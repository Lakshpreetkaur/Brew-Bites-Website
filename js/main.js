/**
 * Brew & Bite - Main JavaScript
 * Handles frame preloading, scroll scrubbing, hero text animation,
 * floating navbar transitions, mobile drawer navigation, dynamic product rendering,
 * and customer-facing shopping cart drawer with quantity controls and item removal.
 */

// Global In-Memory Cart State
let cart = [];

document.addEventListener('DOMContentLoaded', () => {
  const animContainer = document.getElementById('animation-container');
  const img = document.getElementById('anim');
  const scrollHint = document.getElementById('scroll-hint');
  const heroTextCol = document.getElementById('hero-text-col');

  const totalFrames = 222;
  const pad = (num, size) => String(num).padStart(size, '0');
  const frames = [];

  // Generate frame list and preload for smooth rendering
  for (let i = 1; i <= totalFrames; i++) {
    const src = `assets/frames/ezgif-frame-${pad(i, 3)}.jpg`;
    frames.push(src);
    const preloadImg = new Image();
    preloadImg.src = src;
  }

  // Set initial frame
  if (frames.length > 0 && img) {
    img.src = frames[0];
  }

  let isTicking = false;

  function updateFrame() {
    if (!animContainer) return;
    const rect = animContainer.getBoundingClientRect();
    const scrollDistance = -rect.top;
    const maxScroll = animContainer.offsetHeight - window.innerHeight;

    if (maxScroll > 0) {
      const progress = Math.min(Math.max(scrollDistance / maxScroll, 0), 1);
      const frameIdx = Math.min(totalFrames - 1, Math.floor(progress * totalFrames));
      
      if (img && frames[frameIdx] && img.getAttribute('data-current-frame') !== String(frameIdx)) {
        img.src = frames[frameIdx];
        img.setAttribute('data-current-frame', String(frameIdx));
      }

      // Smoothly fade and slightly translate text upward as scroll animation progresses
      if (heroTextCol) {
        const fadeEnd = 0.22; // Smoothly fades out in initial scroll phase
        const textOpacity = Math.max(0, 1 - (progress / fadeEnd));
        const textTranslateY = -(progress / fadeEnd) * 36;
        heroTextCol.style.opacity = textOpacity.toFixed(3);
        heroTextCol.style.transform = `translateY(${textTranslateY.toFixed(1)}px)`;
        heroTextCol.style.pointerEvents = textOpacity <= 0.05 ? 'none' : 'auto';
      }

      if (scrollHint) {
        scrollHint.style.opacity = progress > 0.08 ? '0' : '1';
      }
    }
    isTicking = false;
  }

  // Visual Confirmation Feedback on Button Click
  function showAddedFeedback(button) {
    if (!button) return;
    const originalText = button.innerHTML;
    button.innerHTML = '<span>Added ✓</span>';
    button.classList.add('bg-tertiary', 'text-on-tertiary', 'pink-glow');
    button.classList.remove('bg-secondary-container', 'text-on-secondary-container');

    setTimeout(() => {
      button.innerHTML = originalText;
      button.classList.remove('bg-tertiary', 'text-on-tertiary', 'pink-glow');
      button.classList.add('bg-secondary-container', 'text-on-secondary-container');
    }, 1000);
  }

  // Cart Drawer UI Elements
  const cartDrawer = document.getElementById('cart-drawer');
  const cartOverlay = document.getElementById('cart-overlay');
  const cartBtn = document.getElementById('cart-btn');
  const closeCartBtn = document.getElementById('close-cart-btn');
  const cartBadge = document.getElementById('cart-badge');
  const cartHeaderCount = document.getElementById('cart-header-count');
  const cartItemsContainer = document.getElementById('cart-items-container');
  const cartSubtotal = document.getElementById('cart-subtotal');

  // Open Cart Drawer
  function openCart() {
    if (!cartDrawer || !cartOverlay) return;
    renderCart();
    cartOverlay.classList.remove('opacity-0', 'pointer-events-none');
    cartOverlay.classList.add('opacity-100', 'pointer-events-auto');
    cartDrawer.classList.remove('translate-x-full');
    cartDrawer.classList.add('translate-x-0');
    document.body.classList.add('overflow-hidden');
  }

  // Close Cart Drawer
  function closeCart() {
    if (!cartDrawer || !cartOverlay) return;
    cartOverlay.classList.remove('opacity-100', 'pointer-events-auto');
    cartOverlay.classList.add('opacity-0', 'pointer-events-none');
    cartDrawer.classList.remove('translate-x-0');
    cartDrawer.classList.add('translate-x-full');
    document.body.classList.remove('overflow-hidden');
  }

  // Update Cart Count Badge
  function updateCartCount() {
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    if (cartBadge) {
      cartBadge.textContent = totalCount;
      if (totalCount > 0) {
        cartBadge.classList.remove('hidden');
      } else {
        cartBadge.classList.add('hidden');
      }
    }

    if (cartHeaderCount) {
      cartHeaderCount.textContent = `(${totalCount} item${totalCount === 1 ? '' : 's'})`;
    }
  }

  // Increase Product Quantity
  function increaseQuantity(productId) {
    if (!productId) return;
    const item = cart.find(i => i.productId === productId);
    if (item) {
      item.quantity += 1;
      console.log("Cart:", cart);
      updateCartCount();
      renderCart();
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
      console.log("Cart:", cart);
      updateCartCount();
      renderCart();
    }
  }

  // Remove Product Completely from Cart
  function removeFromCart(productId) {
    if (!productId) return;
    cart = cart.filter(item => item.productId !== productId);
    console.log("Cart:", cart);
    updateCartCount();
    renderCart();
  }

  // Render Cart Items & Subtotal
  function renderCart() {
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
      return;
    }

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
          <div class="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 ${product.accentColor} p-1">
            <img src="${product.image}" alt="${product.name}" class="w-full h-full object-cover rounded-lg" />
          </div>

          <!-- Product Info & Quantity Controls -->
          <div class="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5">
            <div class="flex items-start justify-between gap-2">
              <div>
                <h4 class="font-display font-bold text-primary text-sm truncate max-w-[140px] sm:max-w-[170px]">${product.name}</h4>
                <p class="font-body-md text-xs text-on-surface-variant">$${product.price.toFixed(2)}</p>
              </div>
              <!-- Line Total -->
              <span class="font-label-bold text-primary text-sm whitespace-nowrap">$${lineTotal.toFixed(2)}</span>
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
    cartSubtotal.textContent = `$${subtotal.toFixed(2)}`;
  }

  // Add to Cart Logic
  function addToCart(productId, button) {
    if (!productId) return;

    const existingItem = cart.find(item => item.productId === productId);
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.push({ productId: productId, quantity: 1 });
    }

    console.log("Cart:", cart);

    updateCartCount();
    renderCart();

    if (button) {
      showAddedFeedback(button);
    }
  }

  // Dynamic Product Rendering from PRODUCTS array
  function renderProducts() {
    if (typeof PRODUCTS === 'undefined' || !Array.isArray(PRODUCTS)) return;

    const coffeeContainer = document.getElementById('coffee-products');
    const biteContainer = document.getElementById('bite-products');

    // 1. Render Signature Brews (Coffee Cards - Vertical Layout)
    if (coffeeContainer) {
      const coffeeItems = PRODUCTS.filter(item => item.category === 'coffee');
      coffeeContainer.innerHTML = coffeeItems.map(item => `
        <div class="bg-surface-container-lowest rounded-3xl p-6 shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-300 border border-outline-variant/30 flex flex-col items-center text-center group">
          <div class="w-48 h-48 ${item.accentColor} rounded-full mb-6 overflow-hidden flex items-center justify-center p-4 group-hover:scale-105 transition-transform">
            <img alt="${item.name}" class="w-full h-full object-cover rounded-full" src="${item.image}" />
          </div>
          <h4 class="font-display text-xl font-bold text-primary mb-2">${item.name}</h4>
          <p class="font-body-md text-on-surface-variant mb-4">${item.description}</p>
          <div class="flex flex-col items-center gap-3 w-full mt-auto">
            <span class="font-label-bold text-secondary-container bg-secondary-container/10 px-4 py-1.5 rounded-full">$${item.price.toFixed(2)}</span>
            <button data-product-id="${item.id}" class="add-to-order-btn w-full bg-secondary-container text-on-secondary-container hover:bg-tertiary hover:text-on-tertiary font-label-bold text-sm py-2.5 px-4 rounded-full transition-all duration-200 shadow-xs hover:shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-1.5">
              <span>Add to Order +</span>
            </button>
          </div>
        </div>
      `).join('');
    }

    // 2. Render Bakery Bites (Bites Cards - Horizontal Layout)
    if (biteContainer) {
      const biteItems = PRODUCTS.filter(item => item.category === 'bites');
      biteContainer.innerHTML = biteItems.map(item => `
        <div class="bg-surface-container-lowest rounded-3xl p-6 shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-300 border border-outline-variant/30 flex flex-row items-center gap-6 group">
          <div class="w-32 h-32 ${item.accentColor} rounded-2xl overflow-hidden flex-shrink-0">
            <img alt="${item.name}" class="w-full h-full object-cover group-hover:scale-110 transition-transform" src="${item.image}" />
          </div>
          <div class="flex flex-col items-start justify-between flex-1 h-full py-1">
            <div>
              <h4 class="font-display text-xl font-bold text-primary mb-1">${item.name}</h4>
              <p class="font-body-md text-on-surface-variant mb-3">${item.description}</p>
            </div>
            <div class="flex items-center gap-3 w-full flex-wrap">
              <span class="font-label-bold text-secondary bg-secondary/10 px-4 py-1.5 rounded-full">$${item.price.toFixed(2)}</span>
              <button data-product-id="${item.id}" class="add-to-order-btn bg-secondary-container text-on-secondary-container hover:bg-tertiary hover:text-on-tertiary font-label-bold text-xs py-2 px-4 rounded-full transition-all duration-200 shadow-xs hover:shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-1">
                <span>Add to Order +</span>
              </button>
            </div>
          </div>
        </div>
      `).join('');
    }
  }

  // Bind Event Delegation for Cart Actions (+, -, Remove, and Add to Order)
  document.addEventListener('click', (e) => {
    // 1. Add to Order from product cards
    const addBtn = e.target.closest('.add-to-order-btn');
    if (addBtn) {
      const productId = addBtn.getAttribute('data-product-id');
      addToCart(productId, addBtn);
      return;
    }

    // 2. Increase Quantity inside Cart Drawer
    const incBtn = e.target.closest('.increase-qty-btn');
    if (incBtn) {
      const productId = incBtn.getAttribute('data-product-id');
      increaseQuantity(productId);
      return;
    }

    // 3. Decrease Quantity inside Cart Drawer
    const decBtn = e.target.closest('.decrease-qty-btn');
    if (decBtn) {
      const productId = decBtn.getAttribute('data-product-id');
      decreaseQuantity(productId);
      return;
    }

    // 4. Remove Item from Cart Drawer
    const remBtn = e.target.closest('.remove-item-btn');
    if (remBtn) {
      const productId = remBtn.getAttribute('data-product-id');
      removeFromCart(productId);
      return;
    }
  });

  // Cart Drawer Toggle Listeners
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

  // Floating Navbar Transparency and Blur on Scroll
  const mainNav = document.getElementById('main-nav');
  function updateNavStyle() {
    if (!mainNav) return;
    if (window.scrollY > 30) {
      mainNav.classList.remove('bg-white/10', 'backdrop-blur-xs', 'border-white/20');
      mainNav.classList.add('bg-surface/85', 'backdrop-blur-xl', 'border-white/60', 'shadow-lg', 'shadow-primary/5');
    } else {
      mainNav.classList.add('bg-white/10', 'backdrop-blur-xs', 'border-white/20');
      mainNav.classList.remove('bg-surface/85', 'backdrop-blur-xl', 'border-white/60', 'shadow-lg', 'shadow-primary/5');
    }
  }

  // Mobile Menu Drawer Handler
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const menuIcon = document.getElementById('menu-icon');
  const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      const isHidden = mobileMenu.classList.contains('hidden');
      if (isHidden) {
        mobileMenu.classList.remove('hidden');
        if (menuIcon) menuIcon.textContent = 'close';
      } else {
        mobileMenu.classList.add('hidden');
        if (menuIcon) menuIcon.textContent = 'menu';
      }
    });

    // Close mobile menu on clicking any navigation link
    mobileNavLinks.forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.add('hidden');
        if (menuIcon) menuIcon.textContent = 'menu';
      });
    });
  }

  window.addEventListener('scroll', () => {
    updateNavStyle();
    if (!isTicking) {
      window.requestAnimationFrame(updateFrame);
      isTicking = true;
    }
  }, { passive: true });

  window.addEventListener('resize', () => {
    updateNavStyle();
    updateFrame();
  });

  // Initialize
  renderProducts();
  updateCartCount();
  updateNavStyle();
  updateFrame();
});
