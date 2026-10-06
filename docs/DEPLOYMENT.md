# Vercel Hobby deployment

- Site: https://mindspine.vercel.app
- Vercel project: `rinithomas92s-projects/mindspine`, Hobby plan.
- Database: `mindspine-db`, Neon `free_v3`, Singapore.
- Node.js: 24.x. Vercel Functions: `sin1`, matching the database region.
- Production environment: `DATABASE_URL` supplied by the Neon integration; `DEMO_MODE=true` for fictional accounts.
- Session cookies remain secure on HTTPS. Do not set `COOKIE_SECURE=false` on Vercel.

## Updating the linked project

Run `npm ci`, `npm test`, `npm run typecheck`, and `npm run build`, then `vercel deploy --prod`. The `.vercel` link is local and ignored by Git. On another machine, run `vercel link` and select the existing MindSpine project.

Schema initialization is explicit, not performed in every request. Pull environment variables into an ignored file with `vercel env pull .env.vercel --environment production`, then run `node --env-file=.env.vercel --import tsx scripts/db-migrate.ts`. The initializer adds missing tables/indexes; future changes to existing columns require deliberate migrations.

Seed only a new fictional demo database with a locally supplied `SEED_PASSWORD`. The seed refuses to overwrite existing users. Do not copy real patient data into this public demo. Environment files, local databases, and QA artifacts are excluded from deployment by `.vercelignore`.

## Verification

`scripts/cloud-smoke.mjs` exercises the live fictional demo using Playwright and verifies PostgreSQL persistence. Supply `TEST_URL` and `DATABASE_URL` explicitly; never point this demo-account test at real clinical data. It removes its test booking and invoice, retaining audit/notification events. Microsoft Edge is the configured local browser.

Online payments and external messaging remain unconnected. This deployment is an evaluation environment, not evidence of full clinical production readiness. Vercel Hobby is intended for personal, non-commercial projects; review Vercel's current plan terms before commercial use.
