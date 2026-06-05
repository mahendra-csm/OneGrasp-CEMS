// Server-only data layer. Mirrors the operations the client used to perform
// directly against Firestore, now executed with the Admin SDK behind API
// routes that enforce the local session + roles.
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb, serialize } from "./admin";
import { classify } from "./classify";
import { stageFor, daysSince, followUpStatusFor } from "./stages";

// Whitelisted collections + their default ordering. Anything not listed here
// is rejected (404) so the generic endpoints can't be pointed at arbitrary docs.
const COLLECTIONS = {
  contacts:           { order: ["createdAt", "desc"] },
  campaigns:          { order: ["createdAt", "desc"] },
  templates:          { order: ["createdAt", "desc"] },
  automation_rules:   { order: ["order", "asc"] },
  followup_sequences: { order: ["createdAt", "desc"] },
  uploads:            { order: ["createdAt", "desc"] },
  suppression:        { order: ["createdAt", "desc"] },
  email_logs:         { order: ["ts", "desc"], defaultLimit: 500 },
  smtp_configs:       { order: null },
};

// Writes that require an admin (mirrors the original firestore.rules).
export const ADMIN_WRITE = new Set(["smtp_configs", "email_logs"]);

export function isAllowed(col) {
  return Object.prototype.hasOwnProperty.call(COLLECTIONS, col);
}

function docOut(snap) {
  return { id: snap.id, ...serialize(snap.data()) };
}

export async function listDocs(col, { limit } = {}) {
  const cfg = COLLECTIONS[col];
  let q = getAdminDb().collection(col);
  if (cfg.order) q = q.orderBy(cfg.order[0], cfg.order[1]);
  const lim = limit ?? cfg.defaultLimit;
  if (lim) q = q.limit(Number(lim));
  const snap = await q.get();
  const docs = snap.docs.map(docOut);
  // Contacts carry a *derived* lifecycle stage computed on every read from the
  // upload date — so it advances automatically with no scheduled job. Falls
  // back to createdAt for contacts added before set-uploads existed.
  if (col === "contacts") {
    const now = Date.now();
    for (const d of docs) {
      const base = d.uploadedAt || d.createdAt;
      d.stage = stageFor(base, now);
      d.daysSinceUpload = daysSince(base, now);
      d.followUpStatus = followUpStatusFor(d, d.stage);
      d.due = d.followUpStatus === "due";
    }
  }
  return docs;
}

export async function getOne(col, id) {
  const snap = await getAdminDb().collection(col).doc(id).get();
  return snap.exists ? docOut(snap) : null;
}

export async function createDoc(col, data) {
  const ref = await getAdminDb().collection(col).add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function updateOne(col, id, data) {
  await getAdminDb().collection(col).doc(id).set(
    { ...data, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
}

export async function removeOne(col, id) {
  await getAdminDb().collection(col).doc(id).delete();
}

// Bulk insert contacts from a parsed CSV with naive de-dup by email.
export async function bulkInsertContacts(rows) {
  const db = getAdminDb();
  const existing = await db.collection("contacts").get();
  const seen = new Set(existing.docs.map((d) => (d.data().email || "").toLowerCase()));

  const fresh = (rows || []).filter((r) => {
    const e = (r.email || "").toLowerCase().trim();
    if (!e || seen.has(e)) return false;
    seen.add(e);
    return true;
  });

  for (let i = 0; i < fresh.length; i += 450) {
    const batch = db.batch();
    fresh.slice(i, i + 450).forEach((r) => {
      const ref = db.collection("contacts").doc();
      batch.set(ref, {
        firstName: r.firstName || r.first_name || "",
        lastName: r.lastName || r.last_name || "",
        email: (r.email || "").trim(),
        organization: r.organization || "",
        designation: r.designation || "",
        country: r.country || "",
        interest: r.interest || r.conference_interest || "",
        source: r.source || "import",
        tags: r.tags ? String(r.tags).split(/[;,]/).map((t) => t.trim()) : [],
        verification: classify(r.email),
        lastContacted: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }
  return { inserted: fresh.length, skipped: (rows || []).length - fresh.length };
}

// Import an email-only "set": creates an `uploads` doc (the set) and bulk-inserts
// deduped contacts tagged with the set's id/name and upload date. The upload date
// drives the derived lifecycle stage (see listDocs + lib/stages.js).
export async function importUploadSet({ name, date, emails }) {
  const db = getAdminDb();
  const setName = (name || "").trim() || "Untitled set";
  const uploadedAt = parseDate(date);

  // De-dup against existing contacts AND within this upload.
  const existing = await db.collection("contacts").get();
  const seen = new Set(existing.docs.map((d) => (d.data().email || "").toLowerCase()));

  const fresh = [];
  for (const raw of emails || []) {
    const e = String(raw || "").toLowerCase().trim();
    if (!e || seen.has(e)) continue;
    seen.add(e);
    fresh.push(e);
  }

  const setRef = db.collection("uploads").doc();
  await setRef.set({
    name: setName,
    uploadDate: uploadedAt,
    emailCount: fresh.length,
    submitted: (emails || []).length,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  for (let i = 0; i < fresh.length; i += 450) {
    const batch = db.batch();
    fresh.slice(i, i + 450).forEach((email) => {
      const ref = db.collection("contacts").doc();
      batch.set(ref, {
        firstName: "", lastName: "", email,
        organization: "", designation: "", country: "", interest: "",
        source: "set-upload",
        setName, uploadId: setRef.id, uploadedAt,
        // Follow-up tracking. The original email is treated as already sent on
        // the upload date; outcome/lastFollowUpStage drive the derived status.
        outcome: "open",
        lastFollowUpStage: null,
        followUpCount: 0,
        originalSentAt: uploadedAt,
        tags: [],
        verification: classify(email),
        lastContacted: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }

  return {
    uploadId: setRef.id,
    setName,
    inserted: fresh.length,
    skipped: (emails || []).length - fresh.length,
  };
}

// Delete an upload "set" and every contact that belongs to it (cascade).
export async function deleteUploadSet(uploadId) {
  const db = getAdminDb();
  const members = await db.collection("contacts").where("uploadId", "==", uploadId).get();
  let removed = 0;
  for (let i = 0; i < members.docs.length; i += 450) {
    const batch = db.batch();
    members.docs.slice(i, i + 450).forEach((d) => { batch.delete(d.ref); removed++; });
    await batch.commit();
  }
  await db.collection("uploads").doc(uploadId).delete();
  return { uploadId, removed };
}

// Coerce a YYYY-MM-DD (or ISO/date) into a Firestore Timestamp. Defaults to now.
function parseDate(v) {
  if (!v) return Timestamp.now();
  const t = typeof v === "string" ? Date.parse(v) : new Date(v).getTime();
  return Number.isNaN(t) ? Timestamp.now() : Timestamp.fromMillis(t);
}
