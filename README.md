# NudgePay

Automatic, escalating invoice reminders (Day 1 gentle, Day 7 firm, Day 14 final) until the invoice is paid.

## Setup
1. Create a Postgres DB, then `cp server/.env.example server/.env` and fill it in.
2. `cd server && npm install && npm run db:migrate && npm run dev`
3. `cp client/.env.local.example client/.env.local`, then `cd client && npm install && npm run dev`

## Notes
- Worker: `node-cron` daily (`CRON_SCHEDULE`), `noOverlap: true`. Sends only the latest due stage per invoice; `reminder_logs` has `UNIQUE(invoice_id, stage)` so runs are idempotent. In dev, `POST /api/dev/run-worker` (logged in) triggers it.
- Paywall: free = 2 active invoices (enforced server-side, returns 402 `PAYWALL`); Pro unlocks custom schedule, templates, Reply-To and removes the footer.
- Paddle: point the notification destination at `/api/webhooks/paddle`; checkout passes `custom_data.user_id`.
- Not built yet: open/click tracking (needs Resend webhooks), magic-link auth (email+password used).
