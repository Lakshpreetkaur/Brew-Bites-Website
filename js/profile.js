/**
 * Brew & Bite - Customer Profile & Real Supabase Authentication (profile.js)
 * Connects Customer Profile to the Supabase `profiles` table.
 * Handles customer authentication (signup, login, signout) using Supabase Auth,
 * profile data fetching/creation from Supabase `profiles`, order history list rendering,
 * and order detail inspection.
 */

// Global Auth & Profile State
let currentUser = null;
let userProfile = null;
let isProfileLoading = false;
let currentAuthMode = 'login'; // 'login' | 'signup'

// Initialize Supabase Auth Session and Listen for State Changes
async function initSupabaseAuth() {
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      currentUser = session?.user || null;

      if (currentUser) {
        await fetchOrCreateUserProfile(currentUser);
      }

      supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        currentUser = session?.user || null;
        if (currentUser) {
          await fetchOrCreateUserProfile(currentUser);
        } else {
          userProfile = null;
        }

        const profileModal = document.getElementById('profile-modal');
        if (profileModal && profileModal.classList.contains('opacity-100')) {
          renderProfileMain();
        }
      });
    } catch (err) {
      console.warn("Could not retrieve Supabase session:", err);
    }
  }
}

// Fetch Profile from Supabase `profiles` table or create one if it doesn't exist
async function fetchOrCreateUserProfile(user) {
  if (!user || !supabaseClient) return null;

  try {
    isProfileLoading = true;

    // 1. Query the existing `profiles` table for this authenticated user ID
    const { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.warn("Supabase profiles table query info:", error.message);
    }

    if (profile) {
      userProfile = profile;
      isProfileLoading = false;
      return profile;
    }

    // 2. If profile does not exist yet, create a new profile record
    const newProfileData = {
      id: user.id,
      full_name: user.user_metadata?.full_name || user.email.split('@')[0] || 'Brew & Bite Member',
      email: user.email,
      updated_at: new Date().toISOString()
    };

    const { data: insertedProfile, error: insertError } = await supabaseClient
      .from('profiles')
      .upsert(newProfileData)
      .select()
      .maybeSingle();

    if (insertError) {
      console.warn("Could not insert profile into Supabase profiles table:", insertError.message);
      userProfile = newProfileData;
    } else {
      userProfile = insertedProfile || newProfileData;
    }

    isProfileLoading = false;
    return userProfile;
  } catch (err) {
    console.warn("Error handling Supabase profile:", err);
    userProfile = {
      id: user.id,
      full_name: user.user_metadata?.full_name || user.email.split('@')[0] || 'Brew & Bite Member',
      email: user.email
    };
    isProfileLoading = false;
    return userProfile;
  }
}

// Open Profile Modal
async function openProfile() {
  const profileModal = document.getElementById('profile-modal');
  const profileCard = document.getElementById('profile-modal-card');
  if (!profileModal) return;

  // Close other open drawers/modals if open
  if (typeof closeCart === 'function') closeCart();
  if (typeof closeCheckout === 'function') closeCheckout();

  // If user is authenticated but profile is not loaded, fetch it
  if (currentUser && !userProfile && !isProfileLoading) {
    await fetchOrCreateUserProfile(currentUser);
  }

  // Render the profile overview / auth form
  renderProfileMain();

  // Show Profile Modal with smooth transition
  profileModal.classList.remove('opacity-0', 'pointer-events-none');
  profileModal.classList.add('opacity-100', 'pointer-events-auto');

  if (profileCard) {
    profileCard.classList.remove('scale-95');
    profileCard.classList.add('scale-100');
  }

  document.body.classList.add('overflow-hidden');
}

// Close Profile Modal
function closeProfile() {
  const profileModal = document.getElementById('profile-modal');
  const profileCard = document.getElementById('profile-modal-card');
  if (!profileModal) return;

  profileModal.classList.remove('opacity-100', 'pointer-events-auto');
  profileModal.classList.add('opacity-0', 'pointer-events-none');

  if (profileCard) {
    profileCard.classList.remove('scale-100');
    profileCard.classList.add('scale-95');
  }

  document.body.classList.remove('overflow-hidden');
}

