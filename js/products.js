/**
 * Brew & Bite - Product Catalog Data Layer (products.js)
 * Authoritative database-driven product model connecting to Supabase `products` table.
 *
 * Supabase Schema:
 * - public.products: (id, name, category, description, price, image, accent_color, available, created_at, updated_at)
 */

// Default image fallbacks for newly created products without an image
const DEFAULT_COFFEE_IMAGE = "https://lh3.googleusercontent.com/aida-public/AB6AXuAtSiT_nuRPIxzhj711u9ztYqTFzl0Z4q3f1qZeoxCMm12hYlHJrQPx_1AqNFrrecyeXojJdwdqXzgSR3nRcUB479GqfpmYBN7FB2iPxiUk6BRwGjOTKLg9OuLoBJr3li9iFrleZ6Tzb5sjIwglBYcgJDwZUsMFmj4FNvjNpp61OJ95CaYEu3MUHYlDafF5ixP55sP-ptpitvlUBkcLxTNZdb4qm26_T-0bENJsIz-Js25dN40TPB2NYA";
const DEFAULT_BITE_IMAGE = "https://lh3.googleusercontent.com/aida-public/AB6AXuCLKhoQuUwFMcB6cvwqpvy3l01CLRMOQ023hE2yalcGxkf6NoPB_U-ItebPRcs4Xafj_RT8Z9sPUN9gPOX3AJDDI9gdGpmzymvjXSk8Lo3lvvQtVQ3mW9uyAsWg5DD6yJW4N6OnfHArvRcDKat_o2zGlDjO_c4msJNaC_Ofvbc7F2EjTnRI1uIOXO3v19aK4jiIEv8fK_yhnsptodn8fsEPY8bf5ByjLzR62ajmzkC3bbL4eDFYvtOPQA";

// Normalization helper for category ('coffee' | 'snacks' | 'dessert')
function normalizeCategory(cat) {
  if (!cat) return 'coffee';
  const c = String(cat).trim().toLowerCase();
  if (c === 'dessert' || c === 'desserts' || c.includes('sweet') || c.includes('cookie') || c.includes('muffin') || c.includes('cake') || c.includes('roll') || c.includes('brownie')) {
    return 'dessert';
  }
  if (c === 'snacks' || c === 'snack' || c.includes('sandwich') || c.includes('bagel') || c.includes('toast') || c.includes('savory') || c.includes('cheese-croissant') || c.includes('garlic-croissant')) {
    return 'snacks';
  }
  if (c === 'coffee' || c.includes('cold-brew') || c.includes('latte') || c.includes('espresso') || c.includes('mocha') || c.includes('brew')) {
    return 'coffee';
  }
  if (c.includes('bite') || c.includes('bakery') || c.includes('food')) {
    return 'snacks';
  }
  return 'coffee';
}

// Normalization helper for product availability
function normalizeProductAvailable(val) {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 't';
  }
  if (typeof val === 'number') return val === 1;
  if (val === undefined || val === null) return true; // Default to true if unassigned
  return Boolean(val);
}

