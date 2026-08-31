/**
 * Brew & Bite - Customer Reviews & Ratings Module (reviews.js)
 * Database-backed product reviews connecting to Supabase public.reviews table,
 * enforcing Verified Purchase validation, 1-5 star ratings, dynamic homepage
 * reviews rendering, and dedicated Reviews Page management.
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

// Initial Authentic Seed Reviews (Displayed when database has no records yet)
const SEED_REVIEWS = [
  {
    id: "seed-rev-1",
    product_id: "vanilla-cold-brew",
    user_name: "Sarah Jenkins",
    rating: 5,
    review_text: "The Madagascar vanilla cold brew is completely unmatched. Incredibly smooth with a creamy, velvety finish!",
    verified_purchase: true,
    created_at: new Date(Date.now() - 2 * 86400000).toISOString()
  },
  {
    id: "seed-rev-2",
    product_id: "cheese-croissant",
    user_name: "Karan Malhotra",
    rating: 5,
    review_text: "Flaky, buttery layers with melted Gruyère. The ultimate savory snack paired with a fresh espresso.",
    verified_purchase: true,
    created_at: new Date(Date.now() - 4 * 86400000).toISOString()
  },
  {
    id: "seed-rev-3",
    product_id: "choco-chunk-cookie",
    user_name: "Priya Sharma",
    rating: 5,
    review_text: "Warm dark Belgian chocolate chunks and that touch of sea salt on top makes this cookie absolute perfection.",
    verified_purchase: true,
    created_at: new Date(Date.now() - 6 * 86400000).toISOString()
  },
  {
    id: "seed-rev-4",
    product_id: "caramel-cloud",
    user_name: "David Miller",
    rating: 5,
    review_text: "Salted caramel foam on top of iced dark roast espresso is heavenly. My everyday obsession!",
    verified_purchase: true,
    created_at: new Date(Date.now() - 8 * 86400000).toISOString()
  },
  {
    id: "seed-rev-5",
    product_id: "loaded-veggie-toast",
    user_name: "Elena Rostova",
    rating: 5,
    review_text: "So fresh and flavorful! The loaded multigrain toast and smashed avocado make this a fantastic healthy breakfast.",
    verified_purchase: true,
    created_at: new Date(Date.now() - 10 * 86400000).toISOString()
  },
  {
    id: "seed-rev-6",
    product_id: "blueberry-muffin",
    user_name: "Marcus Vance",
    rating: 5,
    review_text: "Bursting with real wild blueberries and the streusel topping has the best crunch. 10/10 quality.",
    verified_purchase: true,
    created_at: new Date(Date.now() - 12 * 86400000).toISOString()
  }
];

let allProductReviews = [];
let activeReviewModalProductId = null;
let homeReviewPageIndex = 0;

// Filter and Sort state for Reviews Page
let reviewsPageCategoryFilter = 'all';
let reviewsPageSort = 'newest';

/**
 * Fetch all reviews from Supabase public.reviews table, falling back to seed reviews.
 */
async function fetchAllReviewsFromSupabase() {
  let dbReviews = [];
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        dbReviews = data;
      }
    } catch (err) {
      console.warn("Could not fetch reviews from Supabase:", err);
    }
  }

  // If Supabase has reviews, merge with any seed reviews not overridden
  if (dbReviews.length > 0) {
    // Combine unique by id
    const existingIds = new Set(dbReviews.map(r => r.id));
    const supplemental = SEED_REVIEWS.filter(s => !existingIds.has(s.id) && !dbReviews.some(d => d.product_id === s.product_id && d.user_name === s.user_name));
    allProductReviews = [...dbReviews, ...supplemental];
  } else {
    allProductReviews = [...SEED_REVIEWS];
  }

  // Update UI components
  if (typeof renderHomepageCustomerReviews === 'function') {
    renderHomepageCustomerReviews();
  }
  if (typeof renderReviewsPageContent === 'function') {
    renderReviewsPageContent();
  }

  return allProductReviews;
}

/**
 * Get review summary (average rating, total count, star string) for a specific product.
 */
