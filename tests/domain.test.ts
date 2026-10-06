import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
delete process.env.DATABASE_URL;
delete process.env.VERCEL;
process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "mindspine-test-")), "test.sqlite");
const { run, one, all } = await import("../src/lib/db");
const { book, changeAppointment, canAccessPatient, takeRateLimit } = await import("../src/lib/domain");
const { getAppData } = await import("../src/lib/data");
const { hashPassword, verifyPassword } = await import("../src/lib/password");
import type { User } from "../src/lib/types";
const users = [
    ["p1", "Patient One", "patient"],
    ["p2", "Patient Two", "patient"],
    ["c1", "Doctor One", "practitioner"],
    ["c2", "Doctor Two", "practitioner"],
    ["a1", "Admin One", "admin"],
];
for (const [id, name, role] of users)
    await run("INSERT INTO users(id,name,email,password,role,history) VALUES (?,?,?,?,?,?)", id, name, id + "@example.test", hashPassword("Test-password-123"), role, "PRIVATE HISTORY");
const patient = (await one<User>("SELECT * FROM users WHERE id=?", "p1"))!, other = (await one<User>("SELECT * FROM users WHERE id=?", "p2"))!, doctor = (await one<User>("SELECT * FROM users WHERE id=?", "c1"))!, admin = (await one<User>("SELECT * FROM users WHERE id=?", "a1"))!;
const future = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString();
for (let i = 1; i <= 6; i++)
    await run("INSERT INTO slots VALUES (?,?,?)", "slot" + i, "c1", future(i + 2));
test("password hashes are salted and verified without plaintext storage", () => {
    const a = hashPassword("a sufficiently long password"), b = hashPassword("a sufficiently long password");
    assert.notEqual(a, b);
    assert(verifyPassword("a sufficiently long password", a));
    assert(!verifyPassword("incorrect", a));
});
test("patient cannot book as another user; booking creates invoice and notifications atomically", async () => {
    const id = await book(patient, "slot1", "p2", "Initial consultation", "reason");
    const row = (await one<{
        patient_id: string;
    }>("SELECT * FROM appointments WHERE id=?", id))!;
    assert.equal(row.patient_id, "p1");
    assert(await one("SELECT id FROM invoices WHERE appointment_id=?", id));
    assert.equal((await all("SELECT id FROM notifications")).length, 2);
});
test("second booking for an occupied slot fails without extra invoice", async () => {
    await assert.rejects(async () => await book(other, "slot1", "p2", "Initial consultation", ""), /already booked/);
    assert.equal((await all("SELECT id FROM invoices")).length, 1);
});
test("patient record access follows ownership and practitioner relationship", async () => {
    assert(await canAccessPatient(patient, "p1"));
    assert(!await canAccessPatient(patient, "p2"));
    assert(await canAccessPatient(doctor, "p1"));
    assert(!await canAccessPatient(doctor, "p2"));
    assert(!await canAccessPatient(admin, "p1"));
});
test("unauthorized cancellation is rejected and original booking preserved", async () => {
    const a = (await one<{
        id: string;
    }>("SELECT id FROM appointments LIMIT 1"))!;
    await assert.rejects(async () => await changeAppointment(other, a.id, "cancel"), /permission/);
    assert.equal((await one<{
        status: string;
    }>("SELECT status FROM appointments WHERE id=?", a.id))?.status, "confirmed");
});
test("rescheduling updates slot without duplicating invoice and cancellation voids unpaid invoice", async () => {
    const a = (await one<{
        id: string;
    }>("SELECT id FROM appointments LIMIT 1"))!;
    await changeAppointment(patient, a.id, "reschedule", "slot2");
    assert.equal((await all("SELECT id FROM invoices")).length, 1);
    await changeAppointment(patient, a.id, "cancel");
    assert.equal((await one<{
        status: string;
    }>("SELECT status FROM invoices WHERE appointment_id=?", a.id))?.status, "void");
    const replacement = await book(other, "slot2", "p2", "Progress review", "");
    assert(replacement);
});
test("patient cancellation cutoff is enforced and a paid invoice is never automatically refunded", async () => {
    const a = await book(patient, "slot3", "p1", "Progress review", "");
    await run("UPDATE invoices SET status='paid' WHERE appointment_id=?", a);
    await changeAppointment(patient, a, "cancel");
    assert.equal((await one<{
        status: string;
    }>("SELECT status FROM invoices WHERE appointment_id=?", a))?.status, "paid");
    const soon = future(0.1);
    await run("INSERT INTO slots VALUES (?,?,?)", "soon", "c1", soon);
    const b = await book(patient, "soon", "p1", "Progress review", "");
    await assert.rejects(async () => await changeAppointment(patient, b, "cancel"), /hours notice/);
});
test("future visits cannot be marked complete", async () => {
    const a = await book(patient, "slot4", "p1", "Progress review", "");
    await assert.rejects(async () => await changeAppointment(doctor, a, "complete"), /future appointment/);
});
test("SSR data excludes passwords and restricts clinical data", async () => {
    const a = (await one<{
        id: string;
    }>("SELECT id FROM appointments WHERE patient_id=? LIMIT 1", "p1"))!;
    await run("INSERT INTO notes(id,patient_id,practitioner_id,appointment_id,diagnosis,notes,plan,published) VALUES (?,?,?,?,?,?,?,?)", "private-note", "p1", "c1", a.id, "Draft", "Private draft", "Plan", 0);
    const p = await getAppData(patient), adm = await getAppData(admin);
    assert.equal(p.notes.length, 0);
    assert.equal(adm.notes.length, 0);
    assert.equal(adm.patients[0].history, "");
    assert(!JSON.stringify(p).includes("password"));
    assert(p.appointments.every((a) => a.patient_id === "p1"));
});
test("authentication attempts are rate limited", async () => {
    for (let i = 0; i < 10; i++)
        await takeRateLimit("test");
    await assert.rejects(async () => await takeRateLimit("test"), /Too many attempts/);
});
test("database records have plain object prototypes for React serialization", async () => {
    for (const row of await all("SELECT id FROM users"))
        assert.equal(Object.getPrototypeOf(row), Object.prototype);
    assert.equal(Object.getPrototypeOf(await one("SELECT id FROM users LIMIT 1")), Object.prototype);
});

