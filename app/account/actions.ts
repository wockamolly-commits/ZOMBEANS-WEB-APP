"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ProfileState = { status: "idle" | "saved" | "error"; message?: string };

const phoneRe = /^(?:\+63|0)9\d{9}$/;
const profileSchema = z.object({
  display_name: z.string().trim().max(80).optional(),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || phoneRe.test(v), {
      error: "Use a Philippine mobile number such as 09186056360.",
    }),
});

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Please sign in again." };

  const parsed = profileSchema.safeParse({
    display_name: formData.get("display_name") ?? "",
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("customer_profiles").upsert({
    id: user.id,
    display_name: parsed.data.display_name || null,
    phone: parsed.data.phone || null,
  });
  if (error) return { status: "error", message: "Could not save. Try again." };

  revalidatePath("/account");
  return { status: "saved" };
}

export type AddressState = { status: "idle" | "added" | "error"; message?: string };

const addressSchema = z.object({
  label: z.string().trim().max(40).optional(),
  street: z.string().trim().min(1, { error: "Street is required." }),
  barangay: z.string().trim().optional(),
  landmark: z.string().trim().optional(),
  tier: z.enum(["tier-2", "tier-4", "tier-6"]),
});

export async function addAddress(
  _prev: AddressState,
  formData: FormData
): Promise<AddressState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Please sign in again." };

  const parsed = addressSchema.safeParse({
    label: formData.get("label") ?? "",
    street: formData.get("street") ?? "",
    barangay: formData.get("barangay") ?? "",
    landmark: formData.get("landmark") ?? "",
    tier: formData.get("tier") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("customer_addresses").insert({
    user_id: user.id,
    label: parsed.data.label || null,
    street: parsed.data.street,
    barangay: parsed.data.barangay || null,
    landmark: parsed.data.landmark || null,
    tier: parsed.data.tier,
  });
  if (error) return { status: "error", message: "Could not save address." };

  revalidatePath("/account");
  return { status: "added" };
}

export async function deleteAddress(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const supabase = await createClient();
  // RLS also enforces ownership; the user_id filter is belt-and-suspenders.
  await supabase.from("customer_addresses").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/account");
}

export async function setDefaultAddress(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const supabase = await createClient();
  await supabase.from("customer_addresses").update({ is_default: false }).eq("user_id", user.id);
  await supabase.from("customer_addresses").update({ is_default: true }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/account");
}
