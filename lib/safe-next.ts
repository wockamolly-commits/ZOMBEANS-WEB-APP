// Validates a `next` redirect target is an internal path, defeating
// open-redirects via protocol-relative (`//host`) or backslash (`/\host`) values.
export function safeNextPath(
  raw: string | string[] | null | undefined,
  fallback = "/account"
): string {
  if (!raw) return fallback;
  if (Array.isArray(raw)) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}

export function isAdminSurfacePath(path: string): boolean {
  const pathname = path.split(/[?#]/, 1)[0];
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/workspace" ||
    pathname.startsWith("/workspace/")
  );
}

export function safePublicNextPath(
  raw: string | string[] | null | undefined,
  fallback = "/account"
): string {
  const path = safeNextPath(raw, fallback);
  return isAdminSurfacePath(path) ? fallback : path;
}