// Helper to Browse Menu
function browseMenuFromProfile() {
  closeProfile();
  const menuSection = document.getElementById('coffee-section') || document.getElementById('animation-container');
  if (menuSection) {
    menuSection.scrollIntoView({ behavior: 'smooth' });
  }
}

// Render Main Profile View (Login/Signup Form if guest, Profile + Orders if logged in)
function renderProfileMain() {
  const profileContent = document.getElementById('profile-content');
  if (!profileContent) return;

  // Case 1: User is Logged In
  if (currentUser) {
    const displayName = userProfile?.full_name || currentUser.user_metadata?.full_name || currentUser.email.split('@')[0] || 'Valued Member';
    const displayEmail = userProfile?.email || currentUser.email || '';
    const initial = displayName.charAt(0).toUpperCase();

    // Retrieve completed orders from orders.js
    const orders = (typeof getOrders === 'function') ? getOrders() : [];

    let ordersHTML = '';
    if (orders.length === 0) {
      ordersHTML = `
        <div class="flex flex-col items-center justify-center text-center py-10 px-4 bg-surface/50 border border-outline-variant/20 rounded-2xl">
          <div class="w-16 h-16 bg-secondary-container/20 text-secondary rounded-full flex items-center justify-center mb-3">
            <span class="material-symbols-outlined text-3xl">receipt_long</span>
          </div>
          <h4 class="font-display text-lg font-bold text-primary mb-1">No orders yet</h4>
          <p class="font-body-md text-sm text-on-surface-variant max-w-xs mb-5">Your completed orders will appear here.</p>
          <button id="profile-browse-menu-btn" class="bg-secondary-container text-on-secondary-container hover:bg-tertiary hover:text-on-tertiary font-label-bold text-xs py-2.5 px-6 rounded-full transition-all duration-200 shadow-md cursor-pointer active:scale-95">
            <span>Browse Menu</span>
          </button>
        </div>
      `;
    } else {
      ordersHTML = `
        <div class="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
          ${orders.map(order => {
            const totalItems = Array.isArray(order.items)
              ? order.items.reduce((sum, item) => sum + (item.quantity || 1), 0)
              : 0;

            const dateStr = order.createdAt
              ? new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
              : 'Recent Order';

            return `
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-surface border border-outline-variant/20 shadow-xs hover:border-outline-variant/40 transition-colors">
                <div class="flex flex-col gap-1">
                  <div class="flex items-center gap-2.5 flex-wrap">
                    <span class="font-display font-bold text-primary text-sm">${order.orderId}</span>
                    <span class="bg-secondary/15 text-secondary font-label-bold text-[11px] uppercase tracking-wider px-2.5 py-0.5 rounded-full">${order.status || 'placed'}</span>
                  </div>
                  <p class="text-xs text-on-surface-variant font-body-md">${dateStr} • ${totalItems} item${totalItems === 1 ? '' : 's'}</p>
                </div>

                <div class="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 border-outline-variant/15 pt-2 sm:pt-0">
                  <span class="font-display font-bold text-primary text-base">$${Number(order.subtotal || 0).toFixed(2)}</span>
                  <button data-order-id="${order.orderId}" class="view-order-btn bg-secondary-container text-on-secondary-container hover:bg-tertiary hover:text-on-tertiary font-label-bold text-xs py-1.5 px-4 rounded-full transition-all duration-200 shadow-xs cursor-pointer active:scale-95">
                    <span>View Order</span>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    profileContent.innerHTML = `
      <div class="flex flex-col gap-6">
        
        <!-- Logged-in Customer Information Card (Populated from Supabase profiles table) -->
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-surface border border-outline-variant/25 shadow-xs">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-2xl bg-secondary-container text-on-secondary-container flex items-center justify-center font-display font-black text-xl shadow-xs">
              ${initial}
            </div>
            <div>
              <h3 class="font-display text-lg font-bold text-primary">${displayName}</h3>
              <p class="text-xs text-on-surface-variant font-medium">${displayEmail}</p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-secondary/15 border border-secondary/30 text-secondary font-label-bold text-[11px] uppercase tracking-wider">
              <span>Verified Account</span>
            </span>
            <button id="auth-signout-btn" class="text-xs text-on-surface-variant hover:text-red-600 flex items-center gap-1 font-label-bold border border-outline-variant/40 hover:border-red-300 px-3 py-1.5 rounded-full transition-colors cursor-pointer active:scale-95">
              <span>Sign Out</span>
              <span class="material-symbols-outlined text-sm">logout</span>
            </button>
          </div>
        </div>

        <!-- My Orders Section -->
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between border-b border-outline-variant/20 pb-2">
            <h3 class="font-display text-lg font-bold text-primary">My Orders</h3>
            <span class="text-xs font-label-bold text-on-surface-variant">${orders.length} Order${orders.length === 1 ? '' : 's'} Total</span>
          </div>

          ${ordersHTML}
        </div>

      </div>
    `;

    // Signout listener
    const signoutBtn = document.getElementById('auth-signout-btn');
    if (signoutBtn) {
      signoutBtn.addEventListener('click', handleSignOut);
    }

    // Browse menu listener
    const browseMenuBtn = document.getElementById('profile-browse-menu-btn');
    if (browseMenuBtn) {
      browseMenuBtn.addEventListener('click', browseMenuFromProfile);
    }

    return;
  }

  // Case 2: User is NOT Logged In - Render Auth Form (Login / Sign Up)
  profileContent.innerHTML = `
    <div class="flex flex-col gap-6 max-w-md mx-auto py-2">
      <div class="text-center">
        <div class="w-14 h-14 bg-secondary-container/20 text-secondary rounded-full flex items-center justify-center mx-auto mb-3">
          <span class="material-symbols-outlined text-3xl">account_circle</span>
        </div>
        <h3 class="font-display text-2xl font-bold text-primary mb-1">
          ${currentAuthMode === 'login' ? 'Welcome Back' : 'Join Brew & Bite'}
        </h3>
        <p class="font-body-md text-xs text-on-surface-variant">
          ${currentAuthMode === 'login' ? 'Sign in to access your saved profile & order history.' : 'Create an account to track orders and save your favorites.'}
        </p>
      </div>

      <!-- Auth Form -->
      <form id="auth-form" class="flex flex-col gap-4">
        ${currentAuthMode === 'signup' ? `
          <div>
            <label for="auth-name" class="block font-label-bold text-xs text-primary mb-1 uppercase tracking-wider">Full Name *</label>
            <input type="text" id="auth-name" required placeholder="e.g. Lakshpreet Kaur" class="w-full px-4 py-2.5 rounded-2xl bg-surface border border-outline-variant/40 focus:border-tertiary focus:ring-2 focus:ring-tertiary/20 outline-none transition-all text-sm text-on-surface" />
          </div>
        ` : ''}

        <div>
          <label for="auth-email" class="block font-label-bold text-xs text-primary mb-1 uppercase tracking-wider">Email Address *</label>
          <input type="email" id="auth-email" required placeholder="e.g. laksh@example.com" class="w-full px-4 py-2.5 rounded-2xl bg-surface border border-outline-variant/40 focus:border-tertiary focus:ring-2 focus:ring-tertiary/20 outline-none transition-all text-sm text-on-surface" />
        </div>

        <div>
          <label for="auth-password" class="block font-label-bold text-xs text-primary mb-1 uppercase tracking-wider">Password *</label>
          <input type="password" id="auth-password" required minlength="6" placeholder="Minimum 6 characters" class="w-full px-4 py-2.5 rounded-2xl bg-surface border border-outline-variant/40 focus:border-tertiary focus:ring-2 focus:ring-tertiary/20 outline-none transition-all text-sm text-on-surface" />
        </div>

        <!-- Status / Error Notification Paragraph -->
        <p id="auth-status-msg" class="hidden text-xs font-medium text-center"></p>

        <!-- Submit Button -->
        <button type="submit" id="auth-submit-btn" class="w-full mt-2 bg-tertiary text-on-tertiary font-label-bold text-sm py-3 px-6 rounded-full hover:scale-102 transition-all duration-200 shadow-md pink-glow flex items-center justify-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50">
          <span>${currentAuthMode === 'login' ? 'Sign In' : 'Create Account'}</span>
          <span class="material-symbols-outlined text-base">arrow_forward</span>
        </button>
      </form>

      <!-- Toggle between Sign In and Sign Up -->
      <div class="text-center pt-1 border-t border-outline-variant/20">
        <button type="button" id="auth-toggle-mode-btn" class="text-xs text-primary font-label-bold hover:text-tertiary transition-colors cursor-pointer">
          ${currentAuthMode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  `;

  // Attach Form Submit Listener
  const authForm = document.getElementById('auth-form');
  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('auth-email')?.value.trim();
      const password = document.getElementById('auth-password')?.value;
      const name = document.getElementById('auth-name')?.value.trim() || '';

      if (currentAuthMode === 'login') {
        handleSignIn(email, password);
      } else {
        handleSignUp(email, password, name);
      }
    });
  }

  // Attach Toggle Mode Listener
  const toggleBtn = document.getElementById('auth-toggle-mode-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      currentAuthMode = currentAuthMode === 'login' ? 'signup' : 'login';
      renderProfileMain();
    });
  }
}

