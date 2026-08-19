/**
 * Brew & Bite - Main Page JavaScript (main.js)
 * Handles frame preloading, hero scroll scrubbing, hero text animation,
 * dynamic product card rendering, floating navbar transitions, and mobile menu drawer.
 */

document.addEventListener('DOMContentLoaded', () => {
  const animContainer = document.getElementById('animation-container');
  const img = document.getElementById('anim');
  const scrollHint = document.getElementById('scroll-hint');
  const heroTextCol = document.getElementById('hero-text-col');

  const totalFrames = 222;
  const pad = (num, size) => String(num).padStart(size, '0');
  const frames = [];

  // 1. Generate frame list and preload for smooth rendering
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

  // 2. Hero Frame Scrubbing & Text Fade on Scroll
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

      // Smoothly fade and slightly translate hero text upward during initial scroll phase
      if (heroTextCol) {
        const fadeEnd = 0.22;
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

  // 3. Dynamic Product Rendering from PRODUCTS array
  function renderProducts() {
    if (typeof PRODUCTS === 'undefined' || !Array.isArray(PRODUCTS)) return;

    const coffeeContainer = document.getElementById('coffee-products');
    const biteContainer = document.getElementById('bite-products');

    // Render Signature Brews (Coffee Cards - Vertical Layout)
    if (coffeeContainer) {
      const coffeeItems = PRODUCTS.filter(item => item.category === 'coffee');
      coffeeContainer.innerHTML = coffeeItems.map(item => `
        <div class="bg-surface-container-lowest rounded-3xl p-5 shadow-md hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 border border-outline-variant/30 flex flex-col items-center text-center group">
          <div class="w-36 h-36 sm:w-40 sm:h-40 ${item.accentColor} rounded-full mb-4 overflow-hidden flex items-center justify-center p-3 group-hover:scale-105 transition-transform">
            <img alt="${item.name}" class="w-full h-full object-cover rounded-full" src="${item.image}" />
          </div>
          <h4 class="font-display text-lg font-bold text-primary mb-1.5">${item.name}</h4>
          <p class="font-body-md text-xs sm:text-sm text-on-surface-variant mb-4">${item.description}</p>
          <div class="flex flex-col items-center gap-2.5 w-full mt-auto">
            <span class="font-label-bold text-xs text-secondary-container bg-secondary-container/10 px-3.5 py-1 rounded-full">$${item.price.toFixed(2)}</span>
            <button data-product-id="${item.id}" class="add-to-order-btn w-full bg-secondary-container text-on-secondary-container hover:bg-tertiary hover:text-on-tertiary font-label-bold text-xs py-2.5 px-4 rounded-full transition-all duration-200 shadow-xs hover:shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-1.5">
              <span>Add to Order +</span>
            </button>
          </div>
        </div>
      `).join('');
    }

    // Render Bakery Bites (Bites Cards - Horizontal Layout)
    if (biteContainer) {
      const biteItems = PRODUCTS.filter(item => item.category === 'bites');
      biteContainer.innerHTML = biteItems.map(item => `
        <div class="bg-surface-container-lowest rounded-3xl p-5 shadow-md hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 border border-outline-variant/30 flex flex-row items-center gap-5 group">
          <div class="w-28 h-28 sm:w-32 sm:h-32 ${item.accentColor} rounded-2xl overflow-hidden flex-shrink-0">
            <img alt="${item.name}" class="w-full h-full object-cover group-hover:scale-110 transition-transform" src="${item.image}" />
          </div>
          <div class="flex flex-col items-start justify-between flex-1 h-full py-0.5">
            <div>
              <h4 class="font-display text-lg font-bold text-primary mb-1">${item.name}</h4>
              <p class="font-body-md text-xs sm:text-sm text-on-surface-variant mb-2.5">${item.description}</p>
            </div>
            <div class="flex items-center gap-2.5 w-full flex-wrap">
              <span class="font-label-bold text-xs text-secondary bg-secondary/10 px-3 py-1 rounded-full">$${item.price.toFixed(2)}</span>
              <button data-product-id="${item.id}" class="add-to-order-btn bg-secondary-container text-on-secondary-container hover:bg-tertiary hover:text-on-tertiary font-label-bold text-xs py-1.5 px-3.5 rounded-full transition-all duration-200 shadow-xs hover:shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-1">
                <span>Add to Order +</span>
              </button>
            </div>
          </div>
        </div>
      `).join('');
    }
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

  // Page-Level Initializations
  renderProducts();
  updateNavStyle();
  updateFrame();
});
