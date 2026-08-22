/**
 * Brew & Bite - Customer Profile, Country-Aware Phone & Supabase Authentication (profile.js)
 * Connects Customer Profile directly to the Supabase `profiles` table.
 *
 * Supabase Profiles Schema:
 * - public.profiles: (id, full_name, email, phone, created_at, updated_at)
 */

// Standard Country dataset with flags and dialing codes
const COUNTRIES = [
  { name: "India", code: "IN", dial: "+91", flag: "🇮🇳" },
  { name: "United States", code: "US", dial: "+1", flag: "🇺🇸" },
  { name: "Canada", code: "CA", dial: "+1", flag: "🇨🇦" },
  { name: "United Kingdom", code: "GB", dial: "+44", flag: "🇬🇧" },
  { name: "Australia", code: "AU", dial: "+61", flag: "🇦🇺" },
  { name: "United Arab Emirates", code: "AE", dial: "+971", flag: "🇦🇪" },
  { name: "Germany", code: "DE", dial: "+49", flag: "🇩🇪" },
  { name: "Singapore", code: "SG", dial: "+65", flag: "🇸🇬" },
  { name: "France", code: "FR", dial: "+33", flag: "🇫🇷" },
  { name: "New Zealand", code: "NZ", dial: "+64", flag: "🇳🇿" }
];

// Update visibility of Navbar Admin Badges / Buttons
function updateAdminNavVisibility() {
  const isAdmin = !!(userProfile && userProfile.role === 'admin');
  const navAdminBtn = document.getElementById('nav-admin-btn');
  const mobileNavAdminBtn = document.getElementById('mobile-nav-admin-btn');

  if (navAdminBtn) {
    if (isAdmin) {
      navAdminBtn.style.setProperty('display', 'inline-flex', 'important');
    } else {
      navAdminBtn.style.setProperty('display', 'none', 'important');
    }
  }

  if (mobileNavAdminBtn) {
    if (isAdmin) {
      mobileNavAdminBtn.style.setProperty('display', 'flex', 'important');
    } else {
      mobileNavAdminBtn.style.setProperty('display', 'none', 'important');
    }
  }
}

// Global Auth & Profile State
let currentUser = null;
let userProfile = null;
let isProfileLoading = false;
let currentAuthMode = 'login'; // 'login' | 'signup'
let pendingVerificationEmail = null;

// Initialize Supabase Auth Session and Listen for State Changes
async function initSupabaseAuth() {
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      currentUser = session?.user || null;

      if (currentUser) {
        await fetchOrCreateUserProfile(currentUser);
        if (typeof fetchOrdersForUser === 'function') {
          await fetchOrdersForUser(currentUser.id);
        }
        if (typeof subscribeToUserOrders === 'function') {
          subscribeToUserOrders(currentUser.id, () => {
            const profileModal = document.getElementById('profile-modal');
            if (profileModal && profileModal.classList.contains('opacity-100')) {
              renderProfileMain();
            }
          });
        }
      } else {
        userProfile = null;
      }
      updateAdminNavVisibility();

      supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        currentUser = session?.user || null;
        if (currentUser) {
          await fetchOrCreateUserProfile(currentUser);
          if (typeof fetchOrdersForUser === 'function') {
            await fetchOrdersForUser(currentUser.id);
          }
          if (typeof subscribeToUserOrders === 'function') {
            subscribeToUserOrders(currentUser.id, () => {
              const profileModal = document.getElementById('profile-modal');
              if (profileModal && profileModal.classList.contains('opacity-100')) {
                renderProfileMain();
              }
            });
          }
        } else {
          userProfile = null;
          if (typeof clearUserOrderState === 'function') {
            clearUserOrderState();
          }
        }

        updateAdminNavVisibility();

        const profileModal = document.getElementById('profile-modal');
        if (profileModal && profileModal.classList.contains('opacity-100')) {
          renderProfileMain();
        }
      });
    } catch (err) {
      console.warn("Could not retrieve Supabase session:", err);
      updateAdminNavVisibility();
    }
  } else {
    updateAdminNavVisibility();
  }
}

