/**
 * Brew & Bite - Checkout & Payment Experience Module (checkout.js)
 * Handles customer checkout modal display, payment method selection (Online Simulation vs COD),
 * idempotency protection, availability checks, authenticated order + payment persistence,
 * and order confirmation receipt rendering.
 */

// Helper function to prevent XSS in dynamic HTML rendering
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let isSubmittingCheckout = false;

/**
 * Country-Based Phone Configuration and Validation Helper
 */
function getCountryPhoneConfig(currencyCode) {
  const code = (currencyCode || (typeof getActiveCurrency === 'function' ? getActiveCurrency() : 'USD')).toUpperCase();

  switch (code) {
    case 'INR':
      return {
        country: 'India',
        currency: 'INR',
        dialCode: '+91',
        placeholder: '+91 98765 43210',
        labelHint: 'Indian (+91)',
        errorMessage: 'Please enter a valid 10-digit Indian mobile number (e.g. +91 98765 43210 or 9876543210).',
        validate: (input) => {
          if (!input) return { valid: false };
          const cleaned = String(input).trim().replace(/[\s\-\(\)]/g, '');
          let digits = '';
          if (cleaned.startsWith('+91')) {
            digits = cleaned.slice(3);
          } else if (cleaned.startsWith('91') && cleaned.length === 12) {
            digits = cleaned.slice(2);
          } else if (cleaned.startsWith('0') && cleaned.length === 11) {
            digits = cleaned.slice(1);
          } else if (cleaned.length === 10) {
            digits = cleaned;
          } else {
            return { valid: false };
          }
          const isValid = /^[6-9]\d{9}$/.test(digits);
          return {
            valid: isValid,
            e164Phone: isValid ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : null
          };
        }
      };

    case 'CAD':
      return {
        country: 'Canada',
        currency: 'CAD',
        dialCode: '+1',
        placeholder: '+1 (416) 123-4567',
        labelHint: 'Canada (+1)',
        errorMessage: 'Please enter a valid 10-digit Canadian phone number (e.g. +1 416 123-4567).',
        validate: (input) => {
          if (!input) return { valid: false };
          const cleaned = String(input).trim().replace(/[\s\-\(\)\.]/g, '');
          let digits = '';
          if (cleaned.startsWith('+1')) {
            digits = cleaned.slice(2);
          } else if (cleaned.startsWith('1') && cleaned.length === 11) {
            digits = cleaned.slice(1);
          } else if (cleaned.length === 10) {
            digits = cleaned;
          } else {
            return { valid: false };
          }
          const isValid = /^[2-9]\d{2}[2-9]\d{6}$/.test(digits);
          return {
            valid: isValid,
            e164Phone: isValid ? `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : null
          };
        }
      };

    case 'GBP':
      return {
        country: 'United Kingdom',
        currency: 'GBP',
        dialCode: '+44',
        placeholder: '+44 7911 123456',
        labelHint: 'UK (+44)',
        errorMessage: 'Please enter a valid UK phone number (e.g. +44 7911 123456 or 07911123456).',
        validate: (input) => {
          if (!input) return { valid: false };
          const cleaned = String(input).trim().replace(/[\s\-\(\)\.]/g, '');
          let digits = '';
          if (cleaned.startsWith('+44')) {
            digits = cleaned.slice(3);
          } else if (cleaned.startsWith('44') && cleaned.length === 12) {
            digits = cleaned.slice(2);
          } else if (cleaned.startsWith('0') && (cleaned.length === 11 || cleaned.length === 10)) {
            digits = cleaned.slice(1);
          } else if (cleaned.length === 10) {
            digits = cleaned;
          } else {
            return { valid: false };
          }
          const isValid = /^\d{10}$/.test(digits);
          return {
            valid: isValid,
            e164Phone: isValid ? `+44 ${digits.slice(0, 4)} ${digits.slice(4)}` : null
          };
        }
      };

    case 'USD':
    default:
      return {
        country: 'United States',
        currency: 'USD',
        dialCode: '+1',
        placeholder: '+1 (555) 123-4567',
        labelHint: 'US (+1)',
        errorMessage: 'Please enter a valid 10-digit US phone number (e.g. +1 555 123-4567).',
        validate: (input) => {
          if (!input) return { valid: false };
          const cleaned = String(input).trim().replace(/[\s\-\(\)\.]/g, '');
          let digits = '';
          if (cleaned.startsWith('+1')) {
            digits = cleaned.slice(2);
          } else if (cleaned.startsWith('1') && cleaned.length === 11) {
            digits = cleaned.slice(1);
          } else if (cleaned.length === 10) {
            digits = cleaned;
          } else {
            return { valid: false };
          }
          const isValid = /^[2-9]\d{2}[2-9]\d{6}$/.test(digits);
          return {
            valid: isValid,
            e164Phone: isValid ? `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : null
          };
        }
      };
  }
}

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

