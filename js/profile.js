/**
 * Brew & Bite - Customer Profile, Dashboard, Address Book & Account Security (profile.js)
 * Production-ready customer dashboard integrated with Supabase Auth, profiles, and addresses.
 *
 * Supabase Schema:
 * - public.profiles: (id, full_name, email, phone, created_at, updated_at)
 * - public.addresses: (id, user_id, full_name, phone, address_line_1, address_line_2, city, state, postal_code, country, is_default, created_at, updated_at)
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

// Global Auth & Profile State
let currentUser = null;
let userProfile = null;
let isProfileLoading = false;
let currentAuthMode = 'login'; // 'login' | 'signup' | 'forgot_password' | 'reset_password'
let profileActiveTab = 'dashboard'; // 'dashboard' | 'orders' | 'addresses' | 'details' | 'security'
let pendingVerificationEmail = null;
let authNotificationMsg = null;
let editingAddressId = null; // null for new address, or ID for editing
let isPasswordRecoveryMode = false;

// Immediate Detection of Recovery Token at Script Load Time (checks early bootstrap and live URL)
const initLocationHash = window.location.hash || '';
const initLocationSearch = window.location.search || '';
const isInitialRecoveryDetected = (
  window.__bb_recovery_detected ||
  initLocationHash.includes('type=recovery') ||
  initLocationSearch.includes('type=recovery') ||
  (initLocationHash.includes('access_token=') && initLocationHash.includes('type=recovery'))
);

if (isInitialRecoveryDetected) {
  isPasswordRecoveryMode = true;
  currentAuthMode = 'reset_password';
  console.log("[Auth Recovery Stage 2: URL/Token] Recovery tokens detected at page load.");
  console.log("[Auth Recovery Stage 4: currentAuthMode] currentAuthMode set to:", currentAuthMode);
  console.log("[Auth Recovery Stage 5: isPasswordRecoveryMode] isPasswordRecoveryMode set to:", isPasswordRecoveryMode);
}

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

// Initialize Supabase Auth Session and Listen for State Changes
async function initSupabaseAuth() {
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      const currentHash = window.location.hash || '';
      const currentSearch = window.location.search || '';
      if (
        window.__bb_recovery_detected ||
        currentHash.includes('type=recovery') ||
        currentSearch.includes('type=recovery') ||
        (currentHash.includes('access_token=') && currentHash.includes('type=recovery'))
      ) {
        isPasswordRecoveryMode = true;
        currentAuthMode = 'reset_password';
        console.log("[Auth Recovery Stage 2: URL/Token] Recovery state verified during auth initialization.");
      }

      // Register onAuthStateChange immediately
      supabaseClient.auth.onAuthStateChange(async (event, session) => {
        console.log(`[Supabase Auth Event] ${event}`);

        if (event === 'PASSWORD_RECOVERY') {
          console.log("[Auth Recovery Stage 3: PASSWORD_RECOVERY event] Event received:", event, "User:", session?.user?.email);
          isPasswordRecoveryMode = true;
          currentAuthMode = 'reset_password';
          currentUser = session?.user || null;
          console.log("[Auth Recovery Stage 4: currentAuthMode] currentAuthMode:", currentAuthMode);
          console.log("[Auth Recovery Stage 5: isPasswordRecoveryMode] isPasswordRecoveryMode:", isPasswordRecoveryMode);
          console.log("[Auth Recovery Stage 6: renderProfileMain] Triggering openProfile() from PASSWORD_RECOVERY event.");
          openProfile();
          return;
        }

        if (isPasswordRecoveryMode || currentAuthMode === 'reset_password') {
          console.log("[Auth Recovery Stage 3: PASSWORD_RECOVERY event] Recovery mode active; retaining reset view during event:", event);
          currentUser = session?.user || null;
          openProfile();
          return;
        }

        currentUser = session?.user || null;
        if (currentUser) {
          await fetchOrCreateUserProfile(currentUser);
          if (typeof fetchOrdersForUser === 'function') {
            await fetchOrdersForUser(currentUser.id);
          }
          if (typeof fetchUserAddresses === 'function') {
            await fetchUserAddresses(currentUser.id);
          }
          if (typeof subscribeToUserOrders === 'function') {
            subscribeToUserOrders(currentUser.id, () => {
              const profileModal = document.getElementById('profile-modal');
              if (profileModal && profileModal.classList.contains('opacity-100')) {
                renderProfileMain();
              }
            });
          }
          if (typeof fetchUserNotifications === 'function') {
            fetchUserNotifications(currentUser.id);
          }
          if (typeof subscribeToUserNotifications === 'function') {
            subscribeToUserNotifications(currentUser.id);
          }
        } else {
          userProfile = null;
          if (typeof clearUserOrderState === 'function') {
            clearUserOrderState();
          }
          if (typeof clearNotificationState === 'function') {
            clearNotificationState();
          }
          if (typeof clearUserAddresses === 'function') {
            clearUserAddresses();
          }
        }

        updateAdminNavVisibility();

        const profileModal = document.getElementById('profile-modal');
        if (profileModal && profileModal.classList.contains('opacity-100')) {
          renderProfileMain();
        }
      });

      // Get initial session
      const { data: { session } } = await supabaseClient.auth.getSession();
      
      if (isPasswordRecoveryMode || currentAuthMode === 'reset_password') {
        console.log("[Auth Recovery] Recovery session established");
        currentUser = session?.user || null;
        console.log("[Auth Recovery] Showing password reset form");
        openProfile();
        return;
      }

      currentUser = session?.user || null;
      if (currentUser) {
        await fetchOrCreateUserProfile(currentUser);
        if (typeof fetchOrdersForUser === 'function') {
          await fetchOrdersForUser(currentUser.id);
        }
        if (typeof fetchUserAddresses === 'function') {
          await fetchUserAddresses(currentUser.id);
        }
        if (typeof fetchUserNotifications === 'function') {
          fetchUserNotifications(currentUser.id);
        }
      } else {
        userProfile = null;
        if (typeof clearNotificationState === 'function') {
          clearNotificationState();
        }
        if (typeof clearUserAddresses === 'function') {
          clearUserAddresses();
        }
      }
      updateAdminNavVisibility();
    } catch (err) {
      console.error("Supabase Auth Initialization error:", err);
    }
  }
}

// Fetch Profile from Supabase `public.profiles`
async function fetchOrCreateUserProfile(user) {
  if (!user || !user.id || typeof supabaseClient === 'undefined' || !supabaseClient) return null;

  isProfileLoading = true;
  try {
    const { data: existingProfile, error: fetchError } = await supabaseClient
      .from('profiles')
      .select('id, full_name, email, phone, role')
      .eq('id', user.id)
      .maybeSingle();

    if (existingProfile) {
      userProfile = existingProfile;
      isProfileLoading = false;
      updateAdminNavVisibility();
      return userProfile;
    }

    // Role check from user_roles table or admin email match
    const adminEmails = ['lakshsadhioura03@gmail.com', 'admin@brewandbite.com'];
    const isAdminDefault = user.email && adminEmails.includes(user.email.toLowerCase());
    let role = isAdminDefault ? 'admin' : 'customer';

    const newProfileData = {
      id: user.id,
      full_name: user.user_metadata?.full_name || (user.email ? user.email.split('@')[0] : 'Brew & Bite Member'),
      email: user.email,
      phone: user.user_metadata?.phone || '',
      role: role,
      updated_at: new Date().toISOString()
    };

    const { data: insertedProfile } = await supabaseClient
      .from('profiles')
      .upsert(newProfileData)
      .select()
      .maybeSingle();

    userProfile = insertedProfile || newProfileData;
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

// Open Customer Profile Modal View
function openProfile() {
  const profileModal = document.getElementById('profile-modal');
  if (!profileModal) return;

  renderProfileMain();
  profileModal.classList.remove('opacity-0', 'pointer-events-none');
  profileModal.classList.add('opacity-100', 'pointer-events-auto');
  document.body.classList.add('overflow-hidden');
}

// Close Customer Profile Modal View
function closeProfile() {
  const profileModal = document.getElementById('profile-modal');
  if (!profileModal) return;

  profileModal.classList.remove('opacity-100', 'pointer-events-auto');
  profileModal.classList.add('opacity-0', 'pointer-events-none');
  document.body.classList.remove('overflow-hidden');
  authNotificationMsg = null;
  editingAddressId = null;
}

// Main Render Function for Profile Modal Content
function renderProfileMain() {
  const profileContent = document.getElementById('profile-content');
  if (!profileContent) return;

  const titleEl = document.getElementById('profile-title');
  const subtitleEl = document.getElementById('profile-subtitle');

  console.log("[Auth Recovery Stage 6: renderProfileMain] renderProfileMain called. Mode:", currentAuthMode, "isPasswordRecoveryMode:", isPasswordRecoveryMode, "User:", currentUser ? currentUser.email : null);

  // Priority 1: Password Recovery Mode (Always display Set New Password view regardless of temporary recovery session)
  if (isPasswordRecoveryMode || currentAuthMode === 'reset_password') {
    console.log("[Auth Recovery Stage 7: Form Render] Rendering Set New Password form into DOM.");
    if (titleEl) titleEl.textContent = 'Set New Password';
    if (subtitleEl) subtitleEl.textContent = 'Enter and confirm your new account password';

    profileContent.innerHTML = `
      <div class="flex flex-col gap-4 max-w-md mx-auto py-2">
        <div class="text-center">
          <div class="w-12 h-12 bg-secondary-container/20 text-secondary rounded-full flex items-center justify-center mx-auto mb-2 shadow-xs">
            <span class="material-symbols-outlined text-2xl text-secondary">lock_reset</span>
          </div>
          <h3 class="font-display text-xl font-bold text-primary">Set New Password</h3>
          <p class="font-body-md text-xs text-on-surface-variant mt-1">Please enter your new account password below.</p>
        </div>

        <form id="reset-password-form" class="flex flex-col gap-3.5">
          <div>
            <label class="font-label-bold text-xs text-primary block mb-1">New Password (min 6 characters) *</label>
            <input id="reset-pwd-new" type="password" required minlength="6" placeholder="••••••••" class="w-full text-xs px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-primary focus:outline-none focus:border-tertiary shadow-xs" />
          </div>

          <div>
            <label class="font-label-bold text-xs text-primary block mb-1">Confirm New Password *</label>
            <input id="reset-pwd-confirm" type="password" required minlength="6" placeholder="••••••••" class="w-full text-xs px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-primary focus:outline-none focus:border-tertiary shadow-xs" />
          </div>

          <p id="reset-pwd-feedback-msg" class="text-xs font-medium hidden text-center"></p>

          <button type="submit" id="reset-pwd-submit-btn" class="w-full bg-secondary-container text-on-secondary-container hover:bg-tertiary hover:text-on-tertiary font-label-bold text-xs py-3 px-4 rounded-full transition-all duration-200 shadow-sm mt-1 cursor-pointer active:scale-95">
            <span>Save New Password</span>
          </button>
        </form>

        <div class="text-center pt-2 border-t border-outline-variant/20">
          <button id="reset-back-to-login-btn" class="font-label-bold text-xs text-secondary hover:text-tertiary transition-colors cursor-pointer underline">
            ← Back to Sign In
          </button>
        </div>
      </div>
    `;
    attachResetPasswordEvents();
    return;
  }

  // Priority 2: Forgot Password Email Request Mode
  if (currentAuthMode === 'forgot_password') {
    if (titleEl) titleEl.textContent = 'Password Recovery';
    if (subtitleEl) subtitleEl.textContent = 'Send a password recovery link to your email';

    profileContent.innerHTML = `
      <div class="flex flex-col gap-4 max-w-md mx-auto py-2">
        <div class="text-center">
          <div class="w-12 h-12 bg-secondary-container/20 text-secondary rounded-full flex items-center justify-center mx-auto mb-2">
            <span class="material-symbols-outlined text-2xl">mark_email_unread</span>
          </div>
          <h3 class="font-display text-xl font-bold text-primary">Recover Password</h3>
          <p class="font-body-md text-xs text-on-surface-variant mt-1">Enter your email and we'll send you a secure recovery link.</p>
        </div>

        <form id="forgot-password-form" class="flex flex-col gap-3.5">
          <div>
            <label class="font-label-bold text-xs text-primary block mb-1">Email Address</label>
            <input id="forgot-email" type="email" required placeholder="name@example.com" class="w-full text-xs px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-primary focus:outline-none focus:border-tertiary shadow-xs" />
          </div>

          <p id="forgot-feedback-msg" class="text-xs font-medium hidden text-center"></p>

          <button type="submit" id="forgot-submit-btn" class="w-full bg-secondary-container text-on-secondary-container hover:bg-tertiary hover:text-on-tertiary font-label-bold text-xs py-3 px-4 rounded-full transition-all duration-200 shadow-sm mt-1 cursor-pointer active:scale-95">
            <span>Send Recovery Email</span>
          </button>
        </form>

        <div class="text-center pt-2 border-t border-outline-variant/20">
          <button id="back-to-login-btn" class="font-label-bold text-xs text-secondary hover:text-tertiary transition-colors cursor-pointer underline">
            ← Back to Sign In
          </button>
        </div>
      </div>
    `;
    attachForgotPasswordEvents();
    return;
  }

  // Case 1: User is Logged In - Render Tabbed Customer Dashboard (unless in reset password recovery mode)
  if (currentUser && currentAuthMode !== 'reset_password') {
    const displayName = userProfile?.full_name || currentUser.user_metadata?.full_name || currentUser.email.split('@')[0] || 'Valued Member';
    const displayEmail = userProfile?.email || currentUser.email || '';
    const displayCountry = currentUser.user_metadata?.country || 'India';
    const displayPhone = userProfile?.phone || (currentUser.user_metadata?.phone ? `${currentUser.user_metadata?.dial_code || ''} ${currentUser.user_metadata?.phone}`.trim() : '');
    const initial = displayName.charAt(0).toUpperCase();
    const isAdmin = !!(userProfile && userProfile.role === 'admin');
    const isEmailConfirmed = !!currentUser.email_confirmed_at;

    const orders = (typeof getOrders === 'function') ? getOrders() : [];
    const addresses = (typeof getUserAddresses === 'function') ? getUserAddresses() : [];
    const defaultAddress = (typeof getDefaultAddress === 'function') ? getDefaultAddress() : null;
    const notifications = (typeof userNotifications !== 'undefined') ? userNotifications : [];
    const unreadNotifCount = notifications.filter(n => !n.read).length;

    const totalSpent = orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.subtotal || 0), 0);
    const activeOrder = orders.find(o => ['placed', 'confirmed', 'preparing', 'ready'].includes((o.status || '').toLowerCase()));

    // Update Modal Header dynamically
    if (titleEl) titleEl.textContent = isAdmin ? 'Admin Account' : 'Customer Account';
    if (subtitleEl) subtitleEl.textContent = isAdmin ? 'Store Owner Dashboard & Security' : 'Member Dashboard, Orders & Addresses';

    // Sub-tab Content Generator
    let tabBodyHTML = '';

    // TAB 1: DASHBOARD OVERVIEW
    if (profileActiveTab === 'dashboard') {
      tabBodyHTML = `
        <div class="flex flex-col gap-4">
          <!-- Summary Metrics Cards -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="p-3.5 rounded-2xl bg-surface border border-outline-variant/20 shadow-xs flex flex-col">
              <span class="text-[11px] text-on-surface-variant font-label-bold uppercase tracking-wider">Total Orders</span>
              <span class="font-display font-black text-xl text-primary mt-1">${orders.length}</span>
            </div>
            <div class="p-3.5 rounded-2xl bg-surface border border-outline-variant/20 shadow-xs flex flex-col">
              <span class="text-[11px] text-on-surface-variant font-label-bold uppercase tracking-wider">Lifetime Spend</span>
              <span class="font-display font-black text-xl text-primary mt-1">$${totalSpent.toFixed(2)}</span>
            </div>
            <div class="p-3.5 rounded-2xl bg-surface border border-outline-variant/20 shadow-xs flex flex-col">
              <span class="text-[11px] text-on-surface-variant font-label-bold uppercase tracking-wider">Addresses</span>
              <span class="font-display font-black text-xl text-primary mt-1">${addresses.length}</span>
            </div>
            <div class="p-3.5 rounded-2xl bg-surface border border-outline-variant/20 shadow-xs flex flex-col">
              <span class="text-[11px] text-on-surface-variant font-label-bold uppercase tracking-wider">Unread Alerts</span>
              <span class="font-display font-black text-xl text-primary mt-1">${unreadNotifCount}</span>
            </div>
          </div>

          <!-- Active Order Progress Tracker Shortcut (if any) -->
          ${activeOrder ? `
            <div class="p-4 rounded-2xl bg-secondary-container/20 border border-secondary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center flex-shrink-0 animate-pulse">
                  <span class="material-symbols-outlined text-xl">coffee_maker</span>
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-display font-bold text-xs sm:text-sm text-primary">Active Order: ${activeOrder.orderId}</span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-label-bold uppercase ${getStatusBadgeClass(activeOrder.status)}">${activeOrder.status}</span>
                  </div>
                  <p class="text-[11px] text-on-surface-variant mt-0.5">${activeOrder.items?.length || 1} item(s) • Total $${Number(activeOrder.subtotal || 0).toFixed(2)}</p>
                </div>
              </div>
              <button data-order-id="${activeOrder.orderId}" class="view-order-btn bg-tertiary text-on-tertiary font-label-bold text-xs py-2 px-4 rounded-full transition-all shadow-xs cursor-pointer active:scale-95 whitespace-nowrap self-start sm:self-auto">
                <span>Track Live Progress →</span>
              </button>
            </div>
          ` : ''}

          <!-- Quick Two-Column Cards: Default Delivery Address & Recent Order -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Default Address Card -->
            <div class="p-4 rounded-2xl bg-surface border border-outline-variant/25 flex flex-col justify-between shadow-xs">
              <div>
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-label-bold text-primary flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-base text-secondary">home_pin</span>
                    <span>Default Delivery Address</span>
                  </span>
                  <button data-profile-tab="addresses" class="profile-tab-btn text-[11px] font-label-bold text-secondary hover:text-tertiary cursor-pointer">Manage</button>
                </div>
                ${defaultAddress ? `
                  <p class="text-xs font-bold text-primary">${defaultAddress.full_name}</p>
                  <p class="text-[11px] text-on-surface-variant leading-relaxed mt-0.5">${defaultAddress.address_line_1}${defaultAddress.address_line_2 ? ', ' + defaultAddress.address_line_2 : ''}, ${defaultAddress.city}, ${defaultAddress.state || ''} ${defaultAddress.postal_code}</p>
                  <p class="text-[11px] text-on-surface-variant mt-0.5">${defaultAddress.phone}</p>
                ` : `
                  <p class="text-xs text-on-surface-variant py-2">No saved address yet.</p>
                  <button data-profile-tab="addresses" class="profile-tab-btn text-xs font-label-bold text-tertiary underline cursor-pointer">+ Add Delivery Address</button>
                `}
              </div>
            </div>

            <!-- Recent Orders Card with Quick Reorder -->
            <div class="p-4 rounded-2xl bg-surface border border-outline-variant/25 flex flex-col justify-between shadow-xs">
              <div>
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-label-bold text-primary flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-base text-secondary">history</span>
                    <span>Recent Order</span>
                  </span>
                  <button data-profile-tab="orders" class="profile-tab-btn text-[11px] font-label-bold text-secondary hover:text-tertiary cursor-pointer">View All (${orders.length})</button>
                </div>
                ${orders[0] ? `
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-xs font-bold text-primary">${orders[0].orderId}</p>
                      <p class="text-[11px] text-on-surface-variant">${orders[0].items?.length || 1} items • $${Number(orders[0].subtotal || 0).toFixed(2)}</p>
                    </div>
                    <button data-reorder-id="${orders[0].orderId}" class="reorder-order-btn bg-secondary-container text-on-secondary-container hover:bg-tertiary hover:text-on-tertiary text-xs font-label-bold px-3 py-1.5 rounded-full transition-all flex items-center gap-1 cursor-pointer">
                      <span class="material-symbols-outlined text-sm">replay</span>
                      <span>Reorder</span>
                    </button>
                  </div>
                ` : `
                  <p class="text-xs text-on-surface-variant py-2">No orders placed yet.</p>
                  <button id="profile-browse-menu-btn" class="text-xs font-label-bold text-tertiary underline cursor-pointer">Browse Menu</button>
                `}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // TAB 2: MY ORDERS WITH REORDER
    else if (profileActiveTab === 'orders') {
      if (orders.length === 0) {
        tabBodyHTML = `
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
        tabBodyHTML = `
          <div class="flex flex-col gap-2.5 max-h-[340px] overflow-y-auto pr-1">
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
                      <span class="px-2.5 py-0.5 rounded-full text-[10px] font-label-bold uppercase tracking-wider ${getStatusBadgeClass(order.status)}">${order.status || 'placed'}</span>
                      ${order.payment ? `
                        <span class="px-2 py-0.5 rounded-full text-[9px] font-label-bold uppercase ${order.payment.status === 'paid' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}">
                          ${order.payment.method === 'online' ? 'Online: ' : 'COD: '}${order.payment.status}
                        </span>
                      ` : ''}
                    </div>
                    <p class="text-[11px] text-on-surface-variant font-body-md">${dateStr} • ${totalItems} item${totalItems === 1 ? '' : 's'}</p>
                  </div>

                  <div class="flex items-center justify-between sm:justify-end gap-2.5 border-t sm:border-t-0 border-outline-variant/15 pt-1.5 sm:pt-0">
                    <span class="font-display font-bold text-primary text-sm sm:text-base mr-1">$${Number(order.subtotal || 0).toFixed(2)}</span>
                    <button data-reorder-id="${order.orderId}" class="reorder-order-btn bg-surface-container-high hover:bg-secondary-container text-primary text-xs font-label-bold py-1.5 px-3 rounded-full transition-all flex items-center gap-1 cursor-pointer">
                      <span class="material-symbols-outlined text-xs">replay</span>
                      <span>Reorder</span>
                    </button>
                    <button data-order-id="${order.orderId}" class="view-order-btn bg-secondary-container text-on-secondary-container hover:bg-tertiary hover:text-on-tertiary font-label-bold text-xs py-1.5 px-3 rounded-full transition-all shadow-xs cursor-pointer active:scale-95">
                      <span>Track</span>
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }
    }

    // TAB 3: SAVED ADDRESSES BOOK
    else if (profileActiveTab === 'addresses') {
      const editingAddress = editingAddressId ? addresses.find(a => a.id === editingAddressId) : null;

      tabBodyHTML = `
        <div class="flex flex-col gap-4">
          <!-- Address Form (Add or Edit) -->
          <div id="address-form-container" class="${editingAddressId !== null ? '' : 'hidden'} p-4 rounded-2xl bg-surface-container-high/30 border border-outline-variant/30 flex flex-col gap-3">
            <div class="flex items-center justify-between border-b border-outline-variant/20 pb-2">
              <h4 class="font-display font-bold text-xs sm:text-sm text-primary">${editingAddress ? 'Edit Delivery Address' : 'Add New Delivery Address'}</h4>
              <button id="cancel-address-form-btn" class="text-xs font-label-bold text-on-surface-variant hover:text-primary cursor-pointer">Cancel</button>
            </div>

            <form id="save-address-form" class="flex flex-col gap-3">
              <input type="hidden" id="addr-id" value="${editingAddress?.id || ''}" />
              
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label class="font-label-bold text-xs text-primary block mb-1">Recipient Name *</label>
                  <input id="addr-name" type="text" required value="${editingAddress?.full_name || displayName}" placeholder="Full Name" class="w-full text-xs px-3 py-2 rounded-xl bg-surface border border-outline-variant/40 text-primary" />
                </div>
                <div>
                  <label class="font-label-bold text-xs text-primary block mb-1">Contact Phone *</label>
                  <input id="addr-phone" type="tel" required value="${editingAddress?.phone || displayPhone}" placeholder="Phone Number" class="w-full text-xs px-3 py-2 rounded-xl bg-surface border border-outline-variant/40 text-primary" />
                </div>
              </div>

              <div>
                <label class="font-label-bold text-xs text-primary block mb-1">Street Address Line 1 *</label>
                <input id="addr-line1" type="text" required value="${editingAddress?.address_line_1 || ''}" placeholder="House/Flat No., Building Name, Street" class="w-full text-xs px-3 py-2 rounded-xl bg-surface border border-outline-variant/40 text-primary" />
              </div>

              <div>
                <label class="font-label-bold text-xs text-primary block mb-1">Address Line 2 (Optional)</label>
                <input id="addr-line2" type="text" value="${editingAddress?.address_line_2 || ''}" placeholder="Apartment, suite, unit, landmark" class="w-full text-xs px-3 py-2 rounded-xl bg-surface border border-outline-variant/40 text-primary" />
              </div>

              <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div>
                  <label class="font-label-bold text-xs text-primary block mb-1">City *</label>
                  <input id="addr-city" type="text" required value="${editingAddress?.city || ''}" placeholder="City" class="w-full text-xs px-3 py-2 rounded-xl bg-surface border border-outline-variant/40 text-primary" />
                </div>
                <div>
                  <label class="font-label-bold text-xs text-primary block mb-1">State / Province</label>
                  <input id="addr-state" type="text" value="${editingAddress?.state || ''}" placeholder="State" class="w-full text-xs px-3 py-2 rounded-xl bg-surface border border-outline-variant/40 text-primary" />
                </div>
                <div class="col-span-2 sm:col-span-1">
                  <label class="font-label-bold text-xs text-primary block mb-1">PIN / ZIP Code *</label>
                  <input id="addr-postal" type="text" required value="${editingAddress?.postal_code || ''}" placeholder="Postal Code" class="w-full text-xs px-3 py-2 rounded-xl bg-surface border border-outline-variant/40 text-primary" />
                </div>
              </div>

              <div class="flex items-center gap-2 mt-1">
                <input type="checkbox" id="addr-default" ${editingAddress?.is_default ? 'checked' : (addresses.length === 0 ? 'checked' : '')} class="text-tertiary focus:ring-tertiary" />
                <label for="addr-default" class="text-xs font-label-bold text-primary cursor-pointer">Set as default delivery address</label>
              </div>

              <p id="address-feedback-msg" class="text-xs font-medium hidden text-center"></p>

              <button type="submit" id="save-address-btn" class="bg-tertiary text-on-tertiary hover:bg-primary font-label-bold text-xs py-2.5 px-6 rounded-full transition-all shadow-sm self-start cursor-pointer active:scale-95 mt-1">
                <span>${editingAddress ? 'Update Address' : 'Save Address'}</span>
              </button>
            </form>
          </div>

          <!-- Add Address Button Trigger -->
          ${editingAddressId === null ? `
            <div class="flex items-center justify-between">
              <span class="text-xs font-label-bold text-primary">Saved Addresses (${addresses.length})</span>
              <button id="open-add-address-btn" class="bg-primary text-on-primary hover:bg-tertiary text-xs font-label-bold px-3.5 py-1.5 rounded-full transition-colors flex items-center gap-1 cursor-pointer">
                <span class="material-symbols-outlined text-sm">add</span>
                <span>Add Address</span>
              </button>
            </div>
          ` : ''}

          <!-- Addresses List -->
          <div class="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
            ${addresses.length === 0 ? `
              <div class="p-6 text-center bg-surface/50 border border-outline-variant/20 rounded-2xl text-xs text-on-surface-variant">
                <span class="material-symbols-outlined text-3xl text-secondary mb-1">home_pin</span>
                <p class="font-bold text-primary">No addresses saved yet.</p>
                <p class="text-[11px] mt-0.5">Add your home or office address for 1-click checkout.</p>
              </div>
            ` : addresses.map(addr => `
              <div class="p-3.5 rounded-2xl bg-surface border ${addr.is_default ? 'border-tertiary bg-secondary-container/10' : 'border-outline-variant/20'} flex flex-col gap-2 shadow-xs">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-xs text-primary">${addr.full_name}</span>
                    ${addr.is_default ? `
                      <span class="bg-tertiary text-on-tertiary font-label-bold text-[9px] px-2 py-0.5 rounded-full uppercase">Default</span>
                    ` : ''}
                  </div>
                  <div class="flex items-center gap-1.5">
                    ${!addr.is_default ? `
                      <button data-set-default-id="${addr.id}" class="set-default-addr-btn text-[11px] font-label-bold text-secondary hover:text-tertiary px-2 py-0.5 rounded-md hover:bg-surface-container-high cursor-pointer">Set Default</button>
                    ` : ''}
                    <button data-edit-addr-id="${addr.id}" class="edit-addr-btn text-[11px] font-label-bold text-primary hover:text-tertiary px-2 py-0.5 rounded-md hover:bg-surface-container-high cursor-pointer">Edit</button>
                    <button data-delete-addr-id="${addr.id}" class="delete-addr-btn text-[11px] font-label-bold text-red-600 hover:text-red-800 px-2 py-0.5 rounded-md hover:bg-red-50 cursor-pointer">Delete</button>
                  </div>
                </div>
                <p class="text-[11px] text-on-surface-variant leading-relaxed">${addr.address_line_1}${addr.address_line_2 ? ', ' + addr.address_line_2 : ''}, ${addr.city}, ${addr.state || ''} ${addr.postal_code}, ${addr.country}</p>
                <p class="text-[10px] text-on-surface-variant font-medium">📞 ${addr.phone}</p>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // TAB 4: PROFILE DETAILS
    else if (profileActiveTab === 'details') {
      const nameParts = (displayName || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const cleanPhone = displayPhone.replace(/^[+0-9]+\s*/, '') || displayPhone;

      tabBodyHTML = `
        <div class="bg-surface rounded-2xl p-5 border border-outline-variant/25 flex flex-col gap-4 shadow-xs">
          <div class="border-b border-outline-variant/20 pb-2">
            <h4 class="font-display font-bold text-sm text-primary">Personal Profile Information</h4>
            <p class="text-[11px] text-on-surface-variant">Update your name and delivery contact details.</p>
          </div>

          <form id="profile-details-form" class="flex flex-col gap-3.5">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="font-label-bold text-xs text-primary block mb-1">First Name</label>
                <input id="edit-first-name" type="text" required value="${firstName}" class="w-full text-xs px-3.5 py-2.5 rounded-xl bg-surface-container-high/40 border border-outline-variant/40 text-primary focus:outline-none focus:border-tertiary" />
              </div>
              <div>
                <label class="font-label-bold text-xs text-primary block mb-1">Last Name</label>
                <input id="edit-last-name" type="text" required value="${lastName}" class="w-full text-xs px-3.5 py-2.5 rounded-xl bg-surface-container-high/40 border border-outline-variant/40 text-primary focus:outline-none focus:border-tertiary" />
              </div>
            </div>

            <div>
              <label class="font-label-bold text-xs text-primary block mb-1">Country</label>
              <div class="relative">
                <select id="edit-country-select" class="w-full text-xs px-3.5 py-2.5 rounded-xl bg-surface-container-high/40 border border-outline-variant/40 text-primary appearance-none pr-8 focus:outline-none focus:border-tertiary cursor-pointer font-medium">
                  ${COUNTRIES.map(c => `<option value="${c.name}" data-dial="${c.dial}" data-flag="${c.flag}" ${c.name === displayCountry ? 'selected' : ''}>${c.flag} ${c.name} (${c.dial})</option>`).join('')}
                </select>
                <span class="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant pointer-events-none">expand_more</span>
              </div>
            </div>

            <div>
              <label class="font-label-bold text-xs text-primary block mb-1">Phone Number</label>
              <div class="flex items-center gap-2">
                <span id="edit-dial-badge" class="text-xs font-label-bold bg-surface-container-high px-3 py-2.5 rounded-xl border border-outline-variant/40 text-primary min-w-[55px] text-center">+91</span>
                <input id="edit-phone" type="tel" required value="${cleanPhone}" placeholder="98765 43210" class="w-full text-xs px-3.5 py-2.5 rounded-xl bg-surface-container-high/40 border border-outline-variant/40 text-primary focus:outline-none focus:border-tertiary" />
              </div>
            </div>

            <p id="details-feedback-msg" class="text-xs font-medium hidden text-center"></p>

            <button type="submit" id="save-profile-details-btn" class="bg-tertiary text-on-tertiary hover:bg-primary font-label-bold text-xs py-3 px-6 rounded-full transition-all duration-200 shadow-sm self-start cursor-pointer active:scale-95 mt-1">
              <span>Save Profile Changes</span>
            </button>
          </form>
        </div>
      `;
    }

    // TAB 5: ACCOUNT SECURITY
    else if (profileActiveTab === 'security') {
      tabBodyHTML = `
        <div class="flex flex-col gap-4">
          <!-- Security Overview & Email Verification Status -->
          <div class="p-4 rounded-2xl bg-surface border border-outline-variant/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-display font-bold text-sm text-primary">Account Security Status</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-label-bold uppercase ${isEmailConfirmed ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}">
                  ${isEmailConfirmed ? 'Verified Email' : 'Unverified Email'}
                </span>
              </div>
              <p class="text-xs text-on-surface-variant mt-0.5">Primary Email: <strong class="text-primary">${displayEmail}</strong></p>
            </div>
          </div>

          <!-- Change Password Form -->
          <div class="p-5 rounded-2xl bg-surface border border-outline-variant/25 flex flex-col gap-3.5 shadow-xs">
            <div class="border-b border-outline-variant/20 pb-2">
              <h4 class="font-display font-bold text-sm text-primary">Change Password</h4>
              <p class="text-[11px] text-on-surface-variant">Update your account password securely.</p>
            </div>

            <form id="change-password-form" class="flex flex-col gap-3">
              <div>
                <label class="font-label-bold text-xs text-primary block mb-1">Current Password</label>
                <input id="pwd-current" type="password" required placeholder="••••••••" class="w-full text-xs px-3.5 py-2 rounded-xl bg-surface-container-high/40 border border-outline-variant/40 text-primary focus:outline-none focus:border-tertiary" />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="font-label-bold text-xs text-primary block mb-1">New Password</label>
                  <input id="pwd-new" type="password" required minlength="6" placeholder="••••••••" class="w-full text-xs px-3.5 py-2 rounded-xl bg-surface-container-high/40 border border-outline-variant/40 text-primary focus:outline-none focus:border-tertiary" />
                </div>
                <div>
                  <label class="font-label-bold text-xs text-primary block mb-1">Confirm New Password</label>
                  <input id="pwd-confirm" type="password" required minlength="6" placeholder="••••••••" class="w-full text-xs px-3.5 py-2 rounded-xl bg-surface-container-high/40 border border-outline-variant/40 text-primary focus:outline-none focus:border-tertiary" />
                </div>
              </div>

              <p id="password-feedback-msg" class="text-xs font-medium hidden text-center"></p>

              <div class="flex items-center justify-between flex-wrap gap-2 mt-1">
                <button type="submit" id="save-password-btn" class="bg-secondary-container text-on-secondary-container hover:bg-tertiary hover:text-on-tertiary font-label-bold text-xs py-2.5 px-5 rounded-full transition-all duration-200 shadow-sm cursor-pointer active:scale-95">
                  <span>Update Password</span>
                </button>
                <button type="button" id="security-forgot-pwd-btn" class="text-[11px] font-label-bold text-secondary hover:text-tertiary underline cursor-pointer">
                  Forgot your current password?
                </button>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    profileContent.innerHTML = `
      <div class="flex flex-col gap-4">
        <!-- Header Profile Card -->
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
                <span>Verified Member</span>
              </span>
            `}

            <button id="profile-signout-btn" class="bg-surface-container-high hover:bg-error-container hover:text-error text-on-surface-variant text-xs font-label-bold py-1.5 px-3.5 rounded-full transition-all duration-200 shadow-xs cursor-pointer active:scale-95">
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        <!-- 5-Tab Navigation Bar -->
        <div class="flex items-center gap-1.5 border-b border-outline-variant/20 pb-3 overflow-x-auto">
          <button data-profile-tab="dashboard" class="profile-tab-btn px-3.5 py-1.5 rounded-full text-xs font-label-bold transition-all cursor-pointer ${profileActiveTab === 'dashboard' ? 'bg-primary text-on-primary shadow-xs' : 'bg-surface-container-high/50 text-on-surface-variant hover:bg-surface-container-high'}">Dashboard</button>
          <button data-profile-tab="orders" class="profile-tab-btn px-3.5 py-1.5 rounded-full text-xs font-label-bold transition-all cursor-pointer ${profileActiveTab === 'orders' ? 'bg-primary text-on-primary shadow-xs' : 'bg-surface-container-high/50 text-on-surface-variant hover:bg-surface-container-high'}">Orders (${orders.length})</button>
          <button data-profile-tab="addresses" class="profile-tab-btn px-3.5 py-1.5 rounded-full text-xs font-label-bold transition-all cursor-pointer ${profileActiveTab === 'addresses' ? 'bg-primary text-on-primary shadow-xs' : 'bg-surface-container-high/50 text-on-surface-variant hover:bg-surface-container-high'}">Addresses (${addresses.length})</button>
          <button data-profile-tab="details" class="profile-tab-btn px-3.5 py-1.5 rounded-full text-xs font-label-bold transition-all cursor-pointer ${profileActiveTab === 'details' ? 'bg-primary text-on-primary shadow-xs' : 'bg-surface-container-high/50 text-on-surface-variant hover:bg-surface-container-high'}">Profile Details</button>
          <button data-profile-tab="security" class="profile-tab-btn px-3.5 py-1.5 rounded-full text-xs font-label-bold transition-all cursor-pointer ${profileActiveTab === 'security' ? 'bg-primary text-on-primary shadow-xs' : 'bg-surface-container-high/50 text-on-surface-variant hover:bg-surface-container-high'}">Security</button>
        </div>

        <!-- Active Sub-tab View -->
        ${tabBodyHTML}
      </div>
    `;

    attachLoggedInProfileEvents();
    return;
  }

  // Default Auth Mode: Login or Sign Up
  const isSignUp = currentAuthMode === 'signup';
  if (titleEl) titleEl.textContent = isSignUp ? 'Join Brew & Bite' : 'Account Sign In';
  if (subtitleEl) subtitleEl.textContent = isSignUp ? 'Create an account for quick orders and saved delivery addresses.' : 'Sign in to access your dashboard, orders and addresses.';

  profileContent.innerHTML = `
    <div class="flex flex-col gap-5 max-w-md mx-auto py-1">
      <div class="text-center">
        <div class="w-12 h-12 bg-secondary-container/20 text-secondary rounded-full flex items-center justify-center mx-auto mb-2.5">
          <span class="material-symbols-outlined text-2xl">account_circle</span>
        </div>
        <h3 class="font-display text-xl font-bold text-primary">
          ${isSignUp ? 'Join Brew & Bite' : 'Welcome Back'}
        </h3>
        <p class="font-body-md text-xs text-on-surface-variant mt-1">
          ${currentAuthMode === 'login'
            ? 'Sign in to access your dashboard, orders and addresses.'
            : 'Create an account for quick orders and saved delivery addresses.'}
        </p>
      </div>

      <form id="auth-form" class="flex flex-col gap-3.5">
        ${currentAuthMode === 'signup' ? `
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="font-label-bold text-xs text-primary block mb-1">First Name</label>
              <input id="auth-first-name" type="text" required placeholder="Alex" class="w-full text-xs px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-primary placeholder-on-surface-variant/50 focus:outline-none focus:border-tertiary" />
            </div>
            <div>
              <label class="font-label-bold text-xs text-primary block mb-1">Last Name</label>
              <input id="auth-last-name" type="text" required placeholder="Rivers" class="w-full text-xs px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-primary placeholder-on-surface-variant/50 focus:outline-none focus:border-tertiary" />
            </div>
          </div>
        ` : ''}

        <div>
          <label class="font-label-bold text-xs text-primary block mb-1">Email Address</label>
          <input id="auth-email" type="email" required placeholder="alex@example.com" class="w-full text-xs px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-primary placeholder-on-surface-variant/50 focus:outline-none focus:border-tertiary" />
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="font-label-bold text-xs text-primary">Password</label>
            ${currentAuthMode === 'login' ? `
              <button type="button" id="forgot-password-link-btn" class="text-[11px] font-label-bold text-secondary hover:text-tertiary underline cursor-pointer">
                Forgot password?
              </button>
            ` : ''}
          </div>
          <input id="auth-password" type="password" required minlength="6" placeholder="••••••••" class="w-full text-xs px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-primary placeholder-on-surface-variant/50 focus:outline-none focus:border-tertiary" />
        </div>

        <p id="auth-error-msg" class="text-xs font-medium hidden text-center"></p>

        <button type="submit" id="auth-submit-btn" class="w-full bg-secondary-container text-on-secondary-container hover:bg-tertiary hover:text-on-tertiary font-label-bold text-xs py-3 px-4 rounded-full transition-all duration-200 shadow-sm mt-1 cursor-pointer active:scale-95">
          <span>${currentAuthMode === 'login' ? 'Sign In' : 'Create Account'}</span>
        </button>
      </form>

      <div class="text-center pt-2 border-t border-outline-variant/20 text-xs">
        <span class="text-on-surface-variant">
          ${currentAuthMode === 'login' ? "Don't have an account yet?" : "Already have an account?"}
        </span>
        <button id="toggle-auth-mode-btn" class="font-label-bold text-secondary hover:text-tertiary ml-1 cursor-pointer underline">
          ${currentAuthMode === 'login' ? 'Create Account' : 'Sign In'}
        </button>
      </div>
    </div>
  `;

  attachLoggedOutProfileEvents();
}

