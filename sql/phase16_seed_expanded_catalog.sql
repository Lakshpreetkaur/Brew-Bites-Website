-- ==============================================================================
-- PHASE 16: EXPANDED 18 PRODUCT CATALOG SEED MIGRATION
-- 3 Categories: 'coffee' (6 products), 'savory' (6 products), 'sweet' (6 products)
-- ==============================================================================

INSERT INTO public.products (id, name, category, description, price, image, accent_color, available)
VALUES
  -- CATEGORY 1: COFFEE & COLD BREWS
  ('classic-cold-brew', 'Classic Cold Brew', 'coffee', 'Pure slow-steeped 18-hour cold brew with rich notes of dark cocoa and toasted hazelnut.', 4.50, 'assets/images/classic-black.jpg', 'bg-tertiary-fixed', true),
  ('vanilla-cold-brew', 'Vanilla Cold Brew', 'coffee', 'Velvety smooth cold brew infused with pure Madagascar vanilla bean and creamy oat milk.', 5.25, 'assets/images/vanilla-cold-brew.jpg', 'bg-primary-fixed', true),
  ('caramel-cloud', 'Caramel Cloud', 'coffee', 'Chilled dark roast espresso topped with rich salted caramel cold foam and amber drizzle.', 5.75, 'assets/images/caramel-cloud.jpg', 'bg-secondary-fixed', true),
  ('mocha-chill', 'Mocha Chill', 'coffee', 'Single-origin espresso blended with decadent Belgian dark chocolate and chilled whole milk.', 5.50, 'assets/images/mocha-chill.jpg', 'bg-tertiary-fixed-dim', true),
  ('hazelnut-cold-brew', 'Hazelnut Cold Brew', 'coffee', 'Slow-steeped signature roast layered with roasted Piedmont hazelnut essence and sweet cream.', 5.25, 'assets/images/hazelnut-cold-brew.jpg', 'bg-secondary-fixed-dim', true),
  ('iced-spanish-latte', 'Iced Spanish Latte', 'coffee', 'Bold espresso pulled over sweetened textured condensed milk and crystalline ice.', 5.50, 'assets/images/iced-spanish-latte.jpg', 'bg-primary-fixed-dim', true),

  -- CATEGORY 2: SAVORY BITES
  ('cheese-croissant', 'Cheese Croissant', 'savory', 'Flaky, golden French butter croissant baked with aged Gruyère and melted sharp cheddar.', 4.75, 'assets/images/cheese-croissant.jpg', 'bg-secondary-fixed', true),
  ('garlic-herb-croissant', 'Garlic Herb Croissant', 'savory', 'Crispy layered butter pastry brushed with roasted garlic herb butter, sea salt, and fresh parsley.', 4.50, 'assets/images/garlic-herb-croissant.jpg', 'bg-primary-fixed', true),
  ('veggie-cream-cheese-bagel', 'Veggie Cream Cheese Bagel', 'savory', 'Toasted artisan everything bagel smeared with whipped scallion cream cheese and cucumber.', 4.95, 'assets/images/veggie-cream-cheese-bagel.jpg', 'bg-secondary-fixed-dim', true),
  ('grilled-cheese-sandwich', 'Grilled Cheese Sandwich', 'savory', 'Golden toasted artisanal sourdough filled with melted aged cheddar and melted Gruyère.', 6.25, 'assets/images/grilled-cheese-sandwich.jpg', 'bg-tertiary-fixed', true),
  ('herb-cheese-toast', 'Herb & Cheese Toast', 'savory', 'Toasted artisan sourdough with whipped ricotta, melted mozzarella, rosemary, and olive oil.', 5.75, 'assets/images/herb-cheese-toast.jpg', 'bg-tertiary-fixed-dim', true),
  ('loaded-veggie-toast', 'Loaded Veggie Toast', 'savory', 'Thick-cut rustic brioche loaded with smashed avocado, cherry heirloom tomatoes, and seeds.', 5.50, 'assets/images/loaded-veggie-toast.jpg', 'bg-primary-fixed-dim', true),

  -- CATEGORY 3: SWEET BITES
  ('choco-chunk-cookie', 'Choco-Chunk Cookie', 'sweet', 'Warm, chewy golden cookie packed with dark Belgian chocolate chunks and flaky Maldon sea salt.', 3.75, 'assets/images/choco-chunk-cookie.jpg', 'bg-secondary-fixed', true),
  ('double-chocolate-muffin', 'Double Chocolate Muffin', 'sweet', 'Moist Dutch cocoa muffin filled with molten fudge center and dark chocolate pearls.', 4.25, 'assets/images/double-chocolate-muffin.jpg', 'bg-tertiary-fixed', true),
  ('blueberry-muffin', 'Blueberry Muffin', 'sweet', 'Freshly baked vanilla buttermilk muffin bursting with plump wild blueberries and streusel.', 4.25, 'assets/images/blueberry-muffin.jpg', 'bg-primary-fixed', true),
  ('cinnamon-roll', 'Cinnamon Roll', 'sweet', 'Pillowy sweet dough swirled with Saigon cinnamon brown sugar and cream cheese glaze.', 4.50, 'assets/images/cinnamon-roll.jpg', 'bg-secondary-fixed-dim', true),
  ('almond-croissant', 'Almond Croissant', 'sweet', 'Twice-baked butter croissant filled with frangipane almond cream and toasted sliced almonds.', 4.75, 'assets/images/almond-croissant.jpg', 'bg-tertiary-fixed-dim', true),
  ('fudge-brownie', 'Fudge Brownie', 'sweet', 'Ultra-fudgy espresso-infused dark chocolate brownie with a delicate crinkle top.', 3.95, 'assets/images/fudge-brownie.jpg', 'bg-primary-fixed-dim', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  image = EXCLUDED.image,
  accent_color = EXCLUDED.accent_color,
  available = EXCLUDED.available,
  updated_at = now();
