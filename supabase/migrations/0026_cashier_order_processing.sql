-- The cashier is the sole live-order operator and may process any order,
-- including one they placed. Keep online payment confirmation provider-only
-- and retain the payment audit trigger from 0025.

drop trigger if exists prevent_own_order_status_change_trigger on orders;
drop function if exists prevent_own_order_status_change();

drop trigger if exists prevent_own_order_payment_change_trigger on payments;
drop function if exists prevent_own_order_payment_change();

drop trigger if exists prevent_own_order_rider_assignment_trigger
  on rider_assignments;
drop function if exists prevent_own_order_rider_assignment();

drop function if exists order_is_linked_to_actor(uuid, uuid);
drop function if exists normalize_order_phone(text);

create or replace function require_provider_for_online_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if new.status = 'paid'
    and new.status is distinct from old.status
    and old.method <> 'cash'
    and exists (
      select 1
      from profiles
      where id = v_uid
        and role in ('staff', 'admin')
        and is_active
    )
  then
    raise exception 'ONLINE_PAYMENT_WEBHOOK_REQUIRED' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function require_provider_for_online_payment() from public;

create trigger require_provider_for_online_payment_trigger
before update on payments
for each row execute function require_provider_for_online_payment();