// Handle Real Supabase Sign In (Email/Password)
async function handleSignIn(email, password) {
  const statusMsg = document.getElementById('auth-status-msg');
  const submitBtn = document.getElementById('auth-submit-btn');

  if (!email || !password) {
    if (statusMsg) {
      statusMsg.textContent = 'Please provide both email and password.';
      statusMsg.className = 'text-xs text-red-600 font-medium text-center';
      statusMsg.classList.remove('hidden');
    }
    return;
  }

  if (typeof supabaseClient === 'undefined' || !supabaseClient) {
    if (statusMsg) {
      statusMsg.textContent = 'Supabase client is not connected.';
      statusMsg.className = 'text-xs text-red-600 font-medium text-center';
      statusMsg.classList.remove('hidden');
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Signing in...</span>';
  }

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      if (statusMsg) {
        statusMsg.textContent = error.message;
        statusMsg.className = 'text-xs text-red-600 font-medium text-center';
        statusMsg.classList.remove('hidden');
      }
    } else {
      currentUser = data.user;
      await fetchOrCreateUserProfile(currentUser);
      renderProfileMain();
    }
  } catch (err) {
    if (statusMsg) {
      statusMsg.textContent = err.message || 'An error occurred during sign in.';
      statusMsg.className = 'text-xs text-red-600 font-medium text-center';
      statusMsg.classList.remove('hidden');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Sign In</span><span class="material-symbols-outlined text-base">arrow_forward</span>`;
    }
  }
}

// Handle Real Supabase Sign Up (Email/Password with Full Name Metadata)
async function handleSignUp(email, password, fullName) {
  const statusMsg = document.getElementById('auth-status-msg');
  const submitBtn = document.getElementById('auth-submit-btn');

  if (!email || !password) {
    if (statusMsg) {
      statusMsg.textContent = 'Please fill all required fields.';
      statusMsg.className = 'text-xs text-red-600 font-medium text-center';
      statusMsg.classList.remove('hidden');
    }
    return;
  }

  if (typeof supabaseClient === 'undefined' || !supabaseClient) {
    if (statusMsg) {
      statusMsg.textContent = 'Supabase client is not connected.';
      statusMsg.className = 'text-xs text-red-600 font-medium text-center';
      statusMsg.classList.remove('hidden');
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Creating account...</span>';
  }

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { full_name: fullName }
      }
    });

    if (error) {
      if (statusMsg) {
        statusMsg.textContent = error.message;
        statusMsg.className = 'text-xs text-red-600 font-medium text-center';
        statusMsg.classList.remove('hidden');
      }
    } else {
      if (data.session) {
        currentUser = data.user;
        await fetchOrCreateUserProfile(currentUser);
        renderProfileMain();
      } else {
        if (statusMsg) {
          statusMsg.textContent = 'Account created successfully! You may now sign in.';
          statusMsg.className = 'text-xs text-secondary font-bold text-center';
          statusMsg.classList.remove('hidden');
        }
        currentAuthMode = 'login';
        setTimeout(() => {
          renderProfileMain();
        }, 1500);
      }
    }
  } catch (err) {
    if (statusMsg) {
      statusMsg.textContent = err.message || 'An error occurred during sign up.';
      statusMsg.className = 'text-xs text-red-600 font-medium text-center';
      statusMsg.classList.remove('hidden');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Create Account</span><span class="material-symbols-outlined text-base">arrow_forward</span>`;
    }
  }
}