// Initial / Fallback Static Products Catalog (Expanded 18 Products across 3 Categories)
const STATIC_PRODUCTS = [
  // ==========================================
  // CATEGORY A: COFFEE & COLD BREWS (6 Products)
  // ==========================================
  {
    id: "classic-black",
    name: "Classic Black",
    category: "coffee",
    description: "Pure slow-steeped 18-hour cold brew with rich notes of dark cocoa and toasted hazelnut.",
    price: 4.50,
    image: "assets/images/classic-black.jpg",
    accentColor: "bg-tertiary-fixed",
    available: true
  },
  {
    id: "vanilla-cold-brew",
    name: "Vanilla Cold Brew",
    category: "coffee",
    description: "Velvety smooth cold brew infused with pure Madagascar vanilla bean and creamy oat milk.",
    price: 5.25,
    image: "assets/images/vanilla-cold-brew.jpg",
    accentColor: "bg-primary-fixed",
    available: true
  },
  {
    id: "caramel-cloud",
    name: "Caramel Cloud",
    category: "coffee",
    description: "Chilled dark roast espresso topped with rich salted caramel cold foam and amber drizzle.",
    price: 5.75,
    image: "assets/images/caramel-cloud.jpg",
    accentColor: "bg-secondary-fixed",
    available: true
  },
  {
    id: "mocha-chill",
    name: "Mocha Chill",
    category: "coffee",
    description: "Single-origin espresso blended with decadent Belgian dark chocolate and chilled whole milk.",
    price: 5.50,
    image: "assets/images/mocha-chill.jpg",
    accentColor: "bg-tertiary-fixed-dim",
    available: true
  },
  {
    id: "hazelnut-cold-brew",
    name: "Hazelnut Cold Brew",
    category: "coffee",
    description: "Slow-steeped signature roast layered with roasted Piedmont hazelnut essence and sweet cream.",
    price: 5.25,
    image: "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=600&q=80",
    accentColor: "bg-secondary-fixed-dim",
    available: true
  },
  {
    id: "iced-spanish-latte",
    name: "Iced Spanish Latte",
    category: "coffee",
    description: "Bold espresso pulled over sweetened textured condensed milk and crystalline ice.",
    price: 5.50,
    image: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=600&q=80",
    accentColor: "bg-primary-fixed-dim",
    available: true
  },

  // ==========================================
  // CATEGORY B: SNACKS (6 Products)
  // ==========================================
  {
    id: "cheese-croissant",
    name: "Cheese Croissant",
    category: "snacks",
    description: "Flaky, golden French butter croissant baked with aged Gruyère and melted sharp cheddar.",
    price: 4.75,
    image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80",
    accentColor: "bg-secondary-fixed",
    available: true
  },
  {
    id: "veggie-sandwich",
    name: "Veggie Sandwich",
    category: "snacks",
    description: "Garden-fresh avocado, fire-roasted bell peppers, English cucumber, and herb hummus on sourdough.",
    price: 6.25,
    image: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80",
    accentColor: "bg-tertiary-fixed",
    available: true
  },
  {
    id: "garlic-croissant",
    name: "Garlic Croissant",
    category: "snacks",
    description: "Crispy layered butter pastry brushed with roasted garlic herb butter, sea salt, and fresh parsley.",
    price: 4.50,
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80",
    accentColor: "bg-primary-fixed",
    available: true
  },
  {
    id: "cream-cheese-bagel",
    name: "Cream Cheese Bagel",
    category: "snacks",
    description: "Toasted artisan everything bagel generously smeared with whipped chive and scallion cream cheese.",
    price: 4.95,
    image: "https://images.unsplash.com/photo-1585478259715-876a6a81ae08?auto=format&fit=crop&w=600&q=80",
    accentColor: "bg-secondary-fixed-dim",
    available: true
  },
  {
    id: "herb-sandwich",
    name: "Herb Sandwich",
    category: "snacks",
    description: "Grilled rosemary chicken or roasted paneer with wild greens, sun-dried tomato pesto on artisan loaf.",
    price: 6.50,
    image: "https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=600&q=80",
    accentColor: "bg-tertiary-fixed-dim",
    available: true
  },
  {
    id: "loaded-toast",
    name: "Loaded Toast",
    category: "snacks",
    description: "Thick-cut rustic brioche loaded with chunky smashed avocado, cherry heirloom tomatoes, and hemp seeds.",
    price: 5.50,
    image: "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80",
    accentColor: "bg-primary-fixed-dim",
    available: true
  },

  // ==========================================
  // CATEGORY C: DESSERT (6 Products)
  // ==========================================
  {
    id: "choco-chunk-cookie",
    name: "Choco-Chunk Cookie",
    category: "dessert",
    description: "Warm, chewy golden cookie packed with dark Belgian chocolate chunks and flaky Maldon sea salt.",
    price: 3.75,
    image: "assets/images/choco-chunk-cookie.jpg",
    accentColor: "bg-secondary-fixed",
    available: true
  },
  {
    id: "double-chocolate-muffin",
    name: "Double Chocolate Muffin",
    category: "dessert",
    description: "Moist Dutch cocoa muffin filled with molten fudge center and studded with dark chocolate pearls.",
    price: 4.25,
    image: "https://images.unsplash.com/photo-1607958996333-41aef7caefaa?auto=format&fit=crop&w=600&q=80",
    accentColor: "bg-tertiary-fixed",
    available: true
  },
  {
    id: "blueberry-muffin",
    name: "Blueberry Muffin",
    category: "dessert",
    description: "Freshly baked vanilla buttermilk muffin bursting with plump wild blueberries and crispy cinnamon streusel.",
    price: 4.25,
    image: "https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=600&q=80",
    accentColor: "bg-primary-fixed",
    available: true
  },
  {
    id: "cinnamon-roll",
    name: "Cinnamon Roll",
    category: "dessert",
    description: "Pillowy sweet dough swirled with aromatic Saigon cinnamon brown sugar and smothered in cream cheese glaze.",
    price: 4.50,
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80",
    accentColor: "bg-secondary-fixed-dim",
    available: true
  },
  {
    id: "almond-croissant",
    name: "Almond Croissant",
    category: "dessert",
    description: "Twice-baked butter croissant filled with velvety frangipane almond cream and crowned with toasted sliced almonds.",
    price: 4.75,
    image: "https://images.unsplash.com/photo-1623334044303-25108675b7e8?auto=format&fit=crop&w=600&q=80",
    accentColor: "bg-tertiary-fixed-dim",
    available: true
  },
  {
    id: "chocolate-brownie",
    name: "Chocolate Brownie",
    category: "dessert",
    description: "Ultra-fudgy espresso-infused dark chocolate brownie with a shiny delicate crinkle top and walnuts.",
    price: 3.95,
    image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80",
    accentColor: "bg-primary-fixed-dim",
    available: true
  }
];

