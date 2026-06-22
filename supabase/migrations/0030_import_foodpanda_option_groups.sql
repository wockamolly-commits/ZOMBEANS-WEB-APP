-- Import the option/modifier data supplied from the existing Foodpanda setup.
-- This migration copies data and relationships only; the dashboard UI remains
-- the original Zombeans Menu Studio experience.

insert into menu_option_groups (name, description, is_active, sort_order)
values
  (
    'Choice of Milk Substitute',
    'Milk substitutions for eligible coffee and latte products.',
    true,
    10
  ),
  (
    'Choice of Flavor for Flavored Americano',
    'Flavor choices for Americano.',
    true,
    20
  ),
  (
    'Choice of Flavor for Chicken Fingers & Fries',
    'Sauce flavor choices for Chick''n Fries.',
    true,
    30
  ),
  (
    'Choice of Flavor for Fries',
    'Seasoning choices for Flavored Fries.',
    true,
    40
  ),
  (
    'Choice of Dip for Fries & Wedges',
    'Dip choices for Fries & Wedges with Dip.',
    true,
    50
  ),
  (
    'Choice of Extras for Drinks',
    'Optional drink add-ons and upgrades.',
    true,
    60
  ),
  (
    'Choice of Wings and Wedges',
    'Choose whether the wings include wedges and dip.',
    true,
    70
  ),
  (
    'Choice of Meat for Nachos Overload',
    'Meat choices for Nachos Overload.',
    true,
    80
  )
on conflict (name) do update
set description = excluded.description,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order;

-- Remove options not present in the supplied screenshots from the imported
-- groups, then upsert the exact names, prices, order, and availability states.
delete from menu_options option_row
using menu_option_groups group_row
where option_row.group_id = group_row.id
  and group_row.name in (
    'Choice of Milk Substitute',
    'Choice of Flavor for Flavored Americano',
    'Choice of Flavor for Chicken Fingers & Fries',
    'Choice of Flavor for Fries',
    'Choice of Dip for Fries & Wedges',
    'Choice of Extras for Drinks',
    'Choice of Wings and Wedges',
    'Choice of Meat for Nachos Overload'
  )
  and (group_row.name, option_row.name) not in (
    ('Choice of Milk Substitute', 'Sub Oatmilk'),
    ('Choice of Milk Substitute', 'Sub Breve'),
    ('Choice of Flavor for Flavored Americano', 'French Vanilla'),
    ('Choice of Flavor for Flavored Americano', 'Vanilla'),
    ('Choice of Flavor for Flavored Americano', 'White Chocolate'),
    ('Choice of Flavor for Flavored Americano', 'Honey'),
    ('Choice of Flavor for Chicken Fingers & Fries', 'Cheesy Buffalo'),
    ('Choice of Flavor for Chicken Fingers & Fries', 'Garlic Buffalo'),
    ('Choice of Flavor for Chicken Fingers & Fries', 'Cheesy BBQ'),
    ('Choice of Flavor for Fries', 'Cheese'),
    ('Choice of Flavor for Fries', 'Sour Cream'),
    ('Choice of Flavor for Fries', 'BBQ'),
    ('Choice of Dip for Fries & Wedges', 'Sour Cream'),
    ('Choice of Dip for Fries & Wedges', 'Cheese'),
    ('Choice of Dip for Fries & Wedges', 'BBQ'),
    ('Choice of Dip for Fries & Wedges', 'Buffalo'),
    ('Choice of Extras for Drinks', 'Caramel Sauce'),
    ('Choice of Extras for Drinks', 'Milk'),
    ('Choice of Extras for Drinks', 'Condensed'),
    ('Choice of Extras for Drinks', 'Espresso'),
    ('Choice of Extras for Drinks', 'Cold Foam'),
    ('Choice of Extras for Drinks', 'Chocolate Sauce'),
    ('Choice of Wings and Wedges', 'With Wedges & Dip'),
    ('Choice of Wings and Wedges', 'Without Wedges & Dip'),
    ('Choice of Meat for Nachos Overload', 'Beef'),
    ('Choice of Meat for Nachos Overload', 'Chicken')
  );

insert into menu_options (
  group_id,
  name,
  price_delta_cents,
  is_active,
  sort_order
)
select
  group_row.id,
  imported.name,
  imported.price_delta_cents,
  imported.is_active,
  imported.sort_order
