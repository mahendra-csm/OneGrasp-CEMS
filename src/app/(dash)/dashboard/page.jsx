"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import { Users, Send, MailOpen, MousePointerClick } from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { StatCard } from "@/components/ui";
import { listContacts, listCampaigns, listEmailLogs } from "@/lib/firestore";

const TEAL = "#0aa3ac", NAVY = "#1f4490";

export default function Dashboard() {
  const [contacts, setContacts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    listContacts().then(setContacts).catch(() => {});
    listCampaigns().then(setCampaigns).catch(() => {});
    listEmailLogs().then(setLogs).catch(() => {});
  }, []);

  const sent = logs.length;
  const opened = logs.filter((l) => ["opened", "clicked"].includes(l.event)).length;
  const clicked = logs.filter((l) => l.event === "clicked").length;
  const openRate = sent ? Math.round((opened / sent) * 100) : 0;
  const clickRate = sent ? Math.round((clicked / sent) * 100) : 0;

  // Build 7-day activity series from logs (falls back to demo curve).
  const activity = buildActivity(logs);
  const byCountry = topCountries(contacts);
  const funnel = [
    { name: "Sent", v: sent || 0 },
    { name: "Delivered", v: Math.round((sent || 0) * 0.97) },
    { name: "Opened", v: opened },
    { name: "Clicked", v: clicked },
  ];

  return (
    <>
      <Topbar title="Dashboard" subtitle="Outreach performance at a glance" />
      <div className="space-y-6 p-5 lg:p-8">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Verified Contacts" value={contacts.length.toLocaleString()} delta={6} icon={Users} />
          <StatCard label="Emails Sent" value={sent.toLocaleString()} delta={12} icon={Send} accent="teal" />
          <StatCard label="Open Rate" value={`${openRate}%`} delta={3} icon={MailOpen} />
          <StatCard label="Click Rate" value={`${clickRate}%`} delta={clickRate >= 4 ? 2 : -1} icon={MousePointerClick} accent="teal" />
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="card p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display font-semibold text-navy-900">Daily Activity</h3>
              <span className="badge bg-teal-50 text-teal-700">Last 7 days</span>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={activity} margin={{ left: -18, right: 8 }}>
                <defs>
                  <linearGradient id="gSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={NAVY} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={NAVY} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOpen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={TEAL} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f9" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#7e8db0" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#7e8db0" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tip} />
                <Area type="monotone" dataKey="sent" stroke={NAVY} strokeWidth={2} fill="url(#gSent)" name="Sent" />
                <Area type="monotone" dataKey="opened" stroke={TEAL} strokeWidth={2} fill="url(#gOpen)" name="Opened" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-5">
            <h3 className="mb-4 font-display font-semibold text-navy-900">Engagement Funnel</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={funnel} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#465780" }} axisLine={false} tickLine={false} width={70} />
                <Tooltip contentStyle={tip} cursor={{ fill: "#f1f5fc" }} />
                <Bar dataKey="v" radius={[0, 8, 8, 0]} fill={TEAL} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="card p-5">
            <h3 className="mb-4 font-display font-semibold text-navy-900">Contacts by Country</h3>
            {byCountry.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={byCountry} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={3}>
                    {byCountry.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tip} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="py-12 text-center text-sm text-navy-400">Import contacts to see distribution.</p>}
          </div>

          <div className="card p-5 lg:col-span-2">
            <h3 className="mb-4 font-display font-semibold text-navy-900">Recent Campaigns</h3>
            <div className="divide-y divide-navy-50">
              {campaigns.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center gap-3 py-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-navy-50 text-navy-500"><Send size={16} /></span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy-800">{c.name}</p>
                    <p className="text-xs text-navy-400">{c.type} · {c.audienceCount || 0} recipients</p>
                  </div>
                  <span className="ml-auto badge bg-navy-50 text-navy-600">{c.status}</span>
                </div>
              ))}
              {!campaigns.length && <p className="py-8 text-center text-sm text-navy-400">No campaigns yet.</p>}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

const tip = { borderRadius: 12, border: "1px solid #e4ebf6", fontSize: 12, boxShadow: "0 8px 24px rgba(10,31,71,.08)" };
const PALETTE = ["#1f4490", "#0aa3ac", "#4f7bcb", "#54d8dd", "#102a5c", "#8ee9eb"];

function buildActivity(logs) {
  const days = [...Array(7)].map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return { key: d.toISOString().slice(0, 10), day: d.toLocaleDateString("en", { weekday: "short" }), sent: 0, opened: 0 };
  });
  logs.forEach((l) => {
    const k = (l.ts?.toDate?.() || new Date(l.ts || Date.now())).toISOString().slice(0, 10);
    const row = days.find((d) => d.key === k);
    if (row) { row.sent++; if (["opened", "clicked"].includes(l.event)) row.opened++; }
  });
  const hasData = days.some((d) => d.sent);
  return hasData ? days : days.map((d, i) => ({ ...d, sent: 40 + i * 18 + (i % 2) * 25, opened: 18 + i * 9 }));
}

function topCountries(contacts) {
  const m = {};
  contacts.forEach((c) => { const k = c.country || "Unknown"; m[k] = (m[k] || 0) + 1; });
  return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
}
