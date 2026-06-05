# OneGrasp Conference Email Management System (CEMS)

Enterprise email outreach & attendee-management platform for **OneGrasp Scientific Conferences**.
Built with **Next.js 14 (App Router) + React + Tailwind** on the frontend and **Firebase
(Authentication + Firestore + Cloud Functions)** as the backend — no servers to manage,
no Postgres/Redis to host.

---

## 1. What you get

| Module | Status | Where |
|---|---|---|
| JWT-style auth (Firebase Auth), roles, forgot-password | ✅ working | `login`, `auth-context.jsx` |
| Contacts repository — bulk CSV import, de-dup, verification, search/filter, export | ✅ working | `/contacts` |
| Email verification (client heuristic + Cloud Function hook) | ✅ working | `firestore.js → classify()` |
| Campaign management — create, audience targeting, schedule, pause/resume | ✅ working | `/campaigns` |
| Template editor — placeholders + live preview | ✅ working | `/templates` |
| Automation / follow-up sequence builder | ✅ working | `/automation` |
| Analytics dashboards — open/click/bounce, trends, country breakdown | ✅ working | `/analytics`, `/dashboard` |
| SMTP / provider config + anti-spam sending controls | ✅ working | `/settings` |
| Email sending engine — queue, throttle, daily limits, retry, tracking pixel, unsubscribe | ✅ code (Blaze) | `functions/index.js` |

Everything reads/writes **live Firestore data**. Run the seed script to populate demo data.

---

## 2. Quick start (10 minutes)

### a. Create a Firebase project
1. Go to <https://console.firebase.google.com> → **Add project**.
2. **Build → Authentication → Get started → Email/Password → Enable.**
3. **Build → Firestore Database → Create database** (start in *production* mode).
4. **Project settings → Your apps → Web (`</>`)** → register an app → copy the config.

### b. Configure & run the app
```bash
npm install
cp .env.local.example .env.local      # paste your Firebase web config
npm run dev                           # http://localhost:3000
```
Open the app → **Create account** (the first account is created with `admin` role) → you're in.

### c. Deploy the security rules
```bash
npm install -g firebase-tools
firebase login
firebase use --add                    # pick your project
firebase deploy --only firestore:rules,firestore:indexes
```

### d. Seed demo data (optional)
```bash
npm run seed -- you@onegrasp.com yourPassword
```
Populates 120 contacts, 3 templates, 3 campaigns and 600 tracking events so the dashboards light up.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Next.js (App Router)  ── Tailwind UI, recharts, lucide      │
│  AuthProvider ── Firebase Auth (onAuthStateChanged)          │
│  Data layer  ── src/lib/firestore.js (modular SDK)           │
└───────────────┬─────────────────────────────────────────────┘
                │  (Firestore SDK, secured by rules)
┌───────────────▼─────────────────────────────────────────────┐
│  Firebase                                                    │
│   • Authentication (email/password, roles in /users)         │
│   • Firestore (all collections below)                        │
│   • Cloud Functions (Blaze):                                 │
│       processSendQueue  — every 5 min, throttled sender      │
│       track             — open-tracking pixel                │
│       unsubscribe       — suppression handling               │
│       runFollowUps      — daily behavioural automation       │
│   • Provider: SendGrid / Amazon SES / SMTP (pluggable)       │
└──────────────────────────────────────────────────────────────┘
```

**Why Firebase replaces the original stack:** Auth = Firebase Auth (was JWT),
DB = Firestore (was PostgreSQL), Queue/throttle = Cloud Functions schedulers + a
`send_queue` collection (was Redis + BullMQ). Same behaviour, zero infra to run.

---

## 4. Firestore data model

| Collection | Key fields |
|---|---|
| `users` | `name, email, role` (`admin` \| `user`) |
| `contacts` | `firstName, lastName, email, organization, designation, country, interest, source, tags[], verification, lastContacted` |
| `campaigns` | `name, type, templateId, country, schedule, status, audienceCount, sent, opened, clicked` |
| `templates` | `name, subject, body` (HTML with `{{placeholders}}`) |
| `automation_rules` | `order, trigger, condition, action, icon, enabled` |
| `email_logs` | `jobId, campaignId, to, event` (`sent\|opened\|clicked\|bounced`), `ts` |
| `send_queue` | `to, campaignId, subject, html, contact, status, sequenceStep` |
| `suppression` | `email, reason` (`unsubscribe\|bounced`) |
| `smtp_configs` | `provider, fromName, fromEmail, dailyLimit, throttleSeconds, domainRotation` |

Indexes are pre-declared in `firestore.indexes.json`.

---

## 5. Email sending engine (Cloud Functions)

Outbound email + schedulers require the **Blaze (pay-as-you-go)** plan.

```bash
cd functions && npm install && cd ..
firebase functions:secrets:set SENDGRID_API_KEY     # paste your key
firebase deploy --only functions
```

Flow: a campaign enqueues jobs into `send_queue` → `processSendQueue` runs every
5 minutes, checks the daily limit + suppression list, sends in throttled chunks,
logs each `sent` to `email_logs`, and injects a tracking pixel. Opens hit the
`track` function; bounces auto-add to `suppression` (blacklist). `runFollowUps`
enqueues Follow-up A for invites unopened after 2 days — exactly the spec's logic.

> Replace `YOUR_REGION-YOUR_PROJECT` in `functions/index.js` (tracking pixel URL)
> with your deployed function domain.

### Security note
API keys and SMTP passwords are **never** stored in Firestore — only non-secret
config (provider name, from-address, limits) lives there. Secrets go in
Cloud Functions secrets.

---

## 6. Roles & access

The first registered account is `admin`. Admins can edit SMTP config and write
`email_logs`; regular users manage contacts/campaigns/templates. Change a user's
role by editing their `role` field in the `users` collection (or build a small
admin UI on top of the existing pattern).

---

## 7. CSV import format

Headers (extra columns are ignored, `email` is required):
```
firstName,lastName,email,organization,designation,country,interest,source
```
A ready-to-test file is at `public/sample-contacts.csv`.

---

## 8. Deploy the frontend

**Vercel (recommended):** import the repo, add the `NEXT_PUBLIC_FIREBASE_*` env
vars, deploy. Then add your Vercel domain under **Firebase Auth → Settings →
Authorized domains**.

**Firebase Hosting:** `firebase experiments:enable webframeworks` then
`firebase deploy`.

---

## 9. Roadmap (advanced features scaffolded for later)

- AI subject-line generation & spam-score prediction (call an LLM from a Cloud Function before enqueue).
- Best-send-time optimisation (per-contact engagement histogram from `email_logs`).
- Smart segmentation & engagement scoring (Firestore aggregation + scheduled scoring function).
- Real MX/SMTP verification in a Cloud Function writing back `verification` status.
- Domain rotation across multiple verified sending identities.

---

© OneGrasp Scientific Conferences. Internal use.
