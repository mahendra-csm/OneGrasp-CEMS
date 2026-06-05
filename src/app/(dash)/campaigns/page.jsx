"use client";

import { useEffect, useState } from "react";
import { Send, Plus, Loader2, Play, Pause, Calendar, Users } from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { StatusBadge, EmptyState } from "@/components/ui";
import { listCampaigns, createCampaign, updateOne, listContacts, listTemplates } from "@/lib/firestore";
import { ALL_STAGES } from "@/lib/stages";

const TYPES = ["Conference Invitation", "Reminder", "Final Call", "Thank You", "Follow-up"];

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([listCampaigns(), listContacts(), listTemplates()])
      .then(([c, ct, t]) => { setCampaigns(c); setContacts(ct); setTemplates(t); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(load, []);

  async function toggle(c) {
    const next = c.status === "sending" ? "paused" : "sending";
    await updateOne("campaigns", c.id, { status: next });
    setCampaigns((list) => list.map((x) => x.id === c.id ? { ...x, status: next } : x));
  }

  return (
    <>
      <Topbar title="Campaigns" subtitle={`${campaigns.length} campaigns`}
        action={<button onClick={() => setShow(true)} className="btn-accent"><Plus size={16} /> New Campaign</button>} />

      <div className="p-5 lg:p-8">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-navy-300" /></div>
        ) : !campaigns.length ? (
          <EmptyState icon={Send} title="No campaigns yet" hint="Create a conference invitation campaign and select your audience.">
            <button onClick={() => setShow(true)} className="btn-primary"><Plus size={16} /> New Campaign</button>
          </EmptyState>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {campaigns.map((c) => {
              const rate = c.sent ? Math.round((c.opened || 0) / c.sent * 100) : 0;
              return (
                <div key={c.id} className="card flex flex-col p-5">
                  <div className="flex items-start justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-navy-50 text-navy-600"><Send size={18} /></span>
                    <StatusBadge status={c.status} />
                  </div>
                  <h3 className="mt-3 font-display font-semibold text-navy-900">{c.name}</h3>
                  <p className="text-xs text-navy-400">{c.type}</p>
                  <div className="mt-4 flex items-center gap-4 text-xs text-navy-500">
                    <span className="flex items-center gap-1"><Users size={13} /> {c.audienceCount || 0}</span>
                    <span className="flex items-center gap-1"><Calendar size={13} /> {c.schedule || "Now"}</span>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-navy-400"><span>Open rate</span><span>{rate}%</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy-50">
                      <div className="h-full rounded-full bg-teal-400" style={{ width: `${rate}%` }} />
                    </div>
                  </div>
                  {c.status !== "completed" && c.status !== "draft" && (
                    <button onClick={() => toggle(c)} className="btn-ghost mt-4 w-full">
                      {c.status === "sending" ? <><Pause size={15} /> Pause</> : <><Play size={15} /> Resume</>}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {show && <NewCampaign contacts={contacts} templates={templates}
        onClose={() => setShow(false)} onSaved={() => { setShow(false); load(); }} />}
    </>
  );
}

function NewCampaign({ contacts, templates, onClose, onSaved }) {
  const [f, setF] = useState({ name: "", type: TYPES[0], templateId: "", country: "all", stage: "all", schedule: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const countries = [...new Set(contacts.map((c) => c.country).filter(Boolean))];
  const audience = contacts.filter((c) =>
    (f.country === "all" || c.country === f.country) &&
    (f.stage === "all" || c.stage === f.stage) &&
    c.verification === "valid");

  async function save() {
    setBusy(true);
    await createCampaign({
      name: f.name, type: f.type, templateId: f.templateId, country: f.country, stage: f.stage,
      schedule: f.schedule || "immediate", status: f.schedule ? "scheduled" : "draft",
      audienceCount: audience.length, sent: 0, opened: 0, clicked: 0,
    });
    setBusy(false); onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-950/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold text-navy-900">New Campaign</h3>
        <div className="mt-4 space-y-3">
          <input className="input" placeholder="Campaign name" value={f.name} onChange={set("name")} />
          <div className="grid grid-cols-2 gap-3">
            <select className="input" value={f.type} onChange={set("type")}>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <select className="input" value={f.templateId} onChange={set("templateId")}>
              <option value="">Select template…</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select className="input" value={f.country} onChange={set("country")}>
              <option value="all">All countries</option>
              {countries.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select className="input" value={f.stage} onChange={set("stage")}>
              <option value="all">All stages</option>
              {ALL_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <input className="input" type="datetime-local" value={f.schedule} onChange={set("schedule")} />
          <div className="rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-700">
            <Users size={14} className="mr-1 inline" /> Audience: <b>{audience.length}</b> valid contacts
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} className="btn-primary" disabled={busy || !f.name}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Create
          </button>
        </div>
      </div>
    </div>
  );
}