/**
 * Handle Reorder action: Loads products into active cart with live catalog prices
 */
async function handleReorderOrder(orderId) {
  const order = (typeof getOrderById === 'function') ? getOrderById(orderId) : null;
  if (!order || !Array.isArray(order.items) || order.items.length === 0) {
    alert("Could not load items from this order.");
    return;
  }

  let addedCount = 0;
  const omittedItems = [];

  for (const item of order.items) {
    const product = (typeof getProductById === 'function')
      ? getProductById(item.productId)
      : ((typeof PRODUCTS !== 'undefined' && Array.isArray(PRODUCTS)) ? PRODUCTS.find(p => p.id === item.productId) : null);

    if (product && product.available !== false) {
      if (typeof addToCart === 'function') {
        addToCart(product.id, item.quantity || 1);
        addedCount += (item.quantity || 1);
      }
    } else {
      omittedItems.push(item.name || item.productId);
    }
  }

  closeProfile();
  if (typeof openCart === 'function') {
    openCart();
  }

  if (addedCount > 0) {
    let alertMsg = `Added ${addedCount} item(s) from order #${order.orderId} to your cart with current catalog prices.`;
    if (omittedItems.length > 0) {
      alertMsg += ` (Note: ${omittedItems.join(', ')} is currently sold out and was skipped).`;
    }
    console.log("[Reorder]", alertMsg);
  } else if (omittedItems.length > 0) {
    alert(`Could not reorder: ${omittedItems.join(', ')} is currently sold out.`);
  }
}

