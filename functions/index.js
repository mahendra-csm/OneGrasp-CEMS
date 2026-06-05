/**
 * OneGrasp CEMS — Cloud Functions
 * Email sending engine, queue/throttle, tracking pixel, automation runner.
 *
 * Deploy:  firebase deploy --only functions
 * Secrets: firebase functions:secrets:set SENDGRID_API_KEY
 *
 * Note: scheduled functions + outbound network require the Blaze plan.
 */
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");

/* ----------------------------------------------------------------- *
 * Provider abstraction — swap in SES / SMTP as needed.              *
 * ----------------------------------------------------------------- */
async function sendViaSendGrid(apiKey, { to, from, subject, html }) {
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from },
      subject,
      content: [{ type: "text/html", value: html }],
    }),
  });
  if (!res.ok) throw new Error(`SendGrid ${res.status}: ${await res.text()}`);
}

function renderTemplate(str = "", contact = {}) {
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const map = {
      first_name: contact.firstName, organization: contact.organization,
      conference_name: contact.interest, event_date: contact.eventDate || "",
    };
    return map[k] ?? "";
  });
}

/* ----------------------------------------------------------------- *
 * Queue worker — runs every 5 min, respects daily limit & throttle. *
 * Picks queued jobs from `send_queue`, sends, logs to `email_logs`. *
 * ----------------------------------------------------------------- */
exports.processSendQueue = onSchedule(
  { schedule: "every 5 minutes", secrets: [SENDGRID_API_KEY] },
  async () => {
    const cfgSnap = await db.doc("smtp_configs/default").get();
    const cfg = cfgSnap.exists ? cfgSnap.data() : { dailyLimit: 2000, fromEmail: "conferences@onegrasp.com" };

    // How many already sent today?
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const sentToday = (await db.collection("email_logs")
      .where("event", "==", "sent")
      .where("ts", ">=", startOfDay).count().get()).data().count;

    const remaining = Math.max(0, (cfg.dailyLimit || 2000) - sentToday);
    if (remaining === 0) return;

    const batchSize = Math.min(remaining, 50); // throttled chunk per run
    const jobs = await db.collection("send_queue")
      .where("status", "==", "queued").limit(batchSize).get();

    const suppressed = new Set(
      (await db.collection("suppression").get()).docs.map((d) => d.data().email)
    );

    for (const job of jobs.docs) {
      const j = job.data();
      if (suppressed.has((j.to || "").toLowerCase())) {
        await job.ref.update({ status: "suppressed" });
        continue;
      }
      try {
        await sendViaSendGrid(SENDGRID_API_KEY.value(), {
          to: j.to, from: cfg.fromEmail,
          subject: renderTemplate(j.subject, j.contact),
          html: renderTemplate(j.html, j.contact) + trackingPixel(job.id),
        });
        await job.ref.update({ status: "sent", sentAt: admin.firestore.FieldValue.serverTimestamp() });
        await db.collection("email_logs").add({
          jobId: job.id, campaignId: j.campaignId, to: j.to,
          event: "sent", ts: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (e) {
        await job.ref.update({ status: "failed", error: String(e) });
        await db.collection("email_logs").add({
          jobId: job.id, campaignId: j.campaignId, to: j.to,
          event: "bounced", ts: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Bounce → blacklist (matches automation spec).
        await db.collection("suppression").add({ email: j.to, reason: "bounced",
          createdAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    }
  }
);

/* ----------------------------------------------------------------- *
 * Open tracking pixel — GET /track?id=JOB_ID                         *
 * ----------------------------------------------------------------- */
function trackingPixel(jobId) {
  return `<img src="https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/track?id=${jobId}" width="1" height="1" style="display:none" alt="" />`;
}

exports.track = onRequest(async (req, res) => {
  const id = req.query.id;
  if (id) {
    const jobSnap = await db.doc(`send_queue/${id}`).get();
    const job = jobSnap.data() || {};
    await db.collection("email_logs").add({
      jobId: id, campaignId: job.campaignId, to: job.to,
      event: "opened", ts: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  // 1x1 transparent GIF
  const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
  res.set("Content-Type", "image/gif").send(gif);
});

/* ----------------------------------------------------------------- *
 * Unsubscribe — GET /unsubscribe?email=...                           *
 * ----------------------------------------------------------------- */
exports.unsubscribe = onRequest(async (req, res) => {
  const email = (req.query.email || "").toLowerCase();
  if (email) {
    await db.collection("suppression").add({ email, reason: "unsubscribe",
      createdAt: admin.firestore.FieldValue.serverTimestamp() });
  }
  res.send("<h2 style='font-family:sans-serif'>You have been unsubscribed from OneGrasp Conference emails.</h2>");
});

/* ----------------------------------------------------------------- *
 * Automation runner — example: enqueue Follow-up A for contacts that *
 * were sent an invite >2 days ago and never opened.                  *
 * ----------------------------------------------------------------- */
exports.runFollowUps = onSchedule("every 24 hours", async () => {
  const twoDaysAgo = new Date(Date.now() - 2 * 864e5);
  const sent = await db.collection("email_logs")
    .where("event", "==", "sent").where("ts", "<=", twoDaysAgo).get();

  for (const log of sent.docs) {
    const l = log.data();
    const opened = await db.collection("email_logs")
      .where("jobId", "==", l.jobId).where("event", "==", "opened").limit(1).get();
    if (opened.empty) {
      await db.collection("send_queue").add({
        to: l.to, campaignId: l.campaignId, status: "queued",
        subject: "Reminder: Your invitation to {{conference_name}}",
        html: "<p>Dear {{first_name}}, we noticed you may have missed our invitation…</p>",
        contact: {}, sequenceStep: "followup_a",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
});
