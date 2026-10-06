# MindSpine BRD coverage

This matrix distinguishes implemented local workflows from outstanding production requirements. The source is `deliverables/MindSpine_Business_Requirements_Document.docx`, version 0.1.

| Requirement                          | Local implementation                                                          | Remaining work                                                           |
| ------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| BR01 Registration and authentication | Patient registration; all-role sign-in; password change; admin-assisted reset | Email recovery, identity verification process, MFA/SSO decisions         |
| BR02 Authorization                   | Server-side role, owner, and practitioner relationship checks                 | Formal access review and production security assessment                  |
| BR03 Patient profile                 | Name, email identity, phone, history                                          | Agreed required fields, duplicate-patient merge workflow                 |
| BR04 History and documents           | Visit history, authorized clinical history and files                          | Retention, document lifecycle, historical migration                      |
| BR05 Slot management                 | Add/remove hourly slots; occupied slots protected                             | Recurring schedules, buffers, multi-location rules                       |
| BR06 Online booking                  | Atomic appointment/invoice creation; slot conflict prevention                 | Optional prepayment/temporary slot holds                                 |
| BR07 Reschedule and cancel           | Same-practitioner rescheduling; configurable notice cutoff; notifications     | No-show policy and fee rules                                             |
| BR08 Practitioner bookings           | Own bookings, reschedule/cancel, complete past visits                         | Delegated booking permissions if required                                |
| BR09 Clinical documentation          | Notes, summary/diagnosis, treatment plan, author/time                         | Approved templates; formal amendment linkage and sign-off                |
| BR10 Clinical uploads                | PDF/JPEG/PNG; type signature and size validation; access checks               | Malware scanning, object storage, quotas                                 |
| BR11 Patient visibility              | Released clinical notes only                                                  | Clinical owner approval of release policy                                |
| BR12 Bills and invoices              | Linked bills and printable invoice PDFs                                       | Tax-compliant numbering and templates; configurable pricing              |
| BR13 Online payments                 | Not implemented; pay-at-clinic workflow is explicit                           | Provision payment provider and verified checkout                         |
| BR14 Payment confirmation            | Offline receipt reference and separate invoice state                          | Signed webhooks, gateway idempotency, reconciliation queue               |
| BR15 Refunds                         | Records an externally completed full refund                                   | Gateway refund execution, approval limits, partial refunds               |
| BR16 Notifications                   | In-app booking, changes, report release, billing events                       | Scheduled reminders and external delivery                                |
| BR17 Preferences and delivery        | Read/unread in-app state                                                      | Channel consent/preferences, retries, provider receipts                  |
| BR18 Reports and print               | PDF clinical report and invoice download; browser print                       | Approved report templates and multilingual fonts                         |
| BR19 Excel export                    | Practitioner patient/clinical/appointment workbook                            | Approved field lists, large-data export jobs                             |
| BR20 User administration             | Create users, assign role at creation, activate/deactivate, reset passwords   | Editing existing roles and formal onboarding process                     |
| BR21 Schedule administration         | Individual slots; booked slots cannot be removed                              | Bulk changes and affected-patient resolution workflows                   |
| BR22 Analytics                       | Counts, seven-day activity, collections, outstanding invoices                 | Date-range analytics, utilization denominator, formal metric definitions |
| BR23 Configuration                   | Clinic identity, address, cancellation notice                                 | Service catalog, financial, channel and operational settings             |
| BR24 Secure report access            | Authorized API checks, attachment download, export audit                      | Expiring external shares and full record-read audit policy               |

## Nonfunctional requirements

Implemented foundations include hashed passwords, hashed random server-side sessions, HTTP-only SameSite cookies, secure cookies in production, login-attempt throttling, input validation, parameterized SQL, same-origin upload checks, audit events, and transactional consistency. Desktop and mobile views were exercised in a browser.

The demo is deployed on Vercel Hobby with managed environment variables and Neon Free PostgreSQL in Singapore. Records, sessions, rate limits, and document bytes persist in PostgreSQL; SQLite remains a local fallback. Consent/retention/residency policy, complete access auditing, accessibility conformance, malware scanning, verified backups/restoration, monitoring, and support runbooks require production work. The proposed NFR04 performance, NFR05 availability, and NFR06 recovery targets have **not** been demonstrated.

## Local verification results

- Production compilation and TypeScript checks.
- 11 automated core tests passed.
- Browser-to-server-to-database checks for booking, rescheduling, cancellation, uploads, reports, account management, and offline billing.
- Patient and administrator clinical-access denials verified.
- Generated PDF and XLSX files parsed successfully.
- Desktop and 390-pixel mobile layouts inspected; no horizontal page overflow.
- No uncaught browser errors during the final end-to-end run.
- Dependency audit reported zero known vulnerabilities after the ExcelJS transitive UUID update.

These checks establish the local workflows. They are not evidence of full BRD acceptance, load capacity, regulatory compliance, or live integration readiness.

## Cloud deployment verification — 26 September 2026

Production URL: https://mindspine.vercel.app. Vercel production build and type checks passed. Live browser checks passed for all three role sign-ins, booking with a persisted PostgreSQL invoice, reload persistence, PDF parsing, practitioner Excel export, patient/admin clinical access restrictions, and mobile layout. No uncaught browser errors were observed. `scripts/cloud-smoke.mjs` requires an explicitly selected fictional demo URL and database; it creates and removes a uniquely identified test booking while retaining the audit events.
