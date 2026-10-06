import { all, one, run, transaction, id, audit, notify } from "./db";
import { hashPassword } from "./password";
import type { User, Appointment } from "./types";
export const SERVICES = [
    { name: "Initial consultation", amount: 150000, duration: 60 },
    { name: "Chiropractic adjustment", amount: 100000, duration: 60 },
    { name: "Progress review", amount: 80000, duration: 60 },
];
export function authorize(condition: unknown, message = "You do not have permission for this action."): asserts condition {
    if (!condition)
        throw new Error(message);
}
export async function canAccessPatient(user: User, patientId: string) {
    return user.role === "patient"
        ? user.id === patientId
        : user.role === "practitioner" &&
            !!await one("SELECT patient_id FROM appointments WHERE patient_id=? AND practitioner_id=? UNION SELECT patient_id FROM care_links WHERE patient_id=? AND clinician_id=?", patientId, user.id, patientId, user.id);
}
export async function appointmentFor(user: User, appointmentId: string) {
    const a = await one<Appointment>("SELECT * FROM appointments WHERE id=?", appointmentId);
    authorize(a, "Appointment not found.");
    authorize(user.role === "admin" ||
        (user.role === "patient"
            ? a.patient_id === user.id
            : a.practitioner_id === user.id));
    return a;
}
export async function book(user: User, slotId: string, patientId: string, serviceName: string, reason: string) {
    const service = SERVICES.find((s) => s.name === serviceName);
    authorize(service, "Select a valid service.");
    if (user.role === "patient")
        patientId = user.id;
    authorize(await one("SELECT id FROM users WHERE id=? AND role=? AND active=1", patientId, "patient"), "Patient not found.");
    return await transaction(async () => {
        const slot = await one<{
            practitioner_id: string;
            starts_at: string;
        }>("SELECT s.* FROM slots s JOIN users u ON u.id=s.practitioner_id WHERE s.id=? AND u.active=1", slotId);
        authorize(slot, "This appointment slot is no longer available.");
        authorize(user.role !== "practitioner" || slot.practitioner_id === user.id);
        authorize(new Date(slot.starts_at).getTime() > Date.now(), "Choose a future appointment.");
        authorize(!await one("SELECT id FROM appointments WHERE status!='cancelled' AND ((practitioner_id=? AND starts_at=?) OR (patient_id=? AND starts_at=?))", slot.practitioner_id, slot.starts_at, patientId, slot.starts_at), "This time is already booked. Please select another slot.");
        const appointmentId = id("APT");
        await run("INSERT INTO appointments(id,patient_id,practitioner_id,starts_at,service,reason,amount) VALUES (?,?,?,?,?,?,?)", appointmentId, patientId, slot.practitioner_id, slot.starts_at, service.name, reason, service.amount);
        await run("INSERT INTO invoices(id,patient_id,appointment_id,amount) VALUES (?,?,?,?)", id("INV"), patientId, appointmentId, service.amount);
        await notify(patientId, "Appointment confirmed", `Your ${service.name.toLowerCase()} is booked. Payment can be made at the clinic.`);
        await notify(slot.practitioner_id, "New appointment", `A ${service.name.toLowerCase()} has been added to your schedule.`);
        await audit(user.id, "appointment.created", appointmentId);
        return appointmentId;
    });
}
export async function changeAppointment(user: User, appointmentId: string, action: "cancel" | "reschedule" | "complete", slotId?: string) {
    return await transaction(async () => {
        const a = await appointmentFor(user, appointmentId);
        authorize(a.status === "confirmed", "Only confirmed appointments can be changed.");
        if (action === "complete") {
            authorize(user.role !== "patient");
            authorize(new Date(a.starts_at).getTime() <= Date.now(), "A future appointment cannot be completed.");
            await run("UPDATE appointments SET status='completed' WHERE id=?", a.id);
        }
        else {
            const hours = Number((await one<{
                value: string;
            }>("SELECT value FROM settings WHERE key='cancellationHours'"))?.value ?? 24);
            authorize(user.role !== "patient" ||
                new Date(a.starts_at).getTime() - Date.now() >= hours * 3600000, `Changes require at least ${hours} hours notice. Please contact the clinic.`);
            if (action === "cancel") {
                await run("UPDATE appointments SET status='cancelled' WHERE id=?", a.id);
                await run("UPDATE invoices SET status='void' WHERE appointment_id=? AND status='unpaid'", a.id);
            }
            else {
                const slot = await one<{
                    practitioner_id: string;
                    starts_at: string;
                }>("SELECT * FROM slots WHERE id=?", slotId ?? "");
                authorize(slot && slot.practitioner_id === a.practitioner_id, "Choose a slot with the same practitioner.");
                authorize(new Date(slot.starts_at).getTime() > Date.now(), "Choose a future slot.");
                authorize(!await one("SELECT id FROM appointments WHERE status!='cancelled' AND id!=? AND starts_at=? AND (practitioner_id=? OR patient_id=?)", a.id, slot.starts_at, a.practitioner_id, a.patient_id), "This time is already booked.");
                await run("UPDATE appointments SET starts_at=? WHERE id=?", slot.starts_at, a.id);
            }
            await notify(a.patient_id, action === "cancel"
                ? "Appointment cancelled"
                : "Appointment rescheduled", action === "cancel"
                ? "Your appointment has been cancelled. Any paid amount will be reviewed separately by the clinic."
                : "Your appointment time has been updated. Open appointments to see the new time.");
            await notify(a.practitioner_id, "Schedule updated", `An appointment has been ${action === "cancel" ? "cancelled" : "rescheduled"}.`);
        }
        await audit(user.id, `appointment.${action}`, a.id);
    });
}
export async function takeRateLimit(key: string) {
    const now = Date.now();
    const result = await one<{attempts:number}>(`INSERT INTO rate_limits(key,attempts,"window") VALUES (?,1,?)
      ON CONFLICT(key) DO UPDATE SET
      attempts=CASE WHEN rate_limits."window" <= ? THEN 1 ELSE rate_limits.attempts+1 END,
      "window"=CASE WHEN rate_limits."window" <= ? THEN excluded."window" ELSE rate_limits."window" END
      RETURNING attempts`, key, now, now-15*60*1000, now-15*60*1000);
    authorize(result && result.attempts<=10, "Too many attempts. Please try again in 15 minutes.");
}
export async function settings() {
    return Object.fromEntries((await all<{
        key: string;
        value: string;
    }>("SELECT * FROM settings")).map((r) => [
        r.key,
        r.value,
    ]));
}

export async function createManagedUser(actor: User, d: {name:string;email:string;role:'patient'|'psychologist'|'physiotherapist'|'admin';password:string;phone:string}) {
    authorize(actor.role === 'admin' || (actor.role === 'practitioner' && d.role === 'patient'), 'Only administrators can add staff. Clinicians may add patients.');
    return transaction(async () => {
        authorize(!await one('SELECT id FROM users WHERE email=?', d.email), 'This email is already registered. Contact an administrator to manage the existing account.');
        const userId=id('USR');
        const clinical=['psychologist','physiotherapist'].includes(d.role);
        await run('INSERT INTO users(id,name,email,role,password,phone,specialty) VALUES (?,?,?,?,?,?,?)',userId,d.name,d.email,clinical?'practitioner':d.role,hashPassword(d.password),d.phone,clinical?d.role:'');
        if(actor.role==='practitioner')await run('INSERT INTO care_links(patient_id,clinician_id) VALUES (?,?)',userId,actor.id);
        await audit(actor.id,'user.created',userId);
        return userId;
    });
}
