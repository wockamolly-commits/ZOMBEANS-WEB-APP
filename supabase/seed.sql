-- ZomBeans menu seed — sourced from menu pages 1–4.
-- Prices in centavos (PHP × 100).

-- 1. Categories ----------------------------------------------------------
insert into menu_categories (slug, name, sort_order) values
  ('signature-drinks',    'Signature Drinks',     10),
  ('coffee',              'Coffee',               20),
  ('matcha',              'Matcha',               30),
  ('milk-series',         'Milk Series',          40),
  ('creamcheese-series',  'Creamcheese Series',   50),
  ('sparkling',           'Sparkling',            60),
  ('tea',                 'Tea',                  70),
  ('rice-bowls',          'Rice Bowls',           80),
  ('toasts',              'Toasts',               90),
  ('croffles',            'Croffles',             100),
  ('chicken',             'Chicken & Sandwiches', 110),
  ('sides',               'Sides',                120);

-- 2. Items --------------------------------------------------------------
-- Signature drinks
insert into menu_items (category_id, slug, name, description, image_url, is_bestseller, sort_order) values
  ((select id from menu_categories where slug='signature-drinks'), 'zomboss-drink',        'Zomboss Drink',         'House signature. Espresso, milk, and the secret syrup we don''t talk about.', '/images/drinks/zomboss-latte.png',       true,  10),
  ((select id from menu_categories where slug='signature-drinks'), 'spanish-latte',        'Spanish Latte',         'Espresso pulled long, condensed milk for that classic Spanish sweetness.',   '/images/drinks/spanish-latte.png',       true,  20),
  ((select id from menu_categories where slug='signature-drinks'), 'salted-caramel-latte', 'Salted Caramel Latte',  'Caramel, espresso, sea salt finish.',                                        '/images/drinks/salted-caramel-latte.png',true,  30),
  ((select id from menu_categories where slug='signature-drinks'), 'salted-latte',         'Salted Latte',          'Espresso and milk with a pinch of salt — clean, balanced, addictive.',       '/images/drinks/salted-latte.png',        false, 40),
  ((select id from menu_categories where slug='signature-drinks'), 'biscoff-latte',        'Biscoff Latte',         'Iced latte layered with Biscoff cream and a real Biscoff cookie.',           '/images/drinks/biscoff-latte.png',       true,  50);

-- Coffee
insert into menu_items (category_id, slug, name, description, image_url, is_bestseller, sort_order) values
  ((select id from menu_categories where slug='coffee'), 'americano',             'Americano',             'Two shots, hot or over ice. The honest one.',          '/images/drinks/iced-americano.png',       false, 10),
  ((select id from menu_categories where slug='coffee'), 'caramel-latte',         'Caramel Latte',         'Latte sweetened with house caramel.',                  '/images/drinks/caramel-latte.png',        false, 20),
  ((select id from menu_categories where slug='coffee'), 'hazelnut-latte',        'Hazelnut Latte',        'Nutty, smooth, all-day drinkable.',                    '/images/drinks/hazelnut-latte.png',       false, 30),
  ((select id from menu_categories where slug='coffee'), 'salted-hazelnut-latte', 'Salted Hazelnut Latte', 'Hazelnut with that signature salt finish.',            '/images/drinks/salted-hazelnut-latte.png',false, 40),
  ((select id from menu_categories where slug='coffee'), 'mocha-latte',           'Mocha Latte',           'Espresso, milk, dark chocolate.',                      '/images/drinks/mocha-latte.png',          false, 50);

-- Matcha
insert into menu_items (category_id, slug, name, description, image_url, is_bestseller, sort_order) values
  ((select id from menu_categories where slug='matcha'), 'matcha-latte',       'Matcha Latte',        'Ceremonial-grade matcha, whisked the slow way.',  '/images/drinks/matcha-latte.png',       true,  10),
  ((select id from menu_categories where slug='matcha'), 'clean-matcha',       'Clean Matcha',        'Matcha and water — no sweetener, no dairy.',      '/images/drinks/clean-matcha.png',       false, 20),
  ((select id from menu_categories where slug='matcha'), 'white-mocha-matcha', 'White Mocha Matcha',  'Matcha latte layered with white chocolate.',       '/images/drinks/white-mocha-matcha.png', false, 30),
  ((select id from menu_categories where slug='matcha'), 'chabako-matcha',     'Chabako Matcha',      'Premium reserve matcha for matcha purists.',       '/images/drinks/chabako-matcha.png',     false, 40),
  ((select id from menu_categories where slug='matcha'), 'creamcheese-latte',  'Creamcheese Latte',   'Espresso latte topped with whipped creamcheese.',  '/images/drinks/creamcheese-latte.png',  false, 50);

