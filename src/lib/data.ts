import { all, audit } from "./db";
import { settings } from "./domain";
import type { AppData, User, Appointment, ClinicalNote, Invoice, Notification, Slot, FileRecord, Audit, } from "./types";
const publicUser = "id,name,email,role,specialty,active,phone,created_at";
export async function getAppData(user: User): Promise<AppData> {
    const apFilter = user.role === "admin"
        ? "1=1"
        : user.role === "patient"
            ? "a.patient_id=?"
            : "a.practitioner_id=?";
    const args = user.role === "admin" ? [] : [user.id];
    const appointments = await all<Appointment>(`SELECT a.*,p.name patient,c.name practitioner FROM appointments a JOIN users p ON p.id=a.patient_id JOIN users c ON c.id=a.practitioner_id WHERE ${apFilter} ORDER BY a.starts_at`, ...args);
    const patients = user.role === "patient"
        ? [user]
        : user.role === "admin"
            ? await all<User>(`SELECT ${publicUser},'' history FROM users WHERE role='patient' ORDER BY name`) : await all<User>(`SELECT ${publicUser},history FROM users WHERE role='patient' AND id IN (SELECT patient_id FROM appointments WHERE practitioner_id=? UNION SELECT patient_id FROM care_links WHERE clinician_id=?) ORDER BY name`, user.id, user.id);
    const notes = user.role === "admin"
        ? []
        : await all<ClinicalNote>(`SELECT n.*,p.name patient,c.name practitioner FROM notes n JOIN users p ON p.id=n.patient_id JOIN users c ON c.id=n.practitioner_id WHERE ${user.role === "patient" ? "n.patient_id=? AND n.published=1" : "n.patient_id IN (SELECT patient_id FROM appointments WHERE practitioner_id=? UNION SELECT patient_id FROM care_links WHERE clinician_id=?)"} ORDER BY n.created_at DESC`, ...user.role === "patient" ? [user.id] : [user.id,user.id]);
    const invoices = user.role === "practitioner"
        ? []
        : await all<Invoice>(`SELECT i.*,p.name patient,a.service FROM invoices i JOIN users p ON p.id=i.patient_id JOIN appointments a ON a.id=i.appointment_id ${user.role === "patient" ? "WHERE i.patient_id=?" : ""} ORDER BY i.created_at DESC`, ...args);
    const prefs = await settings();
    return {
        generatedAt: new Date().toISOString(),
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            specialty: user.specialty,
            active: user.active,
            phone: user.phone,
            history: user.history,
            created_at: user.created_at,
        },
        appointments,
        patients: patients.map((p) => ({
            id: p.id,
            name: p.name,
            email: p.email,
            role: p.role,
            specialty: p.specialty,
            active: p.active,
            phone: p.phone,
            history: p.history,
            created_at: p.created_at,
        })),
        notes,
        invoices,
        users: user.role === "admin"
            ? await all<User>(`SELECT ${publicUser},'' history FROM users ORDER BY role,name`) : [],
        practitioners: await all<User>(`SELECT id,name,role,specialty,active,'' email,'' phone,'' history,created_at FROM users WHERE role='practitioner' AND active=1`),
        notifications: await all<Notification>("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100", user.id),
        slots: await all<Slot>(`SELECT s.*,u.name practitioner,EXISTS(SELECT 1 FROM appointments a WHERE a.practitioner_id=s.practitioner_id AND a.starts_at=s.starts_at AND a.status!='cancelled') booked FROM slots s JOIN users u ON u.id=s.practitioner_id WHERE u.active=1 AND s.starts_at>? ${user.role === "practitioner" ? "AND s.practitioner_id=?" : ""} ORDER BY s.starts_at LIMIT 500`, new Date().toISOString(), ...(user.role === "practitioner" ? [user.id] : [])),
        files: user.role === "admin"
            ? []
            : await all<FileRecord>(`SELECT id,patient_id,name,mime,size,created_at FROM files WHERE ${user.role === "patient" ? "patient_id=?" : "patient_id IN (SELECT patient_id FROM appointments WHERE practitioner_id=? UNION SELECT patient_id FROM care_links WHERE clinician_id=?)"} ORDER BY created_at DESC`, ...user.role === "patient" ? [user.id] : [user.id,user.id]),
        audits: user.role === "admin"
            ? await all<Audit>("SELECT a.id,u.name actor,a.action,a.entity,a.created_at FROM audit a JOIN users u ON u.id=a.actor_id ORDER BY a.rowid DESC LIMIT 60") : [],
        settings: {
            clinicName: prefs.clinicName,
            address: prefs.address,
            cancellationHours: Number(prefs.cancellationHours),
        },
        demo: user.id === "demo-physiotherapist",
    };
}
export async function recordAccess(user: User, entity: string) {
    await audit(user.id, "record.viewed", entity);
}