// Fetch user authorization role from public.user_roles table
async function fetchUserRole(userId) {
  if (!userId || typeof supabaseClient === 'undefined' || !supabaseClient) return 'customer';
  try {
    const { data, error } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (error) {
      return 'customer';
    }

    if (Array.isArray(data) && data.some(r => r.role === 'admin')) {
      return 'admin';
    }
    return 'customer';
  } catch (err) {
    return 'customer';
  }
}

// Fetch Profile from Supabase `profiles` table or create/upsert one if it doesn't exist
async function fetchOrCreateUserProfile(user, extraMetadata = null) {
  if (!user || !supabaseClient) return null;

  try {
    isProfileLoading = true;

    // 1. Query the existing `profiles` table for this authenticated user ID (id, full_name, email, phone, created_at, updated_at)
    const { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('id, full_name, email, phone, created_at, updated_at')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.warn("Supabase profiles table query note:", error.message);
    }

    // 2. Fetch role from user_roles
    const role = await fetchUserRole(user.id);

    if (profile && profile.full_name) {
      userProfile = {
        ...profile,
        role: role
      };
      isProfileLoading = false;
      updateAdminNavVisibility();
      return userProfile;
    }

    // 3. If profile is missing or needs creation, build payload using verified columns
    const meta = user.user_metadata || {};
    const firstName = extraMetadata?.firstName || meta.first_name || '';
    const lastName = extraMetadata?.lastName || meta.last_name || '';
    const fullName = extraMetadata?.fullName || meta.full_name || (firstName ? `${firstName} ${lastName}`.trim() : user.email.split('@')[0]);
    const dialCode = extraMetadata?.dialCode || meta.dial_code || '+91';
    const rawPhone = extraMetadata?.phone || meta.phone || '';
    const formattedPhone = rawPhone ? (rawPhone.startsWith('+') ? rawPhone : `${dialCode} ${rawPhone}`.trim()) : '';

    const newProfileData = {
      id: user.id,
      full_name: fullName || 'Brew & Bite Member',
      email: user.email,
      phone: formattedPhone,
      updated_at: new Date().toISOString()
    };

    const { data: insertedProfile, error: insertError } = await supabaseClient
      .from('profiles')
      .upsert(newProfileData)
      .select()
      .maybeSingle();

    if (insertError) {
      console.error("Could not upsert into Supabase profiles table:", insertError.message);
      userProfile = {
        ...newProfileData,
        role: role
      };
    } else {
      userProfile = {
        ...(insertedProfile || newProfileData),
        role: role
      };
      console.log("Profile successfully synchronized to Supabase:", userProfile);
    }

    isProfileLoading = false;
    updateAdminNavVisibility();
    return userProfile;
  } catch (err) {
    console.warn("Error handling Supabase profile:", err);
    userProfile = {
      id: user.id,
      full_name: user.user_metadata?.full_name || user.email.split('@')[0] || 'Brew & Bite Member',
      email: user.email,
      role: 'customer'
    };
    isProfileLoading = false;
    updateAdminNavVisibility();
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

  // If user is authenticated, ensure profile and user-specific orders are loaded
  if (currentUser) {
    if (!userProfile && !isProfileLoading) {
      await fetchOrCreateUserProfile(currentUser);
    }
    if (typeof fetchOrdersForUser === 'function') {
      await fetchOrdersForUser(currentUser.id);
    }
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
    const displayCountry = currentUser.user_metadata?.country || '';
    const displayPhone = userProfile?.phone || (currentUser.user_metadata?.phone ? `${currentUser.user_metadata?.dial_code || ''} ${currentUser.user_metadata?.phone}`.trim() : '');
    const initial = displayName.charAt(0).toUpperCase();

    // Retrieve user's isolated orders from orders.js (authoritative from Supabase)
    const orders = (typeof getOrders === 'function') ? getOrders() : [];

    let ordersHTML = '';
    if (orders.length === 0) {
      ordersHTML = `
        <div class="flex flex-col items-center justify-center text-center py-8 px-4 bg-surface/50 border border-outline-variant/20 rounded-2xl">
          <div class="w-14 h-14 bg-secondary-container/20 text-secondary rounded-full flex items-center justify-center mb-2.5">
            <span class="material-symbols-outlined text-2xl">receipt_long</span>
          </div>
          <h4 class="font-display text-base font-bold text-primary mb-1">No orders yet</h4>
          <p class="font-body-md text-xs text-on-surface-variant max-w-xs mb-4">Your completed orders will appear here.</p>
          <button id="profile-browse-menu-btn" class="bg-secondary-container text-on-secondary-container hover:bg-tertiary hover:text-on-tertiary font-label-bold text-xs py-2 px-5 rounded-full transition-all duration-200 shadow-sm cursor-pointer active:scale-95">
            <span>Browse Menu</span>
          </button>
        </div>
      `;
    } else {
      ordersHTML = `
        <div class="flex flex-col gap-2.5 max-h-[280px] overflow-y-auto pr-1">
          ${orders.map(order => {
            const totalItems = Array.isArray(order.items)
              ? order.items.reduce((sum, item) => sum + (item.quantity || 1), 0)
              : 0;

            const dateStr = order.createdAt
              ? new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
              : 'Recent Order';

            return `
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-surface border border-outline-variant/20 shadow-xs hover:border-outline-variant/40 transition-colors">
                <div class="flex flex-col gap-0.5">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-display font-bold text-primary text-xs sm:text-sm">${order.orderId}</span>
                    <span class="bg-secondary/15 text-secondary font-label-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full">${order.status || 'placed'}</span>
                  </div>
                  <p class="text-[11px] text-on-surface-variant font-body-md">${dateStr} • ${totalItems} item${totalItems === 1 ? '' : 's'}</p>
                </div>

                <div class="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 border-outline-variant/15 pt-1.5 sm:pt-0">
                  <span class="font-display font-bold text-primary text-sm sm:text-base">$${Number(order.subtotal || 0).toFixed(2)}</span>
                  <button data-order-id="${order.orderId}" class="view-order-btn bg-secondary-container text-on-secondary-container hover:bg-tertiary hover:text-on-tertiary font-label-bold text-xs py-1.5 px-3.5 rounded-full transition-all duration-200 shadow-xs cursor-pointer active:scale-95">
                    <span>View Order</span>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    const isAdmin = userProfile?.role === 'admin';

    profileContent.innerHTML = `
      <div class="flex flex-col gap-5">
        
        <!-- Logged-in Customer Information Card (Populated from Supabase profiles table) -->
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-surface border border-outline-variant/25 shadow-xs">
          <div class="flex items-center gap-3.5">
            <div class="w-12 h-12 rounded-2xl bg-secondary-container text-on-secondary-container flex items-center justify-center font-display font-black text-lg shadow-xs">
              ${initial}
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-display text-base sm:text-lg font-bold text-primary">${displayName}</h3>
                ${isAdmin ? `<span class="px-2.5 py-0.5 rounded-full bg-tertiary/15 border border-tertiary/30 text-tertiary font-label-bold text-[10px] uppercase tracking-wider">Admin</span>` : ''}
              </div>
              <p class="text-xs text-on-surface-variant font-medium">${displayEmail}</p>
              ${displayCountry || displayPhone ? `
                <div class="flex items-center gap-2 mt-1 text-[11px] text-on-surface-variant font-medium">
                  ${displayCountry ? `<span class="bg-surface-container-high/60 px-2 py-0.5 rounded-md border border-outline-variant/20">${displayCountry}</span>` : ''}
                  ${displayPhone ? `<span>${displayPhone}</span>` : ''}
                </div>
              ` : ''}
            </div>
          </div>

          <div class="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            ${isAdmin ? `
              <button id="profile-open-admin-btn" class="bg-primary text-on-primary hover:bg-tertiary font-label-bold text-xs py-1.5 px-3.5 rounded-full transition-all duration-200 shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95">
                <span class="material-symbols-outlined text-sm">dashboard</span>
                <span>Admin Dashboard</span>
              </button>
            ` : `
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary/15 border border-secondary/30 text-secondary font-label-bold text-[10px] uppercase tracking-wider">
                <span>Verified Account</span>
              </span>
            `}
            <button id="auth-signout-btn" class="text-xs text-on-surface-variant hover:text-red-600 flex items-center gap-1 font-label-bold border border-outline-variant/40 hover:border-red-300 px-3 py-1.5 rounded-full transition-colors cursor-pointer active:scale-95">
              <span>Sign Out</span>
              <span class="material-symbols-outlined text-sm">logout</span>
            </button>
          </div>
        </div>

        <!-- My Orders Section (User Isolated & Persistent via Supabase) -->
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between border-b border-outline-variant/20 pb-2">
            <h3 class="font-display text-base sm:text-lg font-bold text-primary">My Orders</h3>
            <span class="text-xs font-label-bold text-on-surface-variant">${orders.length} Order${orders.length === 1 ? '' : 's'} Total</span>
          </div>

          ${ordersHTML}
        </div>

      </div>
    `;

    // Admin Dashboard Button Listener
    const adminBtn = document.getElementById('profile-open-admin-btn');
    if (adminBtn) {
      adminBtn.addEventListener('click', () => {
        if (typeof openAdminDashboard === 'function') {
          openAdminDashboard();
        }
      });
    }

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
    <div class="flex flex-col gap-5 max-w-md mx-auto py-1">
      <div class="text-center">
        <div class="w-12 h-12 bg-secondary-container/20 text-secondary rounded-full flex items-center justify-center mx-auto mb-2.5">
          <span class="material-symbols-outlined text-2xl">account_circle</span>
        </div>
        <h3 class="font-display text-xl sm:text-2xl font-bold text-primary mb-1">
          ${currentAuthMode === 'login' ? 'Welcome Back' : 'Join Brew & Bite'}
        </h3>
        <p class="font-body-md text-xs text-on-surface-variant">
          ${currentAuthMode === 'login' ? 'Sign in to access your saved profile & order history.' : 'Create an account to track orders and save your favorites.'}
        </p>
      </div>

      ${pendingVerificationEmail ? `
        <!-- Email Verification Banner -->
        <div class="bg-secondary/15 border border-secondary/35 rounded-2xl p-3.5 text-xs text-primary flex items-start gap-2.5">
          <span class="material-symbols-outlined text-secondary text-lg flex-shrink-0 mt-0.5">mark_email_read</span>
          <div>
            <strong class="block font-label-bold text-primary mb-0.5">Verification Email Sent!</strong>
            <span>We sent a confirmation link to <strong class="text-secondary">${pendingVerificationEmail}</strong>. Please verify your email before signing in.</span>
          </div>
        </div>
      ` : ''}

      <!-- Auth Form -->
      <form id="auth-form" class="flex flex-col gap-3.5">
        ${currentAuthMode === 'signup' ? `
          <!-- First & Last Name (2 columns) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label for="auth-first-name" class="block font-label-bold text-[11px] text-primary mb-1 uppercase tracking-wider">First Name *</label>
              <input type="text" id="auth-first-name" required placeholder="e.g. Lakshpreet" class="w-full px-3.5 py-2 rounded-2xl bg-surface border border-outline-variant/40 focus:border-tertiary focus:ring-2 focus:ring-tertiary/20 outline-none transition-all text-xs text-on-surface" />
            </div>
            <div>
              <label for="auth-last-name" class="block font-label-bold text-[11px] text-primary mb-1 uppercase tracking-wider">Last Name *</label>
              <input type="text" id="auth-last-name" required placeholder="e.g. Kaur" class="w-full px-3.5 py-2 rounded-2xl bg-surface border border-outline-variant/40 focus:border-tertiary focus:ring-2 focus:ring-tertiary/20 outline-none transition-all text-xs text-on-surface" />
            </div>
          </div>

          <!-- Country & Phone Number (Country-Aware) -->
          <div>
            <label for="auth-country" class="block font-label-bold text-[11px] text-primary mb-1 uppercase tracking-wider">Country *</label>
            <select id="auth-country" class="w-full px-3.5 py-2 rounded-2xl bg-surface border border-outline-variant/40 focus:border-tertiary focus:ring-2 focus:ring-tertiary/20 outline-none transition-all text-xs text-on-surface cursor-pointer">
              ${COUNTRIES.map(c => `<option value="${c.name}" data-dial="${c.dial}">${c.flag} ${c.name} (${c.dial})</option>`).join('')}
            </select>
          </div>

          <div>
            <label for="auth-phone" class="block font-label-bold text-[11px] text-primary mb-1 uppercase tracking-wider">Phone Number *</label>
            <div class="flex items-center gap-2">
              <span id="auth-dial-code-badge" class="px-3 py-2 rounded-2xl bg-surface border border-outline-variant/40 text-xs font-bold text-primary select-none">+91</span>
              <input type="tel" id="auth-phone" required placeholder="e.g. 9876543210" class="flex-1 px-3.5 py-2 rounded-2xl bg-surface border border-outline-variant/40 focus:border-tertiary focus:ring-2 focus:ring-tertiary/20 outline-none transition-all text-xs text-on-surface" />
            </div>
          </div>
        ` : ''}

        <div>
          <label for="auth-email" class="block font-label-bold text-[11px] text-primary mb-1 uppercase tracking-wider">Email Address *</label>
          <input type="email" id="auth-email" required placeholder="e.g. laksh@example.com" class="w-full px-3.5 py-2 rounded-2xl bg-surface border border-outline-variant/40 focus:border-tertiary focus:ring-2 focus:ring-tertiary/20 outline-none transition-all text-xs text-on-surface" />
        </div>

        <div>
          <label for="auth-password" class="block font-label-bold text-[11px] text-primary mb-1 uppercase tracking-wider">Password *</label>
          <input type="password" id="auth-password" required minlength="6" placeholder="Minimum 6 characters" class="w-full px-3.5 py-2 rounded-2xl bg-surface border border-outline-variant/40 focus:border-tertiary focus:ring-2 focus:ring-tertiary/20 outline-none transition-all text-xs text-on-surface" />
        </div>

        <!-- Status / Error Notification Paragraph -->
        <p id="auth-status-msg" class="hidden text-xs font-medium text-center"></p>

        <!-- Submit Button -->
        <button type="submit" id="auth-submit-btn" class="w-full mt-1.5 bg-tertiary text-on-tertiary font-label-bold text-xs sm:text-sm py-2.5 px-6 rounded-full hover:scale-102 transition-all duration-200 shadow-md pink-glow flex items-center justify-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50">
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

  // Attach Country Selector Change Listener
  const countrySelect = document.getElementById('auth-country');
  const dialBadge = document.getElementById('auth-dial-code-badge');
  if (countrySelect && dialBadge) {
    countrySelect.addEventListener('change', () => {
      const selectedOption = countrySelect.options[countrySelect.selectedIndex];
      const dial = selectedOption.getAttribute('data-dial') || '+91';
      dialBadge.textContent = dial;
    });
  }

  // Attach Form Submit Listener
  const authForm = document.getElementById('auth-form');
  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('auth-email')?.value.trim();
      const password = document.getElementById('auth-password')?.value;

      if (currentAuthMode === 'login') {
        handleSignIn(email, password);
      } else {
        const firstName = document.getElementById('auth-first-name')?.value.trim() || '';
        const lastName = document.getElementById('auth-last-name')?.value.trim() || '';
        const country = countrySelect ? countrySelect.value : 'India';
        const dialCode = dialBadge ? dialBadge.textContent : '+91';
        const phone = document.getElementById('auth-phone')?.value.trim() || '';
        handleSignUp(email, password, firstName, lastName, country, dialCode, phone);
      }
    });
  }

  // Attach Toggle Mode Listener
  const toggleBtn = document.getElementById('auth-toggle-mode-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      currentAuthMode = currentAuthMode === 'login' ? 'signup' : 'login';
      pendingVerificationEmail = null;
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
      // Check for unverified email error
      if (error.message.toLowerCase().includes('email not confirmed') || error.message.toLowerCase().includes('not verified')) {
        if (statusMsg) {
          statusMsg.textContent = 'Please verify your email before signing in. Check your inbox for the confirmation link.';
          statusMsg.className = 'text-xs text-secondary font-bold text-center';
          statusMsg.classList.remove('hidden');
        }
      } else {
        if (statusMsg) {
          statusMsg.textContent = error.message;
          statusMsg.className = 'text-xs text-red-600 font-medium text-center';
          statusMsg.classList.remove('hidden');
        }
      }
    } else {
      currentUser = data.user;
      pendingVerificationEmail = null;
      await fetchOrCreateUserProfile(currentUser);
      if (typeof fetchOrdersForUser === 'function') {
        await fetchOrdersForUser(currentUser.id);
      }
      updateAdminNavVisibility();
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

// Handle Real Supabase Sign Up (Email/Password with Full Country, Phone & Metadata)
async function handleSignUp(email, password, firstName, lastName, country, dialCode, phone) {
  const statusMsg = document.getElementById('auth-status-msg');
  const submitBtn = document.getElementById('auth-submit-btn');

  if (!email || !password || !firstName || !lastName || !phone) {
    if (statusMsg) {
      statusMsg.textContent = 'Please fill all required fields.';
      statusMsg.className = 'text-xs text-red-600 font-medium text-center';
      statusMsg.classList.remove('hidden');
    }
    return;
  }

  // Basic phone length validation
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.length < 6 || cleanPhone.length > 15) {
    if (statusMsg) {
      statusMsg.textContent = 'Please enter a valid phone number.';
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

  const fullName = `${firstName} ${lastName}`.trim();
  const formattedPhone = `${dialCode} ${phone}`.trim();

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          country: country,
          dial_code: dialCode,
          phone: formattedPhone
        }
      }
    });

    if (error) {
      if (statusMsg) {
        statusMsg.textContent = error.message;
        statusMsg.className = 'text-xs text-red-600 font-medium text-center';
        statusMsg.classList.remove('hidden');
      }
    } else {
      // If session is immediately returned (Email confirmation disabled or auto-confirmed)
      if (data.session && data.user) {
        currentUser = data.user;
        await fetchOrCreateUserProfile(currentUser, { firstName, lastName, fullName, country, dialCode, phone: formattedPhone });
        if (typeof fetchOrdersForUser === 'function') {
          await fetchOrdersForUser(currentUser.id);
        }
        renderProfileMain();
      } else {
        // Email confirmation is required by Supabase Auth
        pendingVerificationEmail = email;
        currentAuthMode = 'login';
        renderProfileMain();
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

// Handle Real Supabase Sign Out (Purges Session State and In-Memory Orders)
async function handleSignOut() {
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      await supabaseClient.auth.signOut();
      currentUser = null;
      userProfile = null;
      pendingVerificationEmail = null;
      if (typeof clearUserOrderState === 'function') {
        clearUserOrderState();
      }
      console.log("Supabase Sign Out completed. In-memory session purged.");
      updateAdminNavVisibility();
      renderProfileMain();
    } catch (err) {
      console.warn("Sign Out error:", err);
    }
  }
}