// Event Listeners for Logged-In Profile View
function attachLoggedInProfileEvents() {
  // Tab Switching
  document.querySelectorAll('.profile-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-profile-tab');
      if (tab) {
        profileActiveTab = tab;
        editingAddressId = null;
        renderProfileMain();
      }
    });
  });

  // Track / View Order Detail
  document.querySelectorAll('.view-order-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const orderId = btn.getAttribute('data-order-id');
      if (orderId) openOrderDetail(orderId);
    });
  });

  // Reorder Button
  document.querySelectorAll('.reorder-order-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const orderId = btn.getAttribute('data-reorder-id');
      if (orderId) handleReorderOrder(orderId);
    });
  });

  // Sign Out Button
  const signoutBtn = document.getElementById('profile-signout-btn');
  if (signoutBtn) signoutBtn.addEventListener('click', handleSignOut);

  // Open Admin Button
  const openAdminBtn = document.getElementById('profile-open-admin-btn');
  if (openAdminBtn) {
    openAdminBtn.addEventListener('click', () => {
      closeProfile();
      if (typeof openAdminDashboard === 'function') openAdminDashboard();
    });
  }

  // Browse Menu Button
  const browseBtn = document.getElementById('profile-browse-menu-btn');
  if (browseBtn) {
    browseBtn.addEventListener('click', () => {
      closeProfile();
      const menu = document.getElementById('coffee-section') || document.getElementById('animation-container');
      if (menu) menu.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Address Actions
  const openAddAddrBtn = document.getElementById('open-add-address-btn');
  if (openAddAddrBtn) {
    openAddAddrBtn.addEventListener('click', () => {
      editingAddressId = ''; // blank indicates new
      renderProfileMain();
    });
  }

  const cancelAddrBtn = document.getElementById('cancel-address-form-btn');
  if (cancelAddrBtn) {
    cancelAddrBtn.addEventListener('click', () => {
      editingAddressId = null;
      renderProfileMain();
    });
  }

  document.querySelectorAll('.edit-addr-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-edit-addr-id');
      if (id) {
        editingAddressId = id;
        renderProfileMain();
      }
    });
  });

  document.querySelectorAll('.delete-addr-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-delete-addr-id');
      if (id && confirm("Are you sure you want to delete this address?")) {
        if (typeof deleteUserAddress === 'function') {
          await deleteUserAddress(id, currentUser);
          renderProfileMain();
        }
      }
    });
  });

  document.querySelectorAll('.set-default-addr-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-set-default-id');
      if (id && typeof setDefaultUserAddress === 'function') {
        await setDefaultUserAddress(id, currentUser);
        renderProfileMain();
      }
    });
  });

  // Save Address Form Submit
  const addrForm = document.getElementById('save-address-form');
  if (addrForm) {
    addrForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('addr-id')?.value;
      const name = document.getElementById('addr-name')?.value;
      const phone = document.getElementById('addr-phone')?.value;
      const line1 = document.getElementById('addr-line1')?.value;
      const line2 = document.getElementById('addr-line2')?.value;
      const city = document.getElementById('addr-city')?.value;
      const state = document.getElementById('addr-state')?.value;
      const postal = document.getElementById('addr-postal')?.value;
      const isDefault = document.getElementById('addr-default')?.checked;

      const payload = {
        id: id || undefined,
        full_name: name,
        phone: phone,
        address_line_1: line1,
        address_line_2: line2,
        city: city,
        state: state,
        postal_code: postal,
        is_default: isDefault
      };

      try {
        if (typeof saveUserAddress === 'function') {
          await saveUserAddress(payload, currentUser);
        }
        editingAddressId = null;
        renderProfileMain();
      } catch (err) {
        const msg = document.getElementById('address-feedback-msg');
        if (msg) {
          msg.textContent = err.message;
          msg.className = 'text-xs text-red-600 font-medium text-center';
          msg.classList.remove('hidden');
        }
      }
    });
  }

  // Profile Details Form Submit
  const detailsForm = document.getElementById('profile-details-form');
  if (detailsForm) {
    detailsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const first = document.getElementById('edit-first-name')?.value.trim();
      const last = document.getElementById('edit-last-name')?.value.trim();
      const countrySelect = document.getElementById('edit-country-select');
      const country = countrySelect?.value || 'India';
      const dialCode = countrySelect?.options[countrySelect.selectedIndex]?.getAttribute('data-dial') || '+91';
      const phone = document.getElementById('edit-phone')?.value.trim();

      handleUpdateProfile(first, last, country, dialCode, phone);
    });
  }

  // Change Password Form Submit
  const pwdForm = document.getElementById('change-password-form');
  if (pwdForm) {
    pwdForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const cur = document.getElementById('pwd-current')?.value;
      const newP = document.getElementById('pwd-new')?.value;
      const conf = document.getElementById('pwd-confirm')?.value;
      handleChangePassword(cur, newP, conf);
    });
  }
}