-- Milk series
insert into menu_items (category_id, slug, name, description, image_url, is_bestseller, sort_order) values
  ((select id from menu_categories where slug='milk-series'), 'strawberry-milk', 'Strawberry Milk', 'Fresh strawberry, milk, ice.',                 '/images/drinks/strawberry-milk.png', false, 10),
  ((select id from menu_categories where slug='milk-series'), 'blueberry-milk',  'Blueberry Milk',  'Blueberry compote layered with cold milk.',    '/images/drinks/blueberry-milk.png',  false, 20),
  ((select id from menu_categories where slug='milk-series'), 'ube-milk',        'Ube Milk',        'Purple ube, milk, ice. Pinoy comfort drink.',  '/images/drinks/ube-milk.png',        true,  30),
  ((select id from menu_categories where slug='milk-series'), 'mango-milk',      'Mango Milk',      'Mango puree and cold milk.',                    '/images/drinks/mango-milk.png',      false, 40),
  ((select id from menu_categories where slug='milk-series'), 'milo-overload',   'Milo Overload',   'Cold milk, double Milo, more Milo on top.',     '/images/drinks/milo-overload.png',   false, 50),
  ((select id from menu_categories where slug='milk-series'), 'choco-hq-blend',  'Choco HQ Blend',  'Rich chocolate blend, hot or cold.',            '/images/drinks/choco-hq.png',        false, 60);

-- Creamcheese series
insert into menu_items (category_id, slug, name, description, image_url, is_bestseller, sort_order) values
  ((select id from menu_categories where slug='creamcheese-series'), 'strawberry-creamcheese', 'Strawberry Creamcheese', 'Strawberry milk topped with whipped creamcheese.', '/images/drinks/strawberry-creamcheese.png', false, 10),
  ((select id from menu_categories where slug='creamcheese-series'), 'blueberry-creamcheese',  'Blueberry Creamcheese',  'Blueberry milk topped with whipped creamcheese.',  '/images/drinks/blueberry-creamcheese.png',  false, 20),
  ((select id from menu_categories where slug='creamcheese-series'), 'milo-creamcheese',       'Milo Creamcheese',       'Milo Overload with a thick creamcheese cap.',      '/images/drinks/milo-creamcheese.png',       false, 30);

-- Sparkling
insert into menu_items (category_id, slug, name, description, image_url, is_bestseller, sort_order) values
  ((select id from menu_categories where slug='sparkling'), 'sparkling-strawberry', 'Sparkling Strawberry', 'Strawberry over sparkling water. Light and crisp.', '/images/drinks/sparkling-strawberry.png', false, 10),
  ((select id from menu_categories where slug='sparkling'), 'sparkling-blueberry',  'Sparkling Blueberry',  'Blueberry over sparkling water.',                    '/images/drinks/sparkling-blueberry.png',  false, 20);

-- Tea
insert into menu_items (category_id, slug, name, description, image_url, is_bestseller, sort_order) values
  ((select id from menu_categories where slug='tea'), 'honey-lemon-tea',             'Honey Lemon Tea',              'Honey, lemon, hot or iced.',                     '/images/drinks/honey-lemon-tea.png',          true,  10),
  ((select id from menu_categories where slug='tea'), 'honey-lemon-pomegranate-tea', 'Honey Lemon Pomegranate Tea',  'Honey, lemon, pomegranate.',                     '/images/drinks/honey-lemon-pomegranate.png',  true,  20),
  ((select id from menu_categories where slug='tea'), 'honey-lemon-ginger-tea',      'Honey Lemon Ginger Tea',       'Honey, lemon, ginger — for when you need a reset.', '/images/drinks/honey-lemon-ginger.png',       false, 30),
  ((select id from menu_categories where slug='tea'), 'peach-oolong-tea',            'Peach Oolong Tea',             'Oolong steeped with fresh peach.',               '/images/drinks/peach-oolong-tea.png',         false, 40);