// Render Specific Order Detail View with Visual Status Lifecycle Stepper
function openOrderDetail(orderId) {
  const profileContent = document.getElementById('profile-content');
  if (!profileContent || !orderId) return;

  const order = (typeof getOrderById === 'function') ? getOrderById(orderId) : null;

  if (!order) {
    profileContent.innerHTML = `
      <div class="text-center py-8">
        <p class="text-xs text-red-600 font-bold mb-4">Order not found.</p>
        <button id="back-to-orders-btn" class="bg-secondary-container text-on-secondary-container hover:bg-tertiary hover:text-on-tertiary font-label-bold text-xs py-2 px-5 rounded-full cursor-pointer">
          <span>← Back to Orders</span>
        </button>
      </div>
    `;
    const backBtn = document.getElementById('back-to-orders-btn');
    if (backBtn) backBtn.addEventListener('click', renderProfileMain);
    return;
  }

  const currentStatus = (order.status || 'placed').toLowerCase();
  const isCancelled = currentStatus === 'cancelled';
  const isCancellable = ['placed', 'pending', 'confirmed'].includes(currentStatus);

  // Status mapping for 5-stage progress indicator
  const stages = [
    { key: 'placed', label: 'Placed', icon: 'receipt' },
    { key: 'confirmed', label: 'Confirmed', icon: 'verified' },
    { key: 'preparing', label: 'Preparing', icon: 'coffee_maker' },
    { key: 'ready', label: (order.customer.orderType === 'delivery' ? 'Out for Delivery' : 'Ready'), icon: (order.customer.orderType === 'delivery' ? 'moped' : 'inventory_2') },
    { key: 'delivered', label: (order.customer.orderType === 'delivery' ? 'Delivered' : 'Completed'), icon: 'task_alt' }
  ];

  const stageKeys = ['placed', 'confirmed', 'preparing', 'ready', 'delivered'];
  let currentStageIndex = stageKeys.indexOf(currentStatus);
  if (currentStatus === 'pending') currentStageIndex = 0;
  if (currentStatus === 'completed') currentStageIndex = 4;
  if (currentStageIndex === -1 && !isCancelled) currentStageIndex = 0;

  // Render Visual Stepper
  let stepperHTML = '';
  if (isCancelled) {
    stepperHTML = `
      <div class="p-4 rounded-2xl bg-red-50/80 border border-red-200 text-center flex items-center justify-center gap-3">
        <span class="material-symbols-outlined text-red-600 text-2xl">cancel</span>
        <div class="text-left">
          <h4 class="font-display font-bold text-sm text-red-800">Order Cancelled</h4>
          <p class="text-xs text-red-600 font-medium">This order was cancelled before preparation began.</p>
        </div>
      </div>
    `;
  } else {
    const stepsItemsHTML = stages.map((st, idx) => {
      const isCompleted = idx <= currentStageIndex;
      const isCurrent = idx === currentStageIndex;
      
      const circleClass = isCurrent
        ? 'bg-tertiary text-on-tertiary ring-4 ring-tertiary/20 shadow-md scale-110'
        : (isCompleted ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant/50');
      
      const labelClass = isCurrent
        ? 'text-primary font-black'
        : (isCompleted ? 'text-primary font-bold' : 'text-on-surface-variant/60 font-medium');

      return `
        <div class="flex flex-col items-center text-center flex-1 relative z-10">
          <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all duration-300 ${circleClass}">
            <span class="material-symbols-outlined text-sm sm:text-base">${st.icon}</span>
          </div>
          <span class="text-[10px] sm:text-[11px] mt-2 leading-tight ${labelClass}">${st.label}</span>
        </div>
      `;
    }).join('');

    const progressPercent = Math.max(0, Math.min(100, (currentStageIndex / (stages.length - 1)) * 100));

    stepperHTML = `
      <div class="bg-surface rounded-2xl p-4 sm:p-5 border border-outline-variant/30 shadow-xs flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-label-bold text-primary uppercase tracking-wider">Live Order Progress</span>
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-label-bold uppercase tracking-wider ${getStatusBadgeClass(order.status)}">${order.status || 'placed'}</span>
        </div>

        <div class="relative flex items-center justify-between pt-2 pb-1">
          <!-- Background Progress Bar Track -->
          <div class="absolute left-6 right-6 top-[22px] sm:top-[24px] h-1 bg-surface-container-high rounded-full -z-0">
            <div class="h-full bg-primary rounded-full transition-all duration-500" style="width: ${progressPercent}%;"></div>
          </div>
          ${stepsItemsHTML}
        </div>
      </div>
    `;
  }

  const formattedDate = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Recent Order';

  const itemsListHTML = Array.isArray(order.items)
    ? order.items.map(item => `
        <div class="flex items-center justify-between py-1.5 border-b border-outline-variant/15 text-xs">
          <div>
            <h5 class="font-display font-bold text-primary text-xs">${item.name || item.productId}</h5>
            <p class="text-[11px] text-on-surface-variant">$${Number(item.unitPrice || 0).toFixed(2)} × ${item.quantity}</p>
          </div>
          <span class="font-label-bold text-primary text-xs">$${Number(item.lineTotal || 0).toFixed(2)}</span>
        </div>
      `).join('')
    : '<p class="text-xs text-on-surface-variant">No items recorded.</p>';

  profileContent.innerHTML = `
    <div class="flex flex-col gap-4">
      
      <!-- Back Navigation Header -->
      <div class="flex items-center justify-between border-b border-outline-variant/20 pb-2.5">
        <button id="back-to-orders-btn" class="inline-flex items-center gap-1.5 text-xs font-label-bold text-primary hover:text-tertiary transition-colors cursor-pointer py-1">
          <span class="material-symbols-outlined text-sm">arrow_back</span>
          <span>Back to Orders</span>
        </button>
        <span class="text-xs font-bold text-on-surface-variant">Ref: <strong class="text-primary font-display">${order.orderId}</strong></span>
      </div>

      <!-- Stepper Tracking Widget -->
      ${stepperHTML}

      <!-- Order Summary Card -->
      <div class="p-4 sm:p-5 rounded-2xl bg-surface border border-outline-variant/30 flex flex-col gap-3.5 shadow-xs">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/15 pb-2.5">
          <div>
            <span class="text-[11px] text-on-surface-variant uppercase font-label-bold tracking-wider">Order Reference</span>
            <h4 class="font-display text-base sm:text-lg font-black text-primary">${order.orderId}</h4>
          </div>
          <div class="text-left sm:text-right">
            <span class="text-[11px] text-on-surface-variant uppercase font-label-bold tracking-wider">Date &amp; Time</span>
            <p class="text-xs font-medium text-primary">${formattedDate}</p>
          </div>
        </div>

        <!-- Customer & Delivery Info -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs bg-surface-container-high/30 p-3 rounded-xl border border-outline-variant/15">
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
          <span class="text-[11px] text-on-surface-variant uppercase font-label-bold tracking-wider mb-0.5">Purchased Items</span>
          <div class="max-h-[140px] overflow-y-auto pr-1">
            ${itemsListHTML}
          </div>
        </div>

        <!-- Total Calculation -->
        <div class="border-t border-outline-variant/20 pt-2.5 flex items-center justify-between">
          <span class="font-display font-bold text-xs sm:text-sm text-primary">Subtotal Paid</span>
          <span class="font-display font-black text-base sm:text-lg text-primary">$${Number(order.subtotal || 0).toFixed(2)}</span>
        </div>
      </div>

      <!-- Order Cancellation Action Panel -->
      ${isCancellable ? `
        <div class="p-3.5 bg-surface rounded-2xl border border-outline-variant/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div>
            <span class="font-bold text-xs text-primary block">Need to make changes?</span>
            <span class="text-[11px] text-on-surface-variant">You can cancel this order before kitchen preparation begins.</span>
          </div>
          <button id="cancel-order-btn" data-order-id="${order.orderId}" class="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-label-bold px-4 py-2 rounded-full transition-all cursor-pointer active:scale-95 self-start sm:self-auto">
            <span>Cancel Order</span>
          </button>
        </div>
      ` : (!isCancelled ? `
        <div class="p-3 bg-surface-container-high/30 rounded-2xl border border-outline-variant/15 flex items-center gap-2 text-xs text-on-surface-variant">
          <span class="material-symbols-outlined text-base text-secondary">lock</span>
          <span>Kitchen preparation has begun. This order can no longer be cancelled.</span>
        </div>
      ` : '')}

    </div>
  `;

  const backBtn = document.getElementById('back-to-orders-btn');
  if (backBtn) {
    backBtn.addEventListener('click', renderProfileMain);
  }

  // Attach Cancel Order Action Listener
  const cancelBtn = document.getElementById('cancel-order-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', async () => {
      if (!confirm("Are you sure you want to cancel this order? This action cannot be undone.")) return;

      cancelBtn.disabled = true;
      cancelBtn.innerHTML = '<span>Cancelling...</span>';

      try {
        if (typeof cancelOrderInSupabase === 'function') {
          await cancelOrderInSupabase(order.orderId);
        }
        // Re-render current order detail view to show cancelled state
        openOrderDetail(order.orderId);
      } catch (err) {
        alert(err.message || "Failed to cancel order.");
        cancelBtn.disabled = false;
        cancelBtn.innerHTML = '<span>Cancel Order</span>';
      }
    });
  }
}

// Helper to get status badge CSS class
function getStatusBadgeClass(status) {
  switch ((status || '').toLowerCase()) {
    case 'delivered':
    case 'completed':
      return 'bg-green-100 text-green-800 border border-green-300';
    case 'ready':
      return 'bg-blue-100 text-blue-800 border border-blue-300';
    case 'preparing':
      return 'bg-amber-100 text-amber-800 border border-amber-300';
    case 'confirmed':
      return 'bg-purple-100 text-purple-800 border border-purple-300';
    case 'cancelled':
      return 'bg-red-100 text-red-800 border border-red-300';
    default:
      return 'bg-secondary/15 text-secondary border border-secondary/30';
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
