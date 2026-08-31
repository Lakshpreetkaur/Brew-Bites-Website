/**
 * Brew & Bite - Shopping Cart Module (cart.js)
 * Handles in-memory cart state, localStorage persistence, quantity controls,
 * cart drawer open/close, subtotal calculations, and cart resetting.
 */

// Global In-Memory Cart State
let cart = [];
const CART_STORAGE_KEY = "brewBiteCart";

// Save Cart to LocalStorage
function saveCart() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (err) {
    console.warn("Could not save cart to localStorage:", err);
  }
}

// Load Cart from LocalStorage with Safe Product Validation
function loadCart() {
  try {
    const savedData = localStorage.getItem(CART_STORAGE_KEY);
    if (!savedData) {
      cart = [];
      return;
    }

    const parsed = JSON.parse(savedData);
    if (!Array.isArray(parsed)) {
      cart = [];
      return;
    }

    // Filter and validate: item must exist in PRODUCTS and quantity must be a positive integer
    const validItems = [];
    parsed.forEach(item => {
      if (!item || typeof item !== 'object') return;
      const { productId, quantity } = item;
      const exists = (typeof PRODUCTS !== 'undefined' && Array.isArray(PRODUCTS))
        ? PRODUCTS.some(p => p.id === productId)
        : false;

      const numQty = Math.floor(Number(quantity));
      if (exists && numQty > 0) {
        validItems.push({ productId: productId, quantity: numQty });
      }
    });

    cart = validItems;
  } catch (err) {
    console.warn("Could not load cart from localStorage:", err);
    cart = [];
  }
}

// Visual Confirmation Feedback on Button Click
function showAddedFeedback(button) {
  if (!button || !button.classList) return;
  const originalText = button.innerHTML;
  button.innerHTML = '<span>Added ✓</span>';
  button.classList.add('bg-tertiary', 'text-on-tertiary', 'pink-glow');
  button.classList.remove('bg-secondary-container', 'text-on-secondary-container');

  setTimeout(() => {
    if (!button || !button.classList) return;
    button.innerHTML = originalText;
    button.classList.remove('bg-tertiary', 'text-on-tertiary', 'pink-glow');
    button.classList.add('bg-secondary-container', 'text-on-secondary-container');
  }, 1000);
}