// Active live in-memory product catalog
let PRODUCTS = [];
let isProductsLoading = false;
let isProductsLoaded = false;
let productsLoadError = null;

// Subscribers for catalog updates
const productUpdateListeners = [];

/**
 * Register a listener callback to run whenever the product catalog is updated from Supabase.
 */
function onProductsUpdated(callback) {
  if (typeof callback === 'function') {
    productUpdateListeners.push(callback);
    // If products are already loaded, invoke callback immediately
    if (isProductsLoaded && PRODUCTS.length > 0) {
      try {
        callback(PRODUCTS);
      } catch (e) {
        console.warn("Product listener immediate execution notice:", e);
      }
    }
  }
}

/**
 * Notify all subscribers that products have been updated.
 */
function notifyProductsUpdated() {
  productUpdateListeners.forEach(fn => {
    try {
      fn(PRODUCTS);
    } catch (e) {
      console.warn("Product listener execution notice:", e);
    }
  });
}

/**
 * Retrieve a specific product by its unique string ID.
 */
function getProductById(productId) {
  if (!productId) return null;
  const targetId = String(productId).trim();
  if (Array.isArray(PRODUCTS) && PRODUCTS.length > 0) {
    const found = PRODUCTS.find(p => p.id === targetId);
    if (found) return found;
  }
  return STATIC_PRODUCTS.find(p => p.id === targetId) || null;
}

/**
 * Fetch authoritative product catalog dynamically from Supabase `products` table.
 */
async function fetchProductsFromSupabase(retryCount = 0) {
  isProductsLoading = true;
  productsLoadError = null;

  // If supabaseClient is not yet ready, wait briefly and retry up to 5 times
  if (typeof supabaseClient === 'undefined' || !supabaseClient) {
    if (retryCount < 5) {
      setTimeout(() => fetchProductsFromSupabase(retryCount + 1), 100);
      return;
    }
    console.warn("Supabase client not detected — using static fallback catalog.");
    PRODUCTS = STATIC_PRODUCTS.map(p => ({
      ...p,
      category: normalizeCategory(p.category),
      available: normalizeProductAvailable(p.available)
    }));
    isProductsLoaded = true;
    isProductsLoading = false;
    notifyProductsUpdated();
    return PRODUCTS;
  }

  try {
    const { data, error } = await supabaseClient
      .from('products')
      .select('*')
      .order('category', { ascending: true });

    if (error) {
      console.warn("Supabase product fetch notice:", error.message);
      productsLoadError = error.message;
      PRODUCTS = STATIC_PRODUCTS.map(p => ({
        ...p,
        category: normalizeCategory(p.category),
        available: normalizeProductAvailable(p.available)
      }));
    } else if (Array.isArray(data) && data.length > 0) {
      // Map live database rows onto canonical 18 products catalog
      const dbMap = new Map();
      data.forEach(row => {
        let id = String(row.id || '').trim();
        if (id === 'mocha-cream') id = 'mocha-chill';
        if (id === 'caramel-latte') id = 'caramel-cloud';
        if (id === 'vanilla-cream') id = 'vanilla-cold-brew';
        if (id === 'chocolate-croissant') id = 'cheese-croissant';
        if (id === 'almond-brownie') id = 'chocolate-brownie';
        dbMap.set(id, row);
      });

      PRODUCTS = STATIC_PRODUCTS.map(sp => {
        const dbRow = dbMap.get(sp.id);
        if (dbRow) {
          return {
            id: sp.id,
            name: dbRow.name || sp.name,
            category: sp.category,
            description: dbRow.description || sp.description,
            price: Number(dbRow.price) || sp.price,
            image: (dbRow.image && String(dbRow.image).trim().length > 0) ? String(dbRow.image).trim() : sp.image,
            accentColor: (dbRow.accent_color && String(dbRow.accent_color).trim().length > 0) ? String(dbRow.accent_color).trim() : sp.accentColor,
            available: normalizeProductAvailable(dbRow.available !== undefined ? dbRow.available : sp.available),
            createdAt: dbRow.created_at,
            updatedAt: dbRow.updated_at
          };
        }
        return {
          ...sp,
          category: normalizeCategory(sp.category),
          available: normalizeProductAvailable(sp.available)
        };
      });

      console.log(`[Supabase Sync] Successfully loaded ${PRODUCTS.length} live products from database.`);
      console.table(PRODUCTS);
    } else {
      console.log("No products returned from Supabase table — using static catalog.");
      PRODUCTS = STATIC_PRODUCTS.map(p => ({
        ...p,
        category: normalizeCategory(p.category),
        available: normalizeProductAvailable(p.available)
      }));
    }
  } catch (err) {
    console.warn("Error fetching products from Supabase:", err);
    productsLoadError = err.message;
    PRODUCTS = STATIC_PRODUCTS.map(p => ({
      ...p,
      category: normalizeCategory(p.category),
      available: normalizeProductAvailable(p.available)
    }));
  }

  isProductsLoaded = true;
  isProductsLoading = false;
  notifyProductsUpdated();
  return PRODUCTS;
}

