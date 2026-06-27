-- Webstore availability: manual Open/Closed override (layered on top of the
-- time-based operating hours) plus a time-bound High Demand mode. Reuses the
-- singleton app_settings row; accepting_orders is the master Open/Closed switch
-- (already enforced in place_order).

alter table app_settings
  add column if not exists closure_reason_code text
    check (closure_reason_code in
      ('today','temporary','kitchen','inventory','maintenance','custom')),
  add column if not exists closure_note text,
  add column if not exists closed_until timestamptz,
  add column if not exists high_demand boolean not null default false,
  add column if not exists high_demand_minutes int,
  add column if not exists high_demand_until timestamptz;

-- Auto-clears expired states so the store reopens / leaves high-demand on its
-- own. Mirrors refresh_expired_menu_item_availability.
create or replace function refresh_expired_store_availability()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update app_settings
  set accepting_orders = true,
      closure_reason_code = null,
      closure_note = null,
      closed_until = null
  where id = 1
    and accepting_orders = false
    and closed_until is not null
    and closed_until <= now();

  update app_settings
  set high_demand = false,
      high_demand_minutes = null,
      high_demand_until = null
  where id = 1
    and high_demand = true
    and high_demand_until is not null
    and high_demand_until <= now();
end;
$$;

-- Narrow public read for the storefront. Refreshes expiries first, then returns
-- only the availability fields (no other app_settings columns leak to anon).
create or replace function get_store_availability()
returns table (
  accepting_orders boolean,
  closure_reason_code text,
  closure_note text,
  closed_until timestamptz,
  high_demand boolean,
  high_demand_minutes int,
  high_demand_until timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform refresh_expired_store_availability();

  return query
  select s.accepting_orders,
         s.closure_reason_code,
         s.closure_note,
         s.closed_until,
         s.high_demand,
         s.high_demand_minutes,
         s.high_demand_until
  from app_settings s
  where s.id = 1;
end;
$$;

grant execute on function get_store_availability() to anon, authenticated;
grant execute on function refresh_expired_store_availability() to anon, authenticated;
