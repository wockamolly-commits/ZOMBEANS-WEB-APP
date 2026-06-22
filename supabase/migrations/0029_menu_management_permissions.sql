-- Menu management uses the signed-in Super Admin session.
-- Add the audit and Storage permissions required by that workflow.

grant insert on audit_logs to authenticated;
grant usage, select on sequence audit_logs_id_seq to authenticated;

create policy "super admin inserts menu audit logs"
  on audit_logs for insert
  with check (
    public.current_role_kind() = 'admin'
    and actor_profile_id = auth.uid()
    and action like 'menu.%'
  );

create policy "super admin uploads menu images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'menu-images'
    and public.current_role_kind() = 'admin'
  );

create policy "super admin updates menu images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'menu-images'
    and public.current_role_kind() = 'admin'
  )
  with check (
    bucket_id = 'menu-images'
    and public.current_role_kind() = 'admin'
  );

create policy "super admin deletes menu images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'menu-images'
    and public.current_role_kind() = 'admin'
  );
