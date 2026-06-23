-- Team management server actions use the service-role client. Bypassing RLS
-- does not bypass table privileges, so revoking access needs explicit grants.

grant select, update on profiles to service_role;
grant insert on audit_logs to service_role;
grant usage, select on sequence audit_logs_id_seq to service_role;
