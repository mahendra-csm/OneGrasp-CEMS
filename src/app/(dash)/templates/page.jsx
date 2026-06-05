"use client";

import { useEffect, useState } from "react";
import { FileText, Plus, Loader2, Eye, Save } from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { EmptyState } from "@/components/ui";
import { listTemplates, createTemplate, updateOne } from "@/lib/firestore";

const VARS = ["{{first_name}}", "{{conference_name}}", "{{event_date}}", "{{organization}}"];
const SAMPLE = { first_name: "Dr. Anya", conference_name: "Intl. Conf. on Applied AI 2026", event_date: "14 Mar 2026", organization: "OneGrasp" };

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = () => { setLoading(true); listTemplates().then((d) => { setTemplates(d); setLoading(false); }).catch(() => setLoading(false)); };
  useEffect(load, []);

  return (
    <>
      <Topbar title="Email Templates" subtitle={`${templates.length} reusable templates`}
        action={<button onClick={() => setEditing({ name: "", subject: "", body: "" })} className="btn-accent"><Plus size={16} /> New Template</button>} />

      <div className="p-5 lg:p-8">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-navy-300" /></div>
        ) : !templates.length ? (
          <EmptyState icon={FileText} title="No templates yet" hint="Create reusable invitation, reminder and thank-you templates with dynamic placeholders.">
            <button onClick={() => setEditing({ name: "", subject: "", body: "" })} className="btn-primary"><Plus size={16} /> New Template</button>
          </EmptyState>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((t) => (
              <button key={t.id} onClick={() => setEditing(t)} className="card p-5 text-left transition hover:shadow-glow">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-600"><FileText size={18} /></span>
                <h3 className="mt-3 font-display font-semibold text-navy-900">{t.name}</h3>
                <p className="mt-1 line-clamp-1 text-xs font-medium text-navy-500">{t.subject}</p>
                <p className="mt-2 line-clamp-3 text-xs text-navy-400">{(t.body || "").replace(/<[^>]+>/g, "")}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {editing && <Editor tpl={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </>
  );
}

function render(str = "") {
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => SAMPLE[k] ?? `{{${k}}}`);
}

function Editor({ tpl, onClose, onSaved }) {
  const [f, setF] = useState({ name: tpl.name || "", subject: tpl.subject || "", body: tpl.body || "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  function insert(v) { setF((s) => ({ ...s, body: s.body + " " + v })); }

  async function save() {
    setBusy(true);
    if (tpl.id) await updateOne("templates", tpl.id, f);
    else await createTemplate(f);
    setBusy(false); onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-950/40 p-4" onClick={onClose}>
      <div className="card flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-navy-50 p-5">
          <h3 className="font-display text-lg font-bold text-navy-900">{tpl.id ? "Edit" : "New"} Template</h3>
          <button onClick={save} className="btn-primary" disabled={busy || !f.name}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
          </button>
        </div>
        <div className="grid flex-1 gap-0 overflow-y-auto md:grid-cols-2">
          <div className="space-y-3 border-r border-navy-50 p-5">
            <input className="input" placeholder="Template name" value={f.name} onChange={set("name")} />
            <input className="input" placeholder="Subject line" value={f.subject} onChange={set("subject")} />
            <div className="flex flex-wrap gap-1.5">
              {VARS.map((v) => (
                <button key={v} onClick={() => insert(v)} className="rounded-lg bg-navy-50 px-2 py-1 text-xs font-medium text-navy-600 hover:bg-teal-50 hover:text-teal-700">{v}</button>
              ))}
            </div>
            <textarea className="input min-h-[280px] font-mono text-xs" placeholder="<p>Dear {{first_name}},</p>…"
              value={f.body} onChange={set("body")} />
          </div>
          <div className="bg-navy-50/40 p-5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-navy-400"><Eye size={13} /> Live Preview</p>
            <div className="rounded-xl border border-navy-100 bg-white p-5 shadow-card">
              <p className="text-xs text-navy-400">Subject</p>
              <p className="mb-3 font-semibold text-navy-900">{render(f.subject) || "—"}</p>
              <div className="prose prose-sm max-w-none text-navy-700" dangerouslySetInnerHTML={{ __html: render(f.body) || "<p class='text-navy-300'>Body preview…</p>" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