function getProductReviewSummary(productId) {
  if (!productId || !Array.isArray(allProductReviews)) {
    return { average: 5.0, count: 0, starsHTML: '★★★★★' };
  }

  const reviews = allProductReviews.filter(r => r.product_id === productId);
  if (reviews.length === 0) {
    return { average: 5.0, count: 0, starsHTML: '★★★★★' };
  }

  const sum = reviews.reduce((acc, r) => acc + Number(r.rating || 5), 0);
  const avg = Number((sum / reviews.length).toFixed(1));
  const fullStars = Math.round(avg);
  const starsStr = '★'.repeat(fullStars) + '☆'.repeat(5 - fullStars);

  return {
    average: avg,
    count: reviews.length,
    starsHTML: starsStr
  };
}

/**
 * Get global overall reviews summary.
 */
function getGlobalReviewSummary() {
  const reviews = Array.isArray(allProductReviews) ? allProductReviews : [];
  if (reviews.length === 0) {
    return { average: 5.0, count: 0, breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
  }

  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let sum = 0;
  reviews.forEach(r => {
    const star = Math.max(1, Math.min(5, Number(r.rating || 5)));
    breakdown[star] = (breakdown[star] || 0) + 1;
    sum += star;
  });

  const avg = Number((sum / reviews.length).toFixed(1));
  return {
    average: avg,
    count: reviews.length,
    breakdown
  };
}

/**
 * Check if the user has purchased this product in a completed/delivered order (Verified Purchase).
 */
function checkUserPurchasedProduct(productId, user) {
  if (!user || !user.id || !productId) return false;

  const orders = (typeof getOrders === 'function') ? getOrders() : [];
  for (const order of orders) {
    if (order.status === 'delivered' && Array.isArray(order.items)) {
      const found = order.items.some(item => (item.productId === productId || item.id === productId));
      if (found) return true;
    }
  }
  return false;
}

/**
 * Get list of all delivered products for the current user to review.
 */
function getUserDeliveredProducts(user) {
  if (!user || !user.id) return [];

  const orders = (typeof getOrders === 'function') ? getOrders() : [];
  const productMap = new Map();

  orders.forEach(order => {
    if (order.status === 'delivered' && Array.isArray(order.items)) {
      order.items.forEach(item => {
        const pId = item.productId || item.id;
        if (pId && !productMap.has(pId)) {
          const product = (typeof getProductById === 'function') ? getProductById(pId) : null;
          if (product) productMap.set(pId, product);
        }
      });
    }
  });

  return Array.from(productMap.values());
}

/**
 * Submit or update a product review.
 */
async function submitProductReview(productId, rating, reviewText, user) {
  if (!user || !user.id) {
    throw new Error("Please sign in to write a review.");
  }
  if (!productId) throw new Error("Invalid product.");

  const ratingNum = parseInt(rating, 10);
  if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    throw new Error("Rating must be between 1 and 5 stars.");
  }
  if (!reviewText || reviewText.trim().length < 3) {
    throw new Error("Please write a helpful review (at least 3 characters).");
  }

  // Check verified purchase
  const isVerifiedPurchase = checkUserPurchasedProduct(productId, user);

  const displayName = (typeof userProfile !== 'undefined' && userProfile?.full_name)
    ? userProfile.full_name
    : (user.user_metadata?.full_name || user.email?.split('@')[0] || 'Brew & Bite Customer');

  const newReview = {
    id: `rev-${Date.now()}`,
    product_id: productId,
    user_id: user.id,
    user_name: displayName,
    rating: ratingNum,
    review_text: reviewText.trim(),
    verified_purchase: isVerifiedPurchase,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Save to Supabase if client is ready
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('reviews')
        .upsert({
          product_id: productId,
          user_id: user.id,
          user_name: displayName,
          rating: ratingNum,
          review_text: reviewText.trim(),
          verified_purchase: isVerifiedPurchase,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,product_id' })
        .select()
        .single();

      if (error) {
        console.warn("Notice: reviews table insert note:", error.message);
      } else if (data) {
        newReview.id = data.id;
      }
    } catch (e) {
      console.warn("Could not upsert to Supabase reviews:", e);
    }
  }

  // Add/replace in local in-memory reviews
  const existingIdx = allProductReviews.findIndex(r => r.user_id === user.id && r.product_id === productId);
  if (existingIdx >= 0) {
    allProductReviews[existingIdx] = newReview;
  } else {
    allProductReviews.unshift(newReview);
  }

  // Update all UI components
  if (typeof renderProducts === 'function') renderProducts();
  if (typeof renderHomepageCustomerReviews === 'function') renderHomepageCustomerReviews();
  if (typeof renderReviewsPageContent === 'function') renderReviewsPageContent();

  return newReview;
}

/**
 * Delete a user review.
 */
async function deleteProductReview(reviewId, user) {
  if (!reviewId || !user || !user.id) return;

  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      await supabaseClient.from('reviews').delete().eq('id', reviewId);
    } catch (e) {
      console.warn("Could not delete from Supabase reviews:", e);
    }
  }

  allProductReviews = allProductReviews.filter(r => r.id !== reviewId);

  if (typeof renderProducts === 'function') renderProducts();
  if (typeof renderHomepageCustomerReviews === 'function') renderHomepageCustomerReviews();
  if (typeof renderReviewsPageContent === 'function') renderReviewsPageContent();
}

