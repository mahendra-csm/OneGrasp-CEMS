"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  Upload, Search, Plus, Users, Loader2, CheckCircle2, Download, Trash2, Calendar, Layers,
  Send, Reply, Ban, MinusCircle, RotateCcw, BellRing,
} from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { StatusBadge, EmptyState } from "@/components/ui";
import {
  listContacts, listUploads, uploadContactSet, deleteUploadSet, createContact, updateOne, classify, removeOne,
} from "@/lib/firestore";
import { ALL_STAGES, FOLLOWUP_STATUSES, followUpStatusFor, stageRank, stageLabel } from "@/lib/stages";

const today = () => new Date().toISOString().slice(0, 10);

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [setFilter, setSetFilter] = useState("all");
  const [toast, setToast] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const load = () => {
    setLoading(true);
    // Load independently so a hiccup in one request never blanks the other.
    listContacts()
      .then(setContacts)
      .catch((e) => { setContacts([]); flash(`Couldn't load contacts: ${e.message || "error"}`); })
      .finally(() => setLoading(false));
    listUploads().then(setUploads).catch(() => setUploads([]));
  };
  useEffect(load, []);

  const sets = useMemo(
    () => [...new Set(contacts.map((c) => c.setName).filter(Boolean))].sort(),
    [contacts]
  );

  // Headline counts by follow-up status.
  const counts = useMemo(() => {
    const c = { total: contacts.length, due: 0, followed_up: 0, replied: 0, awaiting: 0, bounced: 0, no_response: 0 };
    contacts.forEach((x) => { c[x.followUpStatus] = (c[x.followUpStatus] || 0) + 1; });
    return c;
  }, [contacts]);

  // Per-set: total + due counts (live).
  const setStats = useMemo(() => {
    const m = {};
    for (const c of contacts) {
      if (!c.uploadId) continue;
      const s = (m[c.uploadId] ||= { total: 0, due: 0 });
      s.total++;
      if (c.due) s.due++;
    }
    return m;
  }, [contacts]);

  // The work queue: everything due now, most urgent (latest milestone) first.
  const queue = useMemo(
    () => contacts
      .filter((c) => c.due && (setFilter === "all" || c.setName === setFilter))
      .sort((a, b) => stageRank(b.stage) - stageRank(a.stage) || (b.daysSinceUpload - a.daysSinceUpload)),
    [contacts, setFilter]
  );

  const filtered = useMemo(() => {
    const t = q.toLowerCase();
    return contacts.filter((c) => {
      const matchQ = !t || `${c.email} ${c.setName || ""}`.toLowerCase().includes(t);
      const matchStage = stageFilter === "all" || c.stage === stageFilter;
      const matchStatus = statusFilter === "all" || c.followUpStatus === statusFilter;
      const matchSet = setFilter === "all" || c.setName === setFilter;
      return matchQ && matchStage && matchStatus && matchSet;
    });
  }, [contacts, q, stageFilter, statusFilter, setFilter]);

  function flash(msg) { setToast(msg); setTimeout(() => setToast(null), 4000); }

  // Optimistically patch a contact locally + re-derive its follow-up status,
  // then persist. Keeps the queue responsive without a full reload.
  function patchLocal(id, patch) {
    setContacts((list) => list.map((c) => {
      if (c.id !== id) return c;
      const next = { ...c, ...patch };
      next.followUpStatus = followUpStatusFor(next, next.stage);
      next.due = next.followUpStatus === "due";
      return next;
    }));
  }

  async function logFollowUp(c) {
    const patch = { lastFollowUpStage: c.stage, followUpCount: (c.followUpCount || 0) + 1, lastContacted: new Date().toISOString() };
    patchLocal(c.id, patch);
    try { await updateOne("contacts", c.id, patch); } catch { flash("Couldn't save — reloading."); load(); }
  }

  async function setOutcome(c, outcome) {
    patchLocal(c.id, { outcome });
    try { await updateOne("contacts", c.id, { outcome }); } catch { flash("Couldn't save — reloading."); load(); }
  }

  async function logAllInQueue() {
    if (!queue.length) return;
    const ids = queue.map((c) => ({ id: c.id, stage: c.stage, n: (c.followUpCount || 0) + 1 }));
    ids.forEach(({ id, stage, n }) => patchLocal(id, { lastFollowUpStage: stage, followUpCount: n, lastContacted: new Date().toISOString() }));
    try {
      await Promise.all(ids.map(({ id, stage, n }) =>
        updateOne("contacts", id, { lastFollowUpStage: stage, followUpCount: n, lastContacted: new Date().toISOString() })));
      flash(`Logged a follow-up for ${ids.length} contact(s)`);
    } catch { flash("Some updates failed — reloading."); load(); }
  }

  async function del(id) {
    await removeOne("contacts", id);
    setContacts((c) => c.filter((x) => x.id !== id));
  }

  async function delSet(u) {
    const total = setStats[u.id]?.total ?? u.emailCount ?? 0;
    if (!confirm(`Delete set “${u.name}” and its ${total} contact(s)? This cannot be undone.`)) return;
    try {
      const { removed } = await deleteUploadSet(u.id);
      flash(`Deleted “${u.name}” · ${removed} contacts removed`);
      if (setFilter === u.name) setSetFilter("all");
      load();
    } catch (e) { flash(e.message || "Failed to delete set."); }
  }

  function exportCsv() {
    const rows = filtered.map((c) => ({
      email: c.email, set: c.setName || "", day_stage: stageLabel(c.stage), follow_up: c.followUpStatus,
      follow_ups_sent: c.followUpCount || 0, original_sent: c.originalSentAt || c.uploadedAt || c.createdAt || "",
    }));
    const csv = Papa.unparse(rows);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "onegrasp-followups.csv"; a.click();
  }

  const KPIS = [
    { key: "all", label: "Total", value: counts.total, tone: "text-navy-900" },
    { key: "due", label: "Follow-up due", value: counts.due, tone: "text-amber-600" },
    { key: "followed_up", label: "Followed up", value: counts.followed_up, tone: "text-sky-600" },
    { key: "replied", label: "Replied", value: counts.replied, tone: "text-emerald-600" },
  ];

  return (
    <>
      <Topbar
        title="Follow-up Repository"
        subtitle={`${contacts.length.toLocaleString()} sent · ${counts.due} due now`}
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => setShowUpload(true)} className="btn-accent"><Upload size={16} /> Upload Set</button>
            <button onClick={() => setShowAdd(true)} className="btn-ghost"><Plus size={16} /> Add</button>
          </div>
        }
      />

      <div className="space-y-5 p-5 lg:p-8">
        {toast && (
          <div className="flex items-center gap-2 rounded-xl bg-teal-50 px-4 py-3 text-sm font-medium text-teal-700">
            <CheckCircle2 size={16} /> {toast}
          </div>
        )}

        {/* KPIs double as quick filters by follow-up status. */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {KPIS.map((k) => (
            <button key={k.key} onClick={() => setStatusFilter(statusFilter === k.key ? "all" : k.key)}
              className={`card p-4 text-left transition ${statusFilter === k.key ? "ring-2 ring-teal-400" : ""}`}>
              <p className="text-xs font-semibold uppercase text-navy-400">{k.label}</p>
              <p className={`mt-1 font-display text-2xl font-bold ${k.tone}`}>{k.value}</p>
            </button>
          ))}
        </div>

        {/* ---- Follow-up queue: the thing you actually work ---- */}
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-50 p-4">
            <div className="flex items-center gap-2 font-semibold text-navy-800">
              <BellRing size={16} className="text-amber-500" /> Follow-up Queue
              <span className="badge bg-amber-100 text-amber-700">{queue.length}</span>
              {setFilter !== "all" && <span className="text-xs font-normal text-navy-400">· {setFilter}</span>}
            </div>
            {queue.length > 0 && (
              <button onClick={logAllInQueue} className="btn-ghost text-sm"><Send size={14} /> Log follow-up for all</button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-navy-300" /></div>
          ) : !queue.length ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <span className="mb-2 grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-500"><CheckCircle2 size={22} /></span>
              <p className="font-semibold text-navy-800">All caught up</p>
              <p className="text-sm text-navy-400">No follow-ups are due right now.</p>
            </div>
          ) : (
            <ul className="divide-y divide-navy-50">
              {queue.slice(0, 100).map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-amber-50/30">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-navy-900">{c.email}</p>
                    <p className="text-xs text-navy-400">
                      {c.setName || "—"} · sent {c.daysSinceUpload}d ago
                      {c.followUpCount > 0 && ` · ${c.followUpCount} follow-up${c.followUpCount > 1 ? "s" : ""} so far`}
                    </p>
                  </div>
                  <span className="badge bg-amber-100 text-amber-700">{stageLabel(c.stage)} follow-up</span>
                  <FollowUpActions c={c} onLog={logFollowUp} onOutcome={setOutcome} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ---- Upload sets ---- */}
        {uploads.length > 0 && (
          <div className="card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy-700">
              <Layers size={15} className="text-navy-400" /> Upload Sets
              <span className="text-xs font-normal text-navy-400">({uploads.length})</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {uploads.map((u) => {
                const st = setStats[u.id] || { total: u.emailCount || 0, due: 0 };
                const active = setFilter === u.name;
                return (
                  <div key={u.id}
                    className={`rounded-xl border p-3 transition ${active ? "border-teal-300 ring-1 ring-teal-200" : "border-navy-100"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <button onClick={() => setSetFilter(active ? "all" : u.name)} className="min-w-0 text-left">
                        <p className="truncate font-semibold text-navy-900">{u.name}</p>
                        <p className="text-xs text-navy-400">{fmtDate(u.uploadDate)} · {st.total} emails</p>
                      </button>
                      <button onClick={() => delSet(u)} title="Delete set + contacts"
                        className="shrink-0 text-navy-300 hover:text-rose-500"><Trash2 size={15} /></button>
                    </div>
                    <div className="mt-2">
                      {st.due > 0
                        ? <span className="badge bg-amber-100 text-amber-700">{st.due} due</span>
                        : <span className="badge bg-emerald-50 text-emerald-600">all caught up</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ---- Full table ---- */}
        <div className="card">
          <div className="flex flex-wrap items-center gap-3 border-b border-navy-50 p-4">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-navy-100 bg-navy-50/40 px-3 py-2">
              <Search size={16} className="text-navy-300" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email or set…"
                className="w-full bg-transparent text-sm outline-none" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input w-auto">
              <option value="all">All statuses</option>
              {FOLLOWUP_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="input w-auto">
              <option value="all">All days</option>
              {ALL_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <select value={setFilter} onChange={(e) => setSetFilter(e.target.value)} className="input w-auto">
              <option value="all">All sets</option>
              {sets.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={exportCsv} className="btn-ghost"><Download size={16} /> Export</button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-navy-300" /></div>
          ) : !filtered.length ? (
            <EmptyState icon={Users} title="No contacts found"
              hint="Upload an Excel/CSV of already-sent emails. Each starts as ‘Awaiting’, then becomes ‘Follow-up due’ at 2 / 5 / 7 days automatically.">
              <button onClick={() => setShowUpload(true)} className="btn-primary"><Upload size={16} /> Upload Set</button>
            </EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-navy-400">
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Set</th>
                    <th className="px-4 py-3 font-semibold">Day</th>
                    <th className="px-4 py-3 font-semibold">Follow-up</th>
                    <th className="px-4 py-3 font-semibold">Sent</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50">
                  {filtered.slice(0, 200).map((c) => (
                    <tr key={c.id} className={`hover:bg-navy-50/40 ${c.due ? "bg-amber-50/30" : ""}`}>
                      <td className="px-4 py-3 font-medium text-navy-900">{c.email}</td>
                      <td className="px-4 py-3 text-navy-600">{c.setName || "—"}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.stage} /></td>
                      <td className="px-4 py-3"><StatusBadge status={c.followUpStatus} /></td>
                      <td className="px-4 py-3 text-navy-500">
                        {fmtDate(c.originalSentAt || c.uploadedAt || c.createdAt)}
                        <span className="block text-xs text-navy-300">
                          {c.daysSinceUpload}d ago{c.followUpCount ? ` · ${c.followUpCount}↩` : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3"><FollowUpActions c={c} onLog={logFollowUp} onOutcome={setOutcome} compact /></td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => del(c.id)} className="text-navy-300 hover:text-rose-500"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 200 && <p className="p-4 text-center text-xs text-navy-400">Showing first 200 of {filtered.length}. Use search/filters to narrow.</p>}
            </div>
          )}
        </div>
      </div>

      {showUpload && <UploadSetModal onClose={() => setShowUpload(false)}
        onDone={(msg) => { setShowUpload(false); flash(msg); load(); }} />}
      {showAdd && <AddContactModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </>
  );
}

// Quick follow-up actions, used in both the queue and the table.
function FollowUpActions({ c, onLog, onOutcome, compact }) {
  const TERMINAL = c.followUpStatus === "replied" || c.followUpStatus === "bounced" || c.followUpStatus === "no_response";
  if (TERMINAL) {
    return (
      <div className="flex items-center gap-2">
        <StatusBadge status={c.followUpStatus} />
        <button onClick={() => onOutcome(c, "open")} className="text-xs text-navy-400 hover:text-teal-600" title="Reopen">
          <RotateCcw size={14} />
        </button>
      </div>
    );
  }
  const cls = "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button onClick={() => onLog(c)} title="Log a follow-up sent"
        className={`${cls} ${c.due ? "bg-teal-600 text-white hover:bg-teal-700" : "bg-navy-50 text-navy-600 hover:bg-navy-100"}`}>
        <Send size={13} /> {compact ? "" : "Log follow-up"}
      </button>
      <button onClick={() => onOutcome(c, "replied")} title="Mark replied"
        className={`${cls} bg-emerald-50 text-emerald-600 hover:bg-emerald-100`}><Reply size={13} /></button>
      <button onClick={() => onOutcome(c, "bounced")} title="Mark bounced"
        className={`${cls} bg-rose-50 text-rose-500 hover:bg-rose-100`}><Ban size={13} /></button>
      <button onClick={() => onOutcome(c, "no_response")} title="Mark no response"
        className={`${cls} bg-navy-50 text-navy-500 hover:bg-navy-100`}><MinusCircle size={13} /></button>
    </div>
  );
}

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Pull every email-looking cell out of a parsed sheet (works regardless of
// header name / column position — the sheets have an email column only).
function extractEmails(rows2d) {
  const out = [];
  for (const row of rows2d) {
    for (const cell of row) {
      const v = String(cell ?? "").trim();
      if (EMAIL_RE.test(v)) out.push(v);
    }
  }
  return [...new Set(out.map((e) => e.toLowerCase()))];
}

function UploadSetModal({ onClose, onDone }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState(today());
  const [emails, setEmails] = useState([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef();

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(""); setFileName(file.name);
    if (!name) setName(file.name.replace(/\.[^.]+$/, ""));
    try {
      const ext = file.name.split(".").pop().toLowerCase();
      let rows;
      if (ext === "csv") {
        const text = await file.text();
        rows = Papa.parse(text, { skipEmptyLines: true }).data;
      } else {
        const wb = XLSX.read(await file.arrayBuffer());
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
      }
      const found = extractEmails(rows);
      setEmails(found);
      if (!found.length) setErr("No valid emails found in this file.");
    } catch {
      setErr("Couldn't read that file. Use .csv, .xlsx or .xls.");
      setEmails([]);
    }
  }

  async function submit() {
    setBusy(true); setErr("");
    try {
      const { inserted, skipped } = await uploadContactSet({ name, date, emails });
      onDone(`“${name || "Untitled set"}” uploaded · ${inserted} added · ${skipped} duplicates skipped`);
    } catch (e) {
      setErr(e.message || "Upload failed."); setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-950/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold text-navy-900">Upload Sent Emails</h3>
        <p className="mt-1 text-sm text-navy-400">Excel/CSV with an email column. The send date drives the automatic 2 / 5 / 7-day follow-up reminders.</p>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-navy-500"><Layers size={13} /> Set name</span>
            <input className="input" placeholder="e.g. Oncology Summit — Batch 1" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-navy-500"><Calendar size={13} /> Date sent</span>
            <input className="input" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </label>

          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" hidden onChange={onFile} />
          <button onClick={() => fileRef.current?.click()} className="btn-ghost w-full justify-center">
            <Upload size={16} /> {fileName || "Choose Excel / CSV file"}
          </button>

          {emails.length > 0 && (
            <div className="rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-700">
              <CheckCircle2 size={14} className="mr-1 inline" /> <b>{emails.length}</b> unique emails ready to import.
            </div>
          )}
          {err && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{err}</div>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={submit} className="btn-primary" disabled={busy || !emails.length || !name.trim()}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Upload {emails.length || ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddContactModal({ onClose, onSaved }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const sentAt = new Date(date).toISOString();
    await createContact({
      firstName: "", lastName: "", email: email.trim(),
      organization: "", designation: "", country: "", interest: "",
      source: "manual", setName: name.trim() || "Manual", uploadId: null,
      uploadedAt: sentAt, originalSentAt: sentAt,
      outcome: "open", lastFollowUpStage: null, followUpCount: 0,
      tags: [], verification: classify(email), lastContacted: null,
    });
    setBusy(false); onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-950/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold text-navy-900">Add Sent Email</h3>
        <div className="mt-4 space-y-3">
          <input className="input" placeholder="Email *" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" placeholder="Set name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-navy-500"><Calendar size={13} /> Date sent</span>
            <input className="input" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} className="btn-primary" disabled={busy || !email.trim()}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Save
          </button>
        </div>
      </div>
    </div>
  );
}
