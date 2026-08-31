/**
 * Brew & Bite - Product Catalog Data Layer (products.js)
 * Authoritative 18-Product Catalog across 3 Categories:
 * 1. Coffee & Cold Brews (6 products)
 * 2. Savory Bites (6 products)
 * 3. Sweet Bites (6 products)
 */

// Normalization helper for category ('coffee' | 'savory' | 'sweet')
function normalizeCategory(cat) {
  if (!cat) return 'coffee';
  const c = String(cat).trim().toLowerCase();
  if (c.includes('sweet') || c.includes('dessert') || c.includes('cookie') || c.includes('muffin') || c.includes('cake') || c.includes('roll') || c.includes('brownie')) {
    return 'sweet';
  }
  if (c.includes('savory') || c.includes('snack') || c.includes('sandwich') || c.includes('bagel') || c.includes('toast') || c.includes('cheese') || c.includes('bite')) {
    return 'savory';
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
  if (val === undefined || val === null) return true;
  return Boolean(val);
}

// Authoritative 18 Products Catalog
const STATIC_PRODUCTS = [
  // ==========================================
  // CATEGORY 1: COFFEE & COLD BREWS (6 Products)
  // ==========================================
  {
    id: "classic-cold-brew",
    name: "Classic Cold Brew",
    category: "coffee",
    description: "Pure slow-steeped 18-hour cold brew with rich notes of dark cocoa and toasted hazelnut.",
    ingredients: [
      "18-Hour Single-Origin Cold Brew",
      "Triple-Filtered Mountain Water",
      "Crystalline Ice"
    ],
    price: 4.50,
    image: "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=1200&q=95",
    accentColor: "bg-tertiary-fixed",
    rating: 4.9,
    reviewCount: 38,
    available: true
  },
  {
    id: "vanilla-cold-brew",
    name: "Vanilla Cold Brew",
    category: "coffee",
    description: "Velvety smooth cold brew infused with pure Madagascar vanilla bean and creamy oat milk.",
    ingredients: [
      "18-Hour Cold Brew Coffee",
      "Madagascar Vanilla Bean Syrup",
      "Creamy Oat Milk",
      "Crystalline Ice"
    ],
    price: 5.25,
    image: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=1200&q=95",
    accentColor: "bg-primary-fixed",
    rating: 5.0,
    reviewCount: 52,
    available: true
  },
  {
    id: "caramel-cloud",
    name: "Caramel Cloud",
    category: "coffee",
    description: "Chilled dark roast espresso topped with rich salted caramel cold foam and amber drizzle.",
    ingredients: [
      "Espresso Roast",
      "Salted Caramel Cold Foam",
      "Artisan Caramel Drizzle",
      "Whole Milk",
      "Crystalline Ice"
    ],
    price: 5.75,
    image: "https://images.unsplash.com/photo-1589396575653-c09c794ff6a6?auto=format&fit=crop&w=1200&q=95",
    accentColor: "bg-secondary-fixed",
    rating: 4.9,
    reviewCount: 44,
    available: true
  },
  {
    id: "mocha-chill",
    name: "Mocha Chill",
    category: "coffee",
    description: "Single-origin espresso blended with decadent Belgian dark chocolate and chilled whole milk.",
    ingredients: [
      "Single-Origin Espresso",
      "Belgian Dark Chocolate Ganache",
      "Chilled Whole Milk",
      "Crystalline Ice"
    ],
    price: 5.50,
    image: "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=1200&q=95",
    accentColor: "bg-tertiary-fixed-dim",
    rating: 4.8,
    reviewCount: 29,
    available: true
  },
  {
    id: "hazelnut-cold-brew",
    name: "Hazelnut Cold Brew",
    category: "coffee",
    description: "Slow-steeped signature roast layered with roasted Piedmont hazelnut essence and sweet cream.",
    ingredients: [
      "Signature Cold Brew Coffee",
      "Roasted Piedmont Hazelnut Essence",
      "Sweet Cream",
      "Crystalline Ice"
    ],
    price: 5.25,
    image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=1200&q=95",
    accentColor: "bg-secondary-fixed-dim",
    rating: 4.9,
    reviewCount: 31,
    available: true
  },
  {
    id: "iced-spanish-latte",
    name: "Iced Spanish Latte",
    category: "coffee",
    description: "Bold espresso pulled over sweetened textured condensed milk and crystalline ice.",
    ingredients: [
      "Double Shot Espresso",
      "Sweetened Condensed Milk",
      "Textured Whole Milk",
      "Crystalline Ice"
    ],
    price: 5.50,
    image: "assets/images/iced-spanish-latte.jpg",
    accentColor: "bg-primary-fixed-dim",
    rating: 5.0,
    reviewCount: 47,
    available: true
  },

  // ==========================================
  // CATEGORY 2: SAVORY BITES (6 Products)
  // ==========================================
  {
    id: "cheese-croissant",
    name: "Cheese Croissant",
    category: "savory",
    description: "Flaky, golden French butter croissant baked with aged Gruyère and melted sharp cheddar.",
    ingredients: [
      "French Butter Laminated Dough",
      "Aged Gruyère Cheese",
      "Sharp White Cheddar",
      "Flaky Sea Salt"
    ],
    price: 4.75,
    image: "assets/images/cheese-croissant.jpg",
    accentColor: "bg-secondary-fixed",
    rating: 4.9,
    reviewCount: 36,
    available: true
  },
  {
    id: "garlic-herb-croissant",
    name: "Garlic Herb Croissant",
    category: "savory",
    description: "Crispy layered butter pastry brushed with roasted garlic herb butter, sea salt, and fresh parsley.",
    ingredients: [
      "Laminated Butter Croissant",
      "Roasted Garlic Butter",
      "Fresh Parsley & Thyme",
      "Flaky Sea Salt"
    ],
    price: 4.50,
    image: "assets/images/garlic-herb-croissant.jpg",
    accentColor: "bg-primary-fixed",
    rating: 4.8,
    reviewCount: 28,
    available: true
  },
  {
    id: "veggie-cream-cheese-bagel",
    name: "Veggie Cream Cheese Bagel",
    category: "savory",
    description: "Toasted artisan everything bagel smeared with whipped scallion cream cheese and cucumber.",
    ingredients: [
      "Toasted Everything Bagel",
      "Whipped Scallion Cream Cheese",
      "English Cucumber Slices",
      "Fresh Dill"
    ],
    price: 4.95,
    image: "assets/images/veggie-cream-cheese-bagel.jpg",
    accentColor: "bg-secondary-fixed-dim",
    rating: 4.9,
    reviewCount: 33,
    available: true
  },
  {
    id: "grilled-cheese-sandwich",
    name: "Grilled Cheese Sandwich",
    category: "savory",
    description: "Golden toasted artisanal sourdough filled with melted aged cheddar and melted Gruyère.",
    ingredients: [
      "Artisan Sourdough Loaf",
      "Aged White Cheddar",
      "Melted Gruyère Cheese",
      "Cultured European Butter"
    ],
    price: 6.25,
    image: "assets/images/grilled-cheese-sandwich.jpg",
    accentColor: "bg-tertiary-fixed",
    rating: 5.0,
    reviewCount: 42,
    available: true
  },
  {
    id: "herb-cheese-toast",
    name: "Herb & Cheese Toast",
    category: "savory",
    description: "Toasted artisan sourdough with whipped ricotta, melted mozzarella, rosemary, and olive oil.",
    ingredients: [
      "Toasted Artisan Sourdough",
      "Whipped Whole Milk Ricotta",
      "Melted Mozzarella",
      "Fresh Rosemary & Thyme",
      "Extra Virgin Olive Oil"
    ],
    price: 5.75,
    image: "assets/images/herb-cheese-toast.jpg",
    accentColor: "bg-tertiary-fixed-dim",
    rating: 4.8,
    reviewCount: 25,
    available: true
  },
  {
    id: "loaded-veggie-toast",
    name: "Loaded Veggie Toast",
    category: "savory",
    description: "Thick-cut rustic brioche loaded with smashed avocado, cherry heirloom tomatoes, and seeds.",
    ingredients: [
      "Thick Multigrain Brioche",
      "Smashed Hass Avocado",
      "Heirloom Cherry Tomatoes",
      "Crisp Radish Slices",
      "Toasted Hemp & Sesame Seeds"
    ],
    price: 5.50,
    image: "assets/images/loaded-veggie-toast.jpg",
    accentColor: "bg-primary-fixed-dim",
    rating: 4.9,
    reviewCount: 39,
    available: true
  },

  // ==========================================
  // CATEGORY 3: SWEET BITES (6 Products)
  // ==========================================
  {
    id: "choco-chunk-cookie",
    name: "Choco-Chunk Cookie",
    category: "sweet",
    description: "Warm, chewy golden cookie packed with dark Belgian chocolate chunks and flaky Maldon sea salt.",
    ingredients: [
      "Unbleached Wheat Flour",
      "Belgian Dark Chocolate Chunks",
      "Brown Sugar & Butter",
      "Maldon Flaky Sea Salt"
    ],
    price: 3.75,
    image: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=1200&q=95",
    accentColor: "bg-secondary-fixed",
    rating: 5.0,
    reviewCount: 61,
    available: true
  },
  {
    id: "double-chocolate-muffin",
    name: "Double Chocolate Muffin",
    category: "sweet",
    description: "Moist Dutch cocoa muffin filled with molten fudge center and dark chocolate pearls.",
    ingredients: [
      "Dutch Process Cocoa",
      "Dark Chocolate Pearls",
      "Molten Fudge Center",
      "Cultured Buttermilk",
      "Pure Vanilla"
    ],
    price: 4.25,
    image: "assets/images/double-chocolate-muffin.jpg",
    accentColor: "bg-tertiary-fixed",
    rating: 4.9,
    reviewCount: 48,
    available: true
  },
  {
    id: "blueberry-muffin",
    name: "Blueberry Muffin",
    category: "sweet",
    description: "Freshly baked vanilla buttermilk muffin bursting with plump wild blueberries and streusel.",
    ingredients: [
      "Plump Wild Blueberries",
      "Cultured Buttermilk",
      "Vanilla Bean Extract",
      "Cinnamon Sugar Streusel"
    ],
    price: 4.25,
    image: "assets/images/blueberry-muffin.jpg",
    accentColor: "bg-primary-fixed",
    rating: 4.9,
    reviewCount: 35,
    available: true
  },
  {
    id: "cinnamon-roll",
    name: "Cinnamon Roll",
    category: "sweet",
    description: "Pillowy sweet dough swirled with Saigon cinnamon brown sugar and cream cheese glaze.",
    ingredients: [
      "Enriched Sweet Yeast Dough",
      "Saigon Cinnamon",
      "Dark Brown Sugar",
      "Cream Cheese Vanilla Glaze"
    ],
    price: 4.50,
    image: "assets/images/cinnamon-roll.jpg",
    accentColor: "bg-secondary-fixed-dim",
    rating: 5.0,
    reviewCount: 54,
    available: true
  },
  {
    id: "almond-croissant",
    name: "Almond Croissant",
    category: "sweet",
    description: "Twice-baked butter croissant filled with frangipane almond cream and toasted sliced almonds.",
    ingredients: [
      "French Butter Croissant",
      "Frangipane Almond Cream",
      "Toasted Sliced Almonds",
      "Powdered Sugar Dusting"
    ],
    price: 4.75,
    image: "assets/images/almond-croissant.jpg",
    accentColor: "bg-tertiary-fixed-dim",
    rating: 4.9,
    reviewCount: 41,
    available: true
  },
  {
    id: "fudge-brownie",
    name: "Fudge Brownie",
    category: "sweet",
    description: "Ultra-fudgy espresso-infused dark chocolate brownie with a delicate crinkle top.",
    ingredients: [
      "70% Dark Belgian Chocolate",
      "Espresso Reduction",
      "European Butter",
      "Cane Sugar",
      "Flaky Sea Salt"
    ],
    price: 3.95,
    image: "assets/images/fudge-brownie.jpg",
    accentColor: "bg-primary-fixed-dim",
    rating: 5.0,
    reviewCount: 58,
    available: true
  }
];

// Active live in-memory product catalog
let PRODUCTS = [...STATIC_PRODUCTS];
let isProductsLoading = false;
let isProductsLoaded = false;
let productsLoadError = null;

// Subscribers for catalog updates
const productUpdateListeners = [];

function onProductsUpdated(callback) {
  if (typeof callback === 'function') {
    productUpdateListeners.push(callback);
  }
}

function notifyProductsUpdated() {
  productUpdateListeners.forEach(cb => {
    try {
      cb(PRODUCTS);
    } catch (e) {
      console.warn("Product listener execution notice:", e);
    }
  });
}

function getProductById(productId) {
  if (!productId) return null;
  const targetId = String(productId).trim();
  if (Array.isArray(PRODUCTS) && PRODUCTS.length > 0) {
    const found = PRODUCTS.find(p => p.id === targetId || (p.id === 'classic-cold-brew' && targetId === 'classic-black'));
    if (found) return found;
  }
  return STATIC_PRODUCTS.find(p => p.id === targetId || (p.id === 'classic-cold-brew' && targetId === 'classic-black')) || null;
}

/**
 * Fetch authoritative product catalog from Supabase, cleanly mapping to the 18 canonical products.
 */
async function fetchProductsFromSupabase(retryCount = 0) {
  isProductsLoading = true;
  productsLoadError = null;

  if (typeof supabaseClient === 'undefined' || !supabaseClient) {
    if (retryCount < 5) {
      setTimeout(() => fetchProductsFromSupabase(retryCount + 1), 100);
      return;
    }
    PRODUCTS = [...STATIC_PRODUCTS];
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
      PRODUCTS = [...STATIC_PRODUCTS];
    } else if (Array.isArray(data) && data.length > 0) {
      const dbMap = new Map();
      data.forEach(row => {
        let id = String(row.id || '').trim();
        if (id === 'classic-black') id = 'classic-cold-brew';
        if (id === 'mocha-cream') id = 'mocha-chill';
        if (id === 'caramel-latte') id = 'caramel-cloud';
        if (id === 'vanilla-cream') id = 'vanilla-cold-brew';
        if (id === 'chocolate-croissant') id = 'cheese-croissant';
        if (id === 'almond-brownie' || id === 'chocolate-brownie') id = 'fudge-brownie';
        if (id === 'veggie-sandwich') id = 'grilled-cheese-sandwich';
        if (id === 'garlic-croissant') id = 'garlic-herb-croissant';
        if (id === 'cream-cheese-bagel') id = 'veggie-cream-cheese-bagel';
        if (id === 'herb-sandwich') id = 'herb-cheese-toast';
        if (id === 'loaded-toast') id = 'loaded-veggie-toast';
        dbMap.set(id, row);
      });

      PRODUCTS = STATIC_PRODUCTS.map(sp => {
        const dbRow = dbMap.get(sp.id);
        if (dbRow) {
          return {
            id: sp.id,
            name: sp.name,
            category: sp.category,
            description: sp.description,
            ingredients: sp.ingredients,
            price: Number(dbRow.price) || sp.price,
            image: sp.image,
            accentColor: sp.accentColor,
            rating: sp.rating,
            reviewCount: sp.reviewCount,
            available: normalizeProductAvailable(dbRow.available !== undefined ? dbRow.available : sp.available),
            createdAt: dbRow.created_at,
            updatedAt: dbRow.updated_at
          };
        }
        return { ...sp };
      });
    } else {
      PRODUCTS = [...STATIC_PRODUCTS];
    }
  } catch (err) {
    console.warn("Error fetching products from Supabase:", err);
    productsLoadError = err.message;
    PRODUCTS = [...STATIC_PRODUCTS];
  } finally {
    isProductsLoaded = true;
    isProductsLoading = false;
    notifyProductsUpdated();
  }

  return PRODUCTS;
}

