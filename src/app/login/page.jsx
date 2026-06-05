"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { firstAccessibleHref } from "@/lib/features";
import { Brand } from "@/components/Brand";
import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const user = await login(form.email, form.password);
      router.replace(user.role === "admin" ? "/dashboard" : firstAccessibleHref(user));
    } catch (err) {
      setMsg(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left: brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-navy-900 p-12 text-white lg:flex">
        <div className="bg-grid absolute inset-0 opacity-40" />
        <div className="absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="relative"><Brand light size={44} /></div>
        <div className="relative max-w-md">
          <h2 className="font-display text-3xl font-bold leading-tight">
            Conference outreach,<br /><span className="text-teal-300">engineered for scale.</span>
          </h2>
          <p className="mt-4 text-navy-100/70">
            Verified email repositories, automated invitation campaigns, behavioural follow-ups
            and real-time deliverability analytics — for OneGrasp Scientific Conferences across 15+ countries.
          </p>
          <div className="mt-8 flex gap-6">
            {[["400+", "Conferences"], ["15+", "Countries"], ["11", "Disciplines"]].map(([n, l]) => (
              <div key={l}>
                <p className="font-display text-2xl font-bold text-teal-300">{n}</p>
                <p className="text-xs uppercase tracking-wide text-navy-200/60">{l}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-navy-300/50">© {new Date().getFullYear()} OneGrasp Scientific Conferences</p>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center bg-grid px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Brand size={40} /></div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Welcome back</h1>
          <p className="mt-1 text-sm text-navy-400">Sign in to your CEMS workspace.</p>

          <form onSubmit={submit} className="mt-7 space-y-3.5">
            <Field icon={Mail} type="email" placeholder="Email address" value={form.email} onChange={set("email")} required />
            <Field icon={Lock} type="password" placeholder="Password" value={form.password} onChange={set("password")} required />

            {msg && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">{msg}</p>
            )}

            <button className="btn-primary w-full" disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              Sign in
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-navy-400">
            Accounts are provisioned by your administrator.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ icon: Icon, ...props }) {
  return (
    <div className="relative">
      <Icon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-300" />
      <input {...props} className="input pl-10" />
    </div>
  );
}
