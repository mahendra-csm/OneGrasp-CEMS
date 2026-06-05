// Server-only Firebase Admin SDK init. All Firestore access goes through this
// (the Admin SDK bypasses security rules), so client browsers never touch the
// database directly. Credentials come from a service-account.json at the
// project root (or GOOGLE_APPLICATION_CREDENTIALS).
import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const KEY_PATH = join(process.cwd(), "service-account.json");

const NO_CREDS_MSG =
  "Firebase Admin credentials missing. Either set the FIREBASE_SERVICE_ACCOUNT env var " +
  "to the service-account JSON (recommended for Vercel/hosted), or save the key as " +
  "service-account.json in the project root (local dev). Get one from Firebase Console → " +
  "Project Settings → Service accounts → Generate new private key.";

// Parse the service account from an env var. Accepts either raw JSON or a
// base64-encoded JSON blob (handy when a host mangles newlines in the private key).
function serviceAccountFromEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  const text = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");
  return JSON.parse(text);
}

let _db = null;

export function getAdminDb() {
  if (_db) return _db;
  if (!getApps().length) {
    const fromEnv = serviceAccountFromEnv();
    if (fromEnv) {
      initializeApp({ credential: cert(fromEnv) });
    } else if (existsSync(KEY_PATH)) {
      initializeApp({ credential: cert(JSON.parse(readFileSync(KEY_PATH, "utf8"))) });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      initializeApp({ credential: applicationDefault() });
    } else {
      throw new Error(NO_CREDS_MSG);
    }
  }
  _db = getFirestore();
  return _db;
}

// Recursively convert Firestore Timestamps to ISO strings so results are
// JSON-serializable for the client (pages handle ISO strings via new Date()).
export function serialize(value) {
  if (value == null) return value;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value)) out[k] = serialize(value[k]);
    return out;
  }
  return value;
}
