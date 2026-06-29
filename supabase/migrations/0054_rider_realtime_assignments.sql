-- Ensure assigned deliveries can wake rider dashboards immediately.
-- Notifications are already added in 0053; rider_assignments gives the active
-- deliveries list a direct real-time signal for new assignments/reassignments.

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
end $$;

notify pgrst, 'reload schema';
