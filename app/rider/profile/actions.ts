"use server";

import { refresh, revalidatePath } from "next/cache";
import * as z from "zod";
import { requireRider } from "@/lib/rider";
import { createAdminClient } from "@/lib/supabase/admin";

export type RiderProfileState = {
  status: "idle" | "saved" | "error";
  message?: string;
  profile?: {
    display_name: string;
    full_name: string;
  };
};

type ProfileRow = {
  id: string;
  display_name: string;
  full_name?: string | null;
};

const invalidNameRe = /[\x00-\x1F\x7F<>]/;

const profileSchema = z.object({
  displayName: z
    .string()
    .min(2, { error: "Display name must be at least 2 characters." })
    .max(80, { error: "Display name must be 80 characters or fewer." })
    .refine((value) => !invalidNameRe.test(value), {
      error: "Display name contains unsupported characters.",
    }),
  fullName: z
    .string()
    .min(2, { error: "Full name must be at least 2 characters." })
    .max(120, { error: "Full name must be 120 characters or fewer." })
    .refine((value) => !invalidNameRe.test(value), {
      error: "Full name contains unsupported characters.",
    }),
});

function normalizeName(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function isMissingFullNameColumn(error: { message?: string } | null): boolean {
  return Boolean(error?.message?.includes("profiles.full_name"));
}

export async function updateRiderProfile(
  _previous: RiderProfileState,
  formData: FormData
): Promise<RiderProfileState> {
  const { profile: actor } = await requireRider("/rider/profile");
  const parsed = profileSchema.safeParse({
    displayName: normalizeName(formData.get("displayName")),
    fullName: normalizeName(formData.get("fullName")),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check your profile details.",
    };
  }

  const admin = createAdminClient();
  let hasFullNameColumn = true;
  let before = await admin
    .from("profiles")
    .select("id, display_name, full_name")
    .eq("id", actor.id)
    .eq("is_active", true)
    .maybeSingle();

  if (before.error && isMissingFullNameColumn(before.error)) {
    hasFullNameColumn = false;
    before = await admin
      .from("profiles")
      .select("id, display_name")
      .eq("id", actor.id)
      .eq("is_active", true)
      .maybeSingle();
  }

  if (before.error || !before.data) {
    console.error(
      "[rider-profile] lookup failed:",
      before.error?.message ?? "profile not found"
    );
    return { status: "error", message: "Could not find your profile." };
  }

  const beforeData = before.data as ProfileRow;
  const nextProfile = {
    display_name: parsed.data.displayName,
    full_name: parsed.data.fullName,
  };
  const previousProfile = {
    display_name: beforeData.display_name,
    full_name: beforeData.full_name ?? null,
  };
  const changed =
    previousProfile.display_name !== nextProfile.display_name ||
    (previousProfile.full_name ?? "") !== nextProfile.full_name;

  if (changed) {
    const profileUpdate = hasFullNameColumn
      ? nextProfile
      : { display_name: nextProfile.display_name };
    const updated = await admin
      .from("profiles")
      .update(profileUpdate)
      .eq("id", actor.id)
      .eq("role", "rider")
      .eq("staff_role", "rider")
      .eq("is_active", true)
      .select("id")
      .maybeSingle();

    if (updated.error || !updated.data) {
      console.error(
        "[rider-profile] update failed:",
        updated.error?.message ?? "profile was not updated"
      );
      return { status: "error", message: "Could not save your profile." };
    }

    const user = await admin.auth.admin.getUserById(actor.id);
    if (user.data.user) {
      const existingMetadata = user.data.user.user_metadata ?? {};
      const metadataUpdate = await admin.auth.admin.updateUserById(actor.id, {
        user_metadata: {
          ...existingMetadata,
          display_name: nextProfile.display_name,
          full_name: nextProfile.full_name,
        },
      });
      if (metadataUpdate.error) {
        console.error(
          "[rider-profile] auth metadata update failed:",
          metadataUpdate.error.message
        );
      }
    } else if (user.error) {
      console.error("[rider-profile] auth lookup failed:", user.error.message);
    }

    const audit = await admin.from("audit_logs").insert({
      actor_profile_id: actor.id,
      action: "rider_profile.updated",
      target_table: "profiles",
      target_id: actor.id,
      diff: {
        before: previousProfile,
        after: nextProfile,
        full_name_column_available: hasFullNameColumn,
      },
    });
    if (audit.error) {
      console.error("[rider-profile] audit failed:", audit.error.message);
    }
  }

  revalidatePath("/rider", "layout");
  revalidatePath("/rider");
  revalidatePath("/rider/profile");
  refresh();

  return { status: "saved", profile: nextProfile };
}
