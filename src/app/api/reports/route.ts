import type { PhysioRecord } from "@/lib/physio";
import { noteCareReport, physioCareReport, renderCareReport, renderInvoiceReport } from "@/lib/care-report";
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import { currentUser } from "@/lib/auth";
import { canAccessPatient, settings } from "@/lib/domain";
import { one, audit } from "@/lib/db";
import type { ClinicalNote, Invoice } from "@/lib/types";
export const runtime = "nodejs";

const PAGE_W = 595, PAGE_H = 842;
const MARGIN_X = 50, CONTENT_W = PAGE_W - MARGIN_X * 2;
const BRAND = rgb(0, 0.471, 0.306);
const BRAND_DARK = rgb(0, 0.267, 0.173);
const MINT = rgb(0.925, 0.976, 0.941);
const TEXT = rgb(0.078, 0.149, 0.141);
const MUTED = rgb(0.4, 0.45, 0.44);
const WHITE = rgb(1, 1, 1);

function isHeading(s: string) {
    const t = s.trim();
    return t.length > 0 && t.length < 50 && t === t.toUpperCase() && /[A-Z]/.test(t);
}

function slugify(s: string) {
    return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "patient";
}

function stamp() {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function reportFilename(prefix: string, patientName: string) {
    return `${prefix}_${slugify(patientName)}_${stamp()}.pdf`;
}

export async function GET(request: Request) {
    const user = await currentUser();
    if (!user)
        return Response.json({ error: "Sign in required." }, { status: 401 });
    const params = new URL(request.url).searchParams, id = params.get("id") || "", type = params.get("type");
    let content: string[] = [];
    let meta: [string, string][] = [];
    let title = "";
    if (type === "note") {
        const n = await one<ClinicalNote & { practitioner_logo?: string }>("SELECT n.*,p.name patient,c.name practitioner,c.practitioner_logo FROM notes n JOIN users p ON p.id=n.patient_id JOIN users c ON c.id=n.practitioner_id WHERE n.id=?", id);
        if (!n ||
            !await canAccessPatient(user, n.patient_id) ||
            (user.role === "patient" && !n.published))
            return Response.json({ error: "Report not found." }, { status: 404 });
        const { bytes } = await renderCareReport(noteCareReport(n), { ...(await settings()), logo: n.practitioner_logo });
        await audit(user.id, "report.downloaded", id);
        return new Response(new Uint8Array(bytes), {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `inline; filename="${reportFilename("care_report", n.patient)}"`,
                "Cache-Control": "private, no-store",
            },
        });
    }
    else if (type === "physio") {
        const r=await one<PhysioRecord & { practitioner_logo?: string }>("SELECT r.*,p.name patient,c.name practitioner,c.practitioner_logo FROM physio_records r JOIN users p ON p.id=r.patient_id JOIN users c ON c.id=r.practitioner_id WHERE r.id=?",id);
        if((user.role==='practitioner'&&user.specialty!=='physiotherapist') || !r || !await canAccessPatient(user,r.patient_id) || (user.role==='patient'&&!r.published)) return Response.json({error:'Report not found.'},{status:404});
        const { bytes } = await renderCareReport(physioCareReport(r), { ...(await settings()), logo: r.practitioner_logo });
        await audit(user.id, "report.downloaded", id);
        return new Response(new Uint8Array(bytes), {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `inline; filename="${reportFilename("care_report", r.patient)}"`,
                "Cache-Control": "private, no-store",
            },
        });
    }
    else if (type === "invoice") {
        const i = await one<Invoice & { practitioner_logo?: string }>("SELECT i.*,p.name patient,a.service,c.practitioner_logo FROM invoices i JOIN users p ON p.id=i.patient_id JOIN appointments a ON a.id=i.appointment_id JOIN users c ON c.id=a.practitioner_id WHERE i.id=?", id);
        if (!i ||
            !(user.role === "admin" ||
                (user.role === "patient" && i.patient_id === user.id) || (user.role === "practitioner" && user.specialty === "physiotherapist" && !!await one("SELECT id FROM appointments WHERE id=? AND practitioner_id=?",i.appointment_id,user.id))))
            return Response.json({ error: "Invoice not found." }, { status: 404 });
        const { bytes } = await renderInvoiceReport(i, { ...(await settings()), logo: i.practitioner_logo });
        await audit(user.id, "report.downloaded", id);
        return new Response(new Uint8Array(bytes), {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `inline; filename="${reportFilename("invoice", i.patient)}"`,
                "Cache-Control": "private, no-store",
            },
        });
    }
    else
        return Response.json({ error: "Invalid report type." }, { status: 400 });

    const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const prefs = await settings();
    const safe = (s: string) => s.replace(/[^\x20-\x7E\n]/g, " ");

    function drawLogoMark(page: PDFPage, cx: number, cy: number, r: number) {
        page.drawEllipse({ x: cx, y: cy, xScale: r, yScale: r, color: WHITE, opacity: 0.16 });
        page.drawEllipse({ x: cx, y: cy, xScale: r - 3, yScale: r - 3, color: BRAND_DARK });
        const pts: [number, number][] = [[-r * 0.55, 0], [-r * 0.25, 0], [-r * 0.08, -r * 0.42], [r * 0.08, r * 0.42], [r * 0.25, 0], [r * 0.55, 0]];
        for (let k = 0; k < pts.length - 1; k++) {
            page.drawLine({ start: { x: cx + pts[k][0], y: cy + pts[k][1] }, end: { x: cx + pts[k + 1][0], y: cy + pts[k + 1][1] }, thickness: 1.6, color: WHITE });
        }
    }

    function drawBand(page: PDFPage, full: boolean) {
        const h = full ? 92 : 46;
        page.drawRectangle({ x: 0, y: PAGE_H - h, width: PAGE_W, height: h, color: BRAND });
        const cy = PAGE_H - h / 2;
        drawLogoMark(page, MARGIN_X + (full ? 16 : 12), cy, full ? 18 : 12);
        page.drawText("MindSpine", { x: MARGIN_X + (full ? 44 : 32), y: cy - (full ? 9 : 5), size: full ? 24 : 14, font: bold, color: WHITE });
        if (full)
            page.drawText("A L I G N   ·   H E A L   ·   M O V E   F O R W A R D", { x: MARGIN_X + 44, y: cy - 28, size: 7, font, color: rgb(0.85, 0.95, 0.9) });
        return h;
    }

    let page = pdf.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - drawBand(page, true) - 28;

    page.drawText(safe(prefs.address), { x: MARGIN_X, y, size: 9, font, color: MUTED });
    y -= 22;
    page.drawText(safe(title), { x: MARGIN_X, y, size: 19, font: bold, color: BRAND_DARK });
    y -= 10;
    page.drawLine({ start: { x: MARGIN_X, y }, end: { x: MARGIN_X + CONTENT_W, y }, thickness: 1.4, color: BRAND });
    y -= 22;

    // Meta info card
    const rows = Math.ceil(meta.length / 2);
    const cardH = rows * 32 + 24;
    page.drawRectangle({ x: MARGIN_X, y: y - cardH, width: CONTENT_W, height: cardH, color: MINT });
    meta.forEach(([label, value], idx) => {
        const col = idx % 2, row = Math.floor(idx / 2);
        const cx = MARGIN_X + 20 + col * (CONTENT_W / 2);
        const cy = y - 20 - row * 32;
        page.drawText(safe(label).toUpperCase(), { x: cx, y: cy, size: 8, font: bold, color: BRAND });
        let v = safe(value || "-");
        const maxW = CONTENT_W / 2 - 40;
        while (font.widthOfTextAtSize(v, 11) > maxW && v.length > 3) v = v.slice(0, -2);
        page.drawText(v, { x: cx, y: cy - 14, size: 11, font, color: TEXT });
    });
    y -= cardH + 28;

    function ensureRoom(need: number) {
        if (y - need < 60) {
            page = pdf.addPage([PAGE_W, PAGE_H]);
            y = PAGE_H - drawBand(page, false) - 36;
        }
    }

    function drawHeading(text: string) {
        ensureRoom(40);
        const barH = 22;
        page.drawRectangle({ x: MARGIN_X, y: y - barH + 5, width: CONTENT_W, height: barH, color: MINT });
        page.drawText(safe(text), { x: MARGIN_X + 10, y: y - 11, size: 11, font: bold, color: BRAND_DARK });
        y -= barH + 10;
    }

    function drawParagraph(text: string, font_: PDFFont, size: number, color = TEXT) {
        const words = safe(text).split(/\s+/);
        let row = "";
        const lines: string[] = [];
        for (const word of words) {
            const trial = row ? row + " " + word : word;
            if (font_.widthOfTextAtSize(trial, size) > CONTENT_W - 4 && row) {
                lines.push(row);
                row = word;
            }
            else
                row = trial;
        }
        if (row) lines.push(row);
        for (const l of lines) {
            ensureRoom(size + 9);
            page.drawText(l, { x: MARGIN_X, y, size, font: font_, color });
            y -= size + 9;
        }
    }

    for (const entry of content) {
        const trimmed = entry.trim();
        if (!trimmed) { y -= 8; continue; }
        if (isHeading(trimmed)) { drawHeading(trimmed); continue; }
        drawParagraph(entry, font, 11);
    }

    pdf.getPages().forEach((p, index) => {
        p.drawLine({ start: { x: MARGIN_X, y: 44 }, end: { x: PAGE_W - MARGIN_X, y: 44 }, thickness: 0.6, color: rgb(0.85, 0.89, 0.87) });
        p.drawText(`MindSpine  |  Page ${index + 1} of ${pdf.getPageCount()}  |  Confidential clinical document`, { x: MARGIN_X, y: 30, size: 8, font, color: MUTED });
    });
    await audit(user!.id, "report.downloaded", id);
    return new Response(new Uint8Array(await pdf.save()), {
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="mindspine-${type}-${id}.pdf"`,
            "Cache-Control": "private, no-store",
        },
    });
}