-- Rice bowls
insert into menu_items (category_id, slug, name, description, image_url, is_bestseller, sort_order) values
  ((select id from menu_categories where slug='rice-bowls'), 'bacon-bowl',                   'Bacon Bowl',                   'Bacon, egg, garlic rice, lettuce.',                    '/images/food/bacon-bowl.png',        true,  10),
  ((select id from menu_categories where slug='rice-bowls'), 'hungarian-bowl',               'Hungarian Bowl',               'Hungarian sausage, egg, garlic rice, lettuce.',        '/images/food/hungarian-bowl.png',    true,  20),
  ((select id from menu_categories where slug='rice-bowls'), 'tocino-bowl',                  'Tocino Bowl',                  'Chicken tocino, egg, garlic rice, lettuce.',           '/images/food/tocino-bowl.png',       true,  30),
  ((select id from menu_categories where slug='rice-bowls'), 'tapa-bowl',                    'Tapa Bowl',                    'Beef tapa, egg, garlic rice, lettuce.',                '/images/food/tapa-bowl.png',         false, 40),
  ((select id from menu_categories where slug='rice-bowls'), 'corned-beef-bowl',             'Corned Beef Bowl',             'Corned beef, egg, garlic rice, lettuce.',              '/images/food/corned-beef-bowl.png',  false, 50),
  ((select id from menu_categories where slug='rice-bowls'), 'longganisa-bowl',              'Longganisa Bowl',              'Longganisa, egg, garlic rice, lettuce.',               '/images/food/longganisa-bowl.png',   false, 60),
  ((select id from menu_categories where slug='rice-bowls'), 'chick-n-rice',                 'Chick''n Rice',                'Crispy chicken fillet, garlic rice, egg.',             '/images/food/chick-n-rice.png',      false, 70),
  ((select id from menu_categories where slug='rice-bowls'), 'burger-steak',                 'Burger Steak',                 'Beef burger steak, rice, egg, mushroom gravy.',        '/images/food/burger-steak.png',      true,  80),
  ((select id from menu_categories where slug='rice-bowls'), 'pork-belly-mushroom-gravy',    'Pork Belly with Mushroom Gravy','Breaded pork belly, rice, mushroom gravy.',            '/images/food/breaded-pork-belly.png',false, 90);

-- Toasts
insert into menu_items (category_id, slug, name, description, image_url, is_bestseller, sort_order) values
  ((select id from menu_categories where slug='toasts'), 'bacon-toast',  'Bacon Toast',  'Bacon, egg, wheat bread, lettuce, cheese, side dish.', '/images/food/bacon-toast.png',  true,  10),
  ((select id from menu_categories where slug='toasts'), 'salami-toast', 'Salami Toast', 'Salami, egg, wheat bread, lettuce, cheese, side dish.','/images/food/salami-toast.png', false, 20);

-- Croffles
insert into menu_items (category_id, slug, name, description, image_url, is_bestseller, sort_order) values
  ((select id from menu_categories where slug='croffles'), 'plain-croffles',                 'Plain Croffles',                 'Plain croffle, butter, syrup on the side.',           '/images/food/plain-croffles.png',                 false, 10),
  ((select id from menu_categories where slug='croffles'), 'biscoff-croffles',               'Biscoff Croffles',               'Croffle topped with Biscoff spread and crumbs.',      '/images/food/biscoff-croffles.png',               false, 20),
  ((select id from menu_categories where slug='croffles'), 'choco-almond-croffles',          'Choco Almond Croffles',          'Croffle with chocolate sauce and toasted almonds.',   '/images/food/choco-almond-croffles.png',          true,  30),
  ((select id from menu_categories where slug='croffles'), 'strawberry-creamcheese-croffles','Strawberry Creamcheese Croffles','Croffle topped with strawberry and creamcheese.',     '/images/food/strawberry-creamcheese-croffles.png',false, 40),
  ((select id from menu_categories where slug='croffles'), 'blueberry-creamcheese-croffles', 'Blueberry Creamcheese Croffles', 'Croffle topped with blueberry and creamcheese.',      '/images/food/blueberry-creamcheese-croffles.png', false, 50),
  ((select id from menu_categories where slug='croffles'), 'milo-overload-croffles',         'Milo Overload Croffles',         'Croffle drowned in chocolate sauce and Milo powder.', '/images/food/milo-overload-croffles.png',         false, 60);

