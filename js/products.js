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

// Normalization helper for category
function normalizeCategory(cat) {
  if (!cat) return 'coffee';
  const c = String(cat).trim().toLowerCase();
  if (c.includes('bite') || c.includes('bakery') || c.includes('food')) return 'bites';
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

// Initial / Fallback Static Products Catalog (Emergency offline fallback only)
const STATIC_PRODUCTS = [
  {
    id: "mocha-cream",
    name: "Mocha Cream",
    category: "coffee",
    description: "Rich chocolate meets velvety smooth espresso.",
    price: 5.50,
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAtSiT_nuRPIxzhj711u9ztYqTFzl0Z4q3f1qZeoxCMm12hYlHJrQPx_1AqNFrrecyeXojJdwdqXzgSR3nRcUB479GqfpmYBN7FB2iPxiUk6BRwGjOTKLg9OuLoBJr3li9iFrleZ6Tzb5sjIwglBYcgJDwZUsMFmj4FNvjNpp61OJ95CaYEu3MUHYlDafF5ixP55sP-ptpitvlUBkcLxTNZdb4qm26_T-0bENJsIz-Js25dN40TPB2NYA",
    accentColor: "bg-tertiary-fixed",
    available: true
  },
  {
    id: "caramel-latte",
    name: "Caramel Latte",
    category: "coffee",
    description: "Sweet caramel ribbons in a creamy delight.",
    price: 5.00,
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDqDTWHE52mfNwiTjNBEw8GXOgnjze1rUxrjvt5p4UijuKmcxfrL5Ouh4cnAfRYXjKWKBVfMSRsRE1G7LsiMzGWQ4KVYPg5yXZytNpJKpteFErIrYQ54vgNccelNal4gpXIvChDxZ3J3oA3-IDhm7O6BCVt1w21NFrjszlqF-MX9m5w_VzpjFjVQHVoONMDXAJa9g9CvaGqoZgSH3QYQSTvHLI0g8MyaBq-Dq9kpW_OcBl9MNsWVMTCrQ",
    accentColor: "bg-secondary-fixed",
    available: true
  },
  {
    id: "vanilla-cream",
    name: "Vanilla Cream",
    category: "coffee",
    description: "Classic vanilla bean infused for maximum chill.",
    price: 4.50,
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBoaLrYFOPEhOmL8osLHUKp52_5DbHhKfnrNc-RoPw-0aoNEcMqXPDBrAYfIFuGKom6Q0ri3hzYuz63mjl3aWIMUA8PIG4QYEt-C-MFBQhdhbDYMXGTUYM2rEThpNZvfLAQUUDCmFZPaXycZRDFR0xfo1a9w6CP0tT-IxV6_fZOzNc8m5_mHNl8CqOL-KBdnk4xHJcRtnGfEfRfWEtg_8uvI850aepHiJJTkA3ePlwZ6IDtSIYi5OxM5Q",
    accentColor: "bg-primary-fixed",
    available: true
  },
  {
    id: "chocolate-croissant",
    name: "Chocolate Croissant",
    category: "bites",
    description: "Flaky, buttery, filled with dark chocolate.",
    price: 4.00,
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCLKhoQuUwFMcB6cvwqpvy3l01CLRMOQ023hE2yalcGxkf6NoPB_U-ItebPRcs4Xafj_RT8Z9sPUN9gPOX3AJDDI9gdGpmzymvjXSk8Lo3lvvQtVQ3mW9uyAsWg5DD6yJW4N6OnfHArvRcDKat_o2zGlDjO_c4msJNaC_Ofvbc7F2EjTnRI1uIOXO3v19aK4jiIEv8fK_yhnsptodn8fsEPY8bf5ByjLzR62ajmzkC3bbL4eDFYvtOPQA",
    accentColor: "bg-secondary-fixed-dim",
    available: true
  },
  {
    id: "almond-brownie",
    name: "Almond Brownie",
    category: "bites",
    description: "Fudgy core, crispy edges, toasted almonds.",
    price: 3.50,
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDubHxFP4arUQjOLfJ0FobeamSV2EaJDg-zT_-FUeyTNJ2L_zeK2pSUeFn9NjjLLxj4n4eBPOxRua-FBVnSHhvvkCrYycX_9PS-udUjwaqjLLqncbs-Xd5nY7-HOv0-pqO7vy3vP-2hAcEVkYEFnuWkwlVofoUSnH5nAhs6GH8-zQlew0KpjAQadJq0LQNfwG7CJTSwpE9DqxqJjNyQDcsryoMzNO5VkcBeKyQq67fjJ8UWz3apNT2KeA",
    accentColor: "bg-tertiary-fixed-dim",
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
      // Map live database columns to standard frontend model
      PRODUCTS = data.map(row => {
        const category = normalizeCategory(row.category);
        const image = (row.image && String(row.image).trim().length > 0)
          ? String(row.image).trim()
          : (category === 'bites' ? DEFAULT_BITE_IMAGE : DEFAULT_COFFEE_IMAGE);

        return {
          id: String(row.id || '').trim(),
          name: String(row.name || '').trim(),
          category: category,
          description: String(row.description || '').trim(),
          price: Number(row.price) || 0,
          image: image,
          accentColor: (row.accent_color && String(row.accent_color).trim().length > 0)
            ? String(row.accent_color).trim()
            : 'bg-secondary-container',
          available: normalizeProductAvailable(row.available),
          createdAt: row.created_at,
          updatedAt: row.updated_at
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
  module.exports = { PRODUCTS, STATIC_PRODUCTS, getProductById, fetchProductsFromSupabase, onProductsUpdated, normalizeProductAvailable, normalizeCategory };
}
