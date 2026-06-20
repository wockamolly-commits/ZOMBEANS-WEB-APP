import fs from "node:fs";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  const values = {};
  for (const rawLine of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    values[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return values;
}

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run staff:enrollment-link -- staff@example.com");
  process.exit(1);
}

const env = { ...loadEnvFile(".env.local"), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serverSecret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const siteUrl = (env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
if (!url || !serverSecret) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or Supabase server secret in .env.local.");
  process.exit(1);
}

const supabase = createClient(url, serverSecret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: identities, error: identityError } = await supabase.rpc(
  "resolve_active_operations_email",
  { p_email: email }
);
if (identityError) throw identityError;
const identity = identities?.[0];
if (!identity) {
  console.error("No active staff/admin profile matches that email.");
  process.exit(1);
}

const { count, error: passkeyError } = await supabase
  .from("staff_passkeys")
  .select("id", { count: "exact", head: true })
  .eq("profile_id", identity.id);
if (passkeyError) throw passkeyError;
if ((count ?? 0) > 0) {
  console.error("This staff account already has a passkey and does not need enrollment.");
  process.exit(1);
}

const { data, error } = await supabase.auth.admin.generateLink({
  type: "magiclink",
  email,
  options: {
    redirectTo: `${siteUrl}/auth/confirm?next=${encodeURIComponent("/workspace/security")}`,
  },
});
if (error) throw error;
const tokenHash = data.properties?.hashed_token;
if (!tokenHash) throw new Error("Supabase did not return an enrollment token.");

const enrollmentUrl = new URL("/auth/confirm", siteUrl);
enrollmentUrl.searchParams.set("token_hash", tokenHash);
enrollmentUrl.searchParams.set("type", "magiclink");
enrollmentUrl.searchParams.set("next", "/workspace/security");

console.log("Open this one-time enrollment URL in the staff member's browser:");
console.log(enrollmentUrl.toString());
console.log("Treat this URL like a password and do not share it.");