-- Chicken & Sandwiches
insert into menu_items (category_id, slug, name, description, image_url, is_bestseller, sort_order) values
  ((select id from menu_categories where slug='chicken'), 'chick-n-fries',                    'Chick''n Fries',                  'Chicken fillet, crispy fries, choose a sauce.', '/images/food/chick-n-fries.png',                  true,  10),
  ((select id from menu_categories where slug='chicken'), 'chick-n-buns',                     'Chick''n Buns',                   'Buns, chicken fillet, veggies, sauce.',          '/images/food/chick-n-buns.png',                   true,  20),
  ((select id from menu_categories where slug='chicken'), 'chicken-ham-overload-sandwich',    'Chicken & Ham Overload Sandwich', 'Wheat bread, chicken fillet, ham, cheese, veggies.', '/images/food/chicken-and-ham-overload-sandwich.png', true,  30),
  ((select id from menu_categories where slug='chicken'), 'taco-burger',                      'Taco Burger',                     'Beef-packed tortilla, veggies, sauces, dip.',     '/images/food/taco-burger.png',                   true,  40),
  ((select id from menu_categories where slug='chicken'), 'chicken-salad',                    'Chicken Salad',                   'Chicken fillet, veggies, sauces.',                '/images/food/chick-n-salad.png',                 false, 50);

-- Sides
insert into menu_items (category_id, slug, name, description, image_url, is_bestseller, sort_order) values
  ((select id from menu_categories where slug='sides'), 'chick-n-chips',         'Chick''n Chips',         'Crispy chicken bites with chips.',                 '/images/food/chick-n-chips.png',          true,  10),
  ((select id from menu_categories where slug='sides'), 'nori-bites',            'Nori Bites',             'Crispy nori-seasoned bites.',                       '/images/food/nori-bites.png',             false, 20),
  ((select id from menu_categories where slug='sides'), 'wings-n-rice',          'Wings & Rice',           'Wings + garlic rice.',                              '/images/food/wings-n-rice.png',           false, 30),
  ((select id from menu_categories where slug='sides'), 'wings-n-wedges',        'Wings & Wedges',         'Wings + potato wedges.',                            '/images/food/wings-n-wedges.png',         false, 40),
  ((select id from menu_categories where slug='sides'), 'shawarma-fries',        'Shawarma Fries',         'Fries topped with shawarma seasoning and sauce.',   '/images/food/shawarma-fries.png',         false, 50),
  ((select id from menu_categories where slug='sides'), 'fries-wedges-with-dip', 'Fries & Wedges with Dip','Fries, wedges, choice of dip.',                     '/images/food/fries-n-wedges.png',         false, 60),
  ((select id from menu_categories where slug='sides'), 'flavored-fries',        'Flavored Fries',         'Fries with your choice of seasoning.',              '/images/food/flavored-fries.png',         false, 70),
  ((select id from menu_categories where slug='sides'), 'quesadilla',            'Quesadilla',             'Cheese-stuffed quesadilla, your choice of filling.','/images/food/quesadilla.png',             false, 80),
  ((select id from menu_categories where slug='sides'), 'nachos-overload',       'Nachos Overload',        'Cheesy nachos loaded with your choice of meat.',    '/images/food/cheesy-nachos-overload.png', false, 90);