// Render Checkout Content (Empty Cart State, Guest Auth Prompt, or Active 2-Column Form)
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
  const getDisplayPrice = (val) => {
    return typeof formatCurrency === 'function' ? formatCurrency(val) : `$${Number(val || 0).toFixed(2)}`;
  };

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
          <div class="w-8 h-8 rounded-lg bg-surface-container-high overflow-hidden flex-shrink-0">
            <img src="${product.image}" alt="${product.name}" class="w-full h-full object-cover" />
          </div>
          <div class="min-w-0">
            <h4 class="font-bold text-primary text-xs truncate">${product.name}</h4>
            <span class="text-[11px] text-on-surface-variant">${cartItem.quantity} × ${getDisplayPrice(product.price)}</span>
          </div>
        </div>
        <span class="font-label-bold text-primary text-xs flex-shrink-0">${getDisplayPrice(lineTotal)}</span>
      </div>
    `;
  }).join('');
  const activeCurr = (typeof getActiveCurrency === 'function') ? getActiveCurrency() : 'USD';
  const phoneConfig = getCountryPhoneConfig(activeCurr);

  // Prefill details from authenticated profile if available
  const isAuth = typeof currentUser !== 'undefined' && currentUser && currentUser.id;
  const prefillName = (typeof userProfile !== 'undefined' && userProfile?.full_name) || (isAuth ? (currentUser.user_metadata?.full_name || '') : '');
  const prefillEmail = (typeof userProfile !== 'undefined' && userProfile?.email) || (isAuth ? currentUser.email : '');
  const prefillPhone = (typeof userProfile !== 'undefined' && userProfile?.phone) || (isAuth ? (currentUser.user_metadata?.phone || '') : '');

  checkoutContent.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
      
      <!-- LEFT COLUMN: Customer & Payment Form -->
      <div class="lg:col-span-7 flex flex-col gap-4">
        
        <!-- Authenticated Status Banner -->
        ${!isAuth ? `
          <div class="p-3.5 rounded-2xl bg-secondary-container/20 border border-secondary/30 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-secondary text-xl">account_circle</span>
              <p class="text-xs text-primary font-medium">Have an account? Sign in for fast checkout.</p>
            </div>
            <button id="checkout-auth-prompt-btn" class="bg-secondary-container text-on-secondary-container hover:bg-tertiary hover:text-on-tertiary text-xs font-label-bold px-3 py-1.5 rounded-full transition-colors cursor-pointer whitespace-nowrap">
              <span>Sign In / Sign Up</span>
            </button>
          </div>
        ` : `
          <div class="p-3 rounded-2xl bg-surface border border-outline-variant/20 flex items-center justify-between text-xs">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-green-600 text-lg">verified_user</span>
              <span class="text-on-surface-variant font-medium">Ordering as: <strong class="text-primary">${prefillName || prefillEmail}</strong></span>
            </div>
            <span class="text-[10px] font-label-bold uppercase tracking-wider text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">Member</span>
          </div>
        `}

        <h3 class="font-display text-lg font-bold text-primary border-b border-outline-variant/20 pb-2">Customer &amp; Payment Details</h3>
        
        <form id="checkout-form" novalidate class="flex flex-col gap-4">
          <!-- Full Name -->
          <div>
            <label for="cust-name" class="block font-label-bold text-xs text-primary mb-1 uppercase tracking-wider">Full Name *</label>
            <input type="text" id="cust-name" name="name" value="${prefillName}" required placeholder="e.g. Lakshpreet Kaur" class="w-full px-4 py-2.5 rounded-2xl bg-surface border border-outline-variant/40 focus:border-tertiary focus:ring-2 focus:ring-tertiary/20 outline-none transition-all text-sm text-on-surface" />
            <p id="error-cust-name" class="hidden text-xs text-red-600 font-medium mt-1"></p>
          </div>

          <!-- Phone & Email (2-Column Grid) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="cust-phone" class="block font-label-bold text-xs text-primary mb-1 uppercase tracking-wider">Phone Number (${phoneConfig.labelHint}) *</label>
              <input type="tel" id="cust-phone" name="phone" value="${prefillPhone}" required placeholder="e.g. ${phoneConfig.placeholder}" class="w-full px-4 py-2.5 rounded-2xl bg-surface border border-outline-variant/40 focus:border-tertiary focus:ring-2 focus:ring-tertiary/20 outline-none transition-all text-sm text-on-surface" />
              <p id="error-cust-phone" class="hidden text-xs text-red-600 font-medium mt-1"></p>
            </div>
            <div>
              <label for="cust-email" class="block font-label-bold text-xs text-primary mb-1 uppercase tracking-wider">Email Address *</label>
              <input type="email" id="cust-email" name="email" value="${prefillEmail}" required placeholder="e.g. laksh@example.com" class="w-full px-4 py-2.5 rounded-2xl bg-surface border border-outline-variant/40 focus:border-tertiary focus:ring-2 focus:ring-tertiary/20 outline-none transition-all text-sm text-on-surface" />
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
          <div id="address-group" class="hidden flex flex-col gap-2.5">
            ${(typeof getUserAddresses === 'function' && getUserAddresses().length > 0) ? `
              <div>
                <label class="block font-label-bold text-xs text-primary mb-1.5 uppercase tracking-wider">Choose Saved Address</label>
                <div class="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto">
                  ${getUserAddresses().map((addr, idx) => `
                    <label class="saved-address-option flex items-start gap-2.5 p-2.5 rounded-xl bg-surface border ${addr.is_default || idx === 0 ? 'border-tertiary bg-secondary-container/10' : 'border-outline-variant/30'} cursor-pointer hover:border-tertiary transition-all">
                      <input type="radio" name="selectedSavedAddress" value="${addr.id}" ${addr.is_default || idx === 0 ? 'checked' : ''} class="mt-0.5 text-tertiary" />
                      <div class="flex flex-col text-xs leading-tight">
                        <div class="flex items-center gap-2">
                          <span class="font-bold text-primary">${addr.full_name}</span>
                          ${addr.is_default ? `<span class="bg-tertiary text-on-tertiary text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase">Default</span>` : ''}
                        </div>
                        <span class="text-[11px] text-on-surface-variant mt-0.5">${addr.address_line_1}${addr.address_line_2 ? ', ' + addr.address_line_2 : ''}, ${addr.city}, ${addr.postal_code}</span>
                      </div>
                    </label>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <div>
              <label for="cust-address" class="block font-label-bold text-xs text-primary mb-1 uppercase tracking-wider">Delivery Address *</label>
              <input type="text" id="cust-address" name="address" value="${(typeof getDefaultAddress === 'function' && getDefaultAddress()) ? `${getDefaultAddress().address_line_1}${getDefaultAddress().address_line_2 ? ', ' + getDefaultAddress().address_line_2 : ''}, ${getDefaultAddress().city}, ${getDefaultAddress().postal_code}` : ''}" placeholder="Street, apartment, suite, city" class="w-full px-4 py-2.5 rounded-2xl bg-surface border border-outline-variant/40 focus:border-tertiary focus:ring-2 focus:ring-tertiary/20 outline-none transition-all text-sm text-on-surface" />
              <p id="error-cust-address" class="hidden text-xs text-red-600 font-medium mt-1"></p>
            </div>
          </div>

          <!-- Order Notes -->
          <div>
            <label for="cust-notes" class="block font-label-bold text-xs text-primary mb-1 uppercase tracking-wider">Order Notes (Optional)</label>
            <textarea id="cust-notes" name="notes" rows="2" placeholder="Any special requests or instructions..." class="w-full px-4 py-2 rounded-2xl bg-surface border border-outline-variant/40 focus:border-tertiary focus:ring-2 focus:ring-tertiary/20 outline-none transition-all text-sm text-on-surface resize-none"></textarea>
          </div>

          <!-- Payment Method Selection Section -->
          <div class="flex flex-col gap-2.5 border-t border-outline-variant/20 pt-3">
            <label class="block font-label-bold text-xs text-primary uppercase tracking-wider">Payment Method *</label>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <!-- Cash on Delivery -->
              <label class="payment-method-label flex items-start gap-3 p-3.5 rounded-2xl bg-surface border-2 border-tertiary cursor-pointer transition-all">
                <input type="radio" name="paymentMethod" value="cash_on_delivery" checked class="mt-0.5 text-tertiary" />
                <div class="flex flex-col">
                  <div class="flex items-center gap-1.5 font-display font-bold text-xs text-primary">
                    <span class="material-symbols-outlined text-base text-secondary">payments</span>
                    <span>Cash on Delivery</span>
                  </div>
                  <span class="text-[11px] text-on-surface-variant mt-0.5">Pay when you pick up or receive order</span>
                </div>
              </label>

              <!-- Online Payment Simulation -->
              <label class="payment-method-label flex items-start gap-3 p-3.5 rounded-2xl bg-surface border-2 border-outline-variant/40 cursor-pointer transition-all">
                <input type="radio" name="paymentMethod" value="online" class="mt-0.5 text-tertiary" />
                <div class="flex flex-col">
                  <div class="flex items-center gap-1.5 font-display font-bold text-xs text-primary">
                    <span class="material-symbols-outlined text-base text-tertiary">credit_card</span>
                    <span>Online Payment</span>
                  </div>
                  <span class="text-[11px] text-on-surface-variant mt-0.5">Card / UPI Simulation (Safe Testing)</span>
                </div>
              </label>
            </div>

            <!-- Online Payment Simulator Sandbox Box -->
            <div id="online-payment-simulation-box" class="hidden p-3.5 rounded-2xl bg-surface-container-high/30 border border-outline-variant/25 flex flex-col gap-2.5">
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-label-bold text-primary flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-sm text-secondary">science</span>
                  <span>Payment Simulation Mode</span>
                </span>
                <span class="text-[10px] bg-secondary-container/40 text-on-secondary-container px-2 py-0.5 rounded-md font-bold uppercase">Sandbox Test</span>
              </div>
              <p class="text-[11px] text-on-surface-variant">Safe testing environment. No real bank cards or money are charged. Select test outcome:</p>
              
              <div class="grid grid-cols-2 gap-2">
                <label class="flex items-center gap-2 p-2 rounded-xl bg-surface border border-outline-variant/30 text-xs cursor-pointer has-[:checked]:border-green-600 has-[:checked]:bg-green-50/50">
                  <input type="radio" name="simulatedOutcome" value="success" checked class="text-green-600 focus:ring-green-500" />
                  <span class="font-bold text-green-800 text-[11px]">Simulate Success (Paid)</span>
                </label>
                <label class="flex items-center gap-2 p-2 rounded-xl bg-surface border border-outline-variant/30 text-xs cursor-pointer has-[:checked]:border-red-600 has-[:checked]:bg-red-50/50">
                  <input type="radio" name="simulatedOutcome" value="failure" class="text-red-600 focus:ring-red-500" />
                  <span class="font-bold text-red-800 text-[11px]">Simulate Decline (Fail)</span>
                </label>
              </div>
            </div>
          </div>

          <!-- General Form Error Notice -->
          <p id="checkout-general-error" class="hidden text-xs text-red-600 font-medium text-center p-2.5 rounded-xl bg-red-50 border border-red-200"></p>

          <!-- Place Order / Pay Button -->
          <button type="submit" id="place-order-submit-btn" class="w-full mt-2 bg-tertiary text-on-tertiary font-label-bold text-sm sm:text-base py-3 px-6 rounded-full hover:scale-102 transition-all duration-200 shadow-md pink-glow flex items-center justify-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50">
            <span id="place-order-btn-text">Place Order (Cash on Delivery)</span>
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
            <span class="font-label-bold text-primary">${getDisplayPrice(subtotal)}</span>
          </div>
          <div class="flex items-center justify-between text-on-surface-variant text-xs">
            <span id="checkout-fee-label">Pickup Fee</span>
            <span id="checkout-fee-amount" class="text-secondary font-label-bold">FREE</span>
          </div>
          <div class="border-t border-dashed border-outline-variant/30 pt-2.5 flex items-center justify-between">
            <span class="font-display font-bold text-primary text-base">Total Due</span>
            <span id="checkout-total" class="font-display font-bold text-xl text-primary">${getDisplayPrice(subtotal)}</span>
          </div>
        </div>
      </div>

    </div>
  `;

  // Attach Auth Prompt Button Listener if guest
  const authPromptBtn = document.getElementById('checkout-auth-prompt-btn');
  if (authPromptBtn) {
    authPromptBtn.addEventListener('click', () => {
      closeCheckout();
      if (typeof openProfile === 'function') {
        openProfile();
      }
    });
  }

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

  // Attach Saved Address Selection Handler
  const savedAddrRadios = document.querySelectorAll('input[name="selectedSavedAddress"]');
  const custAddrInput = document.getElementById('cust-address');
  const custPhoneInput = document.getElementById('cust-phone');
  const custNameInput = document.getElementById('cust-name');

  savedAddrRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.saved-address-option').forEach(opt => {
        opt.classList.remove('border-tertiary', 'bg-secondary-container/10');
        opt.classList.add('border-outline-variant/30');
      });

      const parentLabel = radio.closest('.saved-address-option');
      if (parentLabel) {
        parentLabel.classList.remove('border-outline-variant/30');
        parentLabel.classList.add('border-tertiary', 'bg-secondary-container/10');
      }

      const allAddrs = (typeof getUserAddresses === 'function') ? getUserAddresses() : [];
      const chosen = allAddrs.find(a => a.id === radio.value);
      if (chosen) {
        if (custAddrInput) custAddrInput.value = `${chosen.address_line_1}${chosen.address_line_2 ? ', ' + chosen.address_line_2 : ''}, ${chosen.city}, ${chosen.postal_code}`;
        if (custPhoneInput && !custPhoneInput.value) custPhoneInput.value = chosen.phone;
        if (custNameInput && !custNameInput.value) custNameInput.value = chosen.full_name;
      }
    });
  });

  // Payment Method Selection Toggle Handler
  const paymentRadios = document.querySelectorAll('input[name="paymentMethod"]');
  const simBox = document.getElementById('online-payment-simulation-box');
  const btnText = document.getElementById('place-order-btn-text');

  paymentRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.payment-method-label').forEach(label => {
        label.classList.remove('border-tertiary', 'bg-secondary-container/10');
        label.classList.add('border-outline-variant/40');
      });

      const parentLabel = radio.closest('.payment-method-label');
      if (parentLabel) {
        parentLabel.classList.remove('border-outline-variant/40');
        parentLabel.classList.add('border-tertiary', 'bg-secondary-container/10');
      }

      if (radio.value === 'online') {
        if (simBox) simBox.classList.remove('hidden');
        if (btnText) btnText.textContent = `Pay Now (Simulated $${subtotal.toFixed(2)})`;
      } else {
        if (simBox) simBox.classList.add('hidden');
        if (btnText) btnText.textContent = 'Place Order (Cash on Delivery)';
      }
    });
  });

  // Attach Form Submit Listener
  const checkoutForm = document.getElementById('checkout-form');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', handlePlaceOrder);
  }
}

