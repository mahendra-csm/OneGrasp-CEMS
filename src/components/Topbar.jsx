"use client";

import { useAuth } from "@/lib/auth-context";
import { Search, LogOut, Bell } from "lucide-react";

export function Topbar({ title, subtitle, action }) {
  const { profile, user, logout } = useAuth();
  const name = profile?.name || user?.email || "User";
  const initials = name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-navy-100/70 bg-white/80 px-5 py-3.5 backdrop-blur lg:px-8">
      <div className="min-w-0">
        <h1 className="truncate font-display text-lg font-bold text-navy-900">{title}</h1>
        {subtitle && <p className="truncate text-xs text-navy-400">{subtitle}</p>}
      </div>

      <div className="ml-auto hidden items-center gap-2 rounded-xl border border-navy-100 bg-navy-50/50 px-3 py-2 md:flex">
        <Search size={16} className="text-navy-300" />
        <input className="w-44 bg-transparent text-sm outline-none placeholder:text-navy-300" placeholder="Search contacts, campaigns…" />
      </div>

      {action}

      <button className="relative grid h-10 w-10 place-items-center rounded-xl border border-navy-100 text-navy-500 hover:bg-navy-50">
        <Bell size={18} />
        <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-teal-500" />
      </button>

      <div className="flex items-center gap-2.5 rounded-xl border border-navy-100 py-1 pl-1 pr-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-navy-700 text-xs font-bold text-white">
          {initials}
        </div>
        <div className="hidden leading-tight sm:block">
          <p className="text-xs font-semibold text-navy-900">{name}</p>
          <p className="text-[10px] uppercase tracking-wide text-teal-600">{profile?.role || "user"}</p>
        </div>
        <button onClick={() => logout()} title="Log out" className="ml-1 text-navy-400 hover:text-navy-700">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
