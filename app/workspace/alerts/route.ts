import { NextResponse } from "next/server";
import { getStaffProfile, hasStaffPermission } from "@/lib/admin";
import { getAdminOrderAlertSnapshot } from "@/lib/admin-order-alerts";
import { createAdminSessionClient } from "@/lib/supabase/admin-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createAdminSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { pendingCount: 0, orders: [] },
      { status: 401 }
    );
  }

  const profile = await getStaffProfile();
  if (!profile || !hasStaffPermission(profile, "orders:view")) {
    return NextResponse.json(
      { pendingCount: 0, orders: [] },
      { status: 403 }
    );
  }

  const snapshot = await getAdminOrderAlertSnapshot(supabase);
  return NextResponse.json(snapshot);
}
