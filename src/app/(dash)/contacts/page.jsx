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
import {
  ALL_STAGES, FOLLOWUP_STATUSES, FOLLOWUPS, followUpStatusFor, followUpView, followUpNumber, stageLabel,
} from "@/lib/stages";

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

  // Cumulative follow-ups SENT, per F-step (F1 sent = received ≥1 follow-up …).
  const sent = useMemo(() => {
    const s = { f1: 0, f2: 0, f3: 0 };
    for (const c of contacts) {
      const n = c.followUpCount || 0;
      if (n >= 1) s.f1++; if (n >= 2) s.f2++; if (n >= 3) s.f3++;
    }
    return s;
  }, [contacts]);

  // Today's follow-up plan (Account B): due contacts grouped by which F is next.
  const dueByF = useMemo(() => {
    const g = { 1: [], 2: [], 3: [] };
    for (const c of contacts) {
      if (!c.due) continue;
      if (setFilter !== "all" && c.setName !== setFilter) continue;
      g[followUpNumber(c)].push(c);
    }
    return g;
  }, [contacts, setFilter]);

  const totalDue = dueByF[1].length + dueByF[2].length + dueByF[3].length;

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

  const filtered = useMemo(() => {
    const t = q.toLowerCase();
    return contacts.filter((c) => {
      const matchQ = !t || `${c.email} ${c.setName || ""}`.toLowerCase().includes(t);
      const matchStage = stageFilter === "all" || c.stage === stageFilter;
      const matchStatus = statusFilter === "all"
        || (statusFilter === "issues" ? (c.followUpStatus === "bounced" || c.followUpStatus === "no_response")
            : c.followUpStatus === statusFilter);
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

  // Mark a whole F-group as sent (Account B's "send all F1 today" action).
  async function logAllForGroup(list, fn) {
    if (!list.length) return;
    if (!confirm(`Mark Follow-up ${fn} as sent for ${list.length} contact(s)?`)) return;
    const ts = new Date().toISOString();
    const ids = list.map((c) => ({ id: c.id, stage: c.stage, n: (c.followUpCount || 0) + 1 }));
    ids.forEach(({ id, stage, n }) => patchLocal(id, { lastFollowUpStage: stage, followUpCount: n, lastContacted: ts }));
    try {
      await Promise.all(ids.map(({ id, stage, n }) =>
        updateOne("contacts", id, { lastFollowUpStage: stage, followUpCount: n, lastContacted: ts })));
      flash(`Marked F${fn} sent for ${ids.length} contact(s)`);
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
    { key: "all", label: "New Prospects", value: counts.total, tone: "text-navy-900" },
    { key: "due", label: "Follow-up due", value: totalDue, tone: "text-amber-600" },
    { key: "replied", label: "Replied", value: counts.replied, tone: "text-emerald-600" },
    { key: "issues", label: "Bounced / No reply", value: counts.bounced + counts.no_response, tone: "text-rose-500" },
  ];

  return (
    <>
      <Topbar
        title="Follow-up Repository"
        subtitle={`${contacts.length.toLocaleString()} prospects · ${totalDue.toLocaleString()} follow-ups due today`}
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => setShowUpload(true)} className="btn-accent"><Upload size={16} /> Upload Batch</button>
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

        {/* ---- Cumulative follow-ups sent (matches the business plan table) ---- */}
        <div className="grid grid-cols-3 gap-3">
          {FOLLOWUPS.map((f) => (
            <div key={f.n} className="card p-4">
              <p className="text-xs font-semibold uppercase text-navy-400">{f.label} sent</p>
              <p className="mt-1 font-display text-2xl font-bold text-navy-900">{sent[`f${f.n}`].toLocaleString()}</p>
              <p className="text-xs text-navy-400">day {f.day} touch</p>
            </div>
          ))}
        </div>

        {/* ---- Today's follow-up plan (Account B): grouped F1 / F2 / F3 ---- */}
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-50 p-4">
            <div className="flex items-center gap-2 font-semibold text-navy-800">
              <BellRing size={16} className="text-amber-500" /> Today’s Follow-up Plan
              <span className="badge bg-navy-50 text-navy-500">Account B</span>
              <span className="badge bg-amber-100 text-amber-700">{totalDue} due</span>
              {setFilter !== "all" && <span className="text-xs font-normal text-navy-400">· {setFilter}</span>}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-navy-300" /></div>
          ) : totalDue === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <span className="mb-2 grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-500"><CheckCircle2 size={22} /></span>
              <p className="font-semibold text-navy-800">All caught up</p>
              <p className="text-sm text-navy-400">No follow-ups are due right now.</p>
            </div>
          ) : (
            <div className="grid gap-4 p-4 sm:grid-cols-3">
              {FOLLOWUPS.map((f) => {
                const list = dueByF[f.n];
                return (
                  <div key={f.n} className="flex flex-col rounded-xl border border-navy-100 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-navy-900">{f.label}</p>
                        <p className="text-xs text-navy-400">due at day {f.day}</p>
                      </div>
                      <span className="font-display text-2xl font-bold text-amber-600">{list.length.toLocaleString()}</span>
                    </div>
                    <button onClick={() => logAllForGroup(list, f.n)} disabled={!list.length}
                      className="btn-primary mt-3 w-full justify-center disabled:cursor-not-allowed disabled:opacity-40">
                      <Send size={14} /> Mark all {f.short} sent
                    </button>
                    <ul className="mt-3 space-y-1 border-t border-navy-50 pt-3">
                      {list.slice(0, 5).map((c) => (
                        <li key={c.id} className="truncate text-xs text-navy-500" title={c.email}>{c.email}</li>
                      ))}
                      {list.length > 5 && <li className="text-xs text-navy-400">+{(list.length - 5).toLocaleString()} more</li>}
                      {!list.length && <li className="text-xs text-navy-300">Nothing due</li>}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ---- Upload sets ---- */}
        {uploads.length > 0 && (
          <div className="card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy-700">
              <Layers size={15} className="text-navy-400" /> Daily Batches
              <span className="badge bg-navy-50 text-navy-500">Account A</span>
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
            <EmptyState icon={Users} title="No prospects found"
              hint="Upload a daily batch (Excel/CSV of already-sent emails). Each becomes due for F1 at day 2, F2 at day 5 and F3 at day 7 automatically.">
              <button onClick={() => setShowUpload(true)} className="btn-primary"><Upload size={16} /> Upload Batch</button>
            </EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-navy-400">
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Batch</th>
                    <th className="px-4 py-3 font-semibold">Stage</th>
                    <th className="px-4 py-3 font-semibold">Follow-up</th>
                    <th className="px-4 py-3 font-semibold">Original sent</th>
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
                      <td className="px-4 py-3">
                        {(() => { const v = followUpView(c); return <StatusBadge status={v.tone} label={v.label} />; })()}
                      </td>
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
        <h3 className="font-display text-lg font-bold text-navy-900">Upload Daily Batch</h3>
        <p className="mt-1 text-sm text-navy-400">Excel/CSV with an email column (the prospects Account A emailed). The send date drives the automatic F1/F2/F3 follow-ups at days 2 / 5 / 7.</p>

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