// Event Listeners for Logged-Out Auth Forms
function attachLoggedOutProfileEvents() {
  const toggleBtn = document.getElementById('toggle-auth-mode-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      currentAuthMode = (currentAuthMode === 'login') ? 'signup' : 'login';
      renderProfileMain();
    });
  }

  const forgotBtn = document.getElementById('forgot-password-link-btn');
  if (forgotBtn) {
    forgotBtn.addEventListener('click', () => {
      currentAuthMode = 'forgot_password';
      renderProfileMain();
    });
  }

  const authForm = document.getElementById('auth-form');
  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('auth-email')?.value.trim();
      const pwd = document.getElementById('auth-password')?.value;
      const first = document.getElementById('auth-first-name')?.value?.trim();
      const last = document.getElementById('auth-last-name')?.value?.trim();

      if (currentAuthMode === 'login') {
        handleSignIn(email, pwd);
      } else {
        handleSignUp(email, pwd, first, last);
      }
    });
  }
}

function attachForgotPasswordEvents() {
  const backBtn = document.getElementById('back-to-login-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      currentAuthMode = 'login';
      renderProfileMain();
    });
  }

  const forgotForm = document.getElementById('forgot-password-form');
  if (forgotForm) {
    forgotForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('forgot-email')?.value.trim();
      handleForgotPassword(email);
    });
  }
}

