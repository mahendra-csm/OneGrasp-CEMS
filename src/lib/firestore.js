"use client";

// Client data layer. Same public API as before, but now talks to our secure
// server-side proxy (/api/data/*) instead of hitting Firestore directly. The
// server uses the Admin SDK and enforces the local session + roles.
import { classify } from "./classify";

export { classify };

async function api(path, opts) {
  const res = await fetch(path, { cache: "no-store", ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

const jsonBody = (data) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

/* ------------------------------------------------------------------ *
 * Generic CRUD                                                        *
 * ------------------------------------------------------------------ */
export async function listDocs(col, qs = "") {
  return (await api(`/api/data/${col}${qs}`)).docs;
}

export async function getOne(col, id) {
  return (await api(`/api/data/${col}/${encodeURIComponent(id)}`)).doc;
}

export async function createDoc(col, data) {
  return (await api(`/api/data/${col}`, { method: "POST", ...jsonBody(data) })).id;
}

export async function updateOne(col, id, data) {
  await api(`/api/data/${col}/${encodeURIComponent(id)}`, { method: "PATCH", ...jsonBody(data) });
}

export async function removeOne(col, id) {
  await api(`/api/data/${col}/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/* ------------------------------------------------------------------ *
 * Contacts                                                            *
 * ------------------------------------------------------------------ */
export const listContacts = () => listDocs("contacts");
export const createContact = (c) => createDoc("contacts", c);

export async function bulkInsertContacts(rows) {
  return api("/api/contacts/bulk", { method: "POST", ...jsonBody({ rows }) });
}

// Email-only "set" upload: { name, date, emails[] }.
export async function uploadContactSet({ name, date, emails }) {
  return api("/api/contacts/upload-set", { method: "POST", ...jsonBody({ name, date, emails }) });
}

export const listUploads = () => listDocs("uploads");
export const deleteUploadSet = (id) =>
  api(`/api/uploads/${encodeURIComponent(id)}`, { method: "DELETE" });

/* ------------------------------------------------------------------ *
 * Campaigns / Templates / Automation / Logs / Suppression             *
 * ------------------------------------------------------------------ */
export const listCampaigns = () => listDocs("campaigns");
export const createCampaign = (c) => createDoc("campaigns", { status: "draft", ...c });

export const listTemplates = () => listDocs("templates");
export const createTemplate = (t) => createDoc("templates", t);

export const listAutomations = () => listDocs("automation_rules");
export const createAutomation = (a) => createDoc("automation_rules", a);

export const listEmailLogs = (max = 500) => listDocs("email_logs", `?limit=${max}`);

export const listSuppression = () => listDocs("suppression");
export const addSuppression = (email, reason) =>
  createDoc("suppression", { email: email.toLowerCase().trim(), reason });
