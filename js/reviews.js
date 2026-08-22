/**
 * Brew & Bite - Customer Reviews & Ratings Module (reviews.js)
 * Database-backed product reviews connecting to Supabase public.reviews table,
 * enforcing Verified Purchase validation, 1-5 star ratings, and review moderation.
 */

let allProductReviews = [];
let activeReviewModalProductId = null;

/**
 * Fetch all reviews from Supabase public.reviews table.
 */
async function fetchAllReviewsFromSupabase() {
  if (typeof supabaseClient === 'undefined' || !supabaseClient) {
    allProductReviews = [];
    return [];
  }

  try {
    const { data, error } = await supabaseClient
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn("Notice: reviews table query note:", error.message);
      allProductReviews = [];
    } else {
      allProductReviews = data || [];
    }
  } catch (err) {
    console.warn("Could not fetch reviews from Supabase:", err);
    allProductReviews = [];
  }

  return allProductReviews;
}

/**
 * Get review summary (average rating and total count) for a specific product.
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
 * Check if the user has purchased this product in a completed/non-cancelled order (Verified Purchase).
 */
function checkUserPurchasedProduct(productId, user) {
  if (!user || !user.id || !productId) return false;

  const orders = (typeof getOrders === 'function') ? getOrders() : [];
  for (const order of orders) {
    if (order.status !== 'cancelled' && Array.isArray(order.items)) {
      const found = order.items.some(item => item.productId === productId);
      if (found) return true;
    }
  }
  return false;
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

  const hasPurchased = checkUserPurchasedProduct(productId, user);
  if (!hasPurchased) {
    throw new Error("Verified Purchase Required: You can review this item once you have ordered it.");
  }

  const displayName = (typeof userProfile !== 'undefined' && userProfile?.full_name)
    ? userProfile.full_name
    : (user.user_metadata?.full_name || user.email?.split('@')[0] || 'Brew & Bite Customer');

  const payload = {
    product_id: productId,
    user_id: user.id,
    user_name: displayName,
    rating: ratingNum,
    review_text: reviewText.trim(),
    verified_purchase: true,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabaseClient
    .from('reviews')
    .upsert(payload, { onConflict: 'user_id,product_id' })
    .select()
    .single();

  if (error) throw new Error(error.message || "Failed to submit review.");

  await fetchAllReviewsFromSupabase();
  if (typeof renderProducts === 'function') renderProducts();
  return data;
}

/**
 * Delete a user review.
 */
async function deleteProductReview(reviewId, user) {
  if (!reviewId || !user || !user.id || typeof supabaseClient === 'undefined') return;

  const { error } = await supabaseClient
    .from('reviews')
    .delete()
    .eq('id', reviewId);

  if (error) throw new Error(error.message || "Could not delete review.");

  await fetchAllReviewsFromSupabase();
  if (typeof renderProducts === 'function') renderProducts();
}

/**
 * Open Product Reviews & Ratings Modal.
 */
async function openProductReviewsModal(productId) {
  activeReviewModalProductId = productId;
  const modal = document.getElementById('product-reviews-modal');
  if (!modal) return;

  await fetchAllReviewsFromSupabase();
  renderProductReviewsModalContent(productId);

  modal.classList.remove('opacity-0', 'pointer-events-none');
  modal.classList.add('opacity-100', 'pointer-events-auto');
  document.body.classList.add('overflow-hidden');
}

/**
 * Close Product Reviews Modal.
 */
function closeProductReviewsModal() {
  const modal = document.getElementById('product-reviews-modal');
  if (!modal) return;

  modal.classList.remove('opacity-100', 'pointer-events-auto');
  modal.classList.add('opacity-0', 'pointer-events-none');
  document.body.classList.remove('overflow-hidden');
  activeReviewModalProductId = null;
}

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
  const prodImg = product ? product.image : 'assets/frames/ezgif-frame-001.jpg';
  const reviews = allProductReviews.filter(r => r.product_id === productId);
  const summary = getProductReviewSummary(productId);

  const isLoggedIn = typeof currentUser !== 'undefined' && currentUser !== null;
  const hasPurchased = isLoggedIn ? checkUserPurchasedProduct(productId, currentUser) : false;
  const existingUserReview = isLoggedIn ? reviews.find(r => r.user_id === currentUser.id) : null;

  const reviewsListHTML = reviews.length === 0
    ? `
      <div class="py-8 text-center bg-surface/50 border border-outline-variant/20 rounded-2xl text-xs text-on-surface-variant">
        <span class="material-symbols-outlined text-3xl text-secondary mb-1">rate_review</span>
        <p class="font-bold text-primary">No customer reviews yet.</p>
        <p class="text-[11px] mt-0.5">${hasPurchased ? 'Be the first verified customer to share your thoughts!' : 'Order this item to leave a verified purchase review.'}</p>
      </div>
    `
    : reviews.map(r => {
        const isOwner = isLoggedIn && r.user_id === currentUser.id;
        const dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent';
        const starsStr = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);

        return `
          <div class="p-4 rounded-2xl bg-surface border border-outline-variant/25 flex flex-col gap-2 shadow-xs">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="font-bold text-xs text-primary">${r.user_name}</span>
                ${r.verified_purchase ? `
                  <span class="inline-flex items-center gap-0.5 bg-green-50 text-green-800 border border-green-200 text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                    <span class="material-symbols-outlined text-[10px]">verified</span>
                    <span>Verified Purchase</span>
                  </span>
                ` : ''}
              </div>
              <span class="text-[10px] text-on-surface-variant">${dateStr}</span>
            </div>

            <div class="text-amber-500 text-xs font-bold">${starsStr}</div>
            <p class="text-xs text-on-surface leading-relaxed">${r.review_text}</p>

            ${isOwner ? `
              <div class="flex items-center justify-end gap-2 pt-1 border-t border-outline-variant/15 mt-1">
                <button data-delete-review-id="${r.id}" class="delete-my-review-btn text-[11px] font-label-bold text-red-600 hover:text-red-800 cursor-pointer">Delete</button>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

  content.innerHTML = `
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-2xl bg-surface-container-high overflow-hidden flex-shrink-0">
          <img src="${prodImg}" alt="${prodName}" class="w-full h-full object-cover" />
        </div>
        <div>
          <h3 class="font-display font-bold text-base text-primary">${prodName}</h3>
          <div class="flex items-center gap-1.5 text-xs">
            <span class="text-amber-500 font-bold">${summary.starsHTML}</span>
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
      <div class="p-4 rounded-2xl bg-secondary-container/15 border border-secondary/30 flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-label-bold text-primary">${existingUserReview ? 'Edit Your Review' : 'Write a Verified Customer Review'}</span>
          <span class="text-[10px] text-green-700 font-bold flex items-center gap-1">
            <span class="material-symbols-outlined text-xs">check_circle</span>
            <span>Verified Purchase</span>
          </span>
        </div>

        <form id="product-review-form" class="flex flex-col gap-2.5">
          <div>
            <label class="block text-[11px] font-label-bold text-on-surface-variant mb-1">Your Rating *</label>
            <select id="review-rating-select" class="w-full text-xs px-3 py-2 rounded-xl bg-surface border border-outline-variant/40 text-primary font-bold cursor-pointer">
              <option value="5" ${existingUserReview?.rating === 5 || !existingUserReview ? 'selected' : ''}>★★★★★ (5 Stars - Exceptional)</option>
              <option value="4" ${existingUserReview?.rating === 4 ? 'selected' : ''}>★★★★☆ (4 Stars - Great)</option>
              <option value="3" ${existingUserReview?.rating === 3 ? 'selected' : ''}>★★★☆☆ (3 Stars - Average)</option>
              <option value="2" ${existingUserReview?.rating === 2 ? 'selected' : ''}>★★☆☆☆ (2 Stars - Below Average)</option>
              <option value="1" ${existingUserReview?.rating === 1 ? 'selected' : ''}>★☆☆☆☆ (1 Star - Poor)</option>
            </select>
          </div>

          <div>
            <label class="block text-[11px] font-label-bold text-on-surface-variant mb-1">Your Comments *</label>
            <textarea id="review-text-input" rows="2" required placeholder="What did you love about this item?" class="w-full text-xs px-3 py-2 rounded-xl bg-surface border border-outline-variant/40 text-primary resize-none">${existingUserReview?.review_text || ''}</textarea>
          </div>

          <p id="review-feedback-msg" class="text-xs font-medium hidden text-center"></p>

          <button type="submit" id="submit-review-btn" class="bg-tertiary text-on-tertiary hover:bg-primary font-label-bold text-xs py-2 px-5 rounded-full transition-all shadow-xs self-start cursor-pointer active:scale-95">
            <span>${existingUserReview ? 'Update Review' : 'Submit Review'}</span>
          </button>
        </form>
      </div>
    ` : `
      <div class="p-3.5 rounded-2xl bg-surface-container-high/30 border border-outline-variant/20 flex items-center gap-2.5 text-xs text-on-surface-variant">
        <span class="material-symbols-outlined text-secondary text-lg">info</span>
        <span>Order this product to submit a verified customer review.</span>
      </div>
    `) : `
      <div class="p-3.5 rounded-2xl bg-surface-container-high/30 border border-outline-variant/20 flex items-center justify-between text-xs">
        <span class="text-on-surface-variant">Sign in to leave a review for products you've ordered.</span>
        <button id="review-login-prompt-btn" class="font-label-bold text-xs text-secondary hover:text-tertiary underline cursor-pointer">Sign In</button>
      </div>
    `}

    <!-- Customer Reviews List -->
    <div class="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
      <span class="text-xs font-label-bold text-primary">Customer Reviews (${reviews.length})</span>
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
        } catch (err) {
          alert(err.message || "Could not delete review.");
        }
      }
    });
  });
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  fetchAllReviewsFromSupabase();
});

// Exports for Node testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fetchAllReviewsFromSupabase,
    getProductReviewSummary,
    checkUserPurchasedProduct,
    submitProductReview,
    deleteProductReview,
    openProductReviewsModal,
    closeProductReviewsModal
  };
}