function attachResetPasswordEvents() {
  const backBtn = document.getElementById('reset-back-to-login-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      isPasswordRecoveryMode = false;
      currentAuthMode = 'login';
      renderProfileMain();
    });
  }

  const resetForm = document.getElementById('reset-password-form');
  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPwd = document.getElementById('reset-pwd-new')?.value;
      const confirmPwd = document.getElementById('reset-pwd-confirm')?.value;
      const msgEl = document.getElementById('reset-pwd-feedback-msg');
      const submitBtn = document.getElementById('reset-pwd-submit-btn');

      if (!newPwd || newPwd.length < 6) {
        if (msgEl) {
          msgEl.textContent = 'Password must be at least 6 characters.';
          msgEl.className = 'text-xs text-red-600 font-medium text-center';
          msgEl.classList.remove('hidden');
        }
        return;
      }

      if (newPwd !== confirmPwd) {
        if (msgEl) {
          msgEl.textContent = 'Passwords do not match.';
          msgEl.className = 'text-xs text-red-600 font-medium text-center';
          msgEl.classList.remove('hidden');
        }
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Saving New Password...</span>';
      }

      try {
        console.log("[Auth Recovery Stage 8: updateUser] Calling supabaseClient.auth.updateUser with new password...");
        const { error } = await supabaseClient.auth.updateUser({
          password: newPwd
        });

        if (error) {
          console.error("[Auth Recovery Stage 8: updateUser] updateUser failed:", error);
          if (msgEl) {
            msgEl.textContent = error.message;
            msgEl.className = 'text-xs text-red-600 font-medium text-center';
            msgEl.classList.remove('hidden');
          }
        } else {
          console.log("[Auth Recovery Stage 8: updateUser] Success! Password updated successfully in Supabase.");
          isPasswordRecoveryMode = false;
          if (msgEl) {
            msgEl.textContent = 'Password updated successfully! Redirecting to sign in...';
            msgEl.className = 'text-xs text-green-700 font-bold text-center bg-green-50 p-2.5 rounded-xl border border-green-200';
            msgEl.classList.remove('hidden');
          }
          if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', window.location.pathname);
          }
          setTimeout(async () => {
            try {
              await supabaseClient.auth.signOut();
            } catch (e) {}
            currentAuthMode = 'login';
            currentUser = null;
            userProfile = null;
            renderProfileMain();
          }, 1800);
        }
      } catch (err) {
        if (msgEl) {
          msgEl.textContent = err.message || 'Could not update password.';
          msgEl.className = 'text-xs text-red-600 font-medium text-center';
          msgEl.classList.remove('hidden');
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Save New Password</span>';
        }
      }
    });
  }
}