/**
 * Update a product in memory and persist changes to Supabase.
 */
async function updateProductInSupabase(productId, updates) {
  if (!productId || !updates) return;

  // 1. Update in-memory canonical catalog
  const idx = PRODUCTS.findIndex(p => p.id === productId);
  if (idx > -1) {
    PRODUCTS[idx] = {
      ...PRODUCTS[idx],
      ...updates,
      price: updates.price !== undefined ? Number(updates.price) : PRODUCTS[idx].price,
      available: updates.available !== undefined ? normalizeProductAvailable(updates.available) : PRODUCTS[idx].available
    };
  }

  notifyProductsUpdated();

  // 2. Persist to Supabase products table if connected
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      const prod = idx > -1 ? PRODUCTS[idx] : null;
      const dbPayload = {
        id: productId,
        name: updates.name || prod?.name || productId,
        category: updates.category || prod?.category || 'coffee',
        price: updates.price !== undefined ? Number(updates.price) : (prod?.price || 0),
        description: updates.description || prod?.description || '',
        available: updates.available !== undefined ? normalizeProductAvailable(updates.available) : (prod?.available !== false),
        image: updates.image || prod?.image || ''
      };

      const { error } = await supabaseClient
        .from('products')
        .upsert(dbPayload, { onConflict: 'id' });

      if (error) {
        console.warn("Supabase product upsert notice:", error.message);
      }
    } catch (e) {
      console.warn("Could not persist product update to database:", e);
    }
  }

  return PRODUCTS[idx] || null;
}

