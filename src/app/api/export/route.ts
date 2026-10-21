import {physioLines} from "@/lib/physio";
import { assessmentLines } from "@/lib/assessment";
import ExcelJS from "exceljs";
import { currentUser } from "@/lib/auth";
import { getAppData } from "@/lib/data";
import { audit } from "@/lib/db";
export const runtime = "nodejs";
export async function GET(request: Request) {
    const user = await currentUser();
    if (!user || user.role === "patient")
        return Response.json({ error: "Staff access required." }, { status: 403 });
    const params = new URL(request.url).searchParams;
    const report = params.get("report") || "all";
    const patientId = params.get("patientId") || "";
    const clinicianId = params.get("clinicianId") || "";
    const start = params.get("start") || "";
    const end = params.get("end") || "";
    const appointmentStatus = params.get("appointmentStatus") || "all";
    const paymentStatus = params.get("paymentStatus") || "all";
    const selectedDatasets = new Set((params.get("datasets") || "patients,clinicians,appointments,billing").split(","));
    const data = await getAppData(user), book = new ExcelJS.Workbook();
    const isOverdue = (a: { status: string; starts_at: string }) => a.status === "confirmed" && new Date(a.starts_at) <= new Date();
    const matchesDate = (value: string) => (!start || value.slice(0, 10) >= start) && (!end || value.slice(0, 10) <= end);
    const appointmentMatches = (a: typeof data.appointments[number]) => {
        const statusMatches = appointmentStatus === "all" || appointmentStatus === a.status || (appointmentStatus === "overdue" && isOverdue(a)) || (appointmentStatus === "upcoming" && a.status === "confirmed" && !isOverdue(a));
        return (!patientId || a.patient_id === patientId) && (!clinicianId || a.practitioner_id === clinicianId) && matchesDate(a.starts_at) && statusMatches;
    };
    const filteredAppointments = data.appointments.filter(appointmentMatches);
    const filteredInvoices = data.invoices.filter((invoice) => {
        const appointment = data.appointments.find((a) => a.id === invoice.appointment_id);
        return (!patientId || invoice.patient_id === patientId) && (!clinicianId || appointment?.practitioner_id === clinicianId) && matchesDate(invoice.created_at) && (paymentStatus === "all" || invoice.status === paymentStatus);
    });
    const filteredPatients = data.patients.filter((p) => !patientId || p.id === patientId).filter((p) => !clinicianId || p.clinicianIds?.includes(clinicianId));
    const filteredClinicians = data.practitioners.filter((p) => !clinicianId || p.id === clinicianId);
    const include = (name: string) => report === "all" || report === "custom" ? selectedDatasets.has(name) : (report === "patient" && name === "patients") || (report === "clinician" && name === "clinicians") || (report === "appointments" && name === "appointments") || (report === "billing" && name === "billing");
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
    if (include("appointments")) sheet("Appointments", [
        "Reference",
        "Patient",
        "Clinician",
        "Date and time UTC",
        "Service",
        "Status",
    ], filteredAppointments.map((a) => [
        a.id,
        a.patient,
        a.practitioner,
        a.starts_at,
        a.service,
        a.status,
    ]));
    if (user.role === "practitioner" && report === "all") {
        sheet("Rehabilitation", ["Reference","Patient","Physiotherapist","Evaluation","Type","Released","Details"], data.physioRecords.map(r=>[r.id,r.patient,r.practitioner,r.assessment_id,r.kind,!!r.published,physioLines(r).join("\n")]));
        sheet("Patients", ["Name", "Email", "Phone", "Medical history"], filteredPatients.map((p) => [p.name, p.email, p.phone, p.history]));
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
    else if (user.role === "admin") {
        if (include("patients")) sheet("Patients", ["Patient ID", "Full Name", "Email", "Phone", "Date of Birth", "Gender", "Created At"], filteredPatients.map((p) => [p.id, p.name, p.email, p.phone, p.date_of_birth, p.gender, p.created_at]));
        if (include("clinicians")) sheet("Clinicians", ["Clinician ID", "Full Name", "Email", "Phone", "Specialty", "Status", "Created At"], filteredClinicians.map((p) => [p.id, p.name, p.email, p.phone, p.specialty, p.active ? "Active" : "Inactive", p.created_at]));
        if (include("users")) sheet("Users", ["User ID", "Full Name", "Email", "Phone", "Role", "Status", "Created At"], data.users.map((p) => [p.id, p.name, p.email, p.phone, p.role, p.active ? "Active" : "Inactive", p.created_at]));
        if (include("billing")) sheet("Billing", ["Invoice", "Patient", "Service", "Amount INR", "Status", "Receipt reference"], filteredInvoices.map((i) => [i.id, i.patient, i.service, i.amount / 100, i.status, i.payment_reference]));
    }
    else
        sheet("Billing", [
            "Invoice",
            "Patient",
            "Service",
            "Amount INR",
            "Status",
            "Receipt reference",
        ], filteredInvoices.map((i) => [
            i.id,
            i.patient,
            i.service,
            i.amount / 100,
            i.status,
            i.payment_reference,
        ]));
    const generatedAt = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    const customFilename = `custom_report_${pad(generatedAt.getDate())}_${pad(generatedAt.getMonth() + 1)}_${String(generatedAt.getFullYear()).slice(-2)}_${pad(generatedAt.getHours())}_${pad(generatedAt.getMinutes())}.xlsx`;
    await audit(user.id, "data.exported", report);
    return new Response(new Uint8Array(await book.xlsx.writeBuffer()), {
        headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${report === "custom" ? customFilename : `${report === "all" ? "mindspine_export" : `${report}_report`}.xlsx`}"`,
            "Cache-Control": "private, no-store",
        },
    });
}

