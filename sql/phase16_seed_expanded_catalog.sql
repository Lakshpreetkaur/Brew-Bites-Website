-- ==============================================================================
-- PHASE 16: EXPANDED PRODUCT CATALOG SEED MIGRATION
-- 3 Categories: 'coffee' (6 products), 'snacks' (6 products), 'dessert' (6 products)
-- ==============================================================================

INSERT INTO public.products (id, name, category, description, price, image, accent_color, available)
VALUES
  -- A. COFFEE & COLD BREWS
  ('classic-black', 'Classic Black', 'coffee', 'Pure slow-steeped 18-hour cold brew with rich notes of dark cocoa and toasted hazelnut.', 4.50, 'assets/images/classic-black.jpg', 'bg-tertiary-fixed', true),
  ('vanilla-cold-brew', 'Vanilla Cold Brew', 'coffee', 'Velvety smooth cold brew infused with pure Madagascar vanilla bean and creamy oat milk.', 5.25, 'assets/images/vanilla-cold-brew.jpg', 'bg-primary-fixed', true),
  ('caramel-cloud', 'Caramel Cloud', 'coffee', 'Chilled dark roast espresso topped with rich salted caramel cold foam and amber drizzle.', 5.75, 'assets/images/caramel-cloud.jpg', 'bg-secondary-fixed', true),
  ('mocha-chill', 'Mocha Chill', 'coffee', 'Single-origin espresso blended with decadent Belgian dark chocolate and chilled whole milk.', 5.50, 'assets/images/mocha-chill.jpg', 'bg-tertiary-fixed-dim', true),
  ('hazelnut-cold-brew', 'Hazelnut Cold Brew', 'coffee', 'Slow-steeped signature roast layered with roasted Piedmont hazelnut essence and sweet cream.', 5.25, 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=600&q=80', 'bg-secondary-fixed-dim', true),
  ('iced-spanish-latte', 'Iced Spanish Latte', 'coffee', 'Bold espresso pulled over sweetened textured condensed milk and crystalline ice.', 5.50, 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=600&q=80', 'bg-primary-fixed-dim', true),

  -- B. SNACKS
  ('cheese-croissant', 'Cheese Croissant', 'snacks', 'Flaky, golden French butter croissant baked with aged Gruyère and melted sharp cheddar.', 4.75, 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80', 'bg-secondary-fixed', true),
  ('veggie-sandwich', 'Veggie Sandwich', 'snacks', 'Garden-fresh avocado, fire-roasted bell peppers, English cucumber, and herb hummus on sourdough.', 6.25, 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80', 'bg-tertiary-fixed', true),
  ('garlic-croissant', 'Garlic Croissant', 'snacks', 'Crispy layered butter pastry brushed with roasted garlic herb butter, sea salt, and fresh parsley.', 4.50, 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', 'bg-primary-fixed', true),
  ('cream-cheese-bagel', 'Cream Cheese Bagel', 'snacks', 'Toasted artisan everything bagel generously smeared with whipped chive and scallion cream cheese.', 4.95, 'https://images.unsplash.com/photo-1585478259715-876a6a81ae08?auto=format&fit=crop&w=600&q=80', 'bg-secondary-fixed-dim', true),
  ('herb-sandwich', 'Herb Sandwich', 'snacks', 'Grilled rosemary chicken or roasted paneer with wild greens, sun-dried tomato pesto on artisan loaf.', 6.50, 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=600&q=80', 'bg-tertiary-fixed-dim', true),
  ('loaded-toast', 'Loaded Toast', 'snacks', 'Thick-cut rustic brioche loaded with chunky smashed avocado, cherry heirloom tomatoes, and hemp seeds.', 5.50, 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80', 'bg-primary-fixed-dim', true),

  -- C. DESSERT
  ('choco-chunk-cookie', 'Choco-Chunk Cookie', 'dessert', 'Warm, chewy golden cookie packed with dark Belgian chocolate chunks and flaky Maldon sea salt.', 3.75, 'assets/images/choco-chunk-cookie.jpg', 'bg-secondary-fixed', true),
  ('double-chocolate-muffin', 'Double Chocolate Muffin', 'dessert', 'Moist Dutch cocoa muffin filled with molten fudge center and studded with dark chocolate pearls.', 4.25, 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?auto=format&fit=crop&w=600&q=80', 'bg-tertiary-fixed', true),
  ('blueberry-muffin', 'Blueberry Muffin', 'dessert', 'Freshly baked vanilla buttermilk muffin bursting with plump wild blueberries and crispy cinnamon streusel.', 4.25, 'https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=600&q=80', 'bg-primary-fixed', true),
  ('cinnamon-roll', 'Cinnamon Roll', 'dessert', 'Pillowy sweet dough swirled with aromatic Saigon cinnamon brown sugar and smothered in cream cheese glaze.', 4.50, 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', 'bg-secondary-fixed-dim', true),
  ('almond-croissant', 'Almond Croissant', 'dessert', 'Twice-baked butter croissant filled with velvety frangipane almond cream and crowned with toasted sliced almonds.', 4.75, 'https://images.unsplash.com/photo-1623334044303-25108675b7e8?auto=format&fit=crop&w=600&q=80', 'bg-tertiary-fixed-dim', true),
  ('chocolate-brownie', 'Chocolate Brownie', 'dessert', 'Ultra-fudgy espresso-infused dark chocolate brownie with a shiny delicate crinkle top and walnuts.', 3.95, 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80', 'bg-primary-fixed-dim', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  image = EXCLUDED.image,
  accent_color = EXCLUDED.accent_color,
  available = EXCLUDED.available,
  updated_at = now();