// Compute dynamic, environment-aware Auth Redirect URL
function getAuthRedirectUrl() {
  let origin = window.location.origin;
  let pathname = window.location.pathname || '/';
  pathname = pathname.replace(/\/index\.html$/, '');
  if (!pathname.endsWith('/')) {
    pathname += '/';
  }
  return `${origin}${pathname}`;
}

// Handle Sign In
async function handleSignIn(email, password) {
  const errorEl = document.getElementById('auth-error-msg');
  const submitBtn = document.getElementById('auth-submit-btn');

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
      if (errorEl) {
        errorEl.textContent = error.message;
        errorEl.className = 'text-xs text-red-600 font-medium text-center';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    currentUser = data.user;
    await fetchOrCreateUserProfile(currentUser);
    if (typeof fetchOrdersForUser === 'function') await fetchOrdersForUser(currentUser.id);
    if (typeof fetchUserAddresses === 'function') await fetchUserAddresses(currentUser.id);
    if (typeof fetchUserNotifications === 'function') await fetchUserNotifications(currentUser.id);
    renderProfileMain();
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message || 'Failed to sign in.';
      errorEl.className = 'text-xs text-red-600 font-medium text-center';
      errorEl.classList.remove('hidden');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Sign In</span>';
    }
  }
}

// Handle Sign Up
async function handleSignUp(email, password, firstName, lastName) {
  const errorEl = document.getElementById('auth-error-msg');
  const submitBtn = document.getElementById('auth-submit-btn');

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Creating account...</span>';
  }

  try {
    const fullName = `${firstName} ${lastName}`.trim();
    const { data, error } = await supabaseClient.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: fullName
        }
      }
    });

    if (error) {
      if (errorEl) {
        errorEl.textContent = error.message;
        errorEl.className = 'text-xs text-red-600 font-medium text-center';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    if (data.user && !data.session) {
      pendingVerificationEmail = email;
      currentAuthMode = 'login';
      renderProfileMain();
    } else if (data.session) {
      currentUser = data.user;
      await fetchOrCreateUserProfile(currentUser);
      renderProfileMain();
    }
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message || 'Failed to sign up.';
      errorEl.className = 'text-xs text-red-600 font-medium text-center';
      errorEl.classList.remove('hidden');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Create Account</span>';
    }
  }
}

