-- Maps-powered delivery: an authoritative server-side delivery quote computed
-- from coordinates (haversine), used by both place_order and the live checkout
-- quote. Task 2 appends the place_order redefinition to this same file.

create or replace function delivery_quote(p_lat numeric, p_lng numeric)
returns table(in_zone boolean, distance_km numeric, tier text, fee_cents bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_settings app_settings%rowtype;
  v_dist numeric;
  v_max_km numeric;
  v_fee bigint;
begin
  select * into v_settings from app_settings where id = 1;

  -- Haversine distance (km) store -> point.
  v_dist := 2 * 6371 * asin(sqrt(
    power(sin(radians(p_lat - v_settings.store_lat) / 2), 2) +
    cos(radians(v_settings.store_lat)) * cos(radians(p_lat)) *
    power(sin(radians(p_lng - v_settings.store_lng) / 2), 2)
  ));
  v_dist := round(v_dist, 2);

  if v_dist > v_settings.delivery_max_km then
    return query select false, v_dist, null::text, null::bigint;
    return;
  end if;

  -- First tier whose max_km is at or above the distance.
  select (t->>'max_km')::numeric, (t->>'fee_cents')::bigint
    into v_max_km, v_fee
  from jsonb_array_elements(v_settings.delivery_fee_tiers) as t
  where (t->>'max_km')::numeric >= v_dist
  order by (t->>'max_km')::numeric asc
  limit 1;

  if v_max_km is null then
    return query select false, v_dist, null::text, null::bigint;
    return;
  end if;

  return query
    select true, v_dist, 'tier-' || (v_max_km)::int::text, v_fee;
end;
$$;

grant execute on function delivery_quote(numeric, numeric) to anon, authenticated;
