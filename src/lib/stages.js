// Lifecycle + follow-up logic for uploaded emails. Pure — safe on client & server.
//
// Premise: each uploaded email is an *original email already sent* on the upload
// date. Day milestones (2/5/7) advance automatically with the calendar, and each
// milestone means "a follow-up is now due". None of this is stored — it is all
// derived from the upload date + the few fields we DO persist (outcome,
// lastFollowUpStage), so the queue is always correct with no scheduled job.
//
// Edit STAGES to change the follow-up cadence — they are checked longest → first.

export const STAGES = [
  { key: "stage_7d", days: 7, label: "7 days" },
  { key: "stage_5d", days: 5, label: "5 days" },
  { key: "stage_2d", days: 2, label: "2 days" },
];

export const UPLOADED = { key: "uploaded", days: 0, label: "Uploaded" };

// All stages oldest → newest for filters / stat cards. Labelled in the team's
// F1/F2/F3 follow-up language (F1 = +2 days, F2 = +5 days, F3 = +7 days).
export const ALL_STAGES = [
  { key: "uploaded", days: 0, label: "New Prospect" },
  { key: "stage_2d", days: 2, label: "F1 (day 2)" },
  { key: "stage_5d", days: 5, label: "F2 (day 5)" },
  { key: "stage_7d", days: 7, label: "F3 (day 7)" },
];

// The follow-up cadence as F-steps (drives the queue grouping + labels).
export const FOLLOWUPS = [
  { n: 1, stage: "stage_2d", day: 2, label: "Follow-up 1", short: "F1" },
  { n: 2, stage: "stage_5d", day: 5, label: "Follow-up 2", short: "F2" },
  { n: 3, stage: "stage_7d", day: 7, label: "Follow-up 3", short: "F3" },
];

// Follow-up statuses (derived). `terminal` ones stop the contact being chased.
export const FOLLOWUP_STATUSES = [
  { key: "awaiting",    label: "New prospect" },
  { key: "due",         label: "Follow-up due" },
  { key: "followed_up", label: "Follow-up sent" },
  { key: "replied",     label: "Replied",     terminal: true },
  { key: "bounced",     label: "Bounced",     terminal: true },
  { key: "no_response", label: "No response", terminal: true },
];

// The follow-up number in play for a contact: the NEXT one to send (when due)
// or the LAST one sent. 0 = none yet. Capped at the number of F-steps.
export function followUpNumber(c) {
  return Math.min((c?.followUpCount || 0) + 1, FOLLOWUPS.length);
}

// Rich display for a contact's follow-up state: a colour-tone key + F-aware text.
export function followUpView(c) {
  const status = c?.followUpStatus;
  const sent = c?.followUpCount || 0;
  if (status === "due") return { tone: "due", label: `F${Math.min(sent + 1, FOLLOWUPS.length)} due` };
  if (status === "followed_up") return { tone: "followed_up", label: `F${sent} sent` };
  if (status === "awaiting") return { tone: "awaiting", label: "New prospect" };
  return { tone: status, label: followUpLabel(status) };
}

export const TERMINAL_OUTCOMES = new Set(["replied", "bounced", "no_response"]);

const RANK = { uploaded: 0, stage_2d: 1, stage_5d: 2, stage_7d: 3 };
export const stageRank = (key) => RANK[key] ?? 0;

const DAY_MS = 86400000;

// Whole days elapsed between an upload date and `now`. Accepts a Date, ms epoch,
// ISO string, or Firestore-serialized {seconds}/{_seconds}.
export function daysSince(uploadedAt, now = Date.now()) {
  const t = toMs(uploadedAt);
  if (t == null) return 0;
  const nowMs = now instanceof Date ? now.getTime() : now;
  return Math.max(0, Math.floor((nowMs - t) / DAY_MS));
}

export function stageFor(uploadedAt, now = Date.now()) {
  const d = daysSince(uploadedAt, now);
  for (const s of STAGES) if (d >= s.days) return s.key;
  return UPLOADED.key;
}

// Derived follow-up status from the contact's persisted outcome + last touch and
// its current (time-derived) stage.
export function followUpStatusFor(contact, stageKey) {
  const outcome = contact?.outcome;
  if (outcome && TERMINAL_OUTCOMES.has(outcome)) return outcome;
  const cur = stageRank(stageKey);
  const last = stageRank(contact?.lastFollowUpStage || "uploaded");
  if (cur >= 1 && cur > last) return "due";        // reached a milestone beyond the last touch
  if (contact?.lastFollowUpStage) return "followed_up"; // touched, waiting for next milestone
  return "awaiting";                                // day 0–1: original sent, nothing due yet
}

export const isDue = (contact, stageKey) => followUpStatusFor(contact, stageKey) === "due";

export function stageLabel(key) {
  return ALL_STAGES.find((s) => s.key === key)?.label || "Uploaded";
}

export function followUpLabel(key) {
  return FOLLOWUP_STATUSES.find((s) => s.key === key)?.label || key;
}

function toMs(v) {
  if (v == null) return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  if (typeof v === "string") { const t = Date.parse(v); return Number.isNaN(t) ? null : t; }
  if (typeof v === "object") {
    const s = v.seconds ?? v._seconds;
    if (typeof s === "number") return s * 1000;
  }
  return null;
}