-- 3. Variations ----------------------------------------------------------
-- Signature drinks
insert into item_variations (item_id, label, price_cents, is_default, sort_order) values
  ((select id from menu_items where slug='zomboss-drink'),        'Cold 16oz', 11000, true,  10),
  ((select id from menu_items where slug='zomboss-drink'),        'Cold 1L',   21500, false, 20),
  ((select id from menu_items where slug='spanish-latte'),        'Hot',       10000, false, 10),
  ((select id from menu_items where slug='spanish-latte'),        'Cold 16oz', 10000, true,  20),
  ((select id from menu_items where slug='spanish-latte'),        'Cold 1L',   19500, false, 30),
  ((select id from menu_items where slug='salted-caramel-latte'), 'Cold 16oz', 10500, true,  10),
  ((select id from menu_items where slug='salted-caramel-latte'), 'Cold 1L',   20500, false, 20),
  ((select id from menu_items where slug='salted-latte'),         'Cold 16oz', 11000, true,  10),
  ((select id from menu_items where slug='salted-latte'),         'Cold 1L',   21500, false, 20),
  ((select id from menu_items where slug='biscoff-latte'),        'Cold 16oz', 12500, true,  10),
  ((select id from menu_items where slug='biscoff-latte'),        'Cold 1L',   24500, false, 20);

-- Coffee
insert into item_variations (item_id, label, price_cents, is_default, sort_order) values
  ((select id from menu_items where slug='americano'),             'Hot',       6000,  false, 10),
  ((select id from menu_items where slug='americano'),             'Cold 16oz', 7000,  true,  20),
  ((select id from menu_items where slug='americano'),             'Cold 1L',   13500, false, 30),
  ((select id from menu_items where slug='caramel-latte'),         'Cold 16oz', 10500, true,  10),
  ((select id from menu_items where slug='caramel-latte'),         'Cold 1L',   20500, false, 20),
  ((select id from menu_items where slug='hazelnut-latte'),        'Cold 16oz', 11000, true,  10),
  ((select id from menu_items where slug='hazelnut-latte'),        'Cold 1L',   21500, false, 20),
  ((select id from menu_items where slug='salted-hazelnut-latte'), 'Cold 16oz', 11000, true,  10),
  ((select id from menu_items where slug='salted-hazelnut-latte'), 'Cold 1L',   21500, false, 20),
  ((select id from menu_items where slug='mocha-latte'),           'Cold 16oz', 10500, true,  10),
  ((select id from menu_items where slug='mocha-latte'),           'Cold 1L',   21500, false, 20);

-- Matcha
insert into item_variations (item_id, label, price_cents, is_default, sort_order) values
  ((select id from menu_items where slug='matcha-latte'),       'Hot',       11000, false, 10),
  ((select id from menu_items where slug='matcha-latte'),       'Cold 16oz', 11000, true,  20),
  ((select id from menu_items where slug='matcha-latte'),       'Cold 1L',   21500, false, 30),
  ((select id from menu_items where slug='clean-matcha'),       'Hot',       10000, false, 10),
  ((select id from menu_items where slug='clean-matcha'),       'Cold 1L',   19500, true,  20),
  ((select id from menu_items where slug='white-mocha-matcha'), 'Cold 16oz', 11500, true,  10),
  ((select id from menu_items where slug='white-mocha-matcha'), 'Cold 1L',   22500, false, 20),
  ((select id from menu_items where slug='chabako-matcha'),     'Cold 16oz', 17000, true,  10),
  ((select id from menu_items where slug='chabako-matcha'),     'Cold 1L',   33500, false, 20),
  ((select id from menu_items where slug='creamcheese-latte'),  'Cold 16oz', 11500, true,  10),
  ((select id from menu_items where slug='creamcheese-latte'),  'Cold 1L',   22500, false, 20);

-- Milk series
insert into item_variations (item_id, label, price_cents, is_default, sort_order) values
  ((select id from menu_items where slug='strawberry-milk'), 'Cold 16oz', 11000, true,  10),
  ((select id from menu_items where slug='strawberry-milk'), 'Cold 1L',   21500, false, 20),
  ((select id from menu_items where slug='blueberry-milk'),  'Cold 16oz', 11000, true,  10),
  ((select id from menu_items where slug='blueberry-milk'),  'Cold 1L',   21500, false, 20),
  ((select id from menu_items where slug='ube-milk'),        'Cold 16oz', 10500, true,  10),
  ((select id from menu_items where slug='ube-milk'),        'Cold 1L',   20500, false, 20),
  ((select id from menu_items where slug='mango-milk'),      'Cold 16oz', 10500, true,  10),
  ((select id from menu_items where slug='mango-milk'),      'Cold 1L',   20500, false, 20),
  ((select id from menu_items where slug='milo-overload'),   'Cold 16oz', 10500, true,  10),
  ((select id from menu_items where slug='milo-overload'),   'Cold 1L',   20500, false, 20),
  ((select id from menu_items where slug='choco-hq-blend'),  'Hot',       10500, false, 10),
  ((select id from menu_items where slug='choco-hq-blend'),  'Cold 16oz', 10500, true,  20),
  ((select id from menu_items where slug='choco-hq-blend'),  'Cold 1L',   20500, false, 30);

