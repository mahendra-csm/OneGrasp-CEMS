// Server-only user store + sessions, backed by Firestore (Admin SDK). Works on
// read-only/serverless hosts like Vercel — no local files. Replaces Firebase
// Auth so the app uses admin-managed accounts.
//
// All queries are async. Session tokens are HMAC-signed cookie values
// "<userId>.<sig>"; signing is sync, verifying hits Firestore to confirm the
// user still exists and is enabled.

import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "./admin";
import { ALL_FEATURES, FEATURE_KEYS, DEFAULT_CONTRIBUTOR_FEATURES } from "./features";

const SECRET = process.env.AUTH_SECRET || "onegrasp-cems-dev-secret-change-me";
const COLLECTION = "users";

const DEFAULT_ADMIN = {
  name: "OneGrasp Support",
  email: "support@onegrasp.com",
  password: "OneGrasp@2026",
};

const col = () => getAdminDb().collection(COLLECTION);

// ---- password hashing (scrypt, no external deps) ----
function hashPassword(pw) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(pw), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(pw, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const test = scryptSync(String(pw), salt, 64);
  const orig = Buffer.from(hash, "hex");
  return test.length === orig.length && timingSafeEqual(test, orig);
}

// strip the password hash before anything leaves this module
function publicUser(snapOrObj) {
  if (!snapOrObj) return null;
  const data = typeof snapOrObj.data === "function"
    ? { id: snapOrObj.id, ...snapOrObj.data() }
    : snapOrObj;
  const { password, emailLower, ...rest } = data;
  return rest;
}

const norm = (e) => String(e || "").toLowerCase().trim();

// Seed the default admin once, if the collection is empty. Safe to call often.
async function ensureSeed() {
  const any = await col().limit(1).get();
  if (!any.empty) return;
  await col().add({
    name: DEFAULT_ADMIN.name,
    email: DEFAULT_ADMIN.email,
    emailLower: norm(DEFAULT_ADMIN.email),
    role: "admin",
    enabled: true,
    features: [...FEATURE_KEYS],
    password: hashPassword(DEFAULT_ADMIN.password),
    createdAt: FieldValue.serverTimestamp(),
  });
}

async function allUsersRaw() {
  const snap = await col().get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---- queries ----
export async function listUsers() {
  await ensureSeed();
  const users = await allUsersRaw();
  return users.map(publicUser);
}

export async function findById(id) {
  if (!id) return null;
  const snap = await col().doc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

// ---- auth ----
export async function authenticate(email, password) {
  await ensureSeed();
  const snap = await col().where("emailLower", "==", norm(email)).limit(1).get();
  if (snap.empty) return null;
  const u = { id: snap.docs[0].id, ...snap.docs[0].data() };
  if (!u.enabled) return null;
  if (!verifyPassword(password, u.password)) return null;
  return publicUser(u);
}

// ---- admin CRUD ----
export async function createUser({ name, email, password, role = "contributor", features }) {
  const exists = await col().where("emailLower", "==", norm(email)).limit(1).get();
  if (!exists.empty) throw new Error("EMAIL_TAKEN");
  const isAdmin = role === "admin";
  const doc = {
    name: name || email,
    email,
    emailLower: norm(email),
    role: isAdmin ? "admin" : "contributor",
    enabled: true,
    features: isAdmin ? [...FEATURE_KEYS] : sanitizeFeatures(features || DEFAULT_CONTRIBUTOR_FEATURES),
    password: hashPassword(password),
    createdAt: FieldValue.serverTimestamp(),
  };
  const ref = await col().add(doc);
  return publicUser({ id: ref.id, ...doc });
}

export async function updateUser(id, patch) {
  const ref = col().doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("NOT_FOUND");
  const u = { id: snap.id, ...snap.data() };
  const next = {};

  if (patch.name !== undefined) next.name = patch.name;
  if (patch.role !== undefined) {
    next.role = patch.role === "admin" ? "admin" : "contributor";
    if (next.role === "admin") next.features = [...FEATURE_KEYS];
  }
  if (patch.enabled !== undefined) next.enabled = !!patch.enabled;
  const effectiveRole = next.role ?? u.role;
  if (patch.features !== undefined && effectiveRole !== "admin") {
    next.features = sanitizeFeatures(patch.features);
  }
  if (patch.password) next.password = hashPassword(patch.password);

  // never strand the system without an enabled admin
  const merged = { ...u, ...next };
  if (merged.role !== "admin" || merged.enabled === false) {
    const all = await allUsersRaw();
    const liveAdmins = all.filter((x) => (x.id === id ? merged : x))
      .filter((x) => x.role === "admin" && x.enabled);
    if (liveAdmins.length === 0) throw new Error("LAST_ADMIN");
  }

  await ref.set(next, { merge: true });
  return publicUser(merged);
}

export async function deleteUser(id) {
  const ref = col().doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("NOT_FOUND");
  const u = { id: snap.id, ...snap.data() };
  if (u.role === "admin") {
    const all = await allUsersRaw();
    if (all.filter((x) => x.role === "admin").length <= 1) throw new Error("LAST_ADMIN");
  }
  await ref.delete();
}

function sanitizeFeatures(features) {
  if (!Array.isArray(features)) return [];
  return features.filter((k) => ALL_FEATURES.some((f) => f.key === k));
}

// ---- sessions (HMAC-signed cookie value: "<userId>.<sig>") ----
export function signSession(userId) {
  const sig = createHmac("sha256", SECRET).update(userId).digest("hex");
  return `${userId}.${sig}`;
}

export async function verifySession(token) {
  if (!token || !token.includes(".")) return null;
  const idx = token.lastIndexOf(".");
  const userId = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = createHmac("sha256", SECRET).update(userId).digest("hex");
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const u = await findById(userId);
  if (!u || !u.enabled) return null;
  return publicUser(u);
}

export const SESSION_COOKIE = "cems_session";
