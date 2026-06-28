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

-- Recompute delivery fee + zone from coordinates via delivery_quote(), instead
-- of trusting a client-supplied tier. Everything else matches migration 0046.
create or replace function place_order(p_payload jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_settings app_settings%rowtype;
  v_short_code text;
  v_order_id uuid;
  v_order_item_id uuid;
  v_subtotal bigint := 0;
  v_delivery_fee bigint := 0;
  v_total bigint;
  v_service_mode service_mode;
  v_payment_method payment_method;
  v_pickup_time timestamptz;
  v_attempts int := 0;
  v_lines jsonb;
  v_line jsonb;
  v_delivery jsonb;
  v_qty int;
  v_var record;
  v_group record;
  v_option record;
  v_option_id uuid;
  v_option_ids uuid[];
  v_options jsonb;
  v_option_quantities jsonb;
  v_option_qty int;
  v_option_entry_count int;
  v_option_delta bigint;
  v_selected_count int;
  v_user_id uuid := auth.uid();
  v_dlat numeric;          -- MAPS: delivery coordinates
  v_dlng numeric;          -- MAPS
  v_in_zone boolean;       -- MAPS
begin
  perform refresh_expired_menu_item_availability();

  select * into v_settings from app_settings where id = 1;
  if not v_settings.accepting_orders then
    raise exception 'NOT_ACCEPTING' using errcode = 'P0001';
  end if;

  v_service_mode := (p_payload->>'service_mode')::service_mode;
  v_payment_method :=
    coalesce((p_payload->>'payment_method')::payment_method, 'cash');

  if v_service_mode = 'delivery' and v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  if coalesce(p_payload->>'customer_name', '') = '' then
    raise exception 'MISSING_NAME' using errcode = 'P0001';
  end if;

  v_lines := coalesce(p_payload->'lines', '[]'::jsonb);
  if jsonb_array_length(v_lines) = 0 then
    raise exception 'EMPTY_CART' using errcode = 'P0001';
  end if;

  if v_service_mode = 'pickup' then
    v_pickup_time := (p_payload->>'pickup_time')::timestamptz;
    if v_pickup_time is null then
      raise exception 'MISSING_PICKUP_TIME' using errcode = 'P0001';
    end if;
  elsif v_service_mode = 'delivery' then
    v_delivery := p_payload->'delivery';
    if v_delivery is null then
      raise exception 'MISSING_DELIVERY' using errcode = 'P0001';
    end if;
    -- MAPS: derive fee + zone from coordinates, not a client tier.
    v_dlat := (v_delivery->>'lat')::numeric;
    v_dlng := (v_delivery->>'lng')::numeric;
    if v_dlat is null or v_dlng is null then
      raise exception 'MISSING_DELIVERY_LOCATION' using errcode = 'P0001';
    end if;
    select q.in_zone, q.fee_cents
      into v_in_zone, v_delivery_fee
      from delivery_quote(v_dlat, v_dlng) q;
    if not v_in_zone then
      raise exception 'OUT_OF_ZONE' using errcode = 'P0001';
    end if;
  end if;

  if v_service_mode <> 'dine_in'
    and coalesce(p_payload->>'customer_phone', '') = ''
  then
    raise exception 'MISSING_PHONE' using errcode = 'P0001';
  end if;

  loop
    v_short_code := generate_short_code();
    exit when not exists (select 1 from orders where short_code = v_short_code);
    v_attempts := v_attempts + 1;
    if v_attempts >= 5 then
      raise exception 'SHORT_CODE_COLLISION' using errcode = 'P0001';
    end if;
  end loop;

  insert into orders (
    short_code, status, service_mode,
    customer_name, customer_phone, customer_email,
    table_id, pickup_time,
    subtotal_cents, delivery_fee_cents, total_cents,
    notes, user_id
  ) values (
    v_short_code, 'pending', v_service_mode,
    p_payload->>'customer_name',
    nullif(p_payload->>'customer_phone', ''),
    nullif(p_payload->>'customer_email', ''),
    null, v_pickup_time,
    0, v_delivery_fee, 0,
    nullif(p_payload->>'notes', ''), v_user_id
  ) returning id into v_order_id;

  for v_line in select * from jsonb_array_elements(v_lines) loop
    select
      iv.id as variation_id,
      iv.label as variation_label,
      iv.price_cents as price_cents,
      iv.item_id as item_id,
      iv.is_active as variation_active,
      mi.name as item_name,
      mi.is_active as item_active
    into v_var
    from item_variations iv
    join menu_items mi on mi.id = iv.item_id
    where mi.slug = v_line->>'item_slug'
      and iv.label = v_line->>'variation_label';

    if not found then
      raise exception 'INVALID_ITEM:%/%',
        v_line->>'item_slug', v_line->>'variation_label'
        using errcode = 'P0001';
    end if;
    if not v_var.item_active or not v_var.variation_active then
      raise exception 'ITEM_INACTIVE:%', v_var.item_name
        using errcode = 'P0001';
    end if;

    v_qty := (v_line->>'qty')::int;
    if v_qty is null or v_qty <= 0 or v_qty > 50 then
      raise exception 'INVALID_QTY' using errcode = 'P0001';
    end if;

    v_option_quantities := '{}'::jsonb;

    if v_line ? 'options' then
      v_options := coalesce(v_line->'options', '[]'::jsonb);
      if jsonb_typeof(v_options) <> 'array' then
        raise exception 'INVALID_OPTIONS' using errcode = 'P0001';
      end if;

      select
        count(*),
        coalesce(
          array_agg(option_id) filter (where option_id is not null),
          '{}'::uuid[]
        ),
        coalesce(
          jsonb_object_agg(option_id::text, option_qty)
            filter (where option_id is not null),
          '{}'::jsonb
        )
      into v_option_entry_count, v_option_ids, v_option_quantities
      from (
        select
          (entry->>'option_id')::uuid as option_id,
          coalesce((entry->>'qty')::int, (entry->>'quantity')::int, 1) as option_qty
        from jsonb_array_elements(v_options) as parsed(entry)
      ) parsed_options;

      if v_option_entry_count <> cardinality(v_option_ids) then
        raise exception 'INVALID_OPTIONS' using errcode = 'P0001';
      end if;

      if exists (
        select 1
        from jsonb_array_elements(v_options) as parsed(entry)
        where coalesce((entry->>'qty')::int, (entry->>'quantity')::int, 1) <= 0
           or coalesce((entry->>'qty')::int, (entry->>'quantity')::int, 1) > 50
      ) then
        raise exception 'INVALID_OPTION_QTY' using errcode = 'P0001';
      end if;
    else
      if jsonb_typeof(coalesce(v_line->'option_ids', '[]'::jsonb)) <> 'array' then
        raise exception 'INVALID_OPTIONS' using errcode = 'P0001';
      end if;

      select coalesce(array_agg(value::uuid), '{}'::uuid[])
      into v_option_ids
      from jsonb_array_elements_text(
        coalesce(v_line->'option_ids', '[]'::jsonb)
      );

      foreach v_option_id in array v_option_ids loop
        v_option_quantities :=
          v_option_quantities || jsonb_build_object(v_option_id::text, 1);
      end loop;
    end if;

    if cardinality(v_option_ids) <> (
      select count(distinct option_id)
      from unnest(v_option_ids) as selected(option_id)
    ) then
      raise exception 'DUPLICATE_OPTION' using errcode = 'P0001';
    end if;

    for v_group in
      select link.group_id, link.min_select, link.max_select, group_row.name
      from menu_item_option_groups link
      join menu_option_groups group_row on group_row.id = link.group_id
      where link.item_id = v_var.item_id
        and group_row.is_active
    loop
      select count(*)
      into v_selected_count
      from menu_options option_row
      where option_row.group_id = v_group.group_id
        and option_row.id = any(v_option_ids);

      if v_selected_count < v_group.min_select
        or v_selected_count > v_group.max_select
      then
        raise exception 'INVALID_OPTION_COUNT:%', v_group.name
          using errcode = 'P0001';
      end if;
    end loop;

    v_option_delta := 0;
    foreach v_option_id in array v_option_ids loop
      select
        option_row.id,
        option_row.name,
        option_row.price_delta_cents,
        group_row.name as group_name
      into v_option
      from menu_options option_row
      join menu_option_groups group_row
        on group_row.id = option_row.group_id
      join menu_item_option_groups link
        on link.group_id = group_row.id
       and link.item_id = v_var.item_id
      where option_row.id = v_option_id
        and option_row.is_active
        and group_row.is_active;

      if not found then
        raise exception 'INVALID_OPTION:%', v_option_id using errcode = 'P0001';
      end if;

      v_option_qty := coalesce((v_option_quantities->>(v_option_id::text))::int, 1);
      v_option_delta := v_option_delta + v_option.price_delta_cents * v_option_qty;
    end loop;

    insert into order_items (
      order_id, item_id, variation_id,
      item_name_snapshot, variation_label_snapshot,
      unit_price_cents, qty, line_total_cents
    ) values (
      v_order_id, v_var.item_id, v_var.variation_id,
      v_var.item_name, v_var.variation_label,
      v_var.price_cents + v_option_delta,
      v_qty,
      (v_var.price_cents + v_option_delta) * v_qty
    ) returning id into v_order_item_id;

    foreach v_option_id in array v_option_ids loop
      select
        option_row.id,
        option_row.name,
        option_row.price_delta_cents,
        group_row.name as group_name
      into v_option
      from menu_options option_row
      join menu_option_groups group_row
        on group_row.id = option_row.group_id
      where option_row.id = v_option_id;

      v_option_qty := coalesce((v_option_quantities->>(v_option_id::text))::int, 1);

      insert into order_item_options (
        order_item_id,
        option_id,
        group_name_snapshot,
        name_snapshot,
        price_delta_cents,
        quantity
      ) values (
        v_order_item_id,
        v_option.id,
        v_option.group_name,
        v_option.name,
        v_option.price_delta_cents,
        v_option_qty
      );
    end loop;

    v_subtotal :=
      v_subtotal + (v_var.price_cents + v_option_delta) * v_qty;
  end loop;

  if v_service_mode = 'delivery' then
    insert into delivery_addresses (
      order_id, street, barangay, city, landmark, delivery_notes,
      lat, lng, google_place_id                       -- MAPS: real coords + place id
    ) values (
      v_order_id,
      coalesce(v_delivery->>'street', ''),
      v_delivery->>'barangay',
      coalesce(v_delivery->>'city', 'San Carlos City'),
      v_delivery->>'landmark',
      v_delivery->>'delivery_notes',
      v_dlat,                                          -- MAPS
      v_dlng,                                          -- MAPS
      nullif(v_delivery->>'google_place_id', '')       -- MAPS
    );
  end if;

  v_total := v_subtotal + v_delivery_fee;
  update orders
  set subtotal_cents = v_subtotal,
      total_cents = v_total
  where id = v_order_id;

  insert into payments (order_id, method, status, amount_cents)
  values (v_order_id, v_payment_method, 'pending', v_total);

  insert into order_status_events (order_id, from_status, to_status)
  values (v_order_id, null, 'pending');

  return jsonb_build_object(
    'short_code', v_short_code,
    'order_id', v_order_id,
    'subtotal_cents', v_subtotal,
    'delivery_fee_cents', v_delivery_fee,
    'total_cents', v_total
  );
end;
$$;

grant execute on function place_order(jsonb) to anon, authenticated;

-- Saved addresses carry coordinates so deliveries re-quote exactly. tier is now
-- server-derived from coordinates at save time and becomes nullable (legacy
-- rows keep their tier and have no coordinates until re-pinned).
alter table customer_addresses
  add column if not exists lat numeric(10,7),
  add column if not exists lng numeric(10,7),
  add column if not exists google_place_id text;

alter table customer_addresses alter column tier drop not null;
