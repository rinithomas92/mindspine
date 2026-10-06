"use server";
import {savePhysioRecord} from "@/lib/physio-domain";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser, createSession, destroySession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { assessmentSchema } from "@/lib/assessment";
import { authInput, matchesPortal } from "@/lib/auth-input";
import { one, run, id, transaction, audit, notify } from "@/lib/db";
import { createManagedUser, authorize, book, changeAppointment, appointmentFor, takeRateLimit, } from "@/lib/domain";
import type { User, Invoice } from "@/lib/types";
const text = z.string().trim().min(1).max(200);
const email = z
    .email()
    .max(200)
    .transform((v) => v.toLowerCase());
const password = z.string().min(12, "Use at least 12 characters.").max(128);
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
    try {
        const data = authInput.parse(payload);
        await takeRateLimit("auth:" + data.email);
        const user = await one<User & { password: string }>("SELECT * FROM users WHERE email=?", data.email);
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
            authorize(user &&
                verifyPassword(data.password, user.password) &&
                user.active === 1, data.register
                    ? "We couldn’t sign you in with these details. If you already have an account, enter its original password. For a password reset, contact your clinic administrator."
                    : "Email or password is incorrect, or the account is inactive.");
            if (!data.register) authorize(matchesPortal(user,data.portal), "This account belongs to a different workspace. Choose the matching sign-in option or contact your clinic administrator.");
            await createSession(user.id);
            await audit(user.id, "account.signed_in", user.id);
        }
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
            case "physio": {
                await savePhysioRecord(user,payload);
                break;
            }
            case "note": {
                authorize(user.role === "practitioner");
                const d = z
                    .object({
                    appointmentId: text,
                    diagnosis: text,
                    notes: z.string().trim().min(1).max(10000),
                    plan: z.string().trim().min(1).max(10000),
                    published: z.boolean(),
                    assessment: assessmentSchema.optional(),
                })
                    .parse(payload);
                if (d.assessment) authorize(user.specialty === "physiotherapist", "These evaluation forms require physiotherapist access.");
                const a = await appointmentFor(user, d.appointmentId);
                authorize(a.status !== "cancelled", "Cannot document a cancelled appointment.");
                await transaction(async () => {
                    const noteId = id("REC");
                    await run("INSERT INTO notes(id,patient_id,practitioner_id,appointment_id,diagnosis,notes,plan,published,assessment_json) VALUES (?,?,?,?,?,?,?,?,?)", noteId, a.patient_id, user.id, a.id, d.diagnosis, d.notes, d.plan, Number(d.published), d.assessment ? JSON.stringify(d.assessment) : "");
                    await audit(user.id, "clinical.note_created", noteId);
                    if (d.published)
                        await notify(a.patient_id, "Your care report is ready", "A new report has been released. View it securely in your care records.");
                });
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
                authorize(user.role === "admin");
                const d = z
                    .object({
                    id: text,
                    action: z.enum(["paid", "refunded"]),
                    reference: z.string().trim().min(3).max(200),
                })
                    .parse(payload);
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
                    phone: z.string().trim().max(30),
                    history: z.string().trim().max(5000),
                })
                    .parse(payload);
                await run("UPDATE users SET name=?,phone=?,history=? WHERE id=?", d.name, d.phone, d.history, user.id);
                await audit(user.id, "profile.updated", user.id);
                break;
            }
            case "password": {
                const d = z
                    .object({ current: z.string().max(128), next: password })
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
                    phone: z.string().trim().max(30).optional().default(""),
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
        return { ok: true, message: "Changes saved successfully." };
    }
    catch (e) {
        return { ok: false, message: errorMessage(e) };
    }
}
