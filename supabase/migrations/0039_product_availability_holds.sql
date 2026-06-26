-- Temporary product unavailability windows for Menu Studio.

alter table menu_items
  add column if not exists unavailability_kind text,
  add column if not exists unavailable_until timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'menu_items_unavailability_kind_check'
  ) then
    alter table menu_items
      add constraint menu_items_unavailability_kind_check
      check (
        unavailability_kind is null
        or unavailability_kind in ('today', 'indefinite', 'until')
      );
  end if;
end $$;

create index if not exists menu_items_unavailable_until_idx
  on menu_items(unavailable_until)
  where unavailable_until is not null;

create or replace function refresh_expired_menu_item_availability()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update menu_items
  set is_active = true,
      unavailability_kind = null,
      unavailable_until = null
  where is_active = false
    and unavailable_until is not null
    and unavailable_until <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function refresh_expired_menu_item_availability()
  to anon, authenticated;

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
  v_tier text;
  v_qty int;
  v_var record;
  v_group record;
  v_option record;
  v_option_id uuid;
  v_option_ids uuid[];
  v_option_delta bigint;
  v_selected_count int;
  v_user_id uuid := auth.uid();
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
    v_tier := v_delivery->>'tier';
    v_delivery_fee := case v_tier
      when 'tier-2' then 3000
      when 'tier-4' then 4000
      when 'tier-6' then 5000
      else null
    end;
    if v_delivery_fee is null then
      raise exception 'INVALID_DELIVERY_TIER' using errcode = 'P0001';
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

    if jsonb_typeof(coalesce(v_line->'option_ids', '[]'::jsonb)) <> 'array' then
      raise exception 'INVALID_OPTIONS' using errcode = 'P0001';
    end if;

    select coalesce(array_agg(value::uuid), '{}'::uuid[])
    into v_option_ids
    from jsonb_array_elements_text(
      coalesce(v_line->'option_ids', '[]'::jsonb)
    );

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
      v_option_delta := v_option_delta + v_option.price_delta_cents;
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

      insert into order_item_options (
        order_item_id,
        option_id,
        group_name_snapshot,
        name_snapshot,
        price_delta_cents
      ) values (
        v_order_item_id,
        v_option.id,
        v_option.group_name,
        v_option.name,
        v_option.price_delta_cents
      );
    end loop;

    v_subtotal :=
      v_subtotal + (v_var.price_cents + v_option_delta) * v_qty;
  end loop;

  if v_service_mode = 'delivery' then
    insert into delivery_addresses (
      order_id, street, barangay, city, landmark, delivery_notes, lat, lng
    ) values (
      v_order_id,
      coalesce(v_delivery->>'street', ''),
      v_delivery->>'barangay',
      coalesce(v_delivery->>'city', 'San Carlos City'),
      v_delivery->>'landmark',
      v_delivery->>'delivery_notes',
      coalesce((v_delivery->>'lat')::numeric, v_settings.store_lat),
      coalesce((v_delivery->>'lng')::numeric, v_settings.store_lng)
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
