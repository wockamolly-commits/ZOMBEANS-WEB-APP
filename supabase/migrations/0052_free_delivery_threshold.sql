-- Delivery orders with a subtotal of PHP 750 or more get the delivery fee
-- waived automatically. Checkout mirrors this in TypeScript, but the database
-- remains authoritative for stored orders and pending payment amounts.

create or replace function apply_free_delivery_threshold_to_order()
returns trigger
language plpgsql
as $$
begin
  if new.service_mode = 'delivery'
    and new.subtotal_cents >= 75000
  then
    new.delivery_fee_cents := 0;
  end if;

  new.total_cents := new.subtotal_cents + new.delivery_fee_cents;
  return new;
end;
$$;

drop trigger if exists apply_free_delivery_threshold_to_order_trigger on orders;
create trigger apply_free_delivery_threshold_to_order_trigger
before insert or update of service_mode, subtotal_cents, delivery_fee_cents, total_cents
on orders
for each row
execute function apply_free_delivery_threshold_to_order();

create or replace function sync_initial_payment_with_free_delivery_order()
returns trigger
language plpgsql
as $$
declare
  v_total bigint;
begin
  select total_cents
    into v_total
    from orders
    where id = new.order_id
      and service_mode = 'delivery'
      and subtotal_cents >= 75000;

  if found then
    new.amount_cents := v_total;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_initial_payment_with_free_delivery_order_trigger on payments;
create trigger sync_initial_payment_with_free_delivery_order_trigger
before insert on payments
for each row
when (new.status = 'pending')
execute function sync_initial_payment_with_free_delivery_order();

update orders
set delivery_fee_cents = 0,
    total_cents = subtotal_cents
where service_mode = 'delivery'
  and subtotal_cents >= 75000
  and delivery_fee_cents <> 0;

update payments p
set amount_cents = o.total_cents
from orders o
where p.order_id = o.id
  and p.status = 'pending'
  and o.service_mode = 'delivery'
  and o.subtotal_cents >= 75000
  and p.amount_cents <> o.total_cents;