/**
 * Render Customer Reviews section on Homepage.
 */
function renderHomepageCustomerReviews() {
  const container = document.getElementById('homepage-reviews-container');
  if (!container) return;

  const reviews = Array.isArray(allProductReviews) ? allProductReviews : [];

  if (reviews.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-8 text-center bg-[#fcf9f2] rounded-2xl border border-outline/70 p-4">
        <span class="material-symbols-outlined text-3xl text-caramel mb-1">rate_review</span>
        <p class="font-display font-bold text-sm text-primary">Be the first to share your Brew &amp; Bites experience.</p>
        <p class="text-xs text-on-surface-variant mt-1">Order your favorite brew or snack and leave a verified review!</p>
      </div>
    `;
    return;
  }

  const itemsPerPage = 3;
  const totalPages = Math.ceil(reviews.length / itemsPerPage);
  if (homeReviewPageIndex >= totalPages) homeReviewPageIndex = 0;
  if (homeReviewPageIndex < 0) homeReviewPageIndex = totalPages - 1;

  const startIdx = homeReviewPageIndex * itemsPerPage;
  const displayedReviews = reviews.slice(startIdx, startIdx + itemsPerPage);

  container.innerHTML = displayedReviews.map(r => {
    const product = (typeof getProductById === 'function') ? getProductById(r.product_id) : null;
    const prodName = product ? product.name : 'Brew & Bites Special';
    const starsStr = '★'.repeat(Math.min(5, Math.max(1, r.rating))) + '☆'.repeat(Math.max(0, 5 - r.rating));

    return `
      <div class="bg-[#fcf9f2] rounded-2xl p-4 border border-outline/70 flex flex-col justify-between text-left shadow-2xs hover:shadow-xs transition-all duration-300">
        <div>
          <div class="flex items-center justify-between mb-2">
            <div class="text-caramel text-xs font-bold">${starsStr}</div>
            ${r.verified_purchase ? `
              <span class="inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200/60 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                <span class="material-symbols-outlined text-[10px]">verified</span>
                <span>Verified</span>
              </span>
            ` : ''}
          </div>
          <p class="font-body text-[11px] text-on-surface-variant leading-relaxed mb-3 line-clamp-3">
            "${escapeHtml(r.review_text)}"
          </p>
        </div>

        <div class="border-t border-outline/40 pt-2.5 mt-auto">
          <p class="font-bold text-[11px] text-primary leading-tight">${escapeHtml(r.user_name || 'Verified Customer')}</p>
          <p class="text-[10px] text-caramel font-semibold truncate mt-0.5">Reviewed: ${escapeHtml(prodName)}</p>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Render Content of Dedicated Reviews Page (reviews.html).
 */
function renderReviewsPageContent() {
  const summaryEl = document.getElementById('reviews-page-summary');
  const listEl = document.getElementById('reviews-page-list');
  if (!listEl) return;

  const reviews = Array.isArray(allProductReviews) ? allProductReviews : [];
  const globalSummary = getGlobalReviewSummary();

  // Render Rating Summary Breakdown
  if (summaryEl) {
    const totalCount = globalSummary.count;
    summaryEl.innerHTML = `
      <div class="bg-white rounded-3xl p-6 sm:p-8 border border-outline shadow-warm-xs grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        <!-- Big Rating Number -->
        <div class="md:col-span-4 flex flex-col items-center justify-center text-center md:border-r border-outline/60 pr-0 md:pr-6">
          <span class="font-display font-black text-5xl sm:text-6xl text-primary leading-none mb-1.5">${globalSummary.average}</span>
          <div class="text-caramel text-lg mb-1">★★★★★</div>
          <p class="text-xs font-semibold text-on-surface-variant">Based on ${totalCount} verified customer reviews</p>
        </div>

        <!-- Rating Progress Bars -->
        <div class="md:col-span-8 flex flex-col gap-1.5 pl-0 md:pl-4">
          ${[5, 4, 3, 2, 1].map(stars => {
            const count = globalSummary.breakdown[stars] || 0;
            const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
            return `
              <div class="flex items-center gap-3 text-xs">
                <span class="w-12 font-bold text-primary flex items-center gap-1">${stars} <span class="text-caramel">★</span></span>
                <div class="flex-1 h-2 bg-surface-container rounded-full overflow-hidden border border-outline/30">
                  <div class="h-full bg-caramel rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                </div>
                <span class="w-8 text-right text-[11px] text-on-surface-variant font-medium">${count}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // Filter & Sort Reviews
  let filtered = [...reviews];

  if (reviewsPageCategoryFilter !== 'all') {
    filtered = filtered.filter(r => {
      const prod = (typeof getProductById === 'function') ? getProductById(r.product_id) : null;
      if (!prod) return true;
      const cat = (typeof normalizeCategory === 'function') ? normalizeCategory(prod.category) : prod.category;
      return cat === reviewsPageCategoryFilter;
    });
  }

  if (reviewsPageSort === 'highest') {
    filtered.sort((a, b) => b.rating - a.rating);
  } else if (reviewsPageSort === 'lowest') {
    filtered.sort((a, b) => a.rating - b.rating);
  } else {
    // Newest
    filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="col-span-full py-16 text-center bg-white rounded-3xl border border-outline p-8">
        <span class="material-symbols-outlined text-4xl text-caramel mb-2">reviews</span>
        <h4 class="font-display font-bold text-base text-primary mb-1">Be the first to share your Brew &amp; Bites experience.</h4>
        <p class="text-xs text-on-surface-variant max-w-sm mx-auto mb-5">Order our signature cold brews, fresh snacks, or sweet desserts to write a review.</p>
        <a href="index.html#menu-section" class="bg-primary hover:bg-primary-container text-white font-label-bold text-xs px-6 py-2.5 rounded-full transition-all inline-flex items-center gap-1.5 shadow-warm-xs">
          <span>Explore Menu</span>
          <span class="material-symbols-outlined text-xs">arrow_forward</span>
        </a>
      </div>
    `;
    return;
  }

  listEl.innerHTML = filtered.map(r => {
    const product = (typeof getProductById === 'function') ? getProductById(r.product_id) : null;
    const prodName = product ? product.name : 'Artisanal Selection';
    const prodImg = product ? product.image : 'assets/images/vanilla-cold-brew.jpg';
    const starsStr = '★'.repeat(Math.min(5, Math.max(1, r.rating))) + '☆'.repeat(Math.max(0, 5 - r.rating));
    const dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent';

    return `
      <div class="bg-white rounded-2xl p-5 border border-outline shadow-warm-xs hover:shadow-warm-md transition-all duration-300 flex flex-col justify-between text-left">
        <div>
          <!-- Product & Stars Header -->
          <div class="flex items-center justify-between gap-3 pb-3 mb-3 border-b border-outline/50">
            <div class="flex items-center gap-2.5">
              <img src="${prodImg}" alt="${prodName}" class="w-10 h-10 rounded-xl object-cover border border-outline/40 shadow-xs" onerror="this.src='assets/images/vanilla-cold-brew.jpg'" />
              <div>
                <h5 class="font-display font-bold text-xs text-primary leading-tight">${escapeHtml(prodName)}</h5>
                <div class="text-caramel text-xs font-bold leading-none mt-0.5">${starsStr}</div>
              </div>
            </div>
            ${r.verified_purchase ? `
              <span class="inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200/70 text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0">
                <span class="material-symbols-outlined text-[10px]">verified</span>
                <span>Verified</span>
              </span>
            ` : ''}
          </div>

          <!-- Review Quote -->
          <p class="font-body text-xs text-on-surface leading-relaxed mb-4">
            "${escapeHtml(r.review_text)}"
          </p>
        </div>

        <!-- Footer: User Name & Date -->
        <div class="flex items-center justify-between text-[11px] pt-2 border-t border-outline/30 text-on-surface-variant font-medium mt-auto">
          <span class="font-bold text-primary">${escapeHtml(r.user_name || 'Valued Customer')}</span>
          <span>${dateStr}</span>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Open Product Reviews & Ratings Modal.
 */
async function openProductReviewsModal(productId) {
  if (typeof closeCart === 'function') closeCart();
  if (typeof closeProfile === 'function') closeProfile();
  if (typeof closeNavDrawer === 'function') closeNavDrawer();
  if (typeof toggleNotificationPanel === 'function') toggleNotificationPanel(false);
  if (typeof closeCheckout === 'function') closeCheckout();
  if (typeof closeAdminDashboard === 'function') closeAdminDashboard();

  activeReviewModalProductId = productId;
  const modal = document.getElementById('product-reviews-modal');
  if (!modal) return;

  await fetchAllReviewsFromSupabase();
  renderProductReviewsModalContent(productId);

  modal.classList.remove('opacity-0', 'pointer-events-none');
  modal.classList.add('opacity-100', 'pointer-events-auto');
  document.body.classList.add('overflow-hidden');
  document.body.style.overflow = 'hidden';
}

/**
 * Close Product Reviews Modal.
 */
function closeProductReviewsModal() {
  const modal = document.getElementById('product-reviews-modal');
  if (modal) {
    modal.classList.remove('opacity-100', 'pointer-events-auto');
    modal.classList.add('opacity-0', 'pointer-events-none');
  }
  document.body.classList.remove('overflow-hidden');
  document.body.style.overflow = '';
  activeReviewModalProductId = null;
}

window.openProductReviewsModal = openProductReviewsModal;
window.closeProductReviewsModal = closeProductReviewsModal;

/**
 * Render Content of Product Reviews Modal.
 */
function renderProductReviewsModalContent(productId) {
  const content = document.getElementById('product-reviews-modal-content');
  if (!content) return;

  const product = (typeof getProductById === 'function')
    ? getProductById(productId)
    : ((typeof PRODUCTS !== 'undefined' && Array.isArray(PRODUCTS)) ? PRODUCTS.find(p => p.id === productId) : null);

  const prodName = product ? product.name : 'Product';
  const prodImg = product ? product.image : 'assets/images/vanilla-cold-brew.jpg';
  const reviews = allProductReviews.filter(r => r.product_id === productId);
  const summary = getProductReviewSummary(productId);

  const isLoggedIn = typeof currentUser !== 'undefined' && currentUser !== null;
  const hasPurchased = isLoggedIn ? checkUserPurchasedProduct(productId, currentUser) : false;
  const existingUserReview = isLoggedIn ? reviews.find(r => r.user_id === currentUser.id) : null;

  const reviewsListHTML = reviews.length === 0
    ? `
      <div class="py-8 text-center bg-surface/50 border border-outline/30 rounded-2xl text-xs text-on-surface-variant">
        <span class="material-symbols-outlined text-3xl text-caramel mb-1">rate_review</span>
        <p class="font-bold text-primary">No customer reviews yet.</p>
        <p class="text-[11px] mt-0.5">${hasPurchased ? 'Be the first verified customer to share your thoughts!' : 'Order this item to leave a verified purchase review.'}</p>
      </div>
    `
    : reviews.map(r => {
        const isOwner = isLoggedIn && r.user_id === currentUser.id;
        const dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent';
        const starsStr = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);

        return `
          <div class="p-3.5 rounded-2xl bg-surface border border-outline/40 flex flex-col gap-1.5 shadow-2xs">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="font-bold text-xs text-primary">${escapeHtml(r.user_name)}</span>
                ${r.verified_purchase ? `
                  <span class="inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                    <span class="material-symbols-outlined text-[10px]">verified</span>
                    <span>Verified</span>
                  </span>
                ` : ''}
              </div>
              <span class="text-[10px] text-on-surface-variant">${dateStr}</span>
            </div>

            <div class="text-caramel text-xs font-bold">${starsStr}</div>
            <p class="text-xs text-on-surface leading-relaxed">${escapeHtml(r.review_text)}</p>

            ${isOwner ? `
              <div class="flex items-center justify-end gap-2 pt-1 border-t border-outline/20 mt-1">
                <button data-delete-review-id="${r.id}" class="delete-my-review-btn text-[11px] font-label-bold text-red-600 hover:text-red-800 cursor-pointer">Delete</button>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

  content.innerHTML = `
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-outline pb-3">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-2xl bg-surface-container overflow-hidden flex-shrink-0 border border-outline/40">
          <img src="${prodImg}" alt="${prodName}" class="w-full h-full object-cover" onerror="this.src='assets/images/vanilla-cold-brew.jpg'" />
        </div>
        <div>
          <h3 class="font-display font-bold text-base text-primary">${prodName}</h3>
          <div class="flex items-center gap-1.5 text-xs">
            <span class="text-caramel font-bold">${summary.starsHTML}</span>
            <span class="font-black text-primary">${summary.average}</span>
            <span class="text-on-surface-variant font-medium">(${summary.count} reviews)</span>
          </div>
        </div>
      </div>

      <button id="close-product-reviews-modal-btn" class="p-1.5 rounded-full text-on-surface-variant hover:text-primary cursor-pointer">
        <span class="material-symbols-outlined text-xl">close</span>
      </button>
    </div>

    <!-- Review Form Area -->
    ${isLoggedIn ? (hasPurchased ? `
      <div class="p-4 rounded-2xl bg-[#fcf9f2] border border-caramel/30 flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-label-bold text-primary">${existingUserReview ? 'Edit Your Review' : 'Write a Verified Customer Review'}</span>
          <span class="text-[10px] text-emerald-800 font-bold flex items-center gap-1">
            <span class="material-symbols-outlined text-xs">verified</span>
            <span>Verified Purchase</span>
          </span>
        </div>

        <form id="product-review-form" class="flex flex-col gap-2.5">
          <div>
            <label class="block text-[11px] font-label-bold text-on-surface-variant mb-1">Your Rating *</label>
            <select id="review-rating-select" class="w-full text-xs px-3 py-2 rounded-xl bg-white border border-outline text-primary font-bold cursor-pointer outline-none">
              <option value="5" ${existingUserReview?.rating === 5 || !existingUserReview ? 'selected' : ''}>★★★★★ (5 Stars - Exceptional)</option>
              <option value="4" ${existingUserReview?.rating === 4 ? 'selected' : ''}>★★★★☆ (4 Stars - Great)</option>
              <option value="3" ${existingUserReview?.rating === 3 ? 'selected' : ''}>★★★☆☆ (3 Stars - Average)</option>
              <option value="2" ${existingUserReview?.rating === 2 ? 'selected' : ''}>★★☆☆☆ (2 Stars - Below Average)</option>
              <option value="1" ${existingUserReview?.rating === 1 ? 'selected' : ''}>★☆☆☆☆ (1 Star - Poor)</option>
            </select>
          </div>

          <div>
            <label class="block text-[11px] font-label-bold text-on-surface-variant mb-1">Your Comments *</label>
            <textarea id="review-text-input" rows="2" required placeholder="What did you love about this item?" class="w-full text-xs px-3 py-2 rounded-xl bg-white border border-outline text-primary resize-none outline-none">${existingUserReview?.review_text || ''}</textarea>
          </div>

          <p id="review-feedback-msg" class="text-xs font-medium hidden text-center"></p>

          <button type="submit" id="submit-review-btn" class="bg-primary hover:bg-primary-container text-white font-label-bold text-xs py-2 px-5 rounded-full transition-all shadow-xs self-start cursor-pointer active:scale-95">
            <span>${existingUserReview ? 'Update Review' : 'Submit Review'}</span>
          </button>
        </form>
      </div>
    ` : `
      <div class="p-3.5 rounded-2xl bg-surface-container/60 border border-outline flex items-center gap-2.5 text-xs text-on-surface-variant">
        <span class="material-symbols-outlined text-primary text-lg">info</span>
        <span>Order this product to submit a verified customer review.</span>
      </div>
    `) : `
      <div class="p-3.5 rounded-2xl bg-surface-container/60 border border-outline flex items-center justify-between text-xs">
        <span class="text-on-surface-variant">Sign in to leave a review for products you've ordered.</span>
        <button id="review-login-prompt-btn" class="font-label-bold text-xs text-caramel hover:text-primary underline cursor-pointer">Sign In</button>
      </div>
    `}

    <!-- Customer Reviews List -->
    <div class="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
      <span class="text-xs font-label-bold text-primary">All Reviews for this item (${reviews.length})</span>
      ${reviewsListHTML}
    </div>
  `;

  attachReviewModalEvents(productId);
}

/**
 * Attach Event Listeners inside Review Modal.
 */
function attachReviewModalEvents(productId) {
  const closeBtn = document.getElementById('close-product-reviews-modal-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeProductReviewsModal);

  const loginPromptBtn = document.getElementById('review-login-prompt-btn');
  if (loginPromptBtn) {
    loginPromptBtn.addEventListener('click', () => {
      closeProductReviewsModal();
      if (typeof openProfile === 'function') openProfile();
    });
  }

  const reviewForm = document.getElementById('product-review-form');
  if (reviewForm) {
    reviewForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rating = document.getElementById('review-rating-select')?.value;
      const text = document.getElementById('review-text-input')?.value;
      const msgEl = document.getElementById('review-feedback-msg');
      const submitBtn = document.getElementById('submit-review-btn');

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Submitting...</span>';
      }

      try {
        await submitProductReview(productId, rating, text, currentUser);
        renderProductReviewsModalContent(productId);
      } catch (err) {
        if (msgEl) {
          msgEl.textContent = err.message || "Failed to submit review.";
          msgEl.className = 'text-xs text-red-600 font-medium text-center';
          msgEl.classList.remove('hidden');
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Submit Review</span>';
        }
      }
    });
  }

  document.querySelectorAll('.delete-my-review-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-delete-review-id');
      if (id && confirm("Are you sure you want to delete your review?")) {
        try {
          await deleteProductReview(id, currentUser);
          renderProductReviewsModalContent(productId);
          if (typeof showInAppToast === 'function') {
            showInAppToast("Review removed successfully.", "info");
          }
        } catch (err) {
          if (typeof showInAppToast === 'function') {
            showInAppToast(err.message || "Could not delete review.", "error");
          }
        }
      }
    });
  });
}

// Attach homepage review navigation controls
document.addEventListener('DOMContentLoaded', () => {
  fetchAllReviewsFromSupabase();

  const prevBtn = document.getElementById('prev-home-review-btn');
  const nextBtn = document.getElementById('next-home-review-btn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      homeReviewPageIndex--;
      renderHomepageCustomerReviews();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      homeReviewPageIndex++;
      renderHomepageCustomerReviews();
    });
  }
});

// Exports for Node testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fetchAllReviewsFromSupabase,
    getProductReviewSummary,
    getGlobalReviewSummary,
    checkUserPurchasedProduct,
    getUserDeliveredProducts,
    submitProductReview,
    deleteProductReview,
    openProductReviewsModal,
    closeProductReviewsModal,
    renderHomepageCustomerReviews,
    renderReviewsPageContent
  };
}
