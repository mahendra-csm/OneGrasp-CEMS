"use client";

import { useEffect, useState } from "react";
import {
  UserPlus, Loader2, Trash2, ShieldCheck, User as UserIcon, Check,
} from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { useAuth } from "@/lib/auth-context";
import { ALL_FEATURES, DEFAULT_CONTRIBUTOR_FEATURES } from "@/lib/features";

const BLANK = { name: "", email: "", password: "", role: "contributor" };

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(BLANK);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState(null);
  const [savingId, setSavingId] = useState(null);

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setUsers(data.users || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadUsers(); }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function addUser(e) {
    e.preventDefault();
    setCreating(true); setErr(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          features: form.role === "admin" ? undefined : DEFAULT_CONTRIBUTOR_FEATURES,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not create user.");
      setForm(BLANK);
      await loadUsers();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setCreating(false);
    }
  }

  async function patchUser(id, patch) {
    setSavingId(id); setErr(null);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not update user.");
      setUsers((list) => list.map((u) => (u.id === id ? data.user : u)));
    } catch (e2) {
      setErr(e2.message);
      await loadUsers(); // resync on failure
    } finally {
      setSavingId(null);
    }
  }

  async function removeUser(id, name) {
    if (!confirm(`Remove ${name}? This cannot be undone.`)) return;
    setSavingId(id); setErr(null);
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not delete user.");
      setUsers((list) => list.filter((u) => u.id !== id));
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSavingId(null);
    }
  }

  function toggleFeature(u, key) {
    const has = u.features?.includes(key);
    const features = has
      ? u.features.filter((k) => k !== key)
      : [...(u.features || []), key];
    patchUser(u.id, { features });
  }

  return (
    <>
      <Topbar title="User Management" subtitle="Provision accounts and control contributor access" />
      <div className="mx-auto max-w-5xl space-y-6 p-5 lg:p-8">

        {err && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{err}</p>
        )}

        {/* Add user */}
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-navy-50 text-navy-600"><UserPlus size={18} /></span>
            <h3 className="font-display font-semibold text-navy-900">Add a new user</h3>
          </div>
          <form onSubmit={addUser} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input className="input" placeholder="Full name" value={form.name} onChange={set("name")} />
            <input className="input" type="email" placeholder="Email address" value={form.email} onChange={set("email")} required />
            <input className="input" type="password" placeholder="Temporary password" value={form.password} onChange={set("password")} required />
            <select className="input" value={form.role} onChange={set("role")}>
              <option value="contributor">Contributor</option>
              <option value="admin">Admin</option>
            </select>
            <div className="sm:col-span-2 lg:col-span-4">
              <button className="btn-primary" disabled={creating}>
                {creating ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                Create user
              </button>
              <span className="ml-3 text-xs text-navy-400">
                Contributors start with default access; tune their features below. Admins always have full access.
              </span>
            </div>
          </form>
        </div>

        {/* User list */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-navy-100 px-5 py-4">
            <h3 className="font-display font-semibold text-navy-900">
              Users {!loading && <span className="text-sm font-normal text-navy-400">({users.length})</span>}
            </h3>
          </div>

          {loading ? (
            <div className="grid place-items-center py-16">
              <Loader2 size={22} className="animate-spin text-navy-300" />
            </div>
          ) : (
            <ul className="divide-y divide-navy-100">
              {users.map((u) => {
                const isMe = u.id === me?.id;
                const isAdmin = u.role === "admin";
                const saving = savingId === u.id;
                return (
                  <li key={u.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`grid h-10 w-10 place-items-center rounded-xl text-white ${isAdmin ? "bg-teal-600" : "bg-navy-600"}`}>
                        {isAdmin ? <ShieldCheck size={18} /> : <UserIcon size={18} />}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-navy-900">
                          {u.name} {isMe && <span className="text-xs font-normal text-navy-400">(you)</span>}
                        </p>
                        <p className="truncate text-xs text-navy-400">{u.email}</p>
                      </div>

                      <div className="ml-auto flex items-center gap-2">
                        {saving && <Loader2 size={15} className="animate-spin text-navy-300" />}

                        {/* Role */}
                        <select
                          className="input h-9 w-36 py-1 text-sm"
                          value={u.role}
                          disabled={isMe || saving}
                          onChange={(e) => patchUser(u.id, { role: e.target.value })}
                          title={isMe ? "You can't change your own role" : "Role"}
                        >
                          <option value="contributor">Contributor</option>
                          <option value="admin">Admin</option>
                        </select>

                        {/* Enabled toggle */}
                        <button
                          onClick={() => patchUser(u.id, { enabled: !u.enabled })}
                          disabled={isMe || saving}
                          className={`badge ${u.enabled ? "bg-teal-50 text-teal-700" : "bg-navy-100 text-navy-500"} ${isMe ? "opacity-60" : "hover:opacity-80"}`}
                          title={isMe ? "You can't disable yourself" : "Toggle access"}
                        >
                          {u.enabled ? "Active" : "Disabled"}
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => removeUser(u.id, u.name)}
                          disabled={isMe || saving}
                          className="grid h-9 w-9 place-items-center rounded-lg border border-navy-100 text-navy-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40"
                          title={isMe ? "You can't delete yourself" : "Delete user"}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Feature access */}
                    <div className="mt-3 pl-[52px]">
                      {isAdmin ? (
                        <p className="text-xs text-navy-400">Full access to all features.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {ALL_FEATURES.map((f) => {
                            const on = u.features?.includes(f.key);
                            return (
                              <button
                                key={f.key}
                                onClick={() => toggleFeature(u, f.key)}
                                disabled={saving}
                                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition
                                  ${on
                                    ? "border-teal-200 bg-teal-50 text-teal-700"
                                    : "border-navy-100 bg-white text-navy-400 hover:bg-navy-50"}`}
                              >
                                {on && <Check size={12} />}
                                {f.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
