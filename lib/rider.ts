import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { safeNextPath } from "@/lib/safe-next";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";
import { getTeamProfileForUser } from "@/lib/admin";

export type RiderProfile = {
  id: string;
  role: "rider";
  staff_role: "rider";
  display_name: string;
  full_name: string | null;
};

export const RIDER_HOME = "/rider";

export function riderDestination(raw: string | null | undefined): string {
  const requested = safeNextPath(raw, RIDER_HOME);
  return requested === RIDER_HOME || requested.startsWith(`${RIDER_HOME}/`)
    ? requested
    : RIDER_HOME;
}

export const getRiderProfile = cache(async (): Promise<RiderProfile | null> => {
  const supabase = await createAdminSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await getTeamProfileForUser(supabase, user.id);
  if (!profile || profile.role !== "rider" || profile.staff_role !== "rider") {
    return null;
  }

  return {
    id: profile.id,
    role: "rider",
    staff_role: "rider",
    display_name: profile.display_name,
    full_name: profile.full_name,
  };
});

export async function requireRider(
  returnTo = RIDER_HOME
): Promise<{ user: User; profile: RiderProfile }> {
  const supabase = await createAdminSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);

  const profile = await getRiderProfile();
  if (!profile) redirect("/login?error=not_authorized");
  return { user, profile };
}