// Handle Real Supabase Sign Out
async function handleSignOut() {
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      await supabaseClient.auth.signOut();
      currentUser = null;
      userProfile = null;
      console.log("Supabase Sign Out completed.");
      renderProfileMain();
    } catch (err) {
      console.warn("Sign Out error:", err);
    }
  }
}

// Render Specific Order Detail View
function openOrderDetail(orderId) {
  const profileContent = document.getElementById('profile-content');
  if (!profileContent || !orderId) return;

  const order = (typeof getOrderById === 'function') ? getOrderById(orderId) : null;

  if (!order) {
    profileContent.innerHTML = `
      <div class="text-center py-8">
        <p class="text-sm text-red-600 font-bold mb-4">Order not found.</p>
        <button id="back-to-orders-btn" class="bg-secondary-container text-on-secondary-container hover:bg-tertiary hover:text-on-tertiary font-label-bold text-xs py-2 px-5 rounded-full cursor-pointer">
          <span>← Back to Orders</span>
        </button>
      </div>
    `;
    const backBtn = document.getElementById('back-to-orders-btn');
    if (backBtn) backBtn.addEventListener('click', renderProfileMain);
    return;
  }

  const formattedDate = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Recent Order';

  const itemsListHTML = Array.isArray(order.items)
    ? order.items.map(item => `
        <div class="flex items-center justify-between py-2 border-b border-outline-variant/15 text-sm">
          <div>
            <h5 class="font-display font-bold text-primary text-xs">${item.name || item.productId}</h5>
            <p class="text-xs text-on-surface-variant">$${Number(item.unitPrice || 0).toFixed(2)} × ${item.quantity}</p>
          </div>
          <span class="font-label-bold text-primary text-xs">$${Number(item.lineTotal || 0).toFixed(2)}</span>
        </div>
      `).join('')
    : '<p class="text-xs text-on-surface-variant">No items recorded.</p>';

  profileContent.innerHTML = `
    <div class="flex flex-col gap-5">
      
      <!-- Back Navigation Header -->
      <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
        <button id="back-to-orders-btn" class="inline-flex items-center gap-1.5 text-xs font-label-bold text-primary hover:text-tertiary transition-colors cursor-pointer py-1">
          <span class="material-symbols-outlined text-sm">arrow_back</span>
          <span>Back to Orders</span>
        </button>
        <span class="bg-secondary/15 text-secondary font-label-bold text-xs uppercase tracking-wider px-3 py-0.5 rounded-full">${order.status || 'placed'}</span>
      </div>

      <!-- Order Summary Card -->
      <div class="p-5 rounded-2xl bg-surface border border-outline-variant/30 flex flex-col gap-4 shadow-xs">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/15 pb-3">
          <div>
            <span class="text-xs text-on-surface-variant uppercase font-label-bold tracking-wider">Order Reference</span>
            <h4 class="font-display text-lg font-black text-primary">${order.orderId}</h4>
          </div>
          <div class="text-left sm:text-right">
            <span class="text-xs text-on-surface-variant uppercase font-label-bold tracking-wider">Date &amp; Time</span>
            <p class="text-xs font-medium text-primary">${formattedDate}</p>
          </div>
        </div>

        <!-- Customer & Delivery Info -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-surface-container-high/30 p-3.5 rounded-xl border border-outline-variant/15">
          <div>
            <span class="text-on-surface-variant font-bold block mb-0.5">Customer Name:</span>
            <span class="text-primary font-medium">${order.customer.name || 'Brew & Bite Customer'}</span>
          </div>
          <div>
            <span class="text-on-surface-variant font-bold block mb-0.5">Order Type:</span>
            <span class="text-secondary font-bold uppercase">${order.customer.orderType || 'Pickup'}</span>
          </div>
          ${order.customer.address ? `
            <div class="sm:col-span-2">
              <span class="text-on-surface-variant font-bold block mb-0.5">Delivery Address:</span>
              <span class="text-primary font-medium">${order.customer.address}</span>
            </div>
          ` : ''}
          ${order.customer.notes ? `
            <div class="sm:col-span-2">
              <span class="text-on-surface-variant font-bold block mb-0.5">Order Notes:</span>
              <span class="text-primary font-medium">${order.customer.notes}</span>
            </div>
          ` : ''}
        </div>

        <!-- Purchased Line Items (Immutable Historical Snapshot) -->
        <div class="flex flex-col gap-1">
          <span class="text-xs text-on-surface-variant uppercase font-label-bold tracking-wider mb-1">Purchased Items</span>
          <div class="max-h-[160px] overflow-y-auto pr-1">
            ${itemsListHTML}
          </div>
        </div>

        <!-- Total Calculation -->
        <div class="border-t border-outline-variant/20 pt-3 flex items-center justify-between">
          <span class="font-display font-bold text-sm text-primary">Subtotal Paid</span>
          <span class="font-display font-black text-xl text-primary">$${Number(order.subtotal || 0).toFixed(2)}</span>
        </div>
      </div>

    </div>
  `;

  const backBtn = document.getElementById('back-to-orders-btn');
  if (backBtn) {
    backBtn.addEventListener('click', renderProfileMain);
  }
}

