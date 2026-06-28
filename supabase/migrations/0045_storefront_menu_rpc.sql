-- Narrow public RPC for the customer-facing menu catalog.
-- This keeps storefront reads off the base tables while exposing only the
-- active categories/products and active sellable variations needed to render
-- the webstore.

create or replace function get_storefront_menu()
returns table (
  category_slug text,
  category_name text,
  category_sort_order int,
  item_slug text,
  item_name text,
  item_description text,
  item_image_url text,
  item_is_bestseller boolean,
  item_sort_order int,
  variation_label text,
  variation_price_cents bigint,
  variation_is_default boolean,
  variation_sort_order int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform refresh_expired_menu_item_availability();

  return query
  select
    category_row.slug,
    category_row.name,
    category_row.sort_order,
    item_row.slug,
    item_row.name,
    item_row.description,
    item_row.image_url,
    item_row.is_bestseller,
    item_row.sort_order,
    variation_row.label,
    variation_row.price_cents,
    variation_row.is_default,
    variation_row.sort_order
  from menu_categories category_row
  join menu_items item_row
    on item_row.category_id = category_row.id
  join item_variations variation_row
    on variation_row.item_id = item_row.id
  where category_row.is_active
    and item_row.is_active
    and variation_row.is_active
  order by
    category_row.sort_order,
    category_row.name,
    item_row.sort_order,
    item_row.name,
    variation_row.sort_order;
end;
$$;

grant execute on function get_storefront_menu() to anon, authenticated;
