-- Narrow public RPC for storefront product availability badges.
-- This avoids direct table reads for inactive menu_items while keeping the
-- customer payload limited to status fields.

create or replace function get_storefront_menu_item_availability(p_slugs text[])
returns table (
  slug text,
  is_active boolean,
  unavailability_kind text,
  unavailable_until timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform refresh_expired_menu_item_availability();

  return query
  select
    mi.slug,
    mi.is_active,
    mi.unavailability_kind,
    mi.unavailable_until
  from menu_items mi
  where mi.slug = any(p_slugs);
end;
$$;

grant execute on function get_storefront_menu_item_availability(text[])
  to anon, authenticated;
