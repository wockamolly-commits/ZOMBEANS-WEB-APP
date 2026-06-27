export type MenuVariation = {
  id: string;
  label: string;
  price_cents: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
};

export type MenuItemOptionLink = {
  group_id: string;
  is_required: boolean;
  min_select: number;
  max_select: number;
  sort_order: number;
};

export type ManagedMenuItem = {
  id: string;
  category_id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  is_bestseller: boolean;
  is_active: boolean;
  unavailability_kind: "today" | "indefinite" | "until" | null;
  unavailable_until: string | null;
  sort_order: number;
  variations: MenuVariation[];
  option_links: MenuItemOptionLink[];
};

export type ManagedCategory = {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  items: ManagedMenuItem[];
};

export type ManagedOption = {
  id: string;
  group_id: string;
  name: string;
  price_delta_cents: number;
  is_active: boolean;
  sort_order: number;
};

export type ManagedOptionGroup = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  options: ManagedOption[];
  linked_item_ids: string[];
};

export type MenuManagementData = {
  categories: ManagedCategory[];
  optionGroups: ManagedOptionGroup[];
};
