/**
 * Brew & Bite - Main JavaScript
 * Handles frame preloading, scroll scrubbing, hero text animation,
 * floating navbar transitions, mobile drawer navigation, dynamic product rendering,
 * and in-memory cart ordering.
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

  // Bind Event Delegation for "Add to Order" Buttons
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.add-to-order-btn');
    if (btn) {
      const productId = btn.getAttribute('data-product-id');
      addToCart(productId, btn);
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
  updateNavStyle();
  updateFrame();
});
