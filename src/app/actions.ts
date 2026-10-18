"use server";
import {savePhysioRecord, deletePhysioRecord} from "@/lib/physio-domain";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser, createSession, destroySession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import {saveClinicalNote, addProgressEntry, deleteClinicalNote, deleteProgressEntry} from "@/lib/clinical-notes";
import { authInput, matchesPortal } from "@/lib/auth-input";
import { one, all, run, id, transaction, audit, notify } from "@/lib/db";
import { createManagedUser, authorize, book, changeAppointment, editAppointmentDetails, deleteAppointment, appointmentFor, takeRateLimit, peekRateLimit, clearRateLimit, canAccessPatient, } from "@/lib/domain";
import type { User, Invoice } from "@/lib/types";
const text = z.string().trim().min(1, "This field is required.").max(200, "Must be 200 characters or fewer.");
const email = z
    .email("Enter a valid email address.")
    .max(200, "Must be 200 characters or fewer.")
    .transform((v) => v.toLowerCase());
const password = z.string().min(8, "Use at least 8 characters, including letters and numbers.").max(15, "Password must be 15 characters or fewer.").regex(/^(?=.*[A-Za-z])(?=.*\d)/, "Use at least 8 characters, including letters and numbers.");
const dob = z.string().trim().max(20).optional().default("").refine((v) => !v || new Date(v).getTime() <= Date.now(), "Date of birth cannot be in the future.");
type Result = {
    ok: boolean;
    message: string;
};
function errorMessage(error: unknown) {
    if (error instanceof z.ZodError)
        return error.issues[0]?.message || "Check your input.";
    if (error instanceof Error &&
        !/SQLITE|constraint|database/i.test(error.message))
        return error.message;
    return "Unable to save. Check your details and try again.";
}
export async function authenticate(payload: unknown): Promise<Result> {
    const data = authInput.parse(payload);
    const limitKey = "auth:" + data.email;
    try {
        await peekRateLimit(limitKey);
        const user = await one<User & { password: string }>("SELECT * FROM users WHERE email=?", data.email);
        if (data.register && user && user.active === 0) {
            await takeRateLimit(limitKey);
            authorize(false, "This email was used by an account that has been removed. Contact your clinic administrator to reactivate it before registering again.");
        }
        if (data.register && !user) {
            password.parse(data.password);
            const name = text.parse(data.name);
            const userId = id("USR");
            await transaction(async () => {
                await run("INSERT INTO users(id,name,email,password,role) VALUES (?,?,?,?,?)", userId, name, data.email, hashPassword(data.password), "patient");
                await audit(userId, "account.registered", userId);
                await notify(userId, "Welcome to MindSpine", "Your care journey starts here. Book your first appointment when you are ready.");
            });
            await createSession(userId);
        }
        else {
            const valid = !!(user && verifyPassword(data.password, user.password) && user.active === 1 && (data.register || matchesPortal(user, data.portal)));
            if (!valid) {
                await takeRateLimit(limitKey);
                authorize(user && verifyPassword(data.password, user.password) && user.active === 1, data.register
                    ? "We couldn’t sign you in with these details. If you already have an account, enter its original password. For a password reset, contact your clinic administrator."
                    : "Email or password is incorrect, or the account is inactive.");
                authorize(false, "This account belongs to a different workspace. Choose the matching sign-in option or contact your clinic administrator.");
            }
            await createSession(user!.id);
            await audit(user!.id, "account.signed_in", user!.id);
        }
        await clearRateLimit(limitKey);
        revalidatePath("/");
        return { ok: true, message: "Signed in." };
    }
    catch (e) {
        return { ok: false, message: errorMessage(e) };
    }
}
export async function logout() {
    await destroySession();
    revalidatePath("/");
}
export async function mutate(action: string, payload: unknown): Promise<Result> {
    try {
        const user = await requireUser();
        switch (action) {
            case "book": {
                const d = z
                    .object({
                    slotId: text,
                    patientId: z.string(),
                    service: text,
                    reason: z.string().trim().max(1000),
                })
                    .parse(payload);
                await book(user, d.slotId, d.patientId, d.service, d.reason);
                break;
            }
            case "appointment": {
                const d = z
                    .object({
                    id: text,
                    action: z.enum(["cancel", "reschedule", "complete"]),
                    slotId: z.string().optional(),
                })
                    .parse(payload);
                await changeAppointment(user, d.id, d.action, d.slotId);
                break;
            }
            case "editAppointment": {
                const d = z.object({ id: text, service: text, reason: z.string().trim().max(2000).default("") }).parse(payload);
                await editAppointmentDetails(user, d.id, d.service, d.reason);
                break;
            }
            case "deleteAppointment": {
                const d = z.object({ id: text }).parse(payload);
                await deleteAppointment(user, d.id);
                break;
            }
            case "physio": {
                await savePhysioRecord(user,payload);
                break;
            }
            case "note": {
                await saveClinicalNote(user,payload);
                break;
            }
            case "progressEntry": {
                await addProgressEntry(user,payload);
                break;
            }
            case "publish": {
                authorize(user.role === "practitioner");
                const d = z.object({ id: text }).parse(payload);
                const n = await one<{
                    patient_id: string;
                    practitioner_id: string;
                    published: number;
                }>("SELECT * FROM notes WHERE id=?", d.id);
                authorize(n && n.practitioner_id === user.id && !n.published);
                await transaction(async () => {
                    await run("UPDATE notes SET published=1 WHERE id=?", d.id);
                    await notify(n.patient_id, "Your care report is ready", "A report is now available in your care records.");
                    await audit(user.id, "clinical.published", d.id);
                });
                break;
            }
            case "invoice": {
                const d = z
                    .object({
                    id: text,
                    action: z.enum(["paid", "refunded"]),
                    reference: z.string().trim().min(3).max(200),
                })
                    .parse(payload);
                authorize(d.action === "paid" ? user.role === "admin" || user.role === "practitioner" : user.role === "admin");
                await transaction(async () => {
                    const invoice = await one<Invoice>("SELECT * FROM invoices WHERE id=?", d.id);
                    authorize(invoice, "Invoice not found.");
                    authorize(d.action === "paid"
                        ? invoice.status === "unpaid"
                        : invoice.status === "paid", "This invoice cannot make that status change.");
                    await run("UPDATE invoices SET status=?,payment_reference=? WHERE id=?", d.action, d.reference, d.id);
                    await audit(user.id, `invoice.offline_${d.action}`, d.id);
                    await notify(invoice.patient_id, "Billing updated", `Your invoice has been marked ${d.action} by the clinic.`);
                });
                break;
            }
            case "read": {
                const d = z.object({ id: z.string() }).parse(payload);
                await run("UPDATE notifications SET is_read=1 WHERE user_id=?" +
                    (d.id ? " AND id=?" : ""), user.id, ...(d.id ? [d.id] : []));
                break;
            }
            case "profile": {
                const d = z
                    .object({
                    name: text,
                    phone: z.string().trim().regex(/^(\d{10})?$/, "Enter a valid 10-digit phone number.").optional().default(""),
                    history: z.string().trim().max(5000),
                })
                    .parse(payload);
                await run("UPDATE users SET name=?,phone=?,history=? WHERE id=?", d.name, d.phone, d.history, user.id);
                await audit(user.id, "profile.updated", user.id);
                break;
            }
            case "patientProfile": {
                authorize(user.role === "admin" || user.role === "practitioner");
                const d = z
                    .object({
                    id: text,
                    name: text,
                    phone: z.string().trim().regex(/^(\d{10})?$/, "Enter a valid 10-digit phone number.").optional().default(""),
                    date_of_birth: dob,
                    gender: z.string().trim().max(40).optional().default(""),
                    history: z.string().trim().max(5000).optional().default(""),
                    referral_source: z.string().trim().max(100).optional().default(""),
                })
                    .parse(payload);
                const target = await one<User>("SELECT * FROM users WHERE id=? AND role='patient' AND active=1", d.id);
                authorize(target, "Patient not found.");
                authorize(user.role === "admin" || await canAccessPatient(user, d.id), "You do not have access to this patient.");
                await transaction(async () => {
                    await run("UPDATE users SET name=?,phone=?,date_of_birth=?,gender=?,history=?,referral_source=? WHERE id=?", d.name, d.phone, d.date_of_birth, d.gender, d.history, d.referral_source, d.id);
                    await audit(user.id, "patient.updated", d.id);
                });
                break;
            }
            case "password": {
                const d = z
                    .object({ current: z.string().max(15), next: password, confirm: z.string().max(15) })
                    .refine((v) => v.next === v.confirm, { message: "New password and confirmation do not match.", path: ["confirm"] })
                    .parse(payload);
                const u = await one<{
                    password: string;
                }>("SELECT password FROM users WHERE id=?", user.id);
                authorize(u && verifyPassword(d.current, u.password), "Current password is incorrect.");
                await run("UPDATE users SET password=? WHERE id=?", hashPassword(d.next), user.id);
                await run("DELETE FROM sessions WHERE user_id=?", user.id);
                await createSession(user.id);
                await audit(user.id, "password.changed", user.id);
                break;
            }
            case "user": {
                authorize(user.role === "admin" || user.role === "practitioner");
                const d = z
                    .object({
                    name: text,
                    email,
                    role: z.enum(["patient", "psychologist", "physiotherapist", "admin"]),
                    password,
                    phone: z.string().trim().regex(/^(\d{10})?$/, "Enter a valid 10-digit phone number.").optional().default(""),
                    date_of_birth: dob,
                    gender: z.string().trim().max(40).optional().default(""),
                    referral_source: z.string().trim().max(100).optional().default(""),
                })
                    .parse(payload);
                await createManagedUser(user,d);
                break;
            }
            case "specialty": {
                authorize(user.role === "admin");
                const d = z.object({id:text,specialty:z.enum(["psychologist","physiotherapist"])}).parse(payload);
                await transaction(async () => {
                    authorize(await one("SELECT id FROM users WHERE id=? AND role='practitioner'",d.id),"Clinician not found.");
                    await run("UPDATE users SET specialty=? WHERE id=?",d.specialty,d.id);
                    await audit(user.id,"clinician.specialty_updated",d.id);
                });
                break;
            }
            case "resetPassword": {
                authorize(user.role === "admin");
                const d = z.object({ id: text, password }).parse(payload);
                authorize(d.id !== user.id, "Change your own password in Settings.");
                authorize(await one("SELECT id FROM users WHERE id=?", d.id), "User not found.");
                await transaction(async () => {
                    await run("UPDATE users SET password=? WHERE id=?", hashPassword(d.password), d.id);
                    await run("DELETE FROM sessions WHERE user_id=?", d.id);
                    await audit(user.id, "password.reset_by_admin", d.id);
                    await notify(d.id, "Your password was reset", "A clinic administrator reset your password. Contact the clinic if you did not request this.");
                });
                break;
            }
            case "shareRecord": {
                const d = z.object({
                    recordType: z.enum(["note", "physio", "invoice"]),
                    channel: z.enum(["email", "whatsapp"]),
                    id: text,
                    contact: z.string().trim().min(1, "This field is required.").max(200),
                }).refine((v) => v.channel === "email" ? /^\S+@\S+\.\S+$/.test(v.contact) : /^[+]?[0-9 ]{7,20}$/.test(v.contact), { message: "Enter a valid contact detail.", path: ["contact"] }).parse(payload);
                let patientId: string;
                if (d.recordType === "invoice") {
                    const invoice = await one<{ patient_id: string }>("SELECT patient_id FROM invoices WHERE id=?", d.id);
                    authorize(invoice, "Invoice not found.");
                    authorize(user.role === "admin" || user.role === "practitioner" || await canAccessPatient(user, invoice.patient_id), "You do not have access to this invoice.");
                    patientId = invoice.patient_id;
                }
                else {
                    const table = d.recordType === "note" ? "notes" : "physio_records";
                    const record = await one<{ patient_id: string }>(`SELECT patient_id FROM ${table} WHERE id=?`, d.id);
                    authorize(record, "Record not found.");
                    authorize(user.role === "admin" || await canAccessPatient(user, record.patient_id), "You do not have access to this record.");
                    patientId = record.patient_id;
                }
                const label = d.recordType === "note" ? "clinical note" : d.recordType === "physio" ? "physiotherapy record" : "invoice";
                const via = d.channel === "email" ? "email" : "WhatsApp";
                await notify(patientId, `${d.recordType === "invoice" ? "Invoice" : "Care record"} shared via ${via}`, `A PDF copy of your ${label} was sent via ${via} to ${d.contact}.`);
                await audit(user.id, `${d.recordType}.shared_${d.channel}`, d.id);
                break;
            }
            case "deleteNote": {
                const d = z.object({ id: text }).parse(payload);
                await deleteClinicalNote(user, d.id);
                break;
            }
            case "deleteProgressEntry": {
                const d = z.object({ noteId: text, index: z.number().int().min(0) }).parse(payload);
                await deleteProgressEntry(user, d.noteId, d.index);
                break;
            }
            case "deletePhysioRecord": {
                const d = z.object({ id: text }).parse(payload);
                await deletePhysioRecord(user, d.id);
                break;
            }
            case "deletePatient": {
                const d = z.object({ id: text }).parse(payload);
                const target = await one<User>("SELECT * FROM users WHERE id=? AND role='patient'", d.id);
                authorize(target, "Patient not found.");
                authorize(user.role === "admin" || await canAccessPatient(user, d.id), "You do not have access to this patient.");
                await transaction(async () => {
                    const future = await all<{ id: string; practitioner_id: string }>("SELECT id,practitioner_id FROM appointments WHERE patient_id=? AND status='confirmed' AND starts_at>?", d.id, new Date().toISOString());
                    for (const a of future) {
                        await run("UPDATE appointments SET status='cancelled' WHERE id=?", a.id);
                        await run("UPDATE invoices SET status='void' WHERE appointment_id=? AND status='unpaid'", a.id);
                        await notify(a.practitioner_id, "Schedule updated", "An appointment has been cancelled because the patient was removed.");
                    }
                    await run("UPDATE users SET active=0 WHERE id=?", d.id);
                    await run("DELETE FROM sessions WHERE user_id=?", d.id);
                    await audit(user.id, "patient.deleted", d.id);
                });
                break;
            }
            case "toggleUser": {
                authorize(user.role === "admin");
                const d = z.object({ id: text }).parse(payload);
                authorize(d.id !== user.id, "You cannot deactivate your own account.");
                const target = await one<User>("SELECT * FROM users WHERE id=?", d.id);
                authorize(target, "User not found.");
                await transaction(async () => {
                    await run("UPDATE users SET active=1-active WHERE id=?", d.id);
                    await run("DELETE FROM sessions WHERE user_id=?", d.id);
                    await audit(user.id, "user.status_changed", d.id);
                });
                break;
            }
            case "slot": {
                authorize(user.role !== "patient");
                const d = z
                    .object({ practitionerId: text, startsAt: z.iso.datetime() })
                    .parse(payload);
                authorize(user.role === "admin" || d.practitionerId === user.id);
                authorize(await one("SELECT id FROM users WHERE id=? AND role='practitioner' AND active=1", d.practitionerId), "Clinician not found.");
                const time = new Date(d.startsAt);
                authorize(time.getTime() > Date.now(), "Choose a future time.");
                authorize(time.getUTCMinutes() === 30 && time.getUTCSeconds() === 0, "Use an hourly clinic slot in India time, such as 10:00.");
                authorize(!await one("SELECT id FROM slots WHERE practitioner_id=? AND starts_at=?", d.practitionerId, d.startsAt), "A slot already exists for this clinician at this time.");
                await run("INSERT INTO slots VALUES (?,?,?)", id("SLT"), d.practitionerId, d.startsAt);
                await audit(user.id, "schedule.slot_added", d.practitionerId);
                break;
            }
            case "deleteSlot": {
                authorize(user.role !== "patient");
                const d = z.object({ id: text }).parse(payload);
                await transaction(async () => {
                    const slot = await one<{
                        practitioner_id: string;
                        starts_at: string;
                    }>("SELECT * FROM slots WHERE id=?", d.id);
                    authorize(slot && (user.role === "admin" || slot.practitioner_id === user.id));
                    authorize(!await one("SELECT id FROM appointments WHERE practitioner_id=? AND starts_at=? AND status!='cancelled'", slot.practitioner_id, slot.starts_at), "This slot has an appointment and cannot be removed.");
                    await run("DELETE FROM slots WHERE id=?", d.id);
                    await audit(user.id, "schedule.slot_removed", d.id);
                });
                break;
            }
            case "settings": {
                authorize(user.role === "admin");
                const d = z
                    .object({
                    clinicName: text,
                    address: text,
                    cancellationHours: z.coerce.number().int().min(0).max(168),
                })
                    .parse(payload);
                await transaction(async () => {
                    for (const [key, value] of Object.entries(d))
                        await run("UPDATE settings SET value=? WHERE key=?", String(value), key);
                    await audit(user.id, "settings.updated", "clinic");
                });
                break;
            }
            default:
                throw new Error("Unknown action.");
        }
        revalidatePath("/");
        const messages: Record<string, string> = {
            book: "Appointment booked successfully.",
            appointment: "Appointment updated successfully.",
            editAppointment: "Appointment details updated.",
            deleteAppointment: "Appointment deleted.",
            slot: "Availability slot added.",
            deleteSlot: "Availability slot removed.",
            note: "Clinical note saved.",
            physio: "Record saved.",
            progressEntry: "Progress entry saved.",
            publish: "Record shared with patient.",
            shareRecord: (payload as { channel?: string })?.channel === "whatsapp" ? "Sent to the patient via WhatsApp." : "Emailed to the patient.",
            deleteNote: "Clinical note deleted.",
            deleteProgressEntry: "Progress entry deleted.",
            deletePhysioRecord: "Record deleted.",
            user: "Account created successfully.",
            patientProfile: "Patient profile updated.",
            deletePatient: "Patient removed.",
            profile: "Profile updated successfully.",
            password: "Password updated successfully.",
            invoice: "Payment recorded successfully.",
            resetPassword: "Password reset successfully.",
            settings: "Clinic settings saved.",
            read: "Notifications updated.",
            specialty: "Specialty updated.",
            toggleUser: "Account status updated.",
        };
        return { ok: true, message: messages[action] || "Changes saved successfully." };
    }
    catch (e) {
        return { ok: false, message: errorMessage(e) };
    }
}
