-- Operations staff (cashiers) manage option availability the same way they
-- already manage product/category availability. The original option-table
-- policies (0028) allowed writes for super admins only, which silently blocked
-- staff setOptionAvailability updates under RLS and hid inactive options from
-- the menu dashboard. Align the option tables with the product-table model
-- (0008): operations staff may read and write; the app layer gates which staff
-- may *configure* (menu:configure) vs only toggle availability (menu:availability).

drop policy if exists "super admin writes option groups" on menu_option_groups;
drop policy if exists "super admin writes options" on menu_options;
drop policy if exists "super admin writes option links" on menu_item_option_groups;

create policy "staff write option groups"
  on menu_option_groups for all
  using (current_role_kind() in ('staff','admin'))
  with check (current_role_kind() in ('staff','admin'));
create policy "staff write options"
  on menu_options for all
  using (current_role_kind() in ('staff','admin'))
  with check (current_role_kind() in ('staff','admin'));
create policy "staff write option links"
  on menu_item_option_groups for all
  using (current_role_kind() in ('staff','admin'))
  with check (current_role_kind() in ('staff','admin'));