/**
 * Admin: Update an existing product in Supabase.
 */
async function updateProductInSupabase(productId, updates) {
  if (!productId || typeof supabaseClient === 'undefined' || !supabaseClient) {
    throw new Error("Supabase client not available or invalid product ID.");
  }

  const payload = {
    ...updates,
    updated_at: new Date().toISOString()
  };

  if (payload.category) {
    payload.category = normalizeCategory(payload.category);
  }
  if (payload.price !== undefined) {
    payload.price = Number(payload.price);
  }
  if (payload.available !== undefined) {
    payload.available = normalizeProductAvailable(payload.available);
  }

  const { data, error } = await supabaseClient
    .from('products')
    .update(payload)
    .eq('id', productId)
    .select()
    .single();

  if (error) {
    console.error("Error updating product in Supabase:", error.message);
    throw error;
  }

  // Refresh local product catalog and notify listeners
  await fetchProductsFromSupabase();
  return data;
}

/**
 * Admin: Create a new product in Supabase.
 */
async function createProductInSupabase(productData) {
  if (!productData || !productData.id || !productData.name || typeof supabaseClient === 'undefined' || !supabaseClient) {
    throw new Error("Invalid product payload or Supabase client disconnected.");
  }

  const category = normalizeCategory(productData.category);
  const payload = {
    id: String(productData.id).trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
    name: String(productData.name).trim(),
    category: category,
    description: String(productData.description || '').trim(),
    price: Number(productData.price) || 0,
    image: String(productData.image || '').trim() || (category === 'bites' ? DEFAULT_BITE_IMAGE : DEFAULT_COFFEE_IMAGE),
    accent_color: String(productData.accentColor || productData.accent_color || 'bg-secondary-container').trim(),
    available: normalizeProductAvailable(productData.available),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabaseClient
    .from('products')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error("Error creating product in Supabase:", error.message);
    throw error;
  }

  // Refresh local product catalog and notify listeners
  await fetchProductsFromSupabase();
  return data;
}

/**
 * Admin: Delete a product from Supabase.
 */
async function deleteProductInSupabase(productId) {
  if (!productId || typeof supabaseClient === 'undefined' || !supabaseClient) {
    throw new Error("Invalid product ID or Supabase client disconnected.");
  }

  const { error } = await supabaseClient
    .from('products')
    .delete()
    .eq('id', productId);

  if (error) {
    console.error("Error deleting product from Supabase:", error.message);
    throw error;
  }

  // Refresh local product catalog and notify listeners
  await fetchProductsFromSupabase();
  return true;
}

// Automatically trigger product fetch immediately and on DOMContentLoaded
if (typeof document !== 'undefined') {
  // Trigger immediate fetch
  fetchProductsFromSupabase();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      fetchProductsFromSupabase();
    });
  }
}

// If running in a Node environment (testing/build), export the catalog & helpers
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PRODUCTS,
    STATIC_PRODUCTS,
    getProductById,
    fetchProductsFromSupabase,
    onProductsUpdated,
    normalizeProductAvailable,
    normalizeCategory,
    updateProductInSupabase,
    createProductInSupabase,
    deleteProductInSupabase
  };
}
