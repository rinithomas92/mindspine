import { all, run, transaction, id, notify, initializeDatabase, closeDatabase } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";
import { SERVICES } from "../src/lib/domain";
const password = process.env.SEED_PASSWORD;
await initializeDatabase();
if (!password || password.length < 12)
    throw new Error("Set SEED_PASSWORD to at least 12 characters.");
if ((await all("SELECT id FROM users LIMIT 1")).length) {
    console.log("Database already contains users. No data changed.");
    process.exit(0);
}
const pwd = hashPassword(password);
const accounts = [
    ["admin", "Ananya Rao", "admin@mindspine.local", "admin"],
    ["doctor", "Dr. Maya Sharma", "doctor@mindspine.local", "practitioner"],
    ["doctor2", "Dr. Arjun Mehta", "arjun@mindspine.local", "practitioner"],
    ["patient", "Riya Kapoor", "patient@mindspine.local", "patient"],
    ["patient2", "Aarav Patel", "aarav@mindspine.local", "patient"],
    ["patient3", "Meera Nair", "meera@mindspine.local", "patient"],
    ["patient4", "Kabir Shah", "kabir@mindspine.local", "patient"],
    ["patient5", "Sara Thomas", "sara@mindspine.local", "patient"],
];
function day(offset: number, hour: number) {
    const local = new Date(Date.now() + offset * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    return new Date(`${local}T${String(hour).padStart(2, "0")}:00:00+05:30`).toISOString();
}
await transaction(async () => {
    for (const [uid, name, email, role] of accounts)
        await run("INSERT INTO users(id,name,email,password,role,phone,history) VALUES (?,?,?,?,?,?,?)", uid, name, email, pwd, role, role === "patient" ? "+91 90000 00000" : "", role === "patient"
            ? "Fictional evaluation record. Desk-based work; occasional lower back discomfort. No known allergies reported."
            : "");
    for (let i = 0; i < 21; i++)
        for (const doctor of ["doctor", "doctor2"])
            for (const hour of [9, 10, 11, 12, 14, 15, 16, 17])
                await run("INSERT INTO slots VALUES (?,?,?)", id("SLT"), doctor, day(i, hour));
    const bookings = [
        [-12, 10, "patient", "doctor", 2],
        [-8, 11, "patient2", "doctor", 0],
        [-5, 14, "patient", "doctor", 1],
        [-4, 10, "patient3", "doctor", 0],
        [-3, 11, "patient4", "doctor", 1],
        [-2, 10, "patient5", "doctor", 2],
        [-1, 11, "patient2", "doctor", 1],
        [0, 9, "patient3", "doctor", 1],
        [0, 11, "patient4", "doctor", 2],
        [0, 14, "patient", "doctor", 1],
        [0, 15, "patient5", "doctor", 0],
        [0, 16, "patient2", "doctor", 2],
        [2, 10, "patient", "doctor", 1],
        [3, 11, "patient3", "doctor2", 0],
        [4, 14, "patient4", "doctor", 2],
        [6, 10, "patient5", "doctor", 1],
    ] as const;
    for (const [offset, hour, patient, doctor, index] of bookings) {
        const service = SERVICES[index], aid = id("APT"), completed = offset < 0;
        await run("INSERT INTO appointments(id,patient_id,practitioner_id,starts_at,service,status,reason,amount) VALUES (?,?,?,?,?,?,?,?)", aid, patient, doctor, day(offset, hour), service.name, completed ? "completed" : "confirmed", "Posture and mobility follow-up", service.amount);
        await run("INSERT INTO invoices(id,patient_id,appointment_id,amount,status,payment_reference) VALUES (?,?,?,?,?,?)", id("INV"), patient, aid, service.amount, completed ? "paid" : "unpaid", completed ? "DEMO-OFFLINE-RECEIPT" : "");
        if (completed)
            await run("INSERT INTO notes(id,patient_id,practitioner_id,appointment_id,diagnosis,notes,plan,published,created_at) VALUES (?,?,?,?,?,?,?,?,?)", id("REC"), patient, doctor, aid, "Postural lower back discomfort", "Fictional clinical note for application evaluation. Patient reports improved comfort since previous visit. Mobility reviewed.", "Continue the clinician-prescribed movement plan. Review progress at the next appointment.", 1, day(offset, hour));
    }
    for (const uid of ["patient", "doctor", "admin"]) {
        await notify(uid, "Welcome to your workspace", "This workspace contains fictional data for evaluating MindSpine.");
        await notify(uid, "Your schedule is ready", "Appointments, care records, and clinic updates are organized in one place.");
    }
    await run("INSERT INTO audit(id,actor_id,action,entity) VALUES (?,?,?,?)", id("log"), "admin", "demo.seeded", "fictional-data");
});
await run("UPDATE users SET specialty='physiotherapist' WHERE id='doctor'");
await run("UPDATE users SET specialty='psychologist' WHERE id='doctor2'");
console.log("Seed complete. Accounts: patient@mindspine.local, doctor@mindspine.local, admin@mindspine.local. Password is SEED_PASSWORD.");
await closeDatabase();
