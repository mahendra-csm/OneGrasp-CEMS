"use client";

import { useEffect, useState } from "react";
import { Save, Loader2, Server, Shield, Gauge } from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { useAuth } from "@/lib/auth-context";
import { getOne, updateOne, createDoc } from "@/lib/firestore";

export default function SettingsPage() {
  const { profile } = useAuth();
  const [cfg, setCfg] = useState({
    provider: "sendgrid", fromName: "OneGrasp Conferences", fromEmail: "conferences@onegrasp.com",
    smtpHost: "", smtpPort: "587", smtpUser: "",
    dailyLimit: 2000, throttleSeconds: 8, domainRotation: true,
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const set = (k) => (e) => setCfg((s) => ({ ...s, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  useEffect(() => { getOne("smtp_configs", "default").then((d) => d && setCfg((s) => ({ ...s, ...d }))).catch(() => {}); }, []);

  async function save() {
    setBusy(true);
    try {
      const existing = await getOne("smtp_configs", "default");
      if (existing) await updateOne("smtp_configs", "default", cfg);
      else await createDoc("smtp_configs", cfg);
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } finally { setBusy(false); }
  }

  return (
    <>
      <Topbar title="Settings & SMTP" subtitle="Sending configuration & deliverability controls" />
      <div className="mx-auto max-w-3xl space-y-6 p-5 lg:p-8">

        <Panel icon={Server} title="Email Provider">
          <div className="grid gap-3 sm:grid-cols-2">
            <select className="input" value={cfg.provider} onChange={set("provider")}>
              <option value="sendgrid">SendGrid (API)</option>
              <option value="ses">Amazon SES</option>
              <option value="smtp">Custom SMTP</option>
            </select>
            <input className="input" placeholder="From name" value={cfg.fromName} onChange={set("fromName")} />
            <input className="input sm:col-span-2" placeholder="From email" value={cfg.fromEmail} onChange={set("fromEmail")} />
          </div>
          {cfg.provider === "smtp" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <input className="input sm:col-span-2" placeholder="SMTP host" value={cfg.smtpHost} onChange={set("smtpHost")} />
              <input className="input" placeholder="Port" value={cfg.smtpPort} onChange={set("smtpPort")} />
              <input className="input sm:col-span-3" placeholder="SMTP username" value={cfg.smtpUser} onChange={set("smtpUser")} />
            </div>
          )}
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            🔑 API keys & SMTP passwords are <b>never</b> stored in Firestore. Set them as Cloud Functions secrets — see README → Email Sending.
          </p>
        </Panel>

        <Panel icon={Gauge} title="Sending Controls (anti-spam)">
          <div className="grid gap-4 sm:grid-cols-3">
            <Num label="Daily send limit" value={cfg.dailyLimit} onChange={set("dailyLimit")} />
            <Num label="Throttle (seconds/email)" value={cfg.throttleSeconds} onChange={set("throttleSeconds")} />
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm font-medium text-navy-700">
                <input type="checkbox" checked={cfg.domainRotation} onChange={set("domainRotation")} className="h-4 w-4 rounded accent-teal-500" />
                Domain rotation
              </label>
            </div>
          </div>
          <p className="mt-3 text-xs text-navy-400">Randomized intervals + daily caps + warm-up protect domain reputation. Enforced by the BullMQ-equivalent queue in Cloud Functions / Cloud Tasks.</p>
        </Panel>

        <Panel icon={Shield} title="Account">
          <div className="flex items-center justify-between rounded-xl bg-navy-50/50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-navy-900">{profile?.name}</p>
              <p className="text-xs text-navy-400">{profile?.email}</p>
            </div>
            <span className="badge bg-teal-50 text-teal-700">{profile?.role || "user"}</span>
          </div>
        </Panel>

        <div className="flex items-center gap-3">
          <button onClick={save} className="btn-primary" disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save settings
          </button>
          {saved && <span className="text-sm font-medium text-teal-600">✓ Saved</span>}
        </div>
      </div>
    </>
  );
}

function Panel({ icon: Icon, title, children }) {
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-navy-50 text-navy-600"><Icon size={18} /></span>
        <h3 className="font-display font-semibold text-navy-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Num({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-navy-400">{label}</span>
      <input type="number" className="input" value={value} onChange={onChange} />
    </label>
  );
}
