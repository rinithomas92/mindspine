import {physioLines} from "@/lib/physio";
import { assessmentLines } from "@/lib/assessment";
import ExcelJS from "exceljs";
import { currentUser } from "@/lib/auth";
import { getAppData } from "@/lib/data";
import { audit } from "@/lib/db";
export const runtime = "nodejs";
export async function GET() {
    const user = await currentUser();
    if (!user || user.role === "patient")
        return Response.json({ error: "Staff access required." }, { status: 403 });
    const data = await getAppData(user), book = new ExcelJS.Workbook();
    book.creator = "MindSpine";
    book.created = new Date();
    function sheet(name: string, headers: string[], rows: unknown[][]) {
        const s = book.addWorksheet(name);
        s.addRow(headers);
        rows.forEach((r) => s.addRow(r));
        s.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
        s.getRow(1).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF22665A" },
        };
        s.columns.forEach((c) => (c.width = 25));
        s.views = [{ state: "frozen", ySplit: 1 }];
        s.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: 1, column: headers.length },
        };
    }
    sheet("Appointments", [
        "Reference",
        "Patient",
        "Clinician",
        "Date and time UTC",
        "Service",
        "Status",
    ], data.appointments.map((a) => [
        a.id,
        a.patient,
        a.practitioner,
        a.starts_at,
        a.service,
        a.status,
    ]));
    if (user.role === "practitioner") {
        sheet("Rehabilitation", ["Reference","Patient","Physiotherapist","Evaluation","Type","Released","Details"], data.physioRecords.map(r=>[r.id,r.patient,r.practitioner,r.assessment_id,r.kind,!!r.published,physioLines(r).join("\n")]));
        sheet("Patients", ["Name", "Email", "Phone", "Medical history"], data.patients.map((p) => [p.name, p.email, p.phone, p.history]));
        sheet("Clinical records", [
            "Reference",
            "Patient",
            "Clinician",
            "Diagnosis",
            "Notes",
            "Plan",
            "Released",
            "Date UTC",
            "Evaluation & progress",
        ], data.notes.map((n) => [
            n.id,
            n.patient,
            n.practitioner,
            n.diagnosis,
            n.notes,
            n.plan,
            !!n.published,
            n.created_at,
            assessmentLines(n.assessment_json).join("\n"),
        ]));
    }
    else
        sheet("Billing", [
            "Invoice",
            "Patient",
            "Service",
            "Amount INR",
            "Status",
            "Receipt reference",
        ], data.invoices.map((i) => [
            i.id,
            i.patient,
            i.service,
            i.amount / 100,
            i.status,
            i.payment_reference,
        ]));
    await audit(user.id, "data.exported", user.role);
    return new Response(new Uint8Array(await book.xlsx.writeBuffer()), {
        headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": 'attachment; filename="mindspine-export.xlsx"',
            "Cache-Control": "private, no-store",
        },
    });
}

