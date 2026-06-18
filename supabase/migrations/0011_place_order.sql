-- place_order() — the customer-facing checkout RPC.
-- Validates the cart against menu_items + item_variations,
-- recomputes the subtotal server-side, generates a unique short code,
-- inserts orders + order_items + delivery_address + initial payment
-- in one transaction.

-- Seed 12 dine-in tables so dine_in orders have something to attach.
insert into tables (label) values
  ('T-01'),('T-02'),('T-03'),('T-04'),('T-05'),('T-06'),
  ('T-07'),('T-08'),('T-09'),('T-10'),('T-11'),('T-12')
on conflict (label) do nothing;

create or replace function place_order(p_payload jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_settings   app_settings%rowtype;
  v_short_code text;
  v_order_id   uuid;
  v_subtotal   bigint := 0;
  v_delivery_fee bigint := 0;
  v_total      bigint;
  v_service_mode service_mode;
  v_payment_method payment_method;
  v_table_id   uuid;
  v_pickup_time timestamptz;
  v_attempts   int := 0;
  v_lines      jsonb;
  v_line       jsonb;
  v_delivery   jsonb;
  v_tier       text;
  v_qty        int;
  v_var        record;
begin
  -- 0. Settings + accepting_orders gate
  select * into v_settings from app_settings where id = 1;
  if not v_settings.accepting_orders then
    raise exception 'NOT_ACCEPTING' using errcode = 'P0001';
  end if;

  -- 1. Required fields
  v_service_mode   := (p_payload->>'service_mode')::service_mode;
  v_payment_method := coalesce((p_payload->>'payment_method')::payment_method, 'cash');

  if coalesce(p_payload->>'customer_name','') = '' then
    raise exception 'MISSING_NAME' using errcode = 'P0001';
  end if;

  v_lines := coalesce(p_payload->'lines', '[]'::jsonb);
  if jsonb_array_length(v_lines) = 0 then
    raise exception 'EMPTY_CART' using errcode = 'P0001';
  end if;

  -- 2. Service-mode-specific fields
  if v_service_mode = 'dine_in' then
    if coalesce(p_payload->>'table_label','') = '' then
      raise exception 'MISSING_TABLE' using errcode = 'P0001';
    end if;
    select id into v_table_id
      from tables
      where label = p_payload->>'table_label' and is_active;
    if v_table_id is null then
      raise exception 'INVALID_TABLE' using errcode = 'P0001';
    end if;

  elsif v_service_mode = 'pickup' then
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

  -- Phone required when not dining in
  if v_service_mode <> 'dine_in'
     and coalesce(p_payload->>'customer_phone','') = '' then
    raise exception 'MISSING_PHONE' using errcode = 'P0001';
  end if;

  -- 3. Unique short code (retry on collision)
  loop
    v_short_code := generate_short_code();
    exit when not exists (select 1 from orders where short_code = v_short_code);
    v_attempts := v_attempts + 1;
    if v_attempts >= 5 then
      raise exception 'SHORT_CODE_COLLISION' using errcode = 'P0001';
    end if;
  end loop;

  -- 4. Insert the order shell; totals updated after items
  insert into orders (
    short_code, status, service_mode,
    customer_name, customer_phone, customer_email,
    table_id, pickup_time,
    subtotal_cents, delivery_fee_cents, total_cents,
    notes
  ) values (
    v_short_code, 'pending', v_service_mode,
    p_payload->>'customer_name',
    nullif(p_payload->>'customer_phone',''),
    nullif(p_payload->>'customer_email',''),
    v_table_id, v_pickup_time,
    0, v_delivery_fee, 0,
    nullif(p_payload->>'notes','')
  ) returning id into v_order_id;

  -- 5. Re-price each line against the live menu
  for v_line in select * from jsonb_array_elements(v_lines) loop
    select iv.id            as variation_id,
           iv.label          as variation_label,
           iv.price_cents    as price_cents,
           iv.item_id        as item_id,
           iv.is_active      as variation_active,
           mi.name           as item_name,
           mi.is_active      as item_active
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

    insert into order_items (
      order_id, item_id, variation_id,
      item_name_snapshot, variation_label_snapshot,
      unit_price_cents, qty, line_total_cents
    ) values (
      v_order_id, v_var.item_id, v_var.variation_id,
      v_var.item_name, v_var.variation_label,
      v_var.price_cents, v_qty, v_var.price_cents * v_qty
    );

    v_subtotal := v_subtotal + v_var.price_cents * v_qty;
  end loop;

  -- 6. Delivery address (when applicable)
  if v_service_mode = 'delivery' then
    insert into delivery_addresses (
      order_id, street, barangay, city, landmark, delivery_notes, lat, lng
    ) values (
      v_order_id,
      coalesce(v_delivery->>'street',''),
      v_delivery->>'barangay',
      coalesce(v_delivery->>'city','San Carlos City'),
      v_delivery->>'landmark',
      v_delivery->>'delivery_notes',
      coalesce((v_delivery->>'lat')::numeric, v_settings.store_lat),
      coalesce((v_delivery->>'lng')::numeric, v_settings.store_lng)
    );
  end if;

  -- 7. Persist totals
  v_total := v_subtotal + v_delivery_fee;
  update orders
    set subtotal_cents = v_subtotal,
        total_cents    = v_total
    where id = v_order_id;

  -- 8. Initial payment row (pending; staff confirms in dashboard)
  insert into payments (order_id, method, status, amount_cents)
  values (v_order_id, v_payment_method, 'pending', v_total);

  -- 9. Initial status event for the audit trail
  insert into order_status_events (order_id, from_status, to_status)
  values (v_order_id, null, 'pending');

  return jsonb_build_object(
    'short_code',         v_short_code,
    'order_id',           v_order_id,
    'subtotal_cents',     v_subtotal,
    'delivery_fee_cents', v_delivery_fee,
    'total_cents',        v_total
  );
end;
$$;

grant execute on function place_order(jsonb) to anon, authenticated;