-- Creamcheese series
insert into item_variations (item_id, label, price_cents, is_default, sort_order) values
  ((select id from menu_items where slug='strawberry-creamcheese'), 'Cold 16oz', 11500, true,  10),
  ((select id from menu_items where slug='strawberry-creamcheese'), 'Cold 1L',   22500, false, 20),
  ((select id from menu_items where slug='blueberry-creamcheese'),  'Cold 16oz', 11500, true,  10),
  ((select id from menu_items where slug='blueberry-creamcheese'),  'Cold 1L',   22500, false, 20),
  ((select id from menu_items where slug='milo-creamcheese'),       'Cold 16oz', 11500, true,  10),
  ((select id from menu_items where slug='milo-creamcheese'),       'Cold 1L',   22500, false, 20);

-- Sparkling
insert into item_variations (item_id, label, price_cents, is_default, sort_order) values
  ((select id from menu_items where slug='sparkling-strawberry'), 'Cold 16oz', 8000,  true,  10),
  ((select id from menu_items where slug='sparkling-strawberry'), 'Cold 1L',   15500, false, 20),
  ((select id from menu_items where slug='sparkling-blueberry'),  'Cold 16oz', 8000,  true,  10),
  ((select id from menu_items where slug='sparkling-blueberry'),  'Cold 1L',   15500, false, 20);

-- Tea
insert into item_variations (item_id, label, price_cents, is_default, sort_order) values
  ((select id from menu_items where slug='honey-lemon-tea'),             'Hot',  7000, false, 10),
  ((select id from menu_items where slug='honey-lemon-tea'),             'Cold', 8000, true,  20),
  ((select id from menu_items where slug='honey-lemon-pomegranate-tea'), 'Hot',  7000, false, 10),
  ((select id from menu_items where slug='honey-lemon-pomegranate-tea'), 'Cold', 8000, true,  20),
  ((select id from menu_items where slug='honey-lemon-ginger-tea'),      'Hot',  7000, false, 10),
  ((select id from menu_items where slug='honey-lemon-ginger-tea'),      'Cold', 8000, true,  20),
  ((select id from menu_items where slug='peach-oolong-tea'),            'Hot',  7000, false, 10),
  ((select id from menu_items where slug='peach-oolong-tea'),            'Cold', 8000, true,  20);

-- Food: rice bowls (single price each)
insert into item_variations (item_id, label, price_cents, is_default, sort_order) values
  ((select id from menu_items where slug='bacon-bowl'),                'Regular', 14500, true, 10),
  ((select id from menu_items where slug='hungarian-bowl'),            'Regular', 13500, true, 10),
  ((select id from menu_items where slug='tocino-bowl'),               'Regular', 13500, true, 10),
  ((select id from menu_items where slug='tapa-bowl'),                 'Regular', 13500, true, 10),
  ((select id from menu_items where slug='corned-beef-bowl'),          'Regular', 14500, true, 10),
  ((select id from menu_items where slug='longganisa-bowl'),           'Regular', 12500, true, 10),
  ((select id from menu_items where slug='chick-n-rice'),              'Regular', 16500, true, 10),
  ((select id from menu_items where slug='burger-steak'),              'Regular', 15000, true, 10),
  ((select id from menu_items where slug='pork-belly-mushroom-gravy'), 'Regular', 15000, true, 10);

