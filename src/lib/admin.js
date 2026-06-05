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
  "Firebase Admin credentials missing. Download a service account key from " +
  "Firebase Console → Project Settings → Service accounts → Generate new private key, " +
  "then save it as service-account.json in the project root and restart the dev server.";

let _db = null;

export function getAdminDb() {
  if (_db) return _db;
  if (!getApps().length) {
    if (existsSync(KEY_PATH)) {
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
