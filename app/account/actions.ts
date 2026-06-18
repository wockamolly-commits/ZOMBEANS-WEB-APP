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
