-- GRANTs for the customer account tables — companion to 0015_customer_rls.sql.
-- 0014 created customer_profiles/customer_addresses and 0015 added RLS, but this
-- project grants explicitly (see 0010) rather than relying on default
-- privileges. Without these grants the authenticated client gets 42501
-- (permission denied) before RLS is ever evaluated. RLS (0015) still gates rows.

-- Customers manage their own profile + addresses (rows scoped by RLS).
grant select, insert, update on customer_profiles  to authenticated;
grant select, insert, update, delete on customer_addresses to authenticated;