/**
 * Create a new product in memory and in Supabase.
 */
async function createProductInSupabase(productData) {
  if (!productData || !productData.name) return;

  const newId = productData.id || productData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const newProduct = {
    id: newId,
    name: productData.name,
    category: normalizeCategory(productData.category || 'coffee'),
    description: productData.description || '',
    ingredients: Array.isArray(productData.ingredients) ? productData.ingredients : [],
    price: Number(productData.price) || 4.50,
    image: productData.image || 'assets/images/vanilla-cold-brew.jpg',
    accentColor: productData.accentColor || 'bg-primary-fixed',
    rating: 5.0,
    reviewCount: 0,
    available: productData.available !== false
  };

  PRODUCTS.unshift(newProduct);
  notifyProductsUpdated();

  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      await supabaseClient.from('products').upsert({
        id: newProduct.id,
        name: newProduct.name,
        category: newProduct.category,
        price: newProduct.price,
        description: newProduct.description,
        available: newProduct.available,
        image: newProduct.image
      });
    } catch (e) {
      console.warn("Could not insert product into database:", e);
    }
  }

  return newProduct;
}

window.updateProductInSupabase = updateProductInSupabase;
window.createProductInSupabase = createProductInSupabase;

// Exports for Node testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STATIC_PRODUCTS,
    normalizeCategory,
    normalizeProductAvailable,
    getProductById,
    fetchProductsFromSupabase,
    updateProductInSupabase,
    createProductInSupabase
  };
}
