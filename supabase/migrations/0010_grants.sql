-- Postgres GRANTs — companion to 0008_rls.sql.
-- RLS policies (0008) decide WHICH rows a role can see, but the
-- underlying GRANT decides whether the role can even attempt to
-- touch the table. Without these grants the anon client gets 42501.

-- Anon (the guest customer in their browser) reads the menu.
grant select on menu_categories,
                menu_items,
                item_variations,
                item_modifier_groups,
                item_modifiers
  to anon, authenticated;

-- Anon can call the customer-facing RPCs.
grant execute on function get_order_by_code(text) to anon, authenticated;

-- Authenticated roles (staff/admin/rider) need underlying access
-- on operational tables; RLS in 0008 gates rows by role.
grant select on orders,
                order_items,
                order_item_modifiers,
                delivery_addresses,
                payments,
                order_status_events,
                loyverse_sync,
                profiles,
                riders,
                rider_assignments,
                tables,
                app_settings,
                notifications,
                audit_logs
  to authenticated;

grant insert, update, delete on
                menu_categories,
                menu_items,
                item_variations,
                item_modifier_groups,
                item_modifiers,
                orders,
                order_items,
                order_item_modifiers,
                delivery_addresses,
                payments,
                order_status_events,
                profiles,
                riders,
                rider_assignments,
                tables,
                app_settings
  to authenticated;

-- App settings: anon also reads (store hours, delivery zones).
grant select on app_settings to anon;
