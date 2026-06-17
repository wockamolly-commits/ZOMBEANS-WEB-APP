import "server-only";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type SavedAddress = {
  id: string;
  label: string | null;
  street: string;
  barangay: string | null;
  landmark: string | null;
  city: string;
  tier: "tier-2" | "tier-4" | "tier-6";
  is_default: boolean;
};

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export async function getCustomerProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("customer_profiles")
    .select("display_name, phone")
    .eq("id", user.id)
    .single();
  return data ?? { display_name: null, phone: null };
}

export async function getSavedAddresses(): Promise<SavedAddress[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("customer_addresses")
    .select("id, label, street, barangay, landmark, city, tier, is_default")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  return (data as SavedAddress[] | null) ?? [];
}
