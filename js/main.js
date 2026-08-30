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

  // Category Filtering Logic
  if (storefrontCategoryFilter !== 'all') {
    filtered = filtered.filter(item => {
      const cat = (typeof normalizeCategory === 'function')
        ? normalizeCategory(item.category)
        : String(item.category || '').trim().toLowerCase();
      const name = (item.name || '').toLowerCase();

      if (storefrontCategoryFilter === 'coffee' || storefrontCategoryFilter === 'cold-brews') {
        return cat === 'coffee';
      }
      if (storefrontCategoryFilter === 'cookies') {
        return cat === 'bites' && (name.includes('cookie') || name.includes('chunk') || name.includes('choco'));
      }
      if (storefrontCategoryFilter === 'muffins') {
        return cat === 'bites' && name.includes('muffin');
      }
      if (storefrontCategoryFilter === 'croissants') {
        return cat === 'bites' && name.includes('croissant');
      }
      if (storefrontCategoryFilter === 'bites') {
        return cat === 'bites';
      }
      return true;
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
      : 'assets/vanilla-cold-brew.jpg';

    return `
      <article class="bg-white rounded-2xl p-3 border border-outline shadow-warm-xs hover:shadow-warm-md hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group ${!isAvailable ? 'opacity-70' : ''}">
        <div>
          <div class="w-full aspect-[4/3] rounded-xl overflow-hidden mb-3 relative bg-surface-container">
            <img alt="${item.name}" onerror="this.onerror=null; this.src='assets/vanilla-cold-brew.jpg'" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 rounded-xl" src="${imgSrc}" />
            <div class="absolute top-2 right-2 bg-primary text-white font-body text-[11px] font-bold px-2 py-0.5 rounded-md shadow-xs">
              ${getDisplayPrice(item.price)}
            </div>
            ${!isAvailable ? `<span class="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center text-white text-xs font-bold uppercase">Sold Out</span>` : ''}
          </div>

          <h4 class="font-display font-bold text-sm text-primary mb-0.5 leading-snug">${item.name}</h4>
          <p class="font-body text-[11px] text-on-surface-variant leading-relaxed line-clamp-2 mb-2">${item.description}</p>
        </div>

        <div class="flex items-center justify-between pt-1 border-t border-outline/50 mt-auto">
          <div>${getReviewBadgeHTML(item.id)}</div>
          <button data-product-id="${item.id}" ${!isAvailable ? 'disabled' : ''} aria-label="Add ${item.name} to order" class="add-to-order-btn w-7 h-7 rounded-full bg-primary hover:bg-primary-container text-white flex items-center justify-center text-sm font-bold shadow-xs active:scale-90 transition-all cursor-pointer">
            <span>+</span>
          </button>
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
  const FRAME_COUNT = 222;
  const imgElement = document.getElementById('anim');
  const scrollHint = document.getElementById('scroll-hint');
  const heroSection = document.getElementById('animation-container') || document.getElementById('hero-section');

  // Helper to format frame numbers with 3-digit padding (e.g. 1 -> "001")
  function padFrame(num) {
    return String(num).padStart(3, '0');
  }

  // Helper to select optimal frame asset directory based on screen width
  function getFrameBasePath() {
    return (window.matchMedia && window.matchMedia('(max-width: 768px)').matches)
      ? 'assets/frames-mobile/'
      : 'assets/frames/';
  }

  // Preload first key frames for immediate display
  const initialFrameSrc = `${getFrameBasePath()}ezgif-frame-001.jpg`;
  if (imgElement) {
    imgElement.src = initialFrameSrc;
  }

  // 1. Image Sequence Scroll-Driven Animation (Performance Optimized)
  let currentFrame = 1;
  let isTicking = false;
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Frame preloader cache for smooth buttery scrolling
  const frameCache = {};
  function preloadNearbyFrames(centerFrame) {
    if (prefersReducedMotion) return;
    const range = 5;
    const basePath = getFrameBasePath();
    for (let i = Math.max(1, centerFrame - range); i <= Math.min(FRAME_COUNT, centerFrame + range); i++) {
      if (!frameCache[i]) {
        const img = new Image();
        img.src = `${basePath}ezgif-frame-${padFrame(i)}.jpg`;
        frameCache[i] = img;
      }
    }
  }

  function updateFrame() {
    if (!heroSection || !imgElement) return;

    // Respect reduced motion preference
    if (prefersReducedMotion) {
      if (imgElement.src !== initialFrameSrc) imgElement.src = initialFrameSrc;
      isTicking = false;
      return;
    }

    const scrollY = window.scrollY || window.pageYOffset;
    const heroHeight = heroSection.offsetHeight;
    const windowHeight = window.innerHeight;
    const scrollableDistance = Math.max(heroHeight - windowHeight, 1);

    const progress = Math.min(Math.max(scrollY / scrollableDistance, 0), 1);
    const targetFrame = Math.min(
      Math.max(Math.floor(progress * (FRAME_COUNT - 1)) + 1, 1),
      FRAME_COUNT
    );

    if (targetFrame !== currentFrame) {
      currentFrame = targetFrame;
      imgElement.src = `${getFrameBasePath()}ezgif-frame-${padFrame(currentFrame)}.jpg`;
      preloadNearbyFrames(currentFrame);
    }

    // 2. Hide scroll hint once user starts scrolling
    if (scrollHint) {
      if (scrollY > 50) {
        scrollHint.classList.add('opacity-0');
        scrollHint.classList.remove('opacity-100');
      } else {
        scrollHint.classList.remove('opacity-0');
        scrollHint.classList.add('opacity-100');
      }
    }
    isTicking = false;
  }

  // 4. Floating Navbar Transparency, Compact Sizing and Blur on Scroll
  const mainNav = document.getElementById('main-nav');
  function updateNavStyle() {
    if (!mainNav) return;
    if (window.scrollY > 30) {
      mainNav.classList.remove('bg-white/10', 'backdrop-blur-xs', 'border-white/20', 'top-4', 'sm:top-6', 'py-3', 'sm:py-3.5');
      mainNav.classList.add('bg-surface/90', 'backdrop-blur-xl', 'border-outline-variant/30', 'shadow-md', 'top-2', 'sm:top-3', 'py-2', 'sm:py-2.5');
    } else {
      mainNav.classList.add('bg-white/10', 'backdrop-blur-xs', 'border-white/20', 'top-4', 'sm:top-6', 'py-3', 'sm:py-3.5');
      mainNav.classList.remove('bg-surface/90', 'backdrop-blur-xl', 'border-outline-variant/30', 'shadow-md', 'top-2', 'sm:top-3', 'py-2', 'sm:py-2.5');
    }
  }

  // Escape key listener to close drawer
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navDrawer && navDrawer.classList.contains('translate-x-0')) {
      closeNavDrawer();
    }
  });

  // Window Event Listeners
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
  updateNavStyle();
  updateFrame();
});