// Update Cart Count Badge
function updateCartCount() {
  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartBadge = document.getElementById('cart-badge');
  const drawerCartBadge = document.getElementById('drawer-cart-badge');
  const cartHeaderCount = document.getElementById('cart-header-count');

  [cartBadge, drawerCartBadge].forEach(badge => {
    if (badge) {
      badge.textContent = totalCount;
      if (totalCount > 0) {
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  });

  if (cartHeaderCount) {
    cartHeaderCount.textContent = `(${totalCount} item${totalCount === 1 ? '' : 's'})`;
  }
}

// Open Cart Drawer
function openCart() {
  // Close any other open modals/drawers first (Mutual Exclusion)
  if (typeof closeProfile === 'function') closeProfile();
  if (typeof closeNavDrawer === 'function') closeNavDrawer();
  if (typeof toggleNotificationPanel === 'function') toggleNotificationPanel(false);
  if (typeof closeCheckout === 'function') closeCheckout();
  if (typeof closeAdminDashboard === 'function') closeAdminDashboard();
  if (typeof closeProductReviewsModal === 'function') closeProductReviewsModal();

  const cartDrawer = document.getElementById('cart-drawer');
  const cartOverlay = document.getElementById('cart-overlay');
  if (!cartDrawer || !cartOverlay) return;

  renderCart();
  cartOverlay.classList.remove('opacity-0', 'pointer-events-none');
  cartOverlay.classList.add('opacity-100', 'pointer-events-auto');
  cartDrawer.classList.remove('translate-x-full');
  cartDrawer.classList.add('translate-x-0');
  document.body.classList.add('overflow-hidden');
  document.body.style.overflow = 'hidden';
}

// Close Cart Drawer
function closeCart() {
  const cartDrawer = document.getElementById('cart-drawer');
  const cartOverlay = document.getElementById('cart-overlay');
  if (cartOverlay) {
    cartOverlay.classList.remove('opacity-100', 'pointer-events-auto');
    cartOverlay.classList.add('opacity-0', 'pointer-events-none');
  }
  if (cartDrawer) {
    cartDrawer.classList.remove('translate-x-0');
    cartDrawer.classList.add('translate-x-full');
  }
  document.body.classList.remove('overflow-hidden');
  document.body.style.overflow = '';
}

window.openCart = openCart;
window.closeCart = closeCart;

// Cart Update Listeners
const cartUpdateListeners = [];

function onCartUpdated(callback) {
  if (typeof callback === 'function') {
    cartUpdateListeners.push(callback);
  }
}

function notifyCartUpdated() {
  cartUpdateListeners.forEach(cb => {
    try {
      cb(cart);
    } catch (e) {
      console.warn("Cart update listener notice:", e);
    }
  });
}

function getItemQuantityInCart(productId) {
  if (!productId || !Array.isArray(cart)) return 0;
  const item = cart.find(i => i.productId === productId);
  return item ? Number(item.quantity) || 0 : 0;
}

window.getItemQuantityInCart = getItemQuantityInCart;
window.onCartUpdated = onCartUpdated;
window.notifyCartUpdated = notifyCartUpdated;
window.addToCart = addToCart;
window.increaseQuantity = increaseQuantity;
window.decreaseQuantity = decreaseQuantity;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;

// Increase Product Quantity
function increaseQuantity(productId) {
  if (!productId) return;
  const item = cart.find(i => i.productId === productId);
  if (item) {
    item.quantity += 1;
    saveCart();
    updateCartCount();
    renderCart();
    notifyCartUpdated();
  }
}

// Decrease Product Quantity
function decreaseQuantity(productId) {
  if (!productId) return;
  const itemIndex = cart.findIndex(i => i.productId === productId);
  if (itemIndex > -1) {
    cart[itemIndex].quantity -= 1;
    if (cart[itemIndex].quantity <= 0) {
      cart.splice(itemIndex, 1);
    }
    saveCart();
    updateCartCount();
    renderCart();
    notifyCartUpdated();
  }
}

// Remove Product Completely from Cart
function removeFromCart(productId) {
  if (!productId) return;
  cart = cart.filter(item => item.productId !== productId);
  saveCart();
  updateCartCount();
  renderCart();
  notifyCartUpdated();
}

// Clear Cart (e.g., After Successful Checkout Placement)
function clearCart() {
  cart = [];
  saveCart();
  updateCartCount();
  renderCart();
  notifyCartUpdated();
}

// Render Cart Items & Subtotal
function renderCart() {
  const cartItemsContainer = document.getElementById('cart-items-container');
  const cartSubtotal = document.getElementById('cart-subtotal');
  const openCheckoutBtn = document.getElementById('open-checkout-btn');
  if (!cartItemsContainer || !cartSubtotal) return;

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full text-center py-12 px-4">
        <div class="w-20 h-20 bg-secondary-container/20 text-secondary-container rounded-full flex items-center justify-center mb-4">
          <span class="material-symbols-outlined text-4xl">local_cafe</span>
        </div>
        <h3 class="font-display text-lg font-bold text-primary mb-1">Your order is empty</h3>
        <p class="font-body-md text-sm text-on-surface-variant max-w-xs">Add something delicious to get started.</p>
      </div>
    `;
    cartSubtotal.textContent = '$0.00';
    if (openCheckoutBtn) {
      openCheckoutBtn.classList.add('opacity-50', 'pointer-events-none');
    }
    return;
  }

  if (openCheckoutBtn) {
    openCheckoutBtn.classList.remove('opacity-50', 'pointer-events-none');
  }

  const getDisplayPrice = (val) => {
    return typeof formatCurrency === 'function' ? formatCurrency(val) : `$${Number(val || 0).toFixed(2)}`;
  };

  let subtotal = 0;
  const itemsHTML = cart.map(cartItem => {
    const product = (typeof PRODUCTS !== 'undefined' && Array.isArray(PRODUCTS))
      ? PRODUCTS.find(p => p.id === cartItem.productId)
      : null;

    if (!product) return '';

    const lineTotal = product.price * cartItem.quantity;
    subtotal += lineTotal;

    return `
      <div class="flex items-center gap-3.5 p-3.5 rounded-2xl bg-surface border border-outline-variant/20 shadow-xs hover:border-outline-variant/40 transition-colors">
        <!-- Product Image Thumbnail -->
        <div class="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-surface-container-high p-1">
          <img src="${product.image}" alt="${product.name}" class="w-full h-full object-cover rounded-lg" onerror="this.src='assets/images/vanilla-cold-brew.jpg'" />
        </div>

        <!-- Product Info & Quantity Controls -->
        <div class="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5">
          <div class="flex items-start justify-between gap-2">
            <div>
              <h4 class="font-display font-bold text-primary text-sm truncate max-w-[140px] sm:max-w-[170px]">${product.name}</h4>
              <p class="font-body-md text-xs text-on-surface-variant">${getDisplayPrice(product.price)}</p>
            </div>
            <!-- Line Total -->
            <span class="font-label-bold text-primary text-sm whitespace-nowrap">${getDisplayPrice(lineTotal)}</span>
          </div>

          <!-- Quantity Selector & Remove Action -->
          <div class="flex items-center justify-between mt-2 pt-1">
            <!-- Quantity Buttons: [ - ] qty [ + ] -->
            <div class="flex items-center gap-1.5 bg-surface-container-high/60 border border-outline-variant/30 rounded-full px-1.5 py-0.5">
              <button data-product-id="${product.id}" aria-label="Decrease ${product.name} quantity" class="decrease-qty-btn w-6 h-6 rounded-full flex items-center justify-center text-primary hover:bg-white/80 active:scale-90 transition-all cursor-pointer font-bold text-sm">
                −
              </button>
              <span class="font-label-bold text-xs text-primary min-w-[16px] text-center">${cartItem.quantity}</span>
              <button data-product-id="${product.id}" aria-label="Increase ${product.name} quantity" class="increase-qty-btn w-6 h-6 rounded-full flex items-center justify-center text-primary hover:bg-white/80 active:scale-90 transition-all cursor-pointer font-bold text-sm">
                +
              </button>
            </div>

            <!-- Remove Action -->
            <button data-product-id="${product.id}" aria-label="Remove ${product.name} from order" class="remove-item-btn text-xs font-label-bold text-on-surface-variant/70 hover:text-tertiary transition-colors cursor-pointer px-1 py-0.5 flex items-center gap-1">
              <span class="material-symbols-outlined text-sm">delete</span>
              <span class="hidden sm:inline">Remove</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  cartItemsContainer.innerHTML = itemsHTML;
  cartSubtotal.textContent = getDisplayPrice(subtotal);
}

// Add to Cart Logic
function addToCart(productId, button) {
  if (!productId) return;

  const product = (typeof getProductById === 'function')
    ? getProductById(productId)
    : ((typeof PRODUCTS !== 'undefined' && Array.isArray(PRODUCTS)) ? PRODUCTS.find(p => p.id === productId) : null);

  const isAvail = (typeof normalizeProductAvailable === 'function')
    ? normalizeProductAvailable(product?.available)
    : (product?.available === true);

  if (!isAvail) {
    if (typeof showInAppToast === 'function') {
      showInAppToast("This product is currently unavailable.", "warning");
    }
    return;
  }

  const existingItem = cart.find(item => item.productId === productId);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ productId: productId, quantity: 1 });
  }

  saveCart();
  updateCartCount();
  renderCart();
  notifyCartUpdated();

  if (button) {
    showAddedFeedback(button);
  }
}