// Form Validation and Authenticated Order & Payment Submission Handler
async function handlePlaceOrder(event) {
  event.preventDefault();

  // Idempotency Protection: Prevent duplicate submissions
  if (isSubmittingCheckout) {
    console.warn("Checkout submission already in progress. Ignoring duplicate click.");
    return;
  }

  const nameInput = document.getElementById('cust-name');
  const phoneInput = document.getElementById('cust-phone');
  const emailInput = document.getElementById('cust-email');
  const orderTypeSelect = document.getElementById('cust-order-type');
  const addressInput = document.getElementById('cust-address');
  const notesInput = document.getElementById('cust-notes');
  const generalError = document.getElementById('checkout-general-error');
  const submitBtn = document.getElementById('place-order-submit-btn');

  const selectedPaymentRadio = document.querySelector('input[name="paymentMethod"]:checked');
  const paymentMethod = selectedPaymentRadio ? selectedPaymentRadio.value : 'cash_on_delivery';

  const selectedOutcomeRadio = document.querySelector('input[name="simulatedOutcome"]:checked');
  const simulateOutcome = selectedOutcomeRadio ? selectedOutcomeRadio.value : 'success';

  const errorName = document.getElementById('error-cust-name');
  const errorPhone = document.getElementById('error-cust-phone');
  const errorEmail = document.getElementById('error-cust-email');
  const errorAddress = document.getElementById('error-cust-address');

  // Reset errors
  let isValid = true;
  [errorName, errorPhone, errorEmail, errorAddress, generalError].forEach(el => {
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

  // 2. Phone Validation (Country & Currency Sensitive)
  const phoneVal = phoneInput ? phoneInput.value.trim() : '';
  const currentCurrency = (typeof getActiveCurrency === 'function') ? getActiveCurrency() : 'USD';
  const phoneCfg = getCountryPhoneConfig(currentCurrency);
  const phoneCheck = phoneCfg.validate(phoneVal);

  if (!phoneVal || !phoneCheck.valid) {
    if (errorPhone) {
      errorPhone.textContent = phoneCfg.errorMessage;
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

  // If basic form validation fails, abort
  if (!isValid) return;

  // 5. Authentication Check (Guest Protection)
  if (typeof currentUser === 'undefined' || !currentUser || !currentUser.id) {
    if (generalError) {
      generalError.textContent = 'You must be signed in to place an order. Please click "Sign In / Sign Up" above.';
      generalError.classList.remove('hidden');
    }
    return;
  }

  // 6. Real-Time Menu Availability Verification
  if (typeof validateCartProductsAvailable === 'function') {
    const availCheck = validateCartProductsAvailable(cart);
    if (!availCheck.valid) {
      if (generalError) {
        generalError.textContent = availCheck.error || 'One or more items in your cart are no longer available.';
        generalError.classList.remove('hidden');
      }
      return;
    }
  }

  // Lock submission state
  isSubmittingCheckout = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      <span>${paymentMethod === 'online' ? 'Processing Simulated Payment...' : 'Creating Order...'}</span>
    `;
  }

  const customerData = {
    name: nameVal,
    phone: phoneCheck?.e164Phone || phoneVal,
    email: emailVal,
    orderType: isDelivery ? "delivery" : "pickup",
    address: isDelivery ? addressVal : "",
    notes: notesInput ? notesInput.value.trim() : ""
  };

  const paymentOptions = {
    method: paymentMethod,
    simulateOutcome: simulateOutcome
  };

  try {
    // 7. Create and persist authenticated order + payment into Supabase
    let completedOrder = null;
    if (typeof createAndSaveOrderInSupabase === 'function') {
      completedOrder = await createAndSaveOrderInSupabase(cart, customerData, currentUser, paymentOptions);
    }

    if (!completedOrder) {
      if (generalError) {
        generalError.textContent = 'Could not process order. Please try again.';
        generalError.classList.remove('hidden');
      }
      return;
    }

    // 8. Clear Active Cart, LocalStorage, and Badge only on confirmed success
    if (typeof clearCart === 'function') {
      clearCart();
    }

    // 8.1 Dispatch Customer and Admin In-App Notifications (Non-blocking)
    if (typeof notifyOrderPlaced === 'function') {
      notifyOrderPlaced(completedOrder, currentUser).catch(err => {
        console.warn("Notice: notification dispatch note:", err);
      });
    }

    // 9. Render Confirmation Receipt View
    renderOrderSuccess(completedOrder);
  } catch (err) {
    console.error("Payment & Order submission error:", err);
    if (generalError) {
      generalError.textContent = err.message || 'Payment could not be completed. Your cart has been safely preserved.';
      generalError.classList.remove('hidden');
    }
  } finally {
    isSubmittingCheckout = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      const subtotalVal = (typeof cart !== 'undefined' && Array.isArray(cart))
        ? cart.reduce((sum, item) => {
          const p = (typeof PRODUCTS !== 'undefined' && Array.isArray(PRODUCTS)) ? PRODUCTS.find(prod => prod.id === item.productId) : null;
          return sum + ((p ? p.price : 0) * item.quantity);
        }, 0)
        : 0;

      submitBtn.innerHTML = `
        <span>${paymentMethod === 'online' ? `Pay Now (Simulated $${subtotalVal.toFixed(2)})` : 'Place Order (Cash on Delivery)'}</span>
        <span class="material-symbols-outlined text-base">check_circle</span>
      `;
    }
  }
}

// Render Order Success / Confirmation View with Payment Details
function renderOrderSuccess(order) {
  const checkoutContent = document.getElementById('checkout-content');
  if (!checkoutContent || !order) return;

  const paymentInfo = order.payment || {};
  const isPaid = paymentInfo.status === 'paid';
  const paymentMethodLabel = paymentInfo.method === 'online' ? 'Online Payment (Simulated)' : 'Cash on Delivery';
  const orderCurr = order.currency || order.payment?.currency || 'USD';

  const formatPrice = (val) => {
    return typeof formatHistoricalCurrency === 'function'
      ? formatHistoricalCurrency(val, orderCurr)
      : `$${Number(val || 0).toFixed(2)}`;
  };

  const itemsReceiptHTML = order.items.map(item => {
    return `
      <div class="flex items-center justify-between text-xs py-1 border-b border-outline-variant/10">
        <span class="text-on-surface">${item.name} × ${item.quantity}</span>
        <span class="font-label-bold text-primary">${formatPrice(item.lineTotal)}</span>
      </div>
    `;
  }).join('');

  checkoutContent.innerHTML = `
    <div class="flex flex-col items-center justify-center text-center py-6 px-3 sm:px-4 max-w-lg mx-auto">
      <div class="w-16 h-16 bg-secondary-container/30 text-primary rounded-full flex items-center justify-center mb-4 shadow-lg pink-glow animate-bounce">
        <span class="material-symbols-outlined text-3xl text-primary font-bold">task_alt</span>
      </div>
      
      <div class="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-secondary/15 border border-secondary/30 text-secondary font-label-bold text-xs uppercase tracking-wider mb-2">
        <span>Order Placed &amp; Confirmed</span>
      </div>

      <h3 class="font-display text-2xl sm:text-3xl font-black text-primary mb-1">Thank You!</h3>
      <p class="font-body-md text-sm text-on-surface-variant mb-5">Thanks, <strong class="text-primary">${escapeHtml(order.customer.name)}</strong>! Your order and payment details are securely saved.</p>

      <!-- Receipt Card (Rendered strictly from immutable snapshot) -->
      <div class="w-full bg-surface border border-outline-variant/30 rounded-2xl p-4 sm:p-5 mb-6 text-left shadow-xs flex flex-col gap-2.5">
        <div class="flex items-center justify-between border-b border-outline-variant/20 pb-2 text-xs text-on-surface-variant font-label-bold">
          <span>REFERENCE: <strong class="text-primary">${order.orderId}</strong></span>
          <span class="uppercase text-secondary font-bold">${order.customer.orderType}</span>
        </div>

        <!-- Payment Status Card -->
        <div class="p-3 rounded-xl bg-surface-container-high/30 border border-outline-variant/15 flex items-center justify-between text-xs">
          <div>
            <span class="text-on-surface-variant font-bold block mb-0.5">Payment Method:</span>
            <span class="text-primary font-medium">${paymentMethodLabel}</span>
          </div>
          <div class="text-right">
            <span class="text-on-surface-variant font-bold block mb-0.5">Payment Status:</span>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-label-bold uppercase ${isPaid ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}">
              ${isPaid ? 'Paid' : 'Pending (COD)'}
            </span>
          </div>
        </div>
        
        <div class="flex flex-col gap-1 max-h-[140px] overflow-y-auto">
          ${itemsReceiptHTML}
        </div>

        <div class="border-t border-outline-variant/20 pt-2 flex items-center justify-between">
          <span class="font-label-bold text-xs text-on-surface-variant">Total Amount:</span>
          <span class="font-display font-bold text-lg text-primary">${formatPrice(order.subtotal)}</span>
        </div>

        ${order.customer.address ? `
          <div class="text-xs text-on-surface-variant pt-1 border-t border-outline-variant/10">
            <span class="font-bold text-primary">Delivery Address:</span> ${escapeHtml(order.customer.address)}
          </div>
        ` : ''}

        ${order.customer.notes ? `
          <div class="text-xs text-on-surface-variant pt-1 border-t border-outline-variant/10">
            <span class="font-bold text-primary">Notes:</span> ${escapeHtml(order.customer.notes)}
          </div>
        ` : ''}
      </div>

      <div class="flex items-center gap-3 flex-wrap justify-center">
        <button id="success-track-order-btn" class="bg-primary text-on-primary hover:bg-tertiary font-label-bold text-xs sm:text-sm py-2.5 px-6 rounded-full transition-colors flex items-center gap-1.5 cursor-pointer">
          <span class="material-symbols-outlined text-base">receipt_long</span>
          <span>Track Order in Profile</span>
        </button>
        <button id="success-back-to-menu-btn" class="bg-surface-container-high text-primary hover:bg-surface-container-highest font-label-bold text-xs sm:text-sm py-2.5 px-6 rounded-full transition-colors cursor-pointer">
          <span>Back to Menu</span>
        </button>
      </div>
    </div>
  `;

  const trackBtn = document.getElementById('success-track-order-btn');
  if (trackBtn) {
    trackBtn.addEventListener('click', () => {
      closeCheckout();
      if (typeof openProfile === 'function') {
        openProfile();
      }
      if (typeof openOrderDetail === 'function') {
        openOrderDetail(order.orderId);
      }
    });
  }

  const successBackBtn = document.getElementById('success-back-to-menu-btn');
  if (successBackBtn) {
    successBackBtn.addEventListener('click', backToMenu);
  }
}

// Live sync of phone label and placeholder when currency changes
if (typeof onCurrencyChanged === 'function') {
  onCurrencyChanged((newCurr) => {
    const phoneInput = document.getElementById('cust-phone');
    const phoneLabel = document.querySelector('label[for="cust-phone"]');
    if (phoneInput && phoneLabel) {
      const cfg = getCountryPhoneConfig(newCurr);
      phoneInput.placeholder = `e.g. ${cfg.placeholder}`;
      phoneLabel.textContent = `Phone Number (${cfg.labelHint}) *`;
    }
  });
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

// Exports for testing / Node environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    openCheckout,
    closeCheckout,
    renderCheckout,
    handlePlaceOrder
  };
}
