"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/Sidebar";
import { canAccess, featureForPath, firstAccessibleHref } from "@/lib/features";

export default function DashLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }

    // /users is admin-only
    if (path.startsWith("/users") && user.role !== "admin") {
      router.replace(firstAccessibleHref(user));
      return;
    }
    // feature-gated areas
    const key = featureForPath(path);
    if (key && !canAccess(user, key)) {
      router.replace(firstAccessibleHref(user));
    }
  }, [loading, user, path, router]);

  const key = featureForPath(path);
  const onUsers = path.startsWith("/users");
  const allowed =
    !!user &&
    (onUsers ? user.role === "admin" : (!key || canAccess(user, key)));

  if (loading || !user || !allowed) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-navy-200 border-t-teal-500" />
          <p className="text-sm text-navy-400">Loading workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
