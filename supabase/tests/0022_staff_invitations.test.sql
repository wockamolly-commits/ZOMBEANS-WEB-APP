begin;
do $$ begin
  if not exists (select 1 from pg_class where relname = 'staff_invitations' and relrowsecurity) then raise exception 'TEST FAILED: RLS disabled'; end if;
  if has_function_privilege('anon', 'accept_staff_invitation(text)', 'EXECUTE') then raise exception 'TEST FAILED: anon execute'; end if;
  if not has_function_privilege('authenticated', 'accept_staff_invitation(text)', 'EXECUTE') then raise exception 'TEST FAILED: authenticated missing execute'; end if;
  raise notice 'PASS: invitation privileges correctly scoped';
end $$;
rollback;