// Handle Forgot Password
async function handleForgotPassword(email) {
  const msgEl = document.getElementById('forgot-feedback-msg');
  const submitBtn = document.getElementById('forgot-submit-btn');

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Sending Email...</span>';
  }

  try {
    const redirectUrl = getAuthRedirectUrl();
    console.log("[Auth Recovery Stage 1: resetPasswordForEmail] Requesting reset link for email:", email, "with redirectTo:", redirectUrl);
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });

    if (error) {
      if (msgEl) {
        msgEl.textContent = error.message;
        msgEl.className = 'text-xs text-red-600 font-medium text-center';
        msgEl.classList.remove('hidden');
      }
    } else {
      if (msgEl) {
        msgEl.textContent = `Password reset link sent to "${email}". Please check your email inbox on your phone or computer.`;
        msgEl.className = 'text-xs text-green-700 font-bold text-center bg-green-50 p-2.5 rounded-xl border border-green-200';
        msgEl.classList.remove('hidden');
      }
    }
  } catch (err) {
    if (msgEl) {
      msgEl.textContent = err.message || 'Could not send reset email.';
      msgEl.className = 'text-xs text-red-600 font-medium text-center';
      msgEl.classList.remove('hidden');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Send Recovery Email</span>';
    }
  }
}

// Handle Change Password
async function handleChangePassword(currentPassword, newPassword, confirmPassword) {
  const msgEl = document.getElementById('password-feedback-msg');
  const submitBtn = document.getElementById('save-password-btn');

  if (!newPassword || newPassword.length < 6) {
    if (msgEl) {
      msgEl.textContent = 'New password must be at least 6 characters.';
      msgEl.className = 'text-xs text-red-600 font-medium text-center';
      msgEl.classList.remove('hidden');
    }
    return;
  }

  if (newPassword !== confirmPassword) {
    if (msgEl) {
      msgEl.textContent = 'New passwords do not match.';
      msgEl.className = 'text-xs text-red-600 font-medium text-center';
      msgEl.classList.remove('hidden');
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Verifying &amp; Updating...</span>';
  }

  try {
    const { error } = await supabaseClient.auth.updateUser({
      password: newPassword
    });

    if (error) {
      if (msgEl) {
        msgEl.textContent = error.message;
        msgEl.className = 'text-xs text-red-600 font-medium text-center';
        msgEl.classList.remove('hidden');
      }
    } else {
      if (msgEl) {
        msgEl.textContent = 'Password updated successfully!';
        msgEl.className = 'text-xs text-green-700 font-bold text-center bg-green-50 p-2.5 rounded-xl border border-green-200';
        msgEl.classList.remove('hidden');
      }
      document.getElementById('change-password-form')?.reset();
    }
  } catch (err) {
    if (msgEl) {
      msgEl.textContent = err.message || 'Could not change password.';
      msgEl.className = 'text-xs text-red-600 font-medium text-center';
      msgEl.classList.remove('hidden');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Update Password</span>';
    }
  }
}

// Handle Update Profile Details
async function handleUpdateProfile(firstName, lastName, country, dialCode, phone) {
  const msgEl = document.getElementById('details-feedback-msg');
  const submitBtn = document.getElementById('save-profile-details-btn');

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Saving Profile...</span>';
  }

  const fullName = `${firstName} ${lastName}`.trim();
  const formattedPhone = phone.startsWith('+') ? phone : `${dialCode} ${phone}`.trim();

  try {
    const { error: dbError } = await supabaseClient
      .from('profiles')
      .update({
        full_name: fullName,
        phone: formattedPhone,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentUser.id);

    if (dbError) throw dbError;

    await supabaseClient.auth.updateUser({
      data: {
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        country: country,
        dial_code: dialCode,
        phone: formattedPhone
      }
    });

    userProfile.full_name = fullName;
    userProfile.phone = formattedPhone;

    if (msgEl) {
      msgEl.textContent = 'Profile details updated successfully!';
      msgEl.className = 'text-xs text-green-700 font-bold text-center bg-green-50 p-2.5 rounded-xl border border-green-200';
      msgEl.classList.remove('hidden');
    }

    setTimeout(() => {
      renderProfileMain();
    }, 800);
  } catch (err) {
    if (msgEl) {
      msgEl.textContent = err.message || 'Failed to update profile details.';
      msgEl.className = 'text-xs text-red-600 font-medium text-center';
      msgEl.classList.remove('hidden');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Save Profile Changes</span>';
    }
  }
}

// Handle Sign Out
async function handleSignOut() {
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      await supabaseClient.auth.signOut();
      currentUser = null;
      userProfile = null;
      pendingVerificationEmail = null;
      profileActiveTab = 'dashboard';
      currentAuthMode = 'login';
      if (typeof clearUserOrderState === 'function') {
        clearUserOrderState();
      }
      if (typeof clearNotificationState === 'function') {
        clearNotificationState();
      }
      if (typeof clearUserAddresses === 'function') {
        clearUserAddresses();
      }
      console.log("Supabase Sign Out completed. In-memory session purged.");
      updateAdminNavVisibility();
      renderProfileMain();
    } catch (err) {
      console.warn("Sign Out error:", err);
    }
  }
}

