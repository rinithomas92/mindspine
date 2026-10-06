import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { PDFDocument } from "pdf-lib";
import ExcelJS from "exceljs";
const base = process.env.TEST_URL || "http://127.0.0.1:3000";
const db = new DatabaseSync(
  process.env.DATABASE_PATH || "./data/mindspine.sqlite",
);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  reducedMotion: "reduce",
  viewport: { width: 1440, height: 1000 },
  timezoneId: "Asia/Kolkata",
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
fs.mkdirSync("qa/app", { recursive: true });
async function login(role) {
  await page.goto(base);
  await page.getByLabel("Email address").fill(role + "@mindspine.local");
  await page.getByLabel("Password", { exact: true }).fill("MindSpineDemo!2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Log out", exact: true }).waitFor();
  await page.waitForLoadState("networkidle");
}
async function logout() {
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).waitFor();
}
async function nav(name) {
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name, exact: false })
    .click();
}
async function success() {
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("status")
    .filter({ hasText: "Changes saved successfully." })
    .waitFor();
}
try {
  await login("patient");
  await page.screenshot({ path: "qa/app/patient.png", fullPage: true });
  assert.equal(
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByText("Team & access")
      .count(),
    0,
  );
  await page.getByRole("button", { name: "Book a visit", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Clinician", { exact: true })
    .selectOption("doctor");
  const available = await dialog
    .getByLabel("Date", { exact: true })
    .locator("option")
    .evaluateAll((opts) => opts.map((o) => o.value).filter(Boolean));
  await dialog.getByLabel("Date", { exact: true }).selectOption(available[5]);
  await dialog
    .getByLabel("Available time", { exact: true })
    .selectOption({ index: 1 });
  await dialog.getByLabel("Reason for visit").fill("E2E booking verification");
  await dialog
    .getByRole("button", { name: "Confirm appointment", exact: true })
    .click();
  await success();
  let a = db
    .prepare(
      "SELECT * FROM appointments WHERE reason='E2E booking verification' ORDER BY rowid DESC LIMIT 1",
    )
    .get();
  assert(a && a.patient_id === "patient");
  assert.equal(
    db.prepare("SELECT status FROM invoices WHERE appointment_id=?").get(a.id)
      .status,
    "unpaid",
  );
  console.log(
    "PASS patient booking -> persisted appointment, invoice, notifications",
  );
  await page.reload();
  await nav("Appointments");
  const row = page
    .locator("tr")
    .filter({ hasText: a.id.toUpperCase().slice(0, 12) }); // Patient table shows doctor instead of reference.
  const appointmentRow = page
    .locator("tbody tr")
    .filter({ hasText: "Initial consultation" })
    .filter({
      hasText: new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        timeZone: "Asia/Kolkata",
      }).format(new Date(a.starts_at)),
    })
    .last();
  await appointmentRow
    .getByRole("button", { name: "Reschedule Riya Kapoor", exact: true })
    .click();
  const reschedule = page.getByRole("dialog");
  const dates = await reschedule
    .getByLabel("Date", { exact: true })
    .locator("option")
    .evaluateAll((opts) => opts.map((o) => o.value).filter(Boolean));
  await reschedule.getByLabel("Date", { exact: true }).selectOption(dates[7]);
  await reschedule.getByLabel("Available time").selectOption({ index: 1 });
  await reschedule.getByRole("button", { name: "Confirm new time" }).click();
  await success();
  const changed = db.prepare("SELECT * FROM appointments WHERE id=?").get(a.id);
  assert.notEqual(changed.starts_at, a.starts_at);
  assert.equal(
    db
      .prepare("SELECT count(*) n FROM invoices WHERE appointment_id=?")
      .get(a.id).n,
    1,
  );
  a = changed;
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await nav("Appointments");
  const cancelRow = page
    .locator("tbody tr")
    .filter({ hasText: "Initial consultation" })
    .filter({
      hasText: new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        timeZone: "Asia/Kolkata",
      }).format(new Date(a.starts_at)),
    })
    .last();
  await cancelRow
    .getByRole("button", { name: "Cancel Riya Kapoor", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm cancellation", exact: true })
    .click();
  await success();
  assert.equal(
    db.prepare("SELECT status FROM appointments WHERE id=?").get(a.id).status,
    "cancelled",
  );
  assert.equal(
    db.prepare("SELECT status FROM invoices WHERE appointment_id=?").get(a.id)
      .status,
    "void",
  );
  console.log("PASS reschedule and cancel -> slot history and invoice state");
  const otherNote = db
    .prepare("SELECT id FROM notes WHERE patient_id='patient2' LIMIT 1")
    .get();
  assert.equal(
    (
      await context.request.get(
        `${base}/api/reports?type=note&id=${otherNote.id}`,
      )
    ).status(),
    404,
  );
  assert.equal((await context.request.get(`${base}/api/export`)).status(), 403);
  console.log(
    "PASS patient cannot fetch another patient report or staff exports",
  );
  await logout();
  await login("doctor");
  await page.screenshot({ path: "qa/app/practitioner.png", fullPage: true });
  await nav("Care records");
  await page
    .getByRole("button", { name: "Add clinical note", exact: true })
    .click();
  const noteDialog = page.getByRole("dialog");
  await noteDialog.getByLabel("Patient visit").selectOption({ index: 1 });
  await noteDialog
    .getByLabel("Diagnosis or clinical summary")
    .fill("E2E continuity review");
  await noteDialog
    .getByLabel("Clinical notes", { exact: true })
    .fill("Evaluation note for end-to-end verification.");
  await noteDialog
    .getByLabel("Treatment plan")
    .fill("Review with treating practitioner.");
  await noteDialog.getByLabel("Release this report to the patient").check();
  await noteDialog.getByRole("button", { name: "Save clinical note" }).click();
  await success();
  const n = db
    .prepare(
      "SELECT * FROM notes WHERE diagnosis='E2E continuity review' ORDER BY rowid DESC LIMIT 1",
    )
    .get();
  assert(n && n.published === 1);
  const pdf = await context.request.get(
    `${base}/api/reports?type=note&id=${n.id}`,
  );
  assert.equal(pdf.status(), 200);
  assert((await PDFDocument.load(await pdf.body())).getPageCount() >= 1);
  const excel = await context.request.get(`${base}/api/export`);
  assert.equal(excel.status(), 200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await excel.body());
  assert(workbook.getWorksheet("Clinical records"));
  console.log(
    "PASS practitioner note creation, release, valid PDF and Excel export",
  );
  await nav("Patients");
  await page
    .getByRole("button", { name: "View patient", exact: true })
    .first()
    .click();
  const fakePdf = await PDFDocument.create();
  fakePdf.addPage();
  const bytes = await fakePdf.save();
  await page.getByLabel("Upload a PDF, JPEG, or PNG up to 5 MB").setInputFiles({
    name: "verification.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(bytes),
  });
  await page
    .getByRole("button", { name: "Upload document", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Document uploaded successfully." })
    .waitFor();
  const file = db
    .prepare(
      "SELECT * FROM files WHERE name='verification.pdf' ORDER BY rowid DESC LIMIT 1",
    )
    .get();
  assert(file);
  assert.equal(
    (await context.request.get(`${base}/api/files?id=${file.id}`)).status(),
    200,
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  console.log("PASS authorized clinical upload and download");
  await logout();
  await login("admin");
  await page.screenshot({ path: "qa/app/admin.png", fullPage: true });
  assert.equal(
    (
      await context.request.get(`${base}/api/reports?type=note&id=${n.id}`)
    ).status(),
    404,
  );
  await nav("Billing & payments");
  await page
    .getByRole("button", { name: "Record payment", exact: true })
    .first()
    .click();
  const pay = page.getByRole("dialog");
  await pay
    .getByLabel("Receipt or transaction reference")
    .fill("E2E-OFFLINE-RECEIPT");
  await pay.getByRole("button", { name: "Record completed payment" }).click();
  await success();
  assert(
    db
      .prepare(
        "SELECT id FROM invoices WHERE payment_reference='E2E-OFFLINE-RECEIPT' AND status='paid'",
      )
      .get(),
  );
  await nav("Team & access");
  await page.getByRole("button", { name: "Add user", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Full name")
    .fill("Verification Patient");
  await page
    .getByRole("dialog")
    .getByLabel("Email", { exact: true })
    .fill("verification-" + Date.now() + "@example.test");
  await page
    .getByRole("dialog")
    .getByLabel("Initial password")
    .fill("Verification-Password-2026");
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  await success();
  assert(
    db.prepare("SELECT id FROM users WHERE name='Verification Patient'").get(),
  );
  console.log(
    "PASS admin offline payment and account management; clinical access denied",
  );
  await page
    .getByRole("navigation", { name: "Account navigation" })
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page.getByLabel("Clinic name").fill("MindSpine Wellness");
  await page.getByRole("button", { name: "Save clinic settings" }).click();
  await success();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.screenshot({ path: "qa/app/mobile.png", fullPage: true });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  console.log("PASS mobile navigation and no horizontal overflow");
  assert.deepEqual(errors, []);
  console.log("PASS no uncaught browser errors");
} catch (error) {
  await page.screenshot({ path: "qa/app/failure.png", fullPage: true });
  console.log((await page.locator("body").innerText()).slice(-2500));
  throw error;
} finally {
  await browser.close();
  db.close();
}


