/**
 * Brew & Bite - Main JavaScript
 * Handles frame preloading, scroll scrubbing, hero text animation,
 * floating navbar transitions, and mobile drawer navigation.
 */

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

  updateNavStyle();
  updateFrame();
});
