-- Manual payment confirmation belongs near handoff/completion, not while an
-- order is still new or being prepared.
create or replace function staff_record_payment(
  p_order_id  uuid,
  p_reference text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status order_status;
  v_method payment_method;
begin
  if not exists (
    select 1 from profiles
    where id = v_uid and role in ('staff','admin') and is_active
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select status
  into v_status
  from orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  select method
  into v_method
  from payments
  where order_id = p_order_id
  for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_method = 'cash' and v_status not in ('ready', 'out_for_delivery') then
    raise exception 'PAYMENT_STAGE_LOCKED' using errcode = 'P0001';
  end if;

  update payments set
    status                 = 'paid',
    paid_at                = now(),
    reference              = coalesce(nullif(p_reference,''), reference),
    recorded_by_profile_id = v_uid
  where order_id = p_order_id;
end;
$$;

grant execute on function staff_record_payment(uuid, text) to authenticated;
