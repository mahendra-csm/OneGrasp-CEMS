/**
 * Seed demo data into Firestore (contacts, templates, campaigns, email_logs)
 * using the Firebase Admin SDK — no Firebase Auth required.
 *
 *   1. Put your service account key at the project root as service-account.json
 *      (Firebase Console → Project Settings → Service accounts → Generate key).
 *   2. npm run seed
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

const KEY_PATH = fileURLToPath(new URL("../service-account.json", import.meta.url));
if (!existsSync(KEY_PATH)) {
  console.error("Missing service-account.json at the project root. See the comment at the top of this file.");
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(readFileSync(KEY_PATH, "utf8"))) });
const db = getFirestore();

const COUNTRIES = ["India", "USA", "UK", "Germany", "Singapore", "UAE", "Australia", "Japan"];
const ORGS = ["IIT Hyderabad", "Stanford Univ.", "Oxford", "Max Planck", "NUS", "Khalifa Univ.", "Univ. of Melbourne", "Univ. of Tokyo"];
const INTERESTS = ["Applied AI", "Biomedical Eng.", "Climate Science", "Materials", "Robotics", "Data Science"];
const rand = (a) => a[Math.floor(Math.random() * a.length)];

const run = async () => {
  console.log("Seeding…");

  // 120 demo contacts
  for (let i = 0; i < 120; i++) {
    const c = i % COUNTRIES.length, valid = Math.random() > 0.12;
    await db.collection("contacts").add({
      firstName: "Researcher", lastName: `#${i + 1}`,
      email: `researcher${i + 1}@example${c}.edu`,
      organization: rand(ORGS), designation: rand(["Professor", "PhD Scholar", "Research Lead", "Dean"]),
      country: rand(COUNTRIES), interest: rand(INTERESTS), source: "import", tags: [],
      verification: valid ? "valid" : rand(["risky", "invalid"]), lastContacted: null,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
  }

  // Templates
  const templates = [
    { name: "Conference Invitation", subject: "You're invited: {{conference_name}}",
      body: "<p>Dear {{first_name}},</p><p>OneGrasp invites you to <b>{{conference_name}}</b> on {{event_date}}.</p>" },
    { name: "Reminder", subject: "Reminder — {{conference_name}} closes soon",
      body: "<p>Dear {{first_name}}, registrations for {{conference_name}} close soon.</p>" },
    { name: "Thank You", subject: "Thank you for registering",
      body: "<p>Dear {{first_name}}, thank you for registering for {{conference_name}}.</p>" },
  ];
  for (const t of templates) await db.collection("templates").add({ ...t, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });

  // Campaigns
  const campaigns = [
    { name: "Applied AI 2026 — Global Invite", type: "Conference Invitation", status: "sending", audienceCount: 480, sent: 480, opened: 196, clicked: 41 },
    { name: "Climate Science — Final Call", type: "Final Call", status: "completed", audienceCount: 320, sent: 320, opened: 142, clicked: 33 },
    { name: "Robotics Summit — Reminder", type: "Reminder", status: "scheduled", audienceCount: 210, sent: 0, opened: 0, clicked: 0 },
  ];
  for (const c of campaigns) await db.collection("campaigns").add({ ...c, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });

  // 600 email_logs over 30 days
  const events = ["sent", "sent", "sent", "opened", "opened", "clicked", "bounced"];
  for (let i = 0; i < 600; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const ts = Timestamp.fromDate(new Date(Date.now() - daysAgo * 864e5));
    await db.collection("email_logs").add({ event: rand(events), to: `r${i}@example.edu`, ts });
  }

  console.log("✅ Seed complete: 120 contacts, 3 templates, 3 campaigns, 600 logs.");
  process.exit(0);
};

run().catch((e) => { console.error(e); process.exit(1); });
