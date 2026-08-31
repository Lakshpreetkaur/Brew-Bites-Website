/**
 * Brew & Bite - Main Application Controller
 * Handles image sequence frame rendering, dynamic product rendering from Supabase,
 * scroll listeners, and mobile navigation.
 */

// Storefront Filter State
let storefrontSearchQuery = '';
let storefrontCategoryFilter = 'all'; // 'all' | 'coffee' | 'cold-brews' | 'cookies' | 'muffins' | 'croissants' | 'bites'
let storefrontAvailFilter = 'all'; // 'all' | 'available' | 'soldout'

// Global render function for customer menu
function renderProducts() {
  const coffeeContainer = document.getElementById('coffee-products');
  const biteContainer = document.getElementById('bite-products');
  const coffeeSection = document.getElementById('coffee-section');
  const biteSection = document.getElementById('bites-section');

  const productList = (typeof PRODUCTS !== 'undefined' && Array.isArray(PRODUCTS) && PRODUCTS.length > 0)
    ? PRODUCTS
    : ((typeof STATIC_PRODUCTS !== 'undefined' && Array.isArray(STATIC_PRODUCTS)) ? STATIC_PRODUCTS : []);

  if (productList.length === 0 && typeof isProductsLoading !== 'undefined' && isProductsLoading) {
    const loadingHTML = `
      <div class="col-span-full py-12 flex flex-col items-center justify-center text-center">
        <div class="w-10 h-10 border-3 border-caramel border-t-primary rounded-full animate-spin mb-3"></div>
        <p class="text-xs font-label-bold text-on-surface-variant">Loading our artisanal menu...</p>
      </div>
    `;
    if (coffeeContainer) coffeeContainer.innerHTML = loadingHTML;
    if (biteContainer) biteContainer.innerHTML = loadingHTML;
    return;
  }

  // Apply Search & Filters
  let filtered = [...productList];

  if (storefrontSearchQuery) {
    const q = storefrontSearchQuery.toLowerCase();
    filtered = filtered.filter(item => {
      const name = (item.name || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }

  if (storefrontAvailFilter !== 'all') {
    if (storefrontAvailFilter === 'available') {
      filtered = filtered.filter(item => (typeof normalizeProductAvailable === 'function' ? normalizeProductAvailable(item.available) : item.available === true));
    } else if (storefrontAvailFilter === 'soldout') {
      filtered = filtered.filter(item => (typeof normalizeProductAvailable === 'function' ? !normalizeProductAvailable(item.available) : item.available === false));
    }
  }

  // Category Filtering Logic (3 Main Categories: 'coffee', 'savory', 'sweet')
  if (storefrontCategoryFilter !== 'all') {
    filtered = filtered.filter(item => {
      const cat = (typeof normalizeCategory === 'function')
        ? normalizeCategory(item.category)
        : String(item.category || '').trim().toLowerCase();

      if (storefrontCategoryFilter === 'coffee' || storefrontCategoryFilter === 'cold-brews') {
        return cat === 'coffee';
      }
      if (storefrontCategoryFilter === 'savory' || storefrontCategoryFilter === 'savory-bites' || storefrontCategoryFilter === 'snacks' || storefrontCategoryFilter === 'snack' || storefrontCategoryFilter === 'bites') {
        return cat === 'savory';
      }
      if (storefrontCategoryFilter === 'sweet' || storefrontCategoryFilter === 'sweet-bites' || storefrontCategoryFilter === 'dessert' || storefrontCategoryFilter === 'desserts' || storefrontCategoryFilter === 'cookies' || storefrontCategoryFilter === 'muffins' || storefrontCategoryFilter === 'croissants') {
        return cat === 'sweet';
      }
      return cat === storefrontCategoryFilter;
    });
  }

  // Helper for dynamic currency formatting
  const getDisplayPrice = (priceUSD) => {
    if (typeof formatCurrency === 'function') {
      return formatCurrency(priceUSD);
    }
    return `$${Number(priceUSD || 0).toFixed(2)}`;
  };

  // Helper for review summary
  const getReviewBadgeHTML = (productId) => {
    if (typeof getProductReviewSummary === 'function') {
      const summary = getProductReviewSummary(productId);
      return `
        <button data-review-product-id="${productId}" class="product-reviews-trigger-btn inline-flex items-center gap-1 text-[11px] font-bold text-caramel hover:text-primary cursor-pointer transition-colors">
          <span>★</span>
          <span>${summary.average}</span>
          <span class="text-on-surface-variant font-normal text-[10px]">(${summary.count})</span>
        </button>
      `;
    }
    return '';
  };

  // Card Template Matching Approved Reference Image
  const renderCardHTML = (item) => {
    const isAvailable = (typeof normalizeProductAvailable === 'function')
      ? normalizeProductAvailable(item.available)
      : (item.available === true);

    const imgSrc = (item.image && String(item.image).trim().length > 0)
      ? String(item.image).trim()
      : 'assets/images/vanilla-cold-brew.jpg';

    const inCartQty = (typeof getItemQuantityInCart === 'function')
      ? getItemQuantityInCart(item.id)
      : 0;

    const actionButtonHTML = !isAvailable
      ? `<span class="text-[10px] font-bold text-on-surface-variant/60 uppercase">Sold Out</span>`
      : inCartQty > 0
        ? `
          <div class="flex items-center gap-1.5 bg-[#fbf6ec] border border-outline rounded-full px-1.5 py-0.5 shadow-2xs" onclick="event.stopPropagation()">
            <button data-product-id="${item.id}" aria-label="Decrease ${item.name} quantity" class="card-decrease-qty-btn w-6 h-6 rounded-full flex items-center justify-center text-primary hover:bg-black/5 active:scale-90 transition-all cursor-pointer font-bold text-sm">
              −
            </button>
            <span class="font-label-bold text-xs text-primary min-w-[14px] text-center">${inCartQty}</span>
            <button data-product-id="${item.id}" aria-label="Increase ${item.name} quantity" class="card-increase-qty-btn w-6 h-6 rounded-full flex items-center justify-center text-primary hover:bg-black/5 active:scale-90 transition-all cursor-pointer font-bold text-sm">
              +
            </button>
          </div>
        `
        : `
          <button data-product-id="${item.id}" aria-label="Add ${item.name} to order" class="add-to-order-btn w-7 h-7 rounded-full bg-primary hover:bg-primary-container text-white flex items-center justify-center text-sm font-bold shadow-xs active:scale-90 transition-all cursor-pointer">
            <span>+</span>
          </button>
        `;

    return `
      <article class="bg-white rounded-2xl p-3 border border-outline shadow-warm-xs hover:shadow-warm-md hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group cursor-pointer ${!isAvailable ? 'opacity-70' : ''}" onclick="openProductDetailsModal('${item.id}')">
        <div>
          <div class="w-full aspect-[4/3] rounded-xl overflow-hidden mb-3 relative bg-surface-container">
            <img alt="${item.name}" onerror="this.onerror=null; this.src='assets/images/vanilla-cold-brew.jpg'" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 rounded-xl" src="${imgSrc}" />
            ${!isAvailable ? `<span class="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center text-white text-xs font-bold uppercase">Sold Out</span>` : ''}
          </div>

          <div class="flex items-start justify-between gap-1 mb-1">
            <h4 class="font-display font-bold text-sm text-primary leading-snug">${item.name}</h4>
            <span class="font-body text-xs font-black text-primary shrink-0">${getDisplayPrice(item.price)}</span>
          </div>
          <p class="font-body text-[11px] text-on-surface-variant leading-relaxed line-clamp-2 mb-2">${item.description}</p>
        </div>

        <div class="flex items-center justify-between pt-2 border-t border-outline/50 mt-auto" onclick="event.stopPropagation()">
          <div>${getReviewBadgeHTML(item.id)}</div>
          ${actionButtonHTML}
        </div>
      </article>
    `;
  };

  // Render into main container
  if (coffeeContainer) {
    if (filtered.length === 0) {
      coffeeContainer.innerHTML = `<p class="col-span-full text-center text-xs text-on-surface-variant py-8">No items match your search or category filter.</p>`;
    } else {
      coffeeContainer.innerHTML = filtered.map(renderCardHTML).join('');
    }
  }

  // Attach Review Modal Open Triggers
  document.querySelectorAll('.product-reviews-trigger-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-review-product-id');
      if (id && typeof openProductReviewsModal === 'function') {
        openProductReviewsModal(id);
      }
    });
  });
}

