/**
 * Brew & Bite - Main Application Controller
 * Handles image sequence frame rendering, dynamic product rendering from Supabase,
 * scroll listeners, and mobile navigation.
 */

// Storefront Filter State
let storefrontSearchQuery = '';
let storefrontCategoryFilter = 'all'; // 'all' | 'coffee' | 'bites'
let storefrontAvailFilter = 'all'; // 'all' | 'available' | 'soldout'

// Global render function for customer menu
function renderProducts() {
  const coffeeContainer = document.getElementById('coffee-products');
  const biteContainer = document.getElementById('bite-products');
  const coffeeSection = document.getElementById('coffee-section');
  const biteSection = document.getElementById('bites-section');

  if (typeof PRODUCTS === 'undefined' || !Array.isArray(PRODUCTS) || PRODUCTS.length === 0) {
    if (typeof isProductsLoading !== 'undefined' && isProductsLoading) {
      const loadingHTML = `
        <div class="col-span-full py-12 flex flex-col items-center justify-center text-center">
          <div class="w-10 h-10 border-3 border-secondary-container border-t-tertiary rounded-full animate-spin mb-3"></div>
          <p class="text-xs font-label-bold text-on-surface-variant">Loading our menu...</p>
        </div>
      `;
      if (coffeeContainer) coffeeContainer.innerHTML = loadingHTML;
      if (biteContainer) biteContainer.innerHTML = loadingHTML;
      return;
    }
  }

  // Apply Search & Filters
  let filtered = [...PRODUCTS];

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

  // Hide or Show Sections based on Category Filter
  if (coffeeSection) {
    if (storefrontCategoryFilter === 'bites') coffeeSection.classList.add('hidden');
    else coffeeSection.classList.remove('hidden');
  }
  if (biteSection) {
    if (storefrontCategoryFilter === 'coffee') biteSection.classList.add('hidden');
    else biteSection.classList.remove('hidden');
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
        <button data-review-product-id="${productId}" class="product-reviews-trigger-btn inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 hover:text-amber-700 cursor-pointer transition-colors">
          <span>★</span>
          <span>${summary.average}</span>
          <span class="text-on-surface-variant font-normal text-[10px]">(${summary.count})</span>
        </button>
      `;
    }
    return '';
  };

  // Render Signature Brews (Coffee Cards)
  if (coffeeContainer && storefrontCategoryFilter !== 'bites') {
    const coffeeItems = filtered.filter(item => {
      const cat = (typeof normalizeCategory === 'function')
        ? normalizeCategory(item.category)
        : String(item.category || '').trim().toLowerCase();
      return cat === 'coffee';
    });

    if (coffeeItems.length === 0) {
      coffeeContainer.innerHTML = `<p class="col-span-full text-center text-xs text-on-surface-variant py-8">No brews match your search criteria.</p>`;
    } else {
      coffeeContainer.innerHTML = coffeeItems.map(item => {
        const isAvailable = (typeof normalizeProductAvailable === 'function')
          ? normalizeProductAvailable(item.available)
          : (item.available === true);

        const imgSrc = (item.image && String(item.image).trim().length > 0)
          ? String(item.image).trim()
          : (typeof DEFAULT_COFFEE_IMAGE !== 'undefined' ? DEFAULT_COFFEE_IMAGE : 'assets/frames/ezgif-frame-001.jpg');

        return `
          <div class="bg-surface-container-lowest rounded-3xl p-5 shadow-md hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 border border-outline-variant/30 flex flex-col items-center text-center group ${!isAvailable ? 'opacity-70' : ''}">
            <div class="w-36 h-36 sm:w-40 sm:h-40 ${item.accentColor || 'bg-secondary-container'} rounded-full mb-4 overflow-hidden flex items-center justify-center p-3 group-hover:scale-105 transition-transform relative">
              <img alt="${item.name}" class="w-full h-full object-cover rounded-full" src="${imgSrc}" />
              ${!isAvailable ? `<span class="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center text-white text-[11px] font-label-bold uppercase">Sold Out</span>` : ''}
            </div>
            
            <div class="flex items-center justify-center gap-2 mb-1">
              <h4 class="font-display text-lg font-bold text-primary">${item.name}</h4>
            </div>
            ${getReviewBadgeHTML(item.id)}

            <p class="font-body-md text-xs sm:text-sm text-on-surface-variant my-2.5">${item.description}</p>
            <div class="flex flex-col items-center gap-2.5 w-full mt-auto">
              <span class="font-label-bold text-xs text-secondary-container bg-secondary-container/10 px-3.5 py-1 rounded-full">${getDisplayPrice(item.price)}</span>
              <button data-product-id="${item.id}" ${!isAvailable ? 'disabled' : ''} class="add-to-order-btn w-full ${isAvailable ? 'bg-secondary-container text-on-secondary-container hover:bg-tertiary hover:text-on-tertiary shadow-xs hover:shadow-md active:scale-95 cursor-pointer' : 'bg-surface-container-high text-on-surface-variant opacity-60 cursor-not-allowed'} font-label-bold text-xs py-2.5 px-4 rounded-full transition-all duration-200 flex items-center justify-center gap-1.5">
                <span>${isAvailable ? 'Add to Order +' : 'Unavailable'}</span>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Render Bakery Bites (Bites Cards)
  if (biteContainer && storefrontCategoryFilter !== 'coffee') {
    const biteItems = filtered.filter(item => {
      const cat = (typeof normalizeCategory === 'function')
        ? normalizeCategory(item.category)
        : String(item.category || '').trim().toLowerCase();
      return cat === 'bites';
    });

    if (biteItems.length === 0) {
      biteContainer.innerHTML = `<p class="col-span-full text-center text-xs text-on-surface-variant py-8">No bakery bites match your search criteria.</p>`;
    } else {
      biteContainer.innerHTML = biteItems.map(item => {
        const isAvailable = (typeof normalizeProductAvailable === 'function')
          ? normalizeProductAvailable(item.available)
          : (item.available === true);

        const imgSrc = (item.image && String(item.image).trim().length > 0)
          ? String(item.image).trim()
          : (typeof DEFAULT_BITE_IMAGE !== 'undefined' ? DEFAULT_BITE_IMAGE : 'assets/frames/ezgif-frame-001.jpg');

        return `
          <div class="bg-surface-container-lowest rounded-3xl p-5 shadow-md hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 border border-outline-variant/30 flex flex-row items-center gap-5 group ${!isAvailable ? 'opacity-70' : ''}">
            <div class="w-28 h-28 sm:w-32 sm:h-32 ${item.accentColor || 'bg-secondary-container'} rounded-2xl overflow-hidden flex-shrink-0 relative">
              <img alt="${item.name}" class="w-full h-full object-cover group-hover:scale-110 transition-transform" src="${imgSrc}" />
              ${!isAvailable ? `<span class="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center text-white text-[10px] font-label-bold uppercase">Sold Out</span>` : ''}
            </div>
            <div class="flex flex-col items-start justify-between flex-1 h-full py-0.5">
              <div>
                <div class="flex items-center gap-2 mb-0.5">
                  <h4 class="font-display text-lg font-bold text-primary">${item.name}</h4>
                </div>
                ${getReviewBadgeHTML(item.id)}
                <p class="font-body-md text-xs sm:text-sm text-on-surface-variant my-2">${item.description}</p>
              </div>
              <div class="flex items-center gap-2.5 w-full flex-wrap">
                <span class="font-label-bold text-xs text-secondary bg-secondary/10 px-3 py-1 rounded-full">${getDisplayPrice(item.price)}</span>
                <button data-product-id="${item.id}" ${!isAvailable ? 'disabled' : ''} class="add-to-order-btn ${isAvailable ? 'bg-secondary-container text-on-secondary-container hover:bg-tertiary hover:text-on-tertiary shadow-xs hover:shadow-md active:scale-95 cursor-pointer' : 'bg-surface-container-high text-on-surface-variant opacity-60 cursor-not-allowed'} font-label-bold text-xs py-1.5 px-3.5 rounded-full transition-all duration-200 flex items-center justify-center gap-1">
                  <span>${isAvailable ? 'Add to Order +' : 'Unavailable'}</span>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
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

  // Preload first key frames for immediate display
  const initialFrameSrc = `assets/frames/ezgif-frame-001.jpg`;
  if (imgElement) {
    imgElement.src = initialFrameSrc;
  }

  // 1. Image Sequence Scroll-Driven Animation
  let currentFrame = 1;
  let isTicking = false;

  function updateFrame() {
    if (!heroSection || !imgElement) return;

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
      imgElement.src = `assets/frames/ezgif-frame-${padFrame(currentFrame)}.jpg`;
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

  // 5. Mobile Menu Drawer Handler
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
        b.className = 'menu-cat-btn px-3 py-1 rounded-full text-xs font-label-bold transition-all text-on-surface-variant hover:bg-surface-container-high cursor-pointer';
      });
      btn.className = 'menu-cat-btn px-3 py-1 rounded-full text-xs font-label-bold transition-all bg-primary text-on-primary shadow-2xs cursor-pointer';
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

  // Page-Level Initializations
  renderProducts();
  updateNavStyle();
  updateFrame();
});
