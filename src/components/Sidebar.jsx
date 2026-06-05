"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Send, FileText, Workflow,
  BarChart3, Settings, ShieldCheck,
} from "lucide-react";
import { Brand } from "./Brand";
import { useAuth } from "@/lib/auth-context";
import { ALL_FEATURES, canAccess } from "@/lib/features";

const ICONS = {
  LayoutDashboard, Users, Send, FileText, Workflow, BarChart3, Settings,
};

// "Settings & SMTP" lives in the Admin section; everything else is Workspace.
const ADMIN_FEATURE_KEYS = ["settings"];

export function Sidebar() {
  const path = usePathname();
  const { user } = useAuth();

  const visible = ALL_FEATURES.filter((f) => canAccess(user, f.key));
  const workspace = visible.filter((f) => !ADMIN_FEATURE_KEYS.includes(f.key));
  const adminFeatures = visible.filter((f) => ADMIN_FEATURE_KEYS.includes(f.key));
  const isAdmin = user?.role === "admin";

  const Item = ({ href, label, icon: Icon }) => {
    const active = path === href || path.startsWith(href + "/");
    return (
      <Link
        href={href}
        className={`group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition
          ${active
            ? "bg-teal-500/15 text-white"
            : "text-navy-100/70 hover:bg-white/5 hover:text-white"}`}
      >
        <Icon size={18} className={active ? "text-teal-300" : "text-navy-200/60 group-hover:text-teal-200"} />
        {label}
        {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-teal-300" />}
      </Link>
    );
  };

  return (
    <aside className="hidden w-72 shrink-0 flex-col bg-navy-900 px-4 py-6 lg:flex">
      <div className="px-2">
        <Brand light />
      </div>
      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {workspace.length > 0 && (
          <p className="px-3.5 pb-2 text-[10px] font-bold uppercase tracking-widest text-navy-300/60">
            Workspace
          </p>
        )}
        {workspace.map((f) => (
          <Item key={f.href} href={f.href} label={f.label} icon={ICONS[f.icon]} />
        ))}

        {(isAdmin || adminFeatures.length > 0) && (
          <p className="px-3.5 pb-2 pt-6 text-[10px] font-bold uppercase tracking-widest text-navy-300/60">
            Admin
          </p>
        )}
        {isAdmin && <Item href="/users" label="User Management" icon={ShieldCheck} />}
        {adminFeatures.map((f) => (
          <Item key={f.href} href={f.href} label={f.label} icon={ICONS[f.icon]} />
        ))}
      </nav>
      <div className="mt-4 rounded-2xl bg-gradient-to-br from-navy-800 to-navy-700 p-4">
        <p className="text-xs font-semibold text-teal-200">Deliverability Health</p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-navy-950/60">
          <div className="h-full w-[92%] rounded-full bg-teal-400" />
        </div>
        <p className="mt-2 text-[11px] text-navy-200/70">Domain reputation 92% — Good</p>
      </div>
    </aside>
  );
}
