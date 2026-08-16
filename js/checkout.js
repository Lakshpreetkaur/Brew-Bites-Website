/**
 * Brew & Bite - Checkout Experience Module (checkout.js)
 * Handles customer checkout modal display, order summary rendering,
 * conditional delivery address toggling, form validation, order creation via orders.js,
 * active cart clearing, and demo confirmation receipt rendering.
 */

// Open Checkout Modal
function openCheckout() {
  const checkoutModal = document.getElementById('checkout-modal');
  const checkoutCard = document.getElementById('checkout-modal-card');
  if (!checkoutModal) return;

  // Close the cart drawer first if open
  if (typeof closeCart === 'function') {
    closeCart();
  }

  // Render the current checkout state
  renderCheckout();

  // Show Checkout Modal with smooth scale & opacity
  checkoutModal.classList.remove('opacity-0', 'pointer-events-none');
  checkoutModal.classList.add('opacity-100', 'pointer-events-auto');

  if (checkoutCard) {
    checkoutCard.classList.remove('scale-95');
    checkoutCard.classList.add('scale-100');
  }

  document.body.classList.add('overflow-hidden');
}

// Close Checkout Modal
function closeCheckout() {
  const checkoutModal = document.getElementById('checkout-modal');
  const checkoutCard = document.getElementById('checkout-modal-card');
  if (!checkoutModal) return;

  checkoutModal.classList.remove('opacity-100', 'pointer-events-auto');
  checkoutModal.classList.add('opacity-0', 'pointer-events-none');

  if (checkoutCard) {
    checkoutCard.classList.remove('scale-100');
    checkoutCard.classList.add('scale-95');
  }

  document.body.classList.remove('overflow-hidden');
}

// Back to Menu Helper
function backToMenu() {
  closeCheckout();
  const menuSection = document.getElementById('coffee-section') || document.getElementById('animation-container');
  if (menuSection) {
    menuSection.scrollIntoView({ behavior: 'smooth' });
  }
}

