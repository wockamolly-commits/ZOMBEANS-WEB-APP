-- Service-role table privileges for passkey operations.
-- RLS bypass alone does not provide underlying table privileges.

grant select, insert, update, delete on staff_passkeys to service_role;
grant select, insert, update, delete on staff_passkey_challenges to service_role;
grant select on profiles to service_role;