// Initialize Profile and Auth Event Listeners on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Supabase Auth Session
  initSupabaseAuth();

  const profileBtn = document.getElementById('profile-btn');
  const mobileProfileBtn = document.getElementById('mobile-profile-btn');
  const closeProfileBtn = document.getElementById('close-profile-btn');

  // Open Profile from Navbar Button (Desktop & Tablet)
  if (profileBtn) {
    profileBtn.addEventListener('click', openProfile);
  }

  // Open Profile from Mobile Menu Drawer
  if (mobileProfileBtn) {
    mobileProfileBtn.addEventListener('click', () => {
      const mobileMenu = document.getElementById('mobile-menu');
      const menuIcon = document.getElementById('menu-icon');
      if (mobileMenu) mobileMenu.classList.add('hidden');
      if (menuIcon) menuIcon.textContent = 'menu';

      openProfile();
    });
  }

  // Close Profile Modal
  if (closeProfileBtn) {
    closeProfileBtn.addEventListener('click', closeProfile);
  }

  // Close Profile Modal on Escape Key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const profileModal = document.getElementById('profile-modal');
      if (profileModal && profileModal.classList.contains('opacity-100')) {
        closeProfile();
      }
    }
  });

  // Global Event Delegation for "View Order"
  document.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('.view-order-btn');
    if (viewBtn) {
      const orderId = viewBtn.getAttribute('data-order-id');
      if (orderId) {
        openOrderDetail(orderId);
      }
    }
  });
});
