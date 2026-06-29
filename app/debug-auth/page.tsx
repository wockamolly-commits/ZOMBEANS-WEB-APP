"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

// TEMP client-side auth diagnostic. Shows what the BROWSER SDK sees (no token
// values are displayed). Remove once the production session issue is resolved.
export default function DebugAuthPage() {
  const [report, setReport] = useState<string>("running…");

  useEffect(() => {
    (async () => {
      const out: Record<string, unknown> = {};
      try {
        const cookie = document.cookie;
        const authCookies = cookie
          .split(";")
          .map((c) => c.trim().split("=")[0])
          .filter((n) => /^sb-.*-auth-token/.test(n) || n.startsWith("zb-admin-auth"));
        out.cookiePresent = authCookies;
        out.cookieStringLength = cookie.length;
      } catch (e) {
        out.cookieError = e instanceof Error ? e.message : "threw";
      }

      try {
        const supabase = createClient();
        const { data: sess, error: sessErr } = await supabase.auth.getSession();
        out.getSession = {
          hasSession: Boolean(sess.session),
          hasUser: Boolean(sess.session?.user),
          expiresAt: sess.session?.expires_at ?? null,
          secondsUntilExpiry: sess.session?.expires_at
            ? sess.session.expires_at - Math.floor(Date.now() / 1000)
            : null,
          error: sessErr?.message ?? null,
        };
        const { data: usr, error: usrErr } = await supabase.auth.getUser();
        out.getUser = {
          hasUser: Boolean(usr.user),
          email: usr.user?.email ?? null,
          error: usrErr?.message ?? null,
        };
      } catch (e) {
        out.clientError = e instanceof Error ? e.message : "threw";
      }

      setReport(JSON.stringify(out, null, 2));
    })();
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: "monospace" }}>
      <h1>auth debug (client)</h1>
      <pre style={{ whiteSpace: "pre-wrap" }}>{report}</pre>
    </main>
  );
}
