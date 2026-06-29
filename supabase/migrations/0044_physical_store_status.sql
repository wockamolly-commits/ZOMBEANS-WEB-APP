-- Store Availability v2: a manual physical-store (walk-in cafe) status that is
-- independent of the webstore (accepting_orders). Adds physical columns, a
-- unified closure-reason set shared by both statuses, extends the expiry refresh
-- and the storefront read RPC.

-- v1 (0043) put an inline CHECK on closure_reason_code with the old reason set.
-- Drop it (auto-generated name) and the new unified CHECK is added below.
alter table app_settings
  drop constraint if exists app_settings_closure_reason_code_check,
  drop constraint if exists app_settings_physical_closure_reason_code_check;

alter table app_settings
  add column if not exists physical_open boolean not null default true,
  add column if not exists physical_closure_reason_code text,
  add column if not exists physical_closure_note text,
  add column if not exists physical_closed_until timestamptz;

-- Normalize any persisted v1 reasons before tightening the CHECK set.
update app_settings
set closure_reason_code = case closure_reason_code
  when 'today' then 'end_of_hours'
  when 'temporary' then 'maintenance'
  when 'kitchen' then 'staff'
  else closure_reason_code
end
where closure_reason_code in ('today','temporary','kitchen');

-- Unified reason set for BOTH statuses. NULL allowed (open state).
alter table app_settings
  add constraint app_settings_closure_reason_code_check
    check (closure_reason_code in
      ('end_of_hours','maintenance','staff','inventory','emergency','high_volume','custom')),
  add constraint app_settings_physical_closure_reason_code_check
    check (physical_closure_reason_code in
      ('end_of_hours','maintenance','staff','inventory','emergency','high_volume','custom'));

-- Auto-clear expired states for webstore, physical store, and high demand.
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
  set physical_open = true,
      physical_closure_reason_code = null,
      physical_closure_note = null,
      physical_closed_until = null
  where id = 1
    and physical_open = false
    and physical_closed_until is not null
    and physical_closed_until <= now();

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

-- Storefront read: refresh expiries, then return webstore + physical + high
-- demand fields (no other app_settings columns leak to anon).
drop function if exists get_store_availability();

create or replace function get_store_availability()
returns table (
  accepting_orders boolean,
  closure_reason_code text,
  closure_note text,
  closed_until timestamptz,
  physical_open boolean,
  physical_closure_reason_code text,
  physical_closure_note text,
  physical_closed_until timestamptz,
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
         s.physical_open,
         s.physical_closure_reason_code,
         s.physical_closure_note,
         s.physical_closed_until,
         s.high_demand,
         s.high_demand_minutes,
         s.high_demand_until
  from app_settings s
  where s.id = 1;
end;
$$;

grant execute on function get_store_availability() to anon, authenticated;
