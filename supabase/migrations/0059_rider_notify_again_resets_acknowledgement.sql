-- A rider can intentionally notify the customer again while waiting outside.
-- Treat that as a new arrival alert by clearing the previous customer
-- acknowledgement when customer_ring_at is refreshed.

create or replace function rider_mark_arrived(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := assert_active_rider();
  v_status order_status;
  v_mode service_mode;
begin
  select o.status, o.service_mode
  into v_status, v_mode
  from orders o
  join rider_assignments ra on ra.order_id = o.id
  where o.id = p_order_id
    and ra.rider_profile_id = v_uid
  for update of o, ra;

  if not found then
    raise exception 'ORDER_NOT_ASSIGNED' using errcode = 'P0001';
  end if;
  if v_mode <> 'delivery' then
    raise exception 'DELIVERY_ONLY' using errcode = 'P0001';
  end if;
  if v_status <> 'out_for_delivery' then
    raise exception 'INVALID_TRANSITION:%', v_status using errcode = 'P0001';
  end if;

  update rider_assignments
  set arrived_at = coalesce(arrived_at, now()),
      customer_ring_at = now(),
      customer_arrival_acknowledged_at = null
  where order_id = p_order_id
    and rider_profile_id = v_uid;

  insert into audit_logs (actor_profile_id, action, target_table, target_id)
  values (v_uid, 'rider_assignment.arrived', 'rider_assignments', p_order_id::text);
end;
$$;

revoke all on function rider_mark_arrived(uuid) from public;
revoke all on function rider_mark_arrived(uuid) from anon;
grant execute on function rider_mark_arrived(uuid) to authenticated;
