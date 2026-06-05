"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { firstAccessibleHref } from "@/lib/features";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading) router.replace(user ? firstAccessibleHref(user) : "/login");
  }, [loading, user, router]);
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-navy-200 border-t-teal-500" />
    </div>
  );
}