from menu_option_groups group_row
join (
  values
    ('Choice of Milk Substitute', 'Sub Oatmilk', 4000::bigint, false, 10),
    ('Choice of Milk Substitute', 'Sub Breve', 4000::bigint, false, 20),

    ('Choice of Flavor for Flavored Americano', 'French Vanilla', 0::bigint, true, 10),
    ('Choice of Flavor for Flavored Americano', 'Vanilla', 0::bigint, true, 20),
    ('Choice of Flavor for Flavored Americano', 'White Chocolate', 0::bigint, true, 30),
    ('Choice of Flavor for Flavored Americano', 'Honey', 2000::bigint, true, 40),

    ('Choice of Flavor for Chicken Fingers & Fries', 'Cheesy Buffalo', 0::bigint, true, 10),
    ('Choice of Flavor for Chicken Fingers & Fries', 'Garlic Buffalo', 0::bigint, false, 20),
    ('Choice of Flavor for Chicken Fingers & Fries', 'Cheesy BBQ', 0::bigint, false, 30),

    ('Choice of Flavor for Fries', 'Cheese', 0::bigint, true, 10),
    ('Choice of Flavor for Fries', 'Sour Cream', 0::bigint, false, 20),
    ('Choice of Flavor for Fries', 'BBQ', 0::bigint, false, 30),

    ('Choice of Dip for Fries & Wedges', 'Sour Cream', 0::bigint, false, 10),
    ('Choice of Dip for Fries & Wedges', 'Cheese', 0::bigint, true, 20),
    ('Choice of Dip for Fries & Wedges', 'BBQ', 0::bigint, false, 30),
    ('Choice of Dip for Fries & Wedges', 'Buffalo', 0::bigint, true, 40),

    ('Choice of Extras for Drinks', 'Caramel Sauce', 2800::bigint, true, 10),
    ('Choice of Extras for Drinks', 'Milk', 2000::bigint, true, 20),
    ('Choice of Extras for Drinks', 'Condensed', 1400::bigint, true, 30),
    ('Choice of Extras for Drinks', 'Espresso', 4000::bigint, true, 40),
    ('Choice of Extras for Drinks', 'Cold Foam', 3500::bigint, true, 50),
    ('Choice of Extras for Drinks', 'Chocolate Sauce', 2800::bigint, true, 60),

    ('Choice of Wings and Wedges', 'With Wedges & Dip', 8000::bigint, true, 10),
    ('Choice of Wings and Wedges', 'Without Wedges & Dip', 0::bigint, true, 20),

    ('Choice of Meat for Nachos Overload', 'Beef', 500::bigint, true, 10),
    ('Choice of Meat for Nachos Overload', 'Chicken', 0::bigint, true, 20)
) as imported(group_name, name, price_delta_cents, is_active, sort_order)
  on imported.group_name = group_row.name
on conflict (group_id, name) do update
set price_delta_cents = excluded.price_delta_cents,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order;

-- Replace links for these imported groups so the relationships match the
-- supplied setup. Product slugs are used because they are stable identifiers.
delete from menu_item_option_groups link_row
using menu_option_groups group_row
where link_row.group_id = group_row.id
  and group_row.name in (
    'Choice of Milk Substitute',
    'Choice of Flavor for Flavored Americano',
    'Choice of Flavor for Chicken Fingers & Fries',
    'Choice of Flavor for Fries',
    'Choice of Dip for Fries & Wedges',
    'Choice of Extras for Drinks',
    'Choice of Wings and Wedges',
    'Choice of Meat for Nachos Overload'
  );

-- Foodpanda listed drink sizes rather than consistently displaying product
-- names. Link both drink-wide groups to the eligible Zombeans drink catalog.
insert into menu_item_option_groups (
  item_id,
  group_id,
  is_required,
  min_select,
  max_select,
  sort_order
)
select
  item_row.id,
  group_row.id,
  false,
  0,
  case
    when group_row.name = 'Choice of Extras for Drinks' then 6
    else 1
  end,
  group_row.sort_order
from menu_items item_row
join menu_categories category_row on category_row.id = item_row.category_id
cross join menu_option_groups group_row
where category_row.slug in (
  'signature-drinks',
  'coffee',
  'matcha',
  'milk-series',
  'creamcheese-series'
)
and group_row.name in (
  'Choice of Milk Substitute',
  'Choice of Extras for Drinks'
)
on conflict (item_id, group_id) do update
set is_required = excluded.is_required,
    min_select = excluded.min_select,
    max_select = excluded.max_select,
    sort_order = excluded.sort_order;

-- Direct one-product mappings. "Flavored Americano" maps to the current
-- Zombeans Americano item; the remaining labels map to their existing slugs.
insert into menu_item_option_groups (
  item_id,
  group_id,
  is_required,
  min_select,
  max_select,
  sort_order
)
select
  item_row.id,
  group_row.id,
  false,
  0,
  1,
  group_row.sort_order
from (
  values
    ('Choice of Flavor for Flavored Americano', 'americano'),
    ('Choice of Flavor for Chicken Fingers & Fries', 'chick-n-fries'),
    ('Choice of Flavor for Fries', 'flavored-fries'),
    ('Choice of Dip for Fries & Wedges', 'fries-wedges-with-dip'),
    ('Choice of Wings and Wedges', 'wings-n-wedges'),
    ('Choice of Meat for Nachos Overload', 'nachos-overload')
) as mapping(group_name, item_slug)
join menu_option_groups group_row on group_row.name = mapping.group_name
join menu_items item_row on item_row.slug = mapping.item_slug
on conflict (item_id, group_id) do update
set is_required = excluded.is_required,
    min_select = excluded.min_select,
    max_select = excluded.max_select,
    sort_order = excluded.sort_order;
