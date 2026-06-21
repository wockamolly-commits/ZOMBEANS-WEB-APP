-- Regular staff may browse the storefront but cannot place orders.
-- The single Super Admin may create normal or explicitly marked test orders.

alter table orders
  add column is_test boolean not null default false,
  add column placed_by_profile_id uuid references profiles(id);

create index orders_is_test_placed_at_idx on orders(is_test, placed_at desc);
create or replace function enforce_operations_ordering_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role user_role;
begin
  if v_uid is null then return new; end if;

  select role
  into v_role
  from profiles
  where id = v_uid and is_active;

  if v_role = 'staff' then
    raise exception 'STAFF_ORDERING_FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_role = 'admin' then
    new.placed_by_profile_id := v_uid;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_operations_ordering_policy_trigger on orders;
create trigger enforce_operations_ordering_policy_trigger
before insert on orders
for each row execute function enforce_operations_ordering_policy();

create or replace function super_admin_place_order(
  p_payload jsonb,
  p_is_test boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
  v_order_id uuid;
begin
  if not exists (
    select 1
    from profiles
    where id = v_uid
      and role = 'admin'
      and is_active
  ) then
    raise exception 'SUPER_ADMIN_REQUIRED' using errcode = 'P0001';
  end if;

  v_result := place_order(p_payload);
  v_order_id := (v_result->>'order_id')::uuid;

  update orders
  set is_test = coalesce(p_is_test, false),
      placed_by_profile_id = v_uid
  where id = v_order_id;

  insert into audit_logs (
    actor_profile_id,
    action,
    target_table,
    target_id,
    diff
  )
  values (
    v_uid,
    case
      when coalesce(p_is_test, false)
        then 'order.test_created'
      else 'order.super_admin_created'
    end,
    'orders',
    v_order_id::text,
    jsonb_build_object('is_test', coalesce(p_is_test, false))
  );

  return v_result || jsonb_build_object('is_test', coalesce(p_is_test, false));
end;
$$;

revoke all on function super_admin_place_order(jsonb, boolean) from public;
revoke all on function super_admin_place_order(jsonb, boolean) from anon;
grant execute on function super_admin_place_order(jsonb, boolean)
  to authenticated;
