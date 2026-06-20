-- supabase/migrations/0018_staff_order_ops.sql
-- Phase 2 (Admin Dashboard) — staff/admin order operations.
--
-- Status transitions and payment capture run through SECURITY DEFINER RPCs,
-- mirroring the customer-side place_order() pattern. The RPCs re-check the
-- caller's active staff profile so DEFINER cannot be
-- abused by non-staff. This keeps the status machine authoritative on the
-- server: the transition table, timestamps, and the order_status_events audit
-- row are written atomically in one transaction.

-- Advance an order's status with validation + audit trail.
create or replace function staff_set_order_status(
  p_order_id uuid,
  p_to       order_status,
  p_reason   text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_from order_status;
  v_mode service_mode;
begin
  if not exists (
    select 1 from profiles
    where id = v_uid and role in ('staff','admin') and is_active
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select status, service_mode into v_from, v_mode
    from orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Allowed transitions. Terminal states (completed/rejected/cancelled) have
  -- no outgoing edges, so any attempt from them falls through to the error.
  if not (
       (v_from = 'pending'          and p_to in ('accepted','rejected','cancelled'))
    or (v_from = 'accepted'         and p_to in ('preparing','cancelled'))
    or (v_from = 'preparing'        and p_to in ('ready','cancelled'))
    or (v_from = 'ready'            and p_to in ('out_for_delivery','completed'))
    or (v_from = 'out_for_delivery' and p_to = 'completed')
  ) then
    raise exception 'INVALID_TRANSITION:%->%', v_from, p_to using errcode = 'P0001';
  end if;

  -- Delivery orders must go out for delivery before completing.
  if v_from = 'ready' and p_to = 'completed' and v_mode = 'delivery' then
    raise exception 'DELIVERY_NEEDS_OFD' using errcode = 'P0001';
  end if;
  -- Only delivery orders use the out_for_delivery leg.
  if p_to = 'out_for_delivery' and v_mode <> 'delivery' then
    raise exception 'OFD_DELIVERY_ONLY' using errcode = 'P0001';
  end if;

  update orders set
    status                 = p_to,
    accepted_at            = case when p_to = 'accepted'  then now() else accepted_at end,
    accepted_by_profile_id = case when p_to = 'accepted'  then v_uid else accepted_by_profile_id end,
    ready_at               = case when p_to = 'ready'     then now() else ready_at end,
    completed_at           = case when p_to = 'completed' then now() else completed_at end,
    rejected_at            = case when p_to in ('rejected','cancelled') then now()    else rejected_at end,
    rejected_reason        = case when p_to in ('rejected','cancelled') then p_reason else rejected_reason end
  where id = p_order_id;

  insert into order_status_events (order_id, from_status, to_status, actor_profile_id, reason)
  values (p_order_id, v_from, p_to, v_uid, p_reason);
end;
$$;

-- Mark the order's payment captured at the counter (cash / manual GCash ref).
create or replace function staff_record_payment(
  p_order_id  uuid,
  p_reference text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not exists (
    select 1 from profiles
    where id = v_uid and role in ('staff','admin') and is_active
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  update payments set
    status                 = 'paid',
    paid_at                = now(),
    reference              = coalesce(nullif(p_reference,''), reference),
    recorded_by_profile_id = v_uid
  where order_id = p_order_id;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0001';
  end if;
end;
$$;

grant execute on function staff_set_order_status(uuid, order_status, text) to authenticated;
grant execute on function staff_record_payment(uuid, text) to authenticated;