// Re-render product cards when cart state updates anywhere
if (typeof onCartUpdated === 'function') {
  onCartUpdated(() => {
    renderProducts();
  });
}

/**
 * Open Product Quick Details & Ingredients Modal
 */
function openProductDetailsModal(productId) {
  if (!productId) return;
  const product = (typeof getProductById === 'function') ? getProductById(productId) : null;
  if (!product) return;

  const modal = document.getElementById('product-details-modal');
  const content = document.getElementById('product-details-modal-content');
  if (!modal || !content) return;

  const isAvailable = (typeof normalizeProductAvailable === 'function')
    ? normalizeProductAvailable(product.available)
    : (product.available !== false);

  const inCartQty = (typeof getItemQuantityInCart === 'function')
    ? getItemQuantityInCart(product.id)
    : 0;

  const summary = (typeof getProductReviewSummary === 'function')
    ? getProductReviewSummary(product.id)
    : { average: product.rating || 5.0, count: product.reviewCount || 0, starsHTML: '★★★★★' };

  const ingredientsHTML = Array.isArray(product.ingredients) && product.ingredients.length > 0
    ? `
      <div class="bg-[#fcf9f2] p-4 rounded-2xl border border-outline/70">
        <h5 class="text-xs font-bold uppercase tracking-wider text-caramel mb-2.5 flex items-center gap-1.5">
          <span class="material-symbols-outlined text-sm">local_dining</span>
          <span>Ingredients</span>
        </h5>
        <ul class="flex flex-col gap-1.5 text-xs text-primary font-medium">
          ${product.ingredients.map(ing => `
            <li class="flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full bg-caramel shrink-0"></span>
              <span>${ing}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `
    : '';

  const getDisplayPrice = (priceUSD) => {
    if (typeof formatCurrency === 'function') {
      return formatCurrency(priceUSD);
    }
    return `$${Number(priceUSD || 0).toFixed(2)}`;
  };

  const categoryName = product.category === 'coffee' ? 'Coffee & Cold Brews' : (product.category === 'savory' ? 'Savory Bites' : 'Sweet Bites');

  const actionModalControls = !isAvailable
    ? `<span class="text-xs font-bold text-on-surface-variant/60 uppercase">Currently Sold Out</span>`
    : inCartQty > 0
      ? `
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-2 bg-[#fbf6ec] border border-outline rounded-full px-2.5 py-1">
            <button onclick="decreaseQuantity('${product.id}'); openProductDetailsModal('${product.id}');" aria-label="Decrease quantity" class="w-6 h-6 rounded-full flex items-center justify-center text-primary hover:bg-black/5 active:scale-90 font-bold text-sm cursor-pointer">−</button>
            <span class="font-label-bold text-xs text-primary min-w-[16px] text-center">${inCartQty}</span>
            <button onclick="addToCart('${product.id}'); openProductDetailsModal('${product.id}');" aria-label="Increase quantity" class="w-6 h-6 rounded-full flex items-center justify-center text-primary hover:bg-black/5 active:scale-90 font-bold text-sm cursor-pointer">+</button>
          </div>
          <button onclick="closeProductDetailsModal(); if(typeof openCart==='function') openCart();" class="bg-primary hover:bg-primary-container text-white font-label-bold text-xs px-4 py-2.5 rounded-full shadow-warm-xs active:scale-95 transition-all inline-flex items-center gap-1.5 cursor-pointer">
            <span class="material-symbols-outlined text-sm">shopping_bag</span>
            <span>View Cart</span>
          </button>
        </div>
      `
      : `
        <button onclick="if(typeof addToCart==='function') { addToCart('${product.id}'); openProductDetailsModal('${product.id}'); }" class="bg-primary hover:bg-primary-container text-white font-label-bold text-xs px-5 py-2.5 rounded-full shadow-warm-xs active:scale-95 transition-all inline-flex items-center gap-1.5 cursor-pointer">
          <span class="material-symbols-outlined text-sm">shopping_bag</span>
          <span>Add to Order</span>
        </button>
      `;

  content.innerHTML = `
    <!-- Header with Close Button -->
    <div class="flex items-center justify-between border-b border-outline pb-3">
      <div class="flex items-center gap-2">
        <span class="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-surface-container text-caramel border border-outline/50">${categoryName}</span>
      </div>
      <button onclick="closeProductDetailsModal()" aria-label="Close details modal" class="p-1.5 rounded-full text-on-surface-variant hover:text-primary cursor-pointer">
        <span class="material-symbols-outlined text-xl">close</span>
      </button>
    </div>

    <!-- Product Image & Hero -->
    <div class="w-full aspect-[16/10] rounded-2xl overflow-hidden bg-surface-container relative border border-outline/40">
      <img src="${product.image}" alt="${product.name}" class="w-full h-full object-cover" onerror="this.src='assets/images/vanilla-cold-brew.jpg'" />
      <div class="absolute bottom-3 right-3 bg-primary/95 backdrop-blur-xs text-white font-bold text-sm px-3.5 py-1 rounded-full shadow-warm-xs">
        ${getDisplayPrice(product.price)}
      </div>
      ${!isAvailable ? `<span class="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-sm font-bold uppercase">Sold Out</span>` : ''}
    </div>

    <!-- Title & Rating -->
    <div class="flex items-center justify-between gap-2">
      <h3 class="font-display font-black text-xl sm:text-2xl text-primary leading-tight">${product.name}</h3>
      <button onclick="closeProductDetailsModal(); if(typeof openProductReviewsModal==='function') openProductReviewsModal('${product.id}');" class="flex items-center gap-1 text-xs font-bold text-caramel hover:underline cursor-pointer shrink-0">
        <span>★ ${summary.average}</span>
        <span class="text-on-surface-variant font-normal text-[11px]">(${summary.count} reviews)</span>
      </button>
    </div>

    <!-- Description -->
    <p class="font-body text-xs text-on-surface-variant leading-relaxed font-medium">
      ${product.description}
    </p>

    <!-- Ingredients List -->
    ${ingredientsHTML}

    <!-- Footer Action -->
    <div class="flex items-center justify-between gap-3 pt-2 border-t border-outline/50 mt-1">
      <div>
        <span class="text-[10px] text-on-surface-variant uppercase font-bold block">Price</span>
        <span class="font-display font-black text-lg text-primary leading-none">${getDisplayPrice(product.price)}</span>
      </div>

      <div class="flex items-center gap-2">
        <button onclick="closeProductDetailsModal(); if(typeof openProductReviewsModal==='function') openProductReviewsModal('${product.id}');" class="px-3.5 py-2.5 rounded-full border border-outline text-xs font-bold text-primary hover:bg-surface-container transition-colors cursor-pointer flex items-center gap-1">
          <span class="material-symbols-outlined text-sm">rate_review</span>
          <span>Reviews</span>
        </button>
        ${actionModalControls}
      </div>
    </div>
  `;

  modal.classList.remove('opacity-0', 'pointer-events-none');
  modal.classList.add('opacity-100', 'pointer-events-auto');
  document.body.classList.add('overflow-hidden');
  document.body.style.overflow = 'hidden';
}

function closeProductDetailsModal() {
  const modal = document.getElementById('product-details-modal');
  if (modal) {
    modal.classList.remove('opacity-100', 'pointer-events-auto');
    modal.classList.add('opacity-0', 'pointer-events-none');
  }
  document.body.classList.remove('overflow-hidden');
  document.body.style.overflow = '';
}

window.openProductDetailsModal = openProductDetailsModal;
window.closeProductDetailsModal = closeProductDetailsModal;

// Side Navigation Drawer Controller (Fixed Modal from Left)
function openNavDrawer() {
  // Close any other open modals/drawers first (Mutual Exclusion)
  if (typeof closeCart === 'function') closeCart();
  if (typeof closeProfile === 'function') closeProfile();
  if (typeof toggleNotificationPanel === 'function') toggleNotificationPanel(false);
  if (typeof closeCheckout === 'function') closeCheckout();
  if (typeof closeAdminDashboard === 'function') closeAdminDashboard();
  if (typeof closeProductReviewsModal === 'function') closeProductReviewsModal();

  const navDrawer = document.getElementById('nav-drawer');
  const navDrawerOverlay = document.getElementById('nav-drawer-overlay');
  if (!navDrawer || !navDrawerOverlay) return;

  // Show backdrop
  navDrawerOverlay.classList.remove('opacity-0', 'pointer-events-none');
  navDrawerOverlay.classList.add('opacity-100', 'pointer-events-auto');

  // Slide in drawer from left
  navDrawer.classList.remove('-translate-x-full');
  navDrawer.classList.add('translate-x-0');

  // Lock page scrolling
  document.body.classList.add('overflow-hidden');
  document.body.style.overflow = 'hidden';
}

function closeNavDrawer() {
  const navDrawer = document.getElementById('nav-drawer');
  const navDrawerOverlay = document.getElementById('nav-drawer-overlay');
  if (navDrawerOverlay) {
    navDrawerOverlay.classList.remove('opacity-100', 'pointer-events-auto');
    navDrawerOverlay.classList.add('opacity-0', 'pointer-events-none');
  }
  if (navDrawer) {
    navDrawer.classList.remove('translate-x-0');
    navDrawer.classList.add('-translate-x-full');
  }

  // Restore page scrolling
  document.body.classList.remove('overflow-hidden');
  document.body.style.overflow = '';
}

window.openNavDrawer = openNavDrawer;
window.closeNavDrawer = closeNavDrawer;

// Register onProductsUpdated listener immediately
if (typeof onProductsUpdated === 'function') {
  onProductsUpdated(() => {
    renderProducts();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Hero Video Autoplay Assurance
  const heroVideo = document.getElementById('anim-video');
  if (heroVideo) {
    heroVideo.muted = true;
    heroVideo.playsInline = true;
    const playPromise = heroVideo.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay policy prevented playback, video will play on first interaction
      });
    }
  }

  // Storefront Search Input Listener
  const menuSearchInput = document.getElementById('menu-search-input');
  if (menuSearchInput) {
    menuSearchInput.addEventListener('input', (e) => {
      storefrontSearchQuery = e.target.value;
      renderProducts();
    });
  }

  // Storefront Category Filter Buttons
  document.querySelectorAll('.menu-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      storefrontCategoryFilter = btn.getAttribute('data-menu-cat') || 'all';
      document.querySelectorAll('.menu-cat-btn').forEach(b => {
        b.className = 'menu-cat-btn flex items-center gap-2 px-4 py-2.5 rounded-full text-on-surface-variant hover:bg-surface-container font-label-bold text-xs transition-all cursor-pointer';
      });
      btn.className = 'menu-cat-btn flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-white font-label-bold text-xs shadow-warm-xs transition-all cursor-pointer';
      renderProducts();
    });
  });

  // Storefront Availability Select
  const menuAvailFilter = document.getElementById('menu-avail-filter');
  if (menuAvailFilter) {
    menuAvailFilter.addEventListener('change', (e) => {
      storefrontAvailFilter = e.target.value;
      renderProducts();
    });
  }

  // Navigation Drawer Trigger & Action Listeners
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const closeNavDrawerBtn = document.getElementById('close-nav-drawer-btn');
  const navDrawerOverlay = document.getElementById('nav-drawer-overlay');
  const navDrawer = document.getElementById('nav-drawer');
  const navDrawerLinks = document.querySelectorAll('.nav-drawer-link');
  const mobileNotificationBtn = document.getElementById('mobile-notification-btn');
  const mobileProfileBtn = document.getElementById('mobile-profile-btn');
  const mobileNavAdminBtn = document.getElementById('mobile-nav-admin-btn');

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openNavDrawer();
    });
  }

  if (closeNavDrawerBtn) {
    closeNavDrawerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeNavDrawer();
    });
  }

  if (navDrawerOverlay) {
    navDrawerOverlay.addEventListener('click', (e) => {
      e.stopPropagation();
      closeNavDrawer();
    });
  }

  if (mobileNotificationBtn) {
    mobileNotificationBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeNavDrawer();
      if (typeof toggleNotificationPanel === 'function') {
        toggleNotificationPanel(true);
      }
    });
  }

  if (mobileProfileBtn) {
    mobileProfileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeNavDrawer();
      if (typeof openProfile === 'function') {
        openProfile();
      }
    });
  }

  if (mobileNavAdminBtn) {
    mobileNavAdminBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeNavDrawer();
      if (typeof openAdminDashboard === 'function') {
        openAdminDashboard();
      }
    });
  }

  navDrawerLinks.forEach(link => {
    link.addEventListener('click', () => {
      closeNavDrawer();
    });
  });

  // Escape key listener to close drawer
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navDrawer && navDrawer.classList.contains('translate-x-0')) {
      closeNavDrawer();
    }
  });

  // Page-Level Initializations
  renderProducts();
});
