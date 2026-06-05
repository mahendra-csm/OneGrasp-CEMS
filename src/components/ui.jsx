"use client";

import { TrendingUp, TrendingDown } from "lucide-react";

export function StatCard({ label, value, delta, icon: Icon, accent = "navy" }) {
  const up = (delta ?? 0) >= 0;
  const ring = accent === "teal" ? "bg-teal-50 text-teal-600" : "bg-navy-50 text-navy-600";
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">{label}</p>
          <p className="mt-2 font-display text-2xl font-bold text-navy-900">{value}</p>
        </div>
        {Icon && <span className={`grid h-10 w-10 place-items-center rounded-xl ${ring}`}><Icon size={20} /></span>}
      </div>
      {delta !== undefined && (
        <p className={`mt-3 flex items-center gap-1 text-xs font-semibold ${up ? "text-teal-600" : "text-rose-500"}`}>
          {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {up ? "+" : ""}{delta}% vs last week
        </p>
      )}
    </div>
  );
}

const STATUS_STYLES = {
  valid: "bg-teal-50 text-teal-700",
  invalid: "bg-rose-50 text-rose-600",
  risky: "bg-amber-50 text-amber-600",
  unknown: "bg-navy-50 text-navy-500",
  draft: "bg-navy-50 text-navy-600",
  scheduled: "bg-indigo-50 text-indigo-600",
  sending: "bg-teal-50 text-teal-700",
  paused: "bg-amber-50 text-amber-600",
  completed: "bg-emerald-50 text-emerald-700",
  // Contact lifecycle stages (derived from upload date).
  uploaded: "bg-sky-50 text-sky-700",
  stage_2d: "bg-indigo-50 text-indigo-600",
  stage_5d: "bg-violet-50 text-violet-600",
  stage_7d: "bg-emerald-50 text-emerald-700",
  // Follow-up statuses (derived).
  awaiting: "bg-navy-50 text-navy-500",
  due: "bg-amber-100 text-amber-700",
  followed_up: "bg-sky-50 text-sky-700",
  replied: "bg-emerald-50 text-emerald-700",
  bounced: "bg-rose-50 text-rose-600",
  no_response: "bg-navy-100 text-navy-500",
};

const STATUS_LABELS = {
  uploaded: "Uploaded", stage_2d: "2 days", stage_5d: "5 days", stage_7d: "7 days",
  awaiting: "Awaiting", due: "Follow-up due", followed_up: "Followed up",
  replied: "Replied", bounced: "Bounced", no_response: "No response",
};

export function StatusBadge({ status }) {
  const label = STATUS_LABELS[status] || status;
  return <span className={`badge ${STATUS_STYLES[status] || "bg-navy-50 text-navy-500"}`}>{label}</span>;
}

export function EmptyState({ icon: Icon, title, hint, children }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
      {Icon && <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-navy-50 text-navy-400"><Icon size={24} /></span>}
      <p className="font-display font-semibold text-navy-800">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-navy-400">{hint}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}