// Render Checkout Content (Empty Cart State or Active 2-Column Form)
function renderCheckout() {
  const checkoutContent = document.getElementById('checkout-content');
  if (!checkoutContent) return;

  // Case 1: Cart is Empty
  if (typeof cart === 'undefined' || !Array.isArray(cart) || cart.length === 0) {
    checkoutContent.innerHTML = `
      <div class="flex flex-col items-center justify-center text-center py-12 px-4">
        <div class="w-20 h-20 bg-secondary-container/20 text-secondary rounded-full flex items-center justify-center mb-4">
          <span class="material-symbols-outlined text-4xl">shopping_cart</span>
        </div>
        <h3 class="font-display text-2xl font-bold text-primary mb-2">Your order is empty</h3>
        <p class="font-body-md text-on-surface-variant max-w-sm mb-6">Add something delicious before checking out.</p>
        <button id="checkout-empty-back-btn" class="bg-secondary-container text-on-secondary-container hover:bg-tertiary hover:text-on-tertiary font-label-bold text-sm py-3 px-8 rounded-full transition-all duration-200 shadow-md flex items-center gap-2 cursor-pointer active:scale-95">
          <span>← Back to Menu</span>
        </button>
      </div>
    `;

    const emptyBackBtn = document.getElementById('checkout-empty-back-btn');
    if (emptyBackBtn) {
      emptyBackBtn.addEventListener('click', backToMenu);
    }
    return;
  }

  // Case 2: Cart Has Items - Render 2-Column Layout
  let subtotal = 0;
  const itemsSummaryHTML = cart.map(cartItem => {
    const product = (typeof PRODUCTS !== 'undefined' && Array.isArray(PRODUCTS))
      ? PRODUCTS.find(p => p.id === cartItem.productId)
      : null;

    if (!product) return '';
    const lineTotal = product.price * cartItem.quantity;
    subtotal += lineTotal;

    return `
      <div class="flex items-center justify-between gap-3 text-sm py-1.5 border-b border-outline-variant/15">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 ${product.accentColor} p-0.5">
            <img src="${product.image}" alt="${product.name}" class="w-full h-full object-cover rounded-md" />
          </div>
          <div class="min-w-0">
            <h4 class="font-display font-bold text-primary text-xs truncate max-w-[130px] sm:max-w-[160px]">${product.name}</h4>
            <p class="text-xs text-on-surface-variant">$${product.price.toFixed(2)} × ${cartItem.quantity}</p>
          </div>
        </div>
        <span class="font-label-bold text-primary text-xs whitespace-nowrap">$${lineTotal.toFixed(2)}</span>
      </div>
    `;
  }).join('');

  checkoutContent.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
      
      <!-- LEFT COLUMN: Customer Information Form -->
      <div class="lg:col-span-7 flex flex-col gap-5">
        <h3 class="font-display text-lg font-bold text-primary border-b border-outline-variant/20 pb-2">Customer Details</h3>
        
        <form id="checkout-form" novalidate class="flex flex-col gap-4">
          <!-- Full Name -->
          <div>
            <label for="cust-name" class="block font-label-bold text-xs text-primary mb-1 uppercase tracking-wider">Full Name *</label>
            <input type="text" id="cust-name" name="name" required placeholder="e.g. Lakshpreet Kaur" class="w-full px-4 py-2.5 rounded-2xl bg-surface border border-outline-variant/40 focus:border-tertiary focus:ring-2 focus:ring-tertiary/20 outline-none transition-all text-sm text-on-surface" />
            <p id="error-cust-name" class="hidden text-xs text-red-600 font-medium mt-1"></p>
          </div>

          <!-- Phone & Email (2-Column Grid) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="cust-phone" class="block font-label-bold text-xs text-primary mb-1 uppercase tracking-wider">Phone Number *</label>
              <input type="tel" id="cust-phone" name="phone" required placeholder="e.g. (555) 000-1234" class="w-full px-4 py-2.5 rounded-2xl bg-surface border border-outline-variant/40 focus:border-tertiary focus:ring-2 focus:ring-tertiary/20 outline-none transition-all text-sm text-on-surface" />
              <p id="error-cust-phone" class="hidden text-xs text-red-600 font-medium mt-1"></p>
            </div>
            <div>
              <label for="cust-email" class="block font-label-bold text-xs text-primary mb-1 uppercase tracking-wider">Email Address *</label>
              <input type="email" id="cust-email" name="email" required placeholder="e.g. laksh@example.com" class="w-full px-4 py-2.5 rounded-2xl bg-surface border border-outline-variant/40 focus:border-tertiary focus:ring-2 focus:ring-tertiary/20 outline-none transition-all text-sm text-on-surface" />
              <p id="error-cust-email" class="hidden text-xs text-red-600 font-medium mt-1"></p>
            </div>
          </div>

          <!-- Order Type (Pickup vs Delivery) -->
          <div>
            <label for="cust-order-type" class="block font-label-bold text-xs text-primary mb-1 uppercase tracking-wider">Order Type *</label>
            <select id="cust-order-type" name="orderType" class="w-full px-4 py-2.5 rounded-2xl bg-surface border border-outline-variant/40 focus:border-tertiary focus:ring-2 focus:ring-tertiary/20 outline-none transition-all text-sm text-on-surface cursor-pointer">
              <option value="pickup">Pickup (Free • Ready in 15 mins)</option>
              <option value="delivery">Delivery (Direct to your door)</option>
            </select>
          </div>

          <!-- Conditional Delivery Address -->
          <div id="address-group" class="hidden">
            <label for="cust-address" class="block font-label-bold text-xs text-primary mb-1 uppercase tracking-wider">Delivery Address *</label>
            <input type="text" id="cust-address" name="address" placeholder="Street, apartment, suite, city" class="w-full px-4 py-2.5 rounded-2xl bg-surface border border-outline-variant/40 focus:border-tertiary focus:ring-2 focus:ring-tertiary/20 outline-none transition-all text-sm text-on-surface" />
            <p id="error-cust-address" class="hidden text-xs text-red-600 font-medium mt-1"></p>
          </div>

          <!-- Order Notes -->
          <div>
            <label for="cust-notes" class="block font-label-bold text-xs text-primary mb-1 uppercase tracking-wider">Order Notes (Optional)</label>
            <textarea id="cust-notes" name="notes" rows="2" placeholder="Any special requests or instructions..." class="w-full px-4 py-2 rounded-2xl bg-surface border border-outline-variant/40 focus:border-tertiary focus:ring-2 focus:ring-tertiary/20 outline-none transition-all text-sm text-on-surface resize-none"></textarea>
          </div>

          <!-- Place Order Button -->
          <button type="submit" class="w-full mt-2 bg-tertiary text-on-tertiary font-label-bold text-sm sm:text-base py-3 px-6 rounded-full hover:scale-102 transition-all duration-200 shadow-md pink-glow flex items-center justify-center gap-2 active:scale-95 cursor-pointer">
            <span>Place Demo Order</span>
            <span class="material-symbols-outlined text-base">check_circle</span>
          </button>
        </form>
      </div>

      <!-- RIGHT COLUMN: Order Summary Card -->
      <div class="lg:col-span-5 flex flex-col gap-4 bg-surface/70 border border-outline-variant/30 rounded-3xl p-5 sm:p-6 h-fit">
        <h3 class="font-display text-lg font-bold text-primary border-b border-outline-variant/20 pb-2">Order Summary</h3>
        
        <!-- Items List -->
        <div id="checkout-items-list" class="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
          ${itemsSummaryHTML}
        </div>

        <!-- Calculations -->
        <div class="border-t border-outline-variant/20 pt-3 flex flex-col gap-2 text-sm">
          <div class="flex items-center justify-between text-on-surface-variant text-xs">
            <span>Subtotal</span>
            <span class="font-label-bold text-primary">$${subtotal.toFixed(2)}</span>
          </div>
          <div class="flex items-center justify-between text-on-surface-variant text-xs">
            <span id="checkout-fee-label">Pickup Fee</span>
            <span id="checkout-fee-amount" class="text-secondary font-label-bold">FREE</span>
          </div>
          <div class="border-t border-dashed border-outline-variant/30 pt-2.5 flex items-center justify-between">
            <span class="font-display font-bold text-primary text-base">Total Due</span>
            <span id="checkout-total" class="font-display font-bold text-xl text-primary">$${subtotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

    </div>
  `;

  // Attach Order Type Toggle Listener
  const orderTypeSelect = document.getElementById('cust-order-type');
  const addressGroup = document.getElementById('address-group');
  const feeLabel = document.getElementById('checkout-fee-label');

  if (orderTypeSelect && addressGroup) {
    orderTypeSelect.addEventListener('change', () => {
      if (orderTypeSelect.value === 'delivery') {
        addressGroup.classList.remove('hidden');
        if (feeLabel) feeLabel.textContent = 'Delivery Fee';
      } else {
        addressGroup.classList.add('hidden');
        if (feeLabel) feeLabel.textContent = 'Pickup Fee';
      }
    });
  }

  // Attach Form Submit Listener
  const checkoutForm = document.getElementById('checkout-form');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', handlePlaceOrder);
  }
}

// Form Validation and Order Submission Handler
function handlePlaceOrder(event) {
  event.preventDefault();

  const nameInput = document.getElementById('cust-name');
  const phoneInput = document.getElementById('cust-phone');
  const emailInput = document.getElementById('cust-email');
  const orderTypeSelect = document.getElementById('cust-order-type');
  const addressInput = document.getElementById('cust-address');
  const notesInput = document.getElementById('cust-notes');

  const errorName = document.getElementById('error-cust-name');
  const errorPhone = document.getElementById('error-cust-phone');
  const errorEmail = document.getElementById('error-cust-email');
  const errorAddress = document.getElementById('error-cust-address');

  // Reset errors
  let isValid = true;
  [errorName, errorPhone, errorEmail, errorAddress].forEach(el => {
    if (el) {
      el.textContent = '';
      el.classList.add('hidden');
    }
  });

  // 1. Name Validation
  const nameVal = nameInput ? nameInput.value.trim() : '';
  if (!nameVal || nameVal.length < 2) {
    if (errorName) {
      errorName.textContent = 'Please enter your full name (minimum 2 characters).';
      errorName.classList.remove('hidden');
    }
    isValid = false;
  }

  // 2. Phone Validation
  const phoneVal = phoneInput ? phoneInput.value.trim() : '';
  const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;
  if (!phoneVal || !phoneRegex.test(phoneVal.replace(/\s+/g, ''))) {
    if (errorPhone) {
      errorPhone.textContent = 'Please enter a valid phone number (e.g. 555-123-4567).';
      errorPhone.classList.remove('hidden');
    }
    isValid = false;
  }

  // 3. Email Validation
  const emailVal = emailInput ? emailInput.value.trim() : '';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailVal || !emailRegex.test(emailVal)) {
    if (errorEmail) {
      errorEmail.textContent = 'Please enter a valid email address (e.g. name@example.com).';
      errorEmail.classList.remove('hidden');
    }
    isValid = false;
  }

  // 4. Address Validation (Required only if Delivery is selected)
  const isDelivery = orderTypeSelect && orderTypeSelect.value === 'delivery';
  const addressVal = addressInput ? addressInput.value.trim() : '';
  if (isDelivery && (!addressVal || addressVal.length < 5)) {
    if (errorAddress) {
      errorAddress.textContent = 'Please enter your delivery address.';
      errorAddress.classList.remove('hidden');
    }
    isValid = false;
  }

  // If validation fails, DO NOT create an order or clear the cart
  if (!isValid) return;

  const customerData = {
    name: nameVal,
    phone: phoneVal,
    email: emailVal,
    orderType: isDelivery ? "delivery" : "pickup",
    address: isDelivery ? addressVal : "",
    notes: notesInput ? notesInput.value.trim() : ""
  };

  // 1. Create Completed Order Snapshot using orders.js
  let completedOrder = null;
  if (typeof createOrder === 'function') {
    completedOrder = createOrder(cart, customerData);
  }

  if (!completedOrder) {
    console.error("Could not create order object.");
    return;
  }

  // 2. Save Order Record to Order History Storage
  if (typeof saveOrder === 'function') {
    saveOrder(completedOrder);
  }

  // 3. Clear Active Cart, LocalStorage, and Badge
  if (typeof clearCart === 'function') {
    clearCart();
  }

  // 4. Render Polished Confirmation State using the completedOrder record
  renderOrderSuccess(completedOrder);
}

// Render Order Success / Confirmation View
function renderOrderSuccess(order) {
  const checkoutContent = document.getElementById('checkout-content');
  if (!checkoutContent || !order) return;

  const itemsReceiptHTML = order.items.map(item => {
    return `
      <div class="flex items-center justify-between text-xs py-1">
        <span class="text-on-surface">${item.name} × ${item.quantity}</span>
        <span class="font-label-bold text-primary">$${item.lineTotal.toFixed(2)}</span>
      </div>
    `;
  }).join('');

  checkoutContent.innerHTML = `
    <div class="flex flex-col items-center justify-center text-center py-6 px-3 sm:px-4 max-w-lg mx-auto">
      <div class="w-16 h-16 bg-tertiary-fixed text-primary rounded-full flex items-center justify-center mb-4 shadow-lg pink-glow animate-bounce">
        <span class="material-symbols-outlined text-3xl text-primary font-bold">task_alt</span>
      </div>
      
      <div class="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-secondary/15 border border-secondary/30 text-secondary font-label-bold text-xs uppercase tracking-wider mb-2">
        <span>Frontend Demo Preview</span>
      </div>

      <h3 class="font-display text-2xl sm:text-3xl font-black text-primary mb-1">Order Ready!</h3>
      <p class="font-body-md text-sm text-on-surface-variant mb-5">Thanks, <strong class="text-primary">${order.customer.name}</strong>! Your order has been prepared for the next step.</p>

      <!-- Demo Receipt Card (Rendered strictly from immutable snapshot) -->
      <div class="w-full bg-surface border border-outline-variant/30 rounded-2xl p-4 sm:p-5 mb-6 text-left shadow-xs flex flex-col gap-2.5">
        <div class="flex items-center justify-between border-b border-outline-variant/20 pb-2 text-xs text-on-surface-variant font-label-bold">
          <span>REFERENCE: <strong class="text-primary">${order.orderId}</strong></span>
          <span class="uppercase text-secondary">${order.customer.orderType}</span>
        </div>
        
        <div class="flex flex-col gap-1 max-h-[140px] overflow-y-auto">
          ${itemsReceiptHTML}
        </div>

        <div class="border-t border-outline-variant/20 pt-2 flex items-center justify-between">
          <span class="font-label-bold text-xs text-on-surface-variant">Total Amount:</span>
          <span class="font-display font-bold text-lg text-primary">$${order.subtotal.toFixed(2)}</span>
        </div>

        ${order.customer.address ? `
          <div class="text-xs text-on-surface-variant pt-1 border-t border-outline-variant/10">
            <span class="font-bold text-primary">Delivery Address:</span> ${order.customer.address}
          </div>
        ` : ''}

        ${order.customer.notes ? `
          <div class="text-xs text-on-surface-variant pt-1 border-t border-outline-variant/10">
            <span class="font-bold text-primary">Notes:</span> ${order.customer.notes}
          </div>
        ` : ''}
      </div>

      <button id="success-back-to-menu-btn" class="bg-secondary-container text-on-secondary-container hover:bg-tertiary hover:text-on-tertiary font-label-bold text-sm py-3 px-8 rounded-full transition-all duration-200 shadow-md flex items-center gap-2 cursor-pointer active:scale-95">
        <span>← Back to Menu</span>
      </button>
    </div>
  `;

  const successBackBtn = document.getElementById('success-back-to-menu-btn');
  if (successBackBtn) {
    successBackBtn.addEventListener('click', backToMenu);
  }
}

// Initialize Checkout Event Handlers
document.addEventListener('DOMContentLoaded', () => {
  const closeCheckoutBtn = document.getElementById('close-checkout-btn');
  const backToCartBtn = document.getElementById('back-to-cart-btn');
  const openCheckoutBtn = document.getElementById('open-checkout-btn');

  // Open Checkout from Cart Drawer CTA
  if (openCheckoutBtn) {
    openCheckoutBtn.addEventListener('click', openCheckout);
  }

  // Close Checkout Modal
  if (closeCheckoutBtn) {
    closeCheckoutBtn.addEventListener('click', closeCheckout);
  }

  // Back to Cart from Checkout Header
  if (backToCartBtn) {
    backToCartBtn.addEventListener('click', () => {
      closeCheckout();
      if (typeof openCart === 'function') {
        openCart();
      }
    });
  }

  // Close Checkout Modal on Escape Key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const checkoutModal = document.getElementById('checkout-modal');
      if (checkoutModal && checkoutModal.classList.contains('opacity-100')) {
        closeCheckout();
      }
    }
  });
});
