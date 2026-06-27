import "server-only";
import { createClient } from "@/lib/supabase/server";

export type StorefrontAvailability = {
  isAvailable: boolean;
  statusLabel: string | null;
  unavailableUntil: string | null;
};

type AvailabilityRow = {
  slug: string;
  is_active: boolean;
  unavailability_kind: "today" | "indefinite" | "until" | null;
  unavailable_until: string | null;
};

function formatUntil(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function toAvailability(row: AvailabilityRow): StorefrontAvailability {
  if (row.is_active) {
    return {
      isAvailable: true,
      statusLabel: null,
      unavailableUntil: null,
    };
  }

  if (row.unavailability_kind === "today") {
    return {
      isAvailable: false,
      statusLabel: "Unavailable today",
      unavailableUntil: row.unavailable_until,
    };
  }

  if (row.unavailability_kind === "until") {
    const until = formatUntil(row.unavailable_until);
    return {
      isAvailable: false,
      statusLabel: until ? `Unavailable until ${until}` : "Temporarily unavailable",
      unavailableUntil: row.unavailable_until,
    };
  }

  return {
    isAvailable: false,
    statusLabel: row.unavailability_kind === "indefinite"
      ? "Unavailable indefinitely"
      : "Unavailable",
    unavailableUntil: null,
  };
}

export async function getStorefrontAvailability(
  slugs: string[]
): Promise<Map<string, StorefrontAvailability>> {
  const uniqueSlugs = [...new Set(slugs)].filter(Boolean);
  if (!uniqueSlugs.length) return new Map();

  const supabase = await createClient();
  const result = await supabase.rpc("get_storefront_menu_item_availability", {
    p_slugs: uniqueSlugs,
  });
  if (result.error) {
    console.error("[storefront-availability]", result.error.message);
    return new Map();
  }

  return new Map(
    ((result.data ?? []) as AvailabilityRow[]).map((row) => [
      row.slug,
      toAvailability(row),
    ])
  );
}
