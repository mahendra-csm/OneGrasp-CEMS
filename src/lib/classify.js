// Lightweight email verification heuristic. Pure — safe on client and server.
// For production, a Cloud Function should do MX + SMTP probing and write back
// the real status.
const DISPOSABLE = ["mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com"];

export function classify(email = "") {
  const e = email.toLowerCase().trim();
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(e)) return "invalid";
  const domain = e.split("@")[1];
  if (DISPOSABLE.includes(domain)) return "risky";
  return "valid";
}