// Subscribe to dynamic product catalog updates
if (typeof onProductsUpdated === 'function') {
  onProductsUpdated(() => {
    loadCart();
    updateCartCount();
    const cartDrawer = document.getElementById('cart-drawer');
    if (cartDrawer && !cartDrawer.classList.contains('translate-x-full')) {
      renderCart();
    }
  });
}

// Initialize Cart Event Listeners on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  // Load Cart Data
  loadCart();
  updateCartCount();

  // Cart Drawer Toggle Buttons
  const cartBtn = document.getElementById('cart-btn');
  const closeCartBtn = document.getElementById('close-cart-btn');
  const cartOverlay = document.getElementById('cart-overlay');

  if (cartBtn) {
    cartBtn.addEventListener('click', openCart);
  }
  if (closeCartBtn) {
    closeCartBtn.addEventListener('click', closeCart);
  }
  if (cartOverlay) {
    cartOverlay.addEventListener('click', closeCart);
  }

  // Escape Key Closes Cart Drawer
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCart();
    }
  });

  // Bind Event Delegation for Cart Actions (+, -, Remove, Card Steppers, and Add to Order)
  document.addEventListener('click', (e) => {
    // 1. Add to Order from product cards
    const addBtn = e.target.closest('.add-to-order-btn');
    if (addBtn) {
      e.stopPropagation();
      const productId = addBtn.getAttribute('data-product-id');
      addToCart(productId, addBtn);
      return;
    }

    // 2. Card quick stepper increase (+)
    const cardIncBtn = e.target.closest('.card-increase-qty-btn');
    if (cardIncBtn) {
      e.stopPropagation();
      const productId = cardIncBtn.getAttribute('data-product-id');
      addToCart(productId);
      return;
    }

    // 3. Card quick stepper decrease (-)
    const cardDecBtn = e.target.closest('.card-decrease-qty-btn');
    if (cardDecBtn) {
      e.stopPropagation();
      const productId = cardDecBtn.getAttribute('data-product-id');
      decreaseQuantity(productId);
      return;
    }

    // 4. Increase Quantity inside Cart Drawer
    const incBtn = e.target.closest('.increase-qty-btn');
    if (incBtn) {
      e.stopPropagation();
      const productId = incBtn.getAttribute('data-product-id');
      increaseQuantity(productId);
      return;
    }

    // 5. Decrease Quantity inside Cart Drawer
    const decBtn = e.target.closest('.decrease-qty-btn');
    if (decBtn) {
      e.stopPropagation();
      const productId = decBtn.getAttribute('data-product-id');
      decreaseQuantity(productId);
      return;
    }

    // 6. Remove Item from Cart Drawer
    const remBtn = e.target.closest('.remove-item-btn');
    if (remBtn) {
      e.stopPropagation();
      const productId = remBtn.getAttribute('data-product-id');
      removeFromCart(productId);
      return;
    }
  });
});
