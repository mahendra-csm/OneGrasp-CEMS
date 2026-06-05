"use client";

import { useEffect, useState } from "react";
import {
  Workflow, Plus, Loader2, Mail, Clock, GitBranch, Ban, ShieldOff, ArrowDown,
} from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { listAutomations, createAutomation, updateOne } from "@/lib/firestore";

// Default behavioural sequence matching the spec.
const DEFAULT_FLOW = [
  { order: 0, trigger: "Day 0", condition: "On enrollment", action: "Send initial invitation", icon: "mail", enabled: true },
  { order: 1, trigger: "After 2 days", condition: "If not opened", action: "Send Follow-up A", icon: "clock", enabled: true },
  { order: 2, trigger: "After open", condition: "If opened but not clicked", action: "Send Follow-up B", icon: "branch", enabled: true },
  { order: 3, trigger: "After click", condition: "If clicked but not registered", action: "Send registration reminder", icon: "branch", enabled: true },
  { order: 4, trigger: "On unsubscribe", condition: "If unsubscribed", action: "Stop all future emails", icon: "ban", enabled: true },
  { order: 5, trigger: "On bounce", condition: "If bounced", action: "Blacklist email", icon: "shield", enabled: true },
];

const ICONS = { mail: Mail, clock: Clock, branch: GitBranch, ban: Ban, shield: ShieldOff };

export default function AutomationPage() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const load = () => { setLoading(true); listAutomations().then((d) => { setRules(d); setLoading(false); }).catch(() => setLoading(false)); };
  useEffect(load, []);

  async function seed() {
    setSeeding(true);
    for (const r of DEFAULT_FLOW) await createAutomation(r);
    setSeeding(false); load();
  }

  async function toggle(r) {
    await updateOne("automation_rules", r.id, { enabled: !r.enabled });
    setRules((list) => list.map((x) => x.id === r.id ? { ...x, enabled: !x.enabled } : x));
  }

  return (
    <>
      <Topbar title="Automation & Follow-up" subtitle="Behavioural email sequences"
        action={!rules.length && <button onClick={seed} className="btn-accent" disabled={seeding}>
          {seeding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Load default flow
        </button>} />

      <div className="p-5 lg:p-8">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-navy-300" /></div>
        ) : !rules.length ? (
          <div className="card flex flex-col items-center px-6 py-16 text-center">
            <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-navy-50 text-navy-400"><Workflow size={24} /></span>
            <p className="font-display font-semibold text-navy-800">No automation configured</p>
            <p className="mt-1 max-w-sm text-sm text-navy-400">Load the recommended conference invitation sequence — initial invite, behaviour-based follow-ups, and bounce/unsubscribe handling.</p>
            <button onClick={seed} className="btn-primary mt-4" disabled={seeding}>
              {seeding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Load default flow
            </button>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl">
            {rules.map((r, i) => {
              const Icon = ICONS[r.icon] || Mail;
              return (
                <div key={r.id}>
                  <div className={`card flex items-center gap-4 p-5 transition ${!r.enabled ? "opacity-50" : ""}`}>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-navy-700 text-white"><Icon size={20} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="badge bg-teal-50 text-teal-700">{r.trigger}</span>
                        <span className="text-xs text-navy-400">{r.condition}</span>
                      </div>
                      <p className="mt-1 font-semibold text-navy-900">{r.action}</p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input type="checkbox" checked={r.enabled} onChange={() => toggle(r)} className="peer sr-only" />
                      <div className="h-6 w-11 rounded-full bg-navy-200 transition peer-checked:bg-teal-500 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
                    </label>
                  </div>
                  {i < rules.length - 1 && (
                    <div className="flex justify-center py-1.5 text-navy-200"><ArrowDown size={18} /></div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