// Render Order Detail View with Stepper, Payment Card, and Reorder CTA
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
          <span>Back to Dashboard</span>
        </button>
        <div class="flex items-center gap-2">
          <button data-reorder-id="${order.orderId}" class="reorder-order-btn bg-secondary-container text-on-secondary-container hover:bg-tertiary hover:text-on-tertiary text-xs font-label-bold px-3 py-1 rounded-full transition-all flex items-center gap-1 cursor-pointer">
            <span class="material-symbols-outlined text-sm">replay</span>
            <span>Reorder</span>
          </button>
          <span class="text-xs font-bold text-on-surface-variant">Ref: <strong class="text-primary font-display">${order.orderId}</strong></span>
        </div>
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

        <!-- Payment Information Card -->
        <div class="p-3 rounded-xl bg-surface-container-high/30 border border-outline-variant/15 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div>
            <span class="text-on-surface-variant font-bold block mb-0.5">Payment Method:</span>
            <span class="text-primary font-medium">${order.payment?.method === 'online' ? 'Online Payment (Card/UPI)' : 'Cash on Delivery'}</span>
          </div>
          <div>
            <span class="text-on-surface-variant font-bold block mb-0.5">Payment Status:</span>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-label-bold uppercase ${order.payment?.status === 'paid' ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}">
              ${order.payment?.status === 'paid' ? 'Paid' : 'Pending (COD)'}
            </span>
          </div>
          <div>
            <span class="text-on-surface-variant font-bold block mb-0.5">Transaction Ref:</span>
            <span class="font-mono text-[11px] text-primary">${order.payment?.transactionRef || 'COD-' + order.orderId}</span>
          </div>
        </div>

        <!-- Purchased Line Items -->
        <div class="flex flex-col gap-1">
          <span class="text-[11px] text-on-surface-variant uppercase font-label-bold tracking-wider mb-0.5">Purchased Items</span>
          <div class="max-h-[140px] overflow-y-auto pr-1">
            ${itemsListHTML}
          </div>
        </div>

        <!-- Total Calculation -->
        <div class="border-t border-outline-variant/20 pt-2 flex items-center justify-between">
          <span class="font-label-bold text-xs text-on-surface-variant">Total Amount:</span>
          <span class="font-display font-black text-base sm:text-lg text-primary">$${Number(order.subtotal || 0).toFixed(2)}</span>
        </div>
      </div>

      <!-- Action Buttons: Reorder & Cancel -->
      <div class="flex items-center justify-between flex-wrap gap-2 pt-1">
        <button data-reorder-id="${order.orderId}" class="reorder-order-btn bg-tertiary text-on-tertiary hover:bg-primary font-label-bold text-xs py-2 px-5 rounded-full transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95">
          <span class="material-symbols-outlined text-sm">replay</span>
          <span>Reorder These Items</span>
        </button>

        ${isCancellable ? `
          <button id="cancel-active-order-btn" class="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-label-bold text-xs py-2 px-4 rounded-full transition-all cursor-pointer">
            <span>Cancel Order</span>
          </button>
        ` : ''}
      </div>
    </div>
  `;

  const backBtn = document.getElementById('back-to-orders-btn');
  if (backBtn) backBtn.addEventListener('click', renderProfileMain);

  document.querySelectorAll('.reorder-order-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-reorder-id');
      if (id) handleReorderOrder(id);
    });
  });

  const cancelBtn = document.getElementById('cancel-active-order-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', async () => {
      if (confirm("Are you sure you want to cancel this order?")) {
        if (typeof cancelOrderInSupabase === 'function') {
          try {
            await cancelOrderInSupabase(order.orderId);
            openOrderDetail(order.orderId);
          } catch (e) {
            alert(e.message || "Failed to cancel order.");
          }
        }
      }
    });
  }
}

// Helper to get badge CSS color based on status
function getStatusBadgeClass(status) {
  switch ((status || '').toLowerCase()) {
    case 'delivered':
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

// Initialize Profile Handlers on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  const profileBtn = document.getElementById('profile-btn');
  const mobileProfileBtn = document.getElementById('mobile-profile-btn');
  const closeProfileBtn = document.getElementById('close-profile-btn');

  if (profileBtn) profileBtn.addEventListener('click', openProfile);
  if (mobileProfileBtn) mobileProfileBtn.addEventListener('click', openProfile);
  if (closeProfileBtn) closeProfileBtn.addEventListener('click', closeProfile);

  initSupabaseAuth();
});

// Exports for Node testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initSupabaseAuth,
    openProfile,
    closeProfile,
    renderProfileMain,
    handleReorderOrder,
    openOrderDetail
  };
}