test('clinician-created patients are visible only to their care team and staff creation stays restricted', async()=>{
 const {createManagedUser}=await import('../src/lib/domain');
 const newId=await createManagedUser(doctor,{name:'New patient',email:'created@example.test',role:'patient',password:'A-strong-test-password',phone:'12345'});
 assert.equal(await canAccessPatient(doctor,newId),true);
 const otherDoctor=(await one<User>('SELECT * FROM users WHERE id=?','c2'))!;
 assert.equal(await canAccessPatient(otherDoctor,newId),false);
 assert((await getAppData(doctor)).patients.some(p=>p.id===newId));
 assert(!(await getAppData(otherDoctor)).patients.some(p=>p.id===newId));
 await assert.rejects(()=>createManagedUser(doctor,{name:'Forbidden',email:'staff@example.test',role:'admin',password:'A-strong-test-password',phone:''}));
 await assert.rejects(()=>createManagedUser(patient,{name:'Forbidden',email:'someone@example.test',role:'patient',password:'A-strong-test-password',phone:''}));
 await assert.rejects(()=>createManagedUser(doctor,{name:'Duplicate',email:'created@example.test',role:'patient',password:'A-strong-test-password',phone:''}));
 assert.equal((await all('SELECT * FROM users WHERE email=?','created@example.test')).length,1);
});

test('administrator can create supported clinical specialties without giving them administrator permissions',async()=>{
 const {createManagedUser}=await import('../src/lib/domain');
 const {matchesPortal}=await import('../src/lib/auth-input');
 for(const specialty of ['psychologist','physiotherapist'] as const){
  const newId=await createManagedUser(admin,{name:'Mental health clinician',email:specialty+'@example.test',role:specialty,password:'Strong-test-password-123',phone:''});
  const clinician=(await one<User>('SELECT * FROM users WHERE id=?',newId))!;
  assert.equal(clinician.role,'practitioner');assert.equal(clinician.specialty,specialty);
  assert.equal(matchesPortal(clinician,specialty),true);assert.equal(matchesPortal(clinician,'admin'),false);
  assert.equal(matchesPortal(clinician,specialty==='physiotherapist'?'psychologist':'physiotherapist'),false);
  await assert.rejects(()=>createManagedUser(doctor,{name:'Unauthorized',email:'forbidden-'+specialty+'@example.test',role:specialty,password:'Strong-test-password-123',phone:''}));
 }
});
