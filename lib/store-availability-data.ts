import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  resolveStoreAvailability,
  type StoreAvailability,
  type StoreAvailabilityRow,
} from "@/lib/store-availability";

const OPEN_FALLBACK: StoreAvailability = {
  isOpen: true,
  closureReasonCode: null,
  closureLabel: null,
  closureNote: null,
  closedUntil: null,
  highDemand: false,
  highDemandUntil: null,
  prepBufferMinutes: 0,
};

export async function getStoreAvailability(): Promise<StoreAvailability> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_store_availability");
  if (error || !data || data.length === 0) {
    if (error) console.error("[store-availability]", error.message);
    return OPEN_FALLBACK;
  }
  return resolveStoreAvailability(data[0] as StoreAvailabilityRow);
}
