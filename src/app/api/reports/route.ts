import {physioLines,physioTitle,type PhysioRecord} from "@/lib/physio";
import { assessmentLines,readAssessment,formTitle } from "@/lib/assessment";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { currentUser } from "@/lib/auth";
import { canAccessPatient, settings } from "@/lib/domain";
import { one, audit } from "@/lib/db";
import type { ClinicalNote, Invoice } from "@/lib/types";
export const runtime = "nodejs";
export async function GET(request: Request) {
    const user = await currentUser();
    if (!user)
        return Response.json({ error: "Sign in required." }, { status: 401 });
    const params = new URL(request.url).searchParams, id = params.get("id") || "", type = params.get("type");
    let content: string[] = [];
    let title = "";
    if (type === "note") {
        const n = await one<ClinicalNote>("SELECT n.*,p.name patient,c.name practitioner FROM notes n JOIN users p ON p.id=n.patient_id JOIN users c ON c.id=n.practitioner_id WHERE n.id=?", id);
        if (!n ||
            !await canAccessPatient(user, n.patient_id) ||
            (user.role === "patient" && !n.published))
            return Response.json({ error: "Report not found." }, { status: 404 });
        title = readAssessment(n.assessment_json) ? formTitle(readAssessment(n.assessment_json)?.type) : "Clinical care report";
        content = [
            `Patient: ${n.patient}`,
            `Clinician: ${n.practitioner}`,
            `Record: ${id}`,
            `Date: ${n.created_at}`,
            `Status: ${n.published ? "Released to patient" : "Draft - clinical use only"}`,
            "",
            "CLINICAL SUMMARY",
            n.diagnosis,
            "",
            "VISIT NOTES",
            n.notes,
            "",
            "TREATMENT PLAN",
            n.plan,
            ...assessmentLines(n.assessment_json),
        ];
    }
    else if (type === "physio") {
        const r=await one<PhysioRecord>("SELECT r.*,p.name patient,c.name practitioner FROM physio_records r JOIN users p ON p.id=r.patient_id JOIN users c ON c.id=r.practitioner_id WHERE r.id=?",id);
        if((user.role==='practitioner'&&user.specialty!=='physiotherapist') || !r || !await canAccessPatient(user,r.patient_id) || (user.role==='patient'&&!r.published)) return Response.json({error:'Report not found.'},{status:404});
        title=physioTitle(r.kind);
        content=[`Patient: ${r.patient}`,`Physiotherapist: ${r.practitioner}`,`Record: ${r.id}`,`Related evaluation: ${r.assessment_id}`,`Created: ${r.created_at}`,`Status: ${r.published?'Released to patient':'Draft - clinical use only'}`,'',...physioLines(r)];
    }
    else if (type === "invoice") {
        const i = await one<Invoice>("SELECT i.*,p.name patient,a.service FROM invoices i JOIN users p ON p.id=i.patient_id JOIN appointments a ON a.id=i.appointment_id WHERE i.id=?", id);
        if (!i ||
            !(user.role === "admin" ||
                (user.role === "patient" && i.patient_id === user.id) || (user.role === "practitioner" && user.specialty === "physiotherapist" && !!await one("SELECT id FROM appointments WHERE id=? AND practitioner_id=?",i.appointment_id,user.id))))
            return Response.json({ error: "Invoice not found." }, { status: 404 });
        title = "Patient invoice";
        content = [
            `Invoice: ${id}`,
            `Patient: ${i.patient}`,
            `Created: ${i.created_at}`,
            "",
            `Service: ${i.service}`,
            `Total: INR ${(i.amount / 100).toFixed(2)}`,
            `Status: ${i.status.toUpperCase()}`,
            `Receipt / reference: ${i.payment_reference || "Not recorded"}`,
            "",
            "Payment is collected at the clinic.",
            "This document reflects the payment status recorded by clinic staff.",
            "Tax configuration is pending; this is not a tax invoice.",
        ];
    }
    else
        return Response.json({ error: "Invalid report type." }, { status: 400 });
    const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const prefs = await settings();
    let page = pdf.addPage([595, 842]), y = 780;
    const safe = (s: string) => s.replace(/[^\x20-\x7E\n]/g, " ");
    function line(text: string, size = 11, emphasis = false) {
        if (y < 65) {
            page = pdf.addPage([595, 842]);
            y = 780;
        }
        page.drawText(safe(text), {
            x: 50,
            y,
            size,
            font: emphasis ? bold : font,
            color: rgb(0.13, 0.2, 0.19),
        });
        y -= size + 9;
    }
    line(prefs.clinicName, 24, true);
    line(prefs.address, 10);
    y -= 12;
    line(title, 18, true);
    y -= 12;
    for (const paragraph of content) {
        const words = safe(paragraph).split(/\s+/);
        let row = "";
        for (const word of words) {
            const trial = row ? row + " " + word : word;
            if (font.widthOfTextAtSize(trial, 11) > 480 && row) {
                line(row);
                row = word;
            }
            else
                row = trial;
        }
        line(row);
    }
    pdf
        .getPages()
        .forEach((p, index) => p.drawText(`MindSpine | ${index + 1} of ${pdf.getPageCount()} | Confidential`, { x: 50, y: 30, size: 8, font, color: rgb(0.45, 0.5, 0.49) }));
    await audit(user.id, "report.downloaded", id);
    return new Response(new Uint8Array(await pdf.save()), {
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="mindspine-${type}-${id}.pdf"`,
            "Cache-Control": "private, no-store",
        },
    });
}