-- Toasts
insert into item_variations (item_id, label, price_cents, is_default, sort_order) values
  ((select id from menu_items where slug='bacon-toast'),  'Regular', 12500, true, 10),
  ((select id from menu_items where slug='salami-toast'), 'Regular', 12500, true, 10);

-- Croffles
insert into item_variations (item_id, label, price_cents, is_default, sort_order) values
  ((select id from menu_items where slug='plain-croffles'),                  'Regular', 9000,  true, 10),
  ((select id from menu_items where slug='biscoff-croffles'),                'Regular', 12000, true, 10),
  ((select id from menu_items where slug='choco-almond-croffles'),           'Regular', 11000, true, 10),
  ((select id from menu_items where slug='strawberry-creamcheese-croffles'), 'Regular', 13000, true, 10),
  ((select id from menu_items where slug='blueberry-creamcheese-croffles'),  'Regular', 13000, true, 10),
  ((select id from menu_items where slug='milo-overload-croffles'),          'Regular', 11000, true, 10);

-- Chicken & sandwiches
insert into item_variations (item_id, label, price_cents, is_default, sort_order) values
  ((select id from menu_items where slug='chick-n-fries'),                 'Regular', 17500, true, 10),
  ((select id from menu_items where slug='chick-n-buns'),                  'Regular', 16500, true, 10),
  ((select id from menu_items where slug='chicken-ham-overload-sandwich'), 'Regular', 17500, true, 10),
  ((select id from menu_items where slug='taco-burger'),                   'Regular', 14000, true, 10),
  ((select id from menu_items where slug='chicken-salad'),                 'Regular', 18000, true, 10);

-- Sides
insert into item_variations (item_id, label, price_cents, is_default, sort_order) values
  ((select id from menu_items where slug='chick-n-chips'),         'Regular', 14000, true,  10),
  ((select id from menu_items where slug='nori-bites'),            'Regular', 15000, true,  10),
  ((select id from menu_items where slug='wings-n-rice'),          'Regular', 19000, true,  10),
  ((select id from menu_items where slug='wings-n-wedges'),        'Regular', 24500, true,  10),
  ((select id from menu_items where slug='shawarma-fries'),        'Regular', 16000, true,  10),
  ((select id from menu_items where slug='fries-wedges-with-dip'), 'Regular', 12500, true,  10),
  ((select id from menu_items where slug='flavored-fries'),        'Regular', 11000, true,  10),
  ((select id from menu_items where slug='quesadilla'),            'Chicken', 14000, true,  10),
  ((select id from menu_items where slug='quesadilla'),            'Beef',    14500, false, 20),
  ((select id from menu_items where slug='nachos-overload'),       'Chicken', 24000, true,  10),
  ((select id from menu_items where slug='nachos-overload'),       'Beef',    24500, false, 20);

-- 4. Modifier groups + modifiers ----------------------------------------
-- Chick'n Fries sauce
with grp as (
  insert into item_modifier_groups (item_id, name, is_required, min_select, max_select, sort_order)
  values ((select id from menu_items where slug='chick-n-fries'), 'Sauce', true, 1, 1, 10)
  returning id
)
insert into item_modifiers (group_id, name, price_delta_cents)
select grp.id, x.name, 0
from grp, (values ('Cheesy Buffalo'), ('Garlic Buffalo'), ('Cheesy BBQ')) as x(name);

-- Flavored Fries seasoning
with grp as (
  insert into item_modifier_groups (item_id, name, is_required, min_select, max_select, sort_order)
  values ((select id from menu_items where slug='flavored-fries'), 'Seasoning', true, 1, 1, 10)
  returning id
)
insert into item_modifiers (group_id, name, price_delta_cents)
select grp.id, x.name, 0
from grp, (values ('Cheese'), ('BBQ'), ('Sour Cream')) as x(name);

-- Fries & Wedges dip choice
with grp as (
  insert into item_modifier_groups (item_id, name, is_required, min_select, max_select, sort_order)
  values ((select id from menu_items where slug='fries-wedges-with-dip'), 'Dip', true, 1, 1, 10)
  returning id
)
insert into item_modifiers (group_id, name, price_delta_cents)
select grp.id, x.name, 0
from grp, (values ('Cheese'), ('BBQ'), ('Garlic Mayo')) as x(name);
