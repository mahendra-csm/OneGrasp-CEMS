// Server-only local user store + sessions. Replaces Firebase Auth so the app
// works with built-in default credentials and admin-managed accounts — no
// cloud project required. Persisted to data/users.json.
//
// NOTE: this is a lightweight, file-backed store suitable for a single-instance
// internal deployment. For multi-instance/production use, move to a real DB.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  randomBytes, scryptSync, timingSafeEqual, createHmac, randomUUID,
} from "node:crypto";
import { ALL_FEATURES, FEATURE_KEYS, DEFAULT_CONTRIBUTOR_FEATURES } from "./features";

const DATA_DIR = join(process.cwd(), "data");
const FILE = join(DATA_DIR, "users.json");
const SECRET = process.env.AUTH_SECRET || "onegrasp-cems-dev-secret-change-me";

const DEFAULT_ADMIN = {
  name: "OneGrasp Support",
  email: "support@onegrasp.com",
  password: "OneGrasp@2026",
};

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

// ---- persistence ----
function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}
function seedData() {
  return {
    users: [
      {
        id: randomUUID(),
        name: DEFAULT_ADMIN.name,
        email: DEFAULT_ADMIN.email,
        role: "admin",
        enabled: true,
        features: [...FEATURE_KEYS],
        password: hashPassword(DEFAULT_ADMIN.password),
        createdAt: new Date().toISOString(),
      },
    ],
  };
}
function load() {
  if (!existsSync(FILE)) {
    const data = seedData();
    save(data);
    return data;
  }
  try {
    return JSON.parse(readFileSync(FILE, "utf8"));
  } catch {
    const data = seedData();
    save(data);
    return data;
  }
}
function save(data) {
  ensureDir();
  writeFileSync(FILE, JSON.stringify(data, null, 2));
}

// strip the password hash before anything leaves this module
function publicUser(u) {
  if (!u) return null;
  const { password, ...rest } = u;
  return rest;
}

const sameEmail = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

// ---- queries ----
export function listUsers() {
  return load().users.map(publicUser);
}
export function findById(id) {
  return load().users.find((u) => u.id === id) || null;
}

// ---- auth ----
export function authenticate(email, password) {
  const u = load().users.find((x) => sameEmail(x.email, email));
  if (!u || !u.enabled) return null;
  if (!verifyPassword(password, u.password)) return null;
  return publicUser(u);
}

// ---- admin CRUD ----
export function createUser({ name, email, password, role = "contributor", features }) {
  const data = load();
  if (data.users.some((u) => sameEmail(u.email, email))) throw new Error("EMAIL_TAKEN");
  const isAdmin = role === "admin";
  const u = {
    id: randomUUID(),
    name: name || email,
    email,
    role: isAdmin ? "admin" : "contributor",
    enabled: true,
    features: isAdmin
      ? [...FEATURE_KEYS]
      : sanitizeFeatures(features || DEFAULT_CONTRIBUTOR_FEATURES),
    password: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  data.users.push(u);
  save(data);
  return publicUser(u);
}

export function updateUser(id, patch) {
  const data = load();
  const u = data.users.find((x) => x.id === id);
  if (!u) throw new Error("NOT_FOUND");

  if (patch.name !== undefined) u.name = patch.name;
  if (patch.role !== undefined) {
    u.role = patch.role === "admin" ? "admin" : "contributor";
    if (u.role === "admin") u.features = [...FEATURE_KEYS];
  }
  if (patch.enabled !== undefined) u.enabled = !!patch.enabled;
  if (patch.features !== undefined && u.role !== "admin") {
    u.features = sanitizeFeatures(patch.features);
  }
  if (patch.password) u.password = hashPassword(patch.password);

  // never strand the system without an enabled admin
  if (u.role !== "admin" || u.enabled === false) {
    const liveAdmins = data.users.filter((x) => x.role === "admin" && x.enabled);
    if (liveAdmins.length === 0) throw new Error("LAST_ADMIN");
  }

  save(data);
  return publicUser(u);
}

export function deleteUser(id) {
  const data = load();
  const u = data.users.find((x) => x.id === id);
  if (!u) throw new Error("NOT_FOUND");
  if (u.role === "admin" && data.users.filter((x) => x.role === "admin").length <= 1) {
    throw new Error("LAST_ADMIN");
  }
  data.users = data.users.filter((x) => x.id !== id);
  save(data);
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
export function verifySession(token) {
  if (!token || !token.includes(".")) return null;
  const idx = token.lastIndexOf(".");
  const userId = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = createHmac("sha256", SECRET).update(userId).digest("hex");
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const u = findById(userId);
  if (!u || !u.enabled) return null;
  return publicUser(u);
}

export const SESSION_COOKIE = "cems_session";
