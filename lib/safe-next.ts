// Validates a `next` redirect target is an internal path, defeating
// open-redirects via protocol-relative (`//host`) or backslash (`/\host`) values.
export function safeNextPath(raw: string | null | undefined, fallback = "/account"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}
