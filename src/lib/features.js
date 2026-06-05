// Shared role + feature catalog. Safe to import on both server and client
// (no Node-only or Firebase imports here).

export const ROLES = ["admin", "contributor"];

// Every gateable area of the app. `key` is what gets stored on a user's
// `features` list; `href`/`label`/`icon` drive the sidebar.
export const ALL_FEATURES = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { key: "contacts", label: "Contacts Repository", href: "/contacts", icon: "Users" },
  { key: "campaigns", label: "Campaigns", href: "/campaigns", icon: "Send" },
  { key: "templates", label: "Templates", href: "/templates", icon: "FileText" },
  { key: "automation", label: "Automation", href: "/automation", icon: "Workflow" },
  { key: "analytics", label: "Analytics", href: "/analytics", icon: "BarChart3" },
  { key: "settings", label: "Settings & SMTP", href: "/settings", icon: "Settings" },
];

export const FEATURE_KEYS = ALL_FEATURES.map((f) => f.key);

// What a brand-new contributor can see before an admin tunes their access.
export const DEFAULT_CONTRIBUTOR_FEATURES = [
  "dashboard",
  "contacts",
  "campaigns",
  "templates",
  "analytics",
];

// Admins always have everything; contributors only what's been granted.
export function canAccess(user, key) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return Array.isArray(user.features) && user.features.includes(key);
}

// Map a pathname (e.g. "/contacts" or "/contacts/123") to its feature key.
export function featureForPath(pathname) {
  const match = ALL_FEATURES.find(
    (f) => pathname === f.href || pathname.startsWith(f.href + "/")
  );
  return match ? match.key : null;
}

// First area a user is allowed into — used as a landing/fallback target.
export function firstAccessibleHref(user) {
  const f = ALL_FEATURES.find((x) => canAccess(user, x.key));
  return f ? f.href : "/login";
}
