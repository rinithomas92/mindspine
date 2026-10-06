# MindSpine

A Next.js application built from the MindSpine Business Requirements Document. It includes separate patient, practitioner, and administrator workspaces backed by PostgreSQL on Vercel and SQLite for local development.

## Open the application

Live demo: **https://mindspine.vercel.app** (Vercel Hobby, Neon Free PostgreSQL). The local preview runs at **http://127.0.0.1:3000**.

To prepare the local physiotherapist demo account, run `npm run demo:physio`, then choose **Try physiotherapist demo** and **Sign in**. Open **Physiotherapy journey** from the sidebar.

| Role | Email | Local demo password |
| --- | --- | --- |
| Physiotherapist | physio@mindspine.local | PhysioDemo!2026 |

The setup creates or activates only this local demo account. It adds no patients or appointments, refuses PostgreSQL/Vercel/production execution, and does not overwrite an account with changed credentials. Use fictional information in the shared demo. Git does not store database accounts; run this command after a fresh checkout.

## Run on this Windows machine

The system Node installation is version 18. Use the included wrapper, which selects the available bundled Node 24 runtime:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 dev
```

Other supported commands: `build`, `start`, `seed`, `test`, and `typecheck`. Stop an existing preview with Ctrl+C before starting another on the same port.

## Install on another machine

Requires **Node.js 24 or newer**. The application uses `node:sqlite` and the Node runtime; it cannot run on Edge or as a static export.

```bash
npm ci
npm run demo:physio
npm run dev
```

Local development defaults to `data/mindspine.sqlite`; no environment file is required. An optional `.env.local` can set `DATABASE_PATH`. Use `DATABASE_URL` for a separately configured PostgreSQL environment and run `npm run db:migrate` there; the demo setup intentionally refuses that environment.

```bash
npm run typecheck
npm test
npm run build
npm start
```

## Implemented workflows

- Patient registration, sign-in, sign-out, password changes, administrator-assisted password reset, account activation and deactivation.
- Server-enforced roles, patient ownership, practitioner care relationships, and restricted PDF, file, and workbook access.
- Booking from practitioner availability, rescheduling, cancellation, appointment completion, and collision prevention through transactions and unique indexes.
- Patient profiles, medical history, clinical notes, treatment plans, draft/report release, and PDF/JPEG/PNG document uploads up to 5 MB.
- Separate appointment and invoice states. Unpaid invoices are voided on cancellation; paid invoices are not automatically refunded.
- Explicit **offline payment and refund recording** with a receipt reference. These operations record transactions already completed outside the application and do not move money.
- In-app event notifications, unread state, and read acknowledgements.
- Printable PDF clinical reports and invoices, role-scoped Excel exports, activity summaries, and administrator audit history.
- User administration, individual hourly availability slots, clinic name/address, and patient cancellation notice settings.
- Responsive navigation, keyboard-operable dialogs, form validation, empty states, and operation feedback.

## Working assumptions

- One clinic, INR, India Standard Time, 60-minute appointments starting on the hour.
- Three fixed service prices: initial consultation INR 1,500, chiropractic adjustment INR 1,000, progress review INR 800.
- Pay at the clinic; booking does not wait for payment. Patients can change appointments with 24 hours notice by default; administrators can change this setting.
- Staff can override the patient notice window. Staff changes are audited.
- A clinician gains record access through a patient appointment relationship or by registering that new patient. The Add patient action is available across all admin and clinician modules. Administrators have operational and billing access, not clinical record access.
- Clinical amendments are new records; an original note is not silently overwritten. Patient uploads are not enabled.
- Uploaded files are available to the patient and their authorized care team. Individual document release controls are a future extension.

## Connections and production work remaining

This is a functioning local implementation, **not the complete production BRD release**. Payment gateway charging, verified webhooks, automated reconciliation/refunds, email/SMS/WhatsApp/push delivery, timed appointment reminders, calendar synchronization, and laboratory/insurance/EMR connections are not connected. No external messages or payments are simulated as successful.

The deployed app uses Neon PostgreSQL for records, sessions, rate limits, and uploaded document bytes; local development can use SQLite. Vercel Functions and Neon run in Singapore. Database access uses TLS and parameterized queries, with serializable booking transactions. The Vercel deployment requires `DATABASE_URL` and never falls back to ephemeral disk. Before real clinical use, complete backup/restore procedures, monitoring, retention/consent rules, upload malware scanning, load testing, and the approved support model.

Self-service email recovery, native iOS/Android apps, recurring schedule templates, multi-clinic/time-zone support, configurable service/tax pricing, partial payments/refunds, and the proposed uptime/performance/recovery targets remain outside this local implementation. PDF output currently uses a Latin standard font and normalizes unsupported characters; multilingual PDF rendering must be implemented before using non-Latin clinical content. Tax configuration is pending, and generated invoices are explicitly not tax invoices.

For a persistent Node deployment, use HTTPS and the default secure session cookies. `COOKIE_SECURE=false` is an explicit option only for local HTTP production-build testing. The database, sessions, and uploaded documents are private server-side files; protect their directory and do not commit them.

See [BRD coverage](docs/BRD-COVERAGE.md) for requirement-by-requirement status.

## Project structure

```text
src/app/                 App Router pages, authenticated server actions, styles
src/app/api/reports/     Authorized printable PDF generation
src/app/api/export/      Role-scoped Excel export
src/app/api/files/       Authorized file upload and download
src/components/          Role-specific workspace and reusable interface elements
src/lib/                 Database, business rules, authentication, projections
scripts/seed.ts          Fictional demo data and accounts
scripts/dev.ps1          Windows launcher using Node 24
scripts/e2e.mjs          Browser workflow verification against a disposable demo
tests/domain.test.ts     Booking integrity, access, serialization, password tests
data/                   Ignored local database and private uploads
deliverables/            Source BRD
```

## Verification

The core tests check booking collisions, patient impersonation prevention, transactional invoice creation, cancellation policies, rescheduling, paid invoice preservation, access isolation, password hashing, rate limiting, and React-compatible record serialization.

Browser verification covers patient booking/rescheduling/cancellation, persistence after reload, report access denial, practitioner note release, PDF/XLSX parsing, uploads, administrator payment/user management, and a 390-pixel mobile viewport. Use `npm run test:e2e` **only against a disposable seeded demo**; it intentionally creates and changes test records and requires a running server, seeded demo credentials, and Microsoft Edge (change the Playwright channel for other platforms). Set `TEST_URL` and `DATABASE_PATH` together to target that test instance. This is not a load test or a production security assessment.

