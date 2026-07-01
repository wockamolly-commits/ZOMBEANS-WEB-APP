-- Real-time rider dashboard: stream assignment and order changes straight to the
-- authenticated rider via Supabase Realtime (postgres_changes), so newly assigned
-- deliveries appear without a manual refresh.
--
-- This intentionally uses a fresh migration number. A previous 0053 rider
-- notifications migration existed in project history, so reusing 0053 can cause
-- deployed databases that recorded that version to skip this realtime setup.

alter table rider_assignments replica identity full;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rider_assignments'
  ) then
    execute 'alter publication supabase_realtime add table public.rider_assignments';
  end if;

  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    execute 'alter publication supabase_realtime add table public.orders';
  end if;
end $$;

notify pgrst, 'reload schema';
