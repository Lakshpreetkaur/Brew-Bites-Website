/**
 * Brew & Bite - Customer Profile, Account Security & Password Recovery (profile.js)
 * Production-ready account management integrated directly with Supabase Auth and `public.profiles`.
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

// Global Auth & Profile State
let currentUser = null;
let userProfile = null;
let isProfileLoading = false;
let currentAuthMode = 'login'; // 'login' | 'signup' | 'forgot_password' | 'reset_password'
let profileActiveTab = 'orders'; // 'orders' | 'details' | 'security'
let pendingVerificationEmail = null;
let authNotificationMsg = null; // { type: 'success'|'error'|'info', text: string }

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
      // Check for password recovery hash in URL
      if (window.location.hash && (window.location.hash.includes('type=recovery') || window.location.hash.includes('access_token='))) {
        currentAuthMode = 'reset_password';
        openProfile();
      }

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

      supabaseClient.auth.onAuthStateChange(async (event, session) => {
        console.log(`[Supabase Auth Event] ${event}`);

        if (event === 'PASSWORD_RECOVERY') {
          currentAuthMode = 'reset_password';
          openProfile();
          return;
        }

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

    // 1. Query the existing `profiles` table for this authenticated user ID
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
}

// Main Render Function for Profile Modal Content
function renderProfileMain() {
  const profileContent = document.getElementById('profile-content');
  if (!profileContent) return;

  const titleEl = document.getElementById('profile-title');
  const subtitleEl = document.getElementById('profile-subtitle');

  // Case 1: User is Logged In - Render Tabbed Profile & Settings
  if (currentUser) {
    const displayName = userProfile?.full_name || currentUser.user_metadata?.full_name || currentUser.email.split('@')[0] || 'Valued Member';
    const displayEmail = userProfile?.email || currentUser.email || '';
    const displayCountry = currentUser.user_metadata?.country || 'India';
    const displayPhone = userProfile?.phone || (currentUser.user_metadata?.phone ? `${currentUser.user_metadata?.dial_code || ''} ${currentUser.user_metadata?.phone}`.trim() : '');
    const initial = displayName.charAt(0).toUpperCase();
    const isAdmin = !!(userProfile && userProfile.role === 'admin');
    const isEmailConfirmed = !!currentUser.email_confirmed_at;

    // Update Modal Header dynamically
    if (titleEl) titleEl.textContent = isAdmin ? 'Admin Account' : 'Customer Profile';
    if (subtitleEl) subtitleEl.textContent = isAdmin ? 'Account & Security Settings' : 'Account & Order History';

    // Sub-tab Content Generator
    let tabBodyHTML = '';

    if (profileActiveTab === 'orders') {
      const orders = (typeof getOrders === 'function') ? getOrders() : [];
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
          <div class="flex flex-col gap-2.5 max-h-[320px] overflow-y-auto pr-1">
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
                    </div>
                    <p class="text-[11px] text-on-surface-variant font-body-md">${dateStr} • ${totalItems} item${totalItems === 1 ? '' : 's'}</p>
                  </div>

                  <div class="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 border-outline-variant/15 pt-1.5 sm:pt-0">
                    <span class="font-display font-bold text-primary text-sm sm:text-base">$${Number(order.subtotal || 0).toFixed(2)}</span>
                    <button data-order-id="${order.orderId}" class="view-order-btn bg-secondary-container text-on-secondary-container hover:bg-tertiary hover:text-on-tertiary font-label-bold text-xs py-1.5 px-3.5 rounded-full transition-all duration-200 shadow-xs cursor-pointer active:scale-95">
                      <span>Track / View</span>
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }
    } else if (profileActiveTab === 'details') {
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
    } else if (profileActiveTab === 'security') {
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
            ${!isEmailConfirmed ? `
              <button id="resend-verification-btn" class="text-xs font-label-bold text-secondary hover:text-tertiary border border-secondary/30 px-3 py-1.5 rounded-full hover:bg-surface-container-high cursor-pointer">
                Resend Verification
              </button>
            ` : ''}
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

          <!-- Change Email Address Form -->
          <div class="p-5 rounded-2xl bg-surface border border-outline-variant/25 flex flex-col gap-3.5 shadow-xs">
            <div class="border-b border-outline-variant/20 pb-2">
              <h4 class="font-display font-bold text-sm text-primary">Change Email Address</h4>
              <p class="text-[11px] text-on-surface-variant">A confirmation link will be sent to both your current and new email addresses.</p>
            </div>

            <form id="change-email-form" class="flex flex-col gap-3">
              <div>
                <label class="font-label-bold text-xs text-primary block mb-1">New Email Address</label>
                <input id="new-email-input" type="email" required placeholder="newemail@example.com" class="w-full text-xs px-3.5 py-2 rounded-xl bg-surface-container-high/40 border border-outline-variant/40 text-primary focus:outline-none focus:border-tertiary" />
              </div>

              <p id="email-feedback-msg" class="text-xs font-medium hidden text-center"></p>

              <button type="submit" id="save-email-btn" class="bg-secondary-container text-on-secondary-container hover:bg-tertiary hover:text-on-tertiary font-label-bold text-xs py-2.5 px-5 rounded-full transition-all duration-200 shadow-sm self-start cursor-pointer active:scale-95 mt-1">
                <span>Request Email Change</span>
              </button>
            </form>
          </div>

        </div>
      `;
    }

    profileContent.innerHTML = `
      <div class="flex flex-col gap-5">
        
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

        <!-- Tabbed Navigation -->
        <div class="flex items-center gap-2 border-b border-outline-variant/20 pb-2.5">
          <button data-ptab="orders" class="profile-tab-btn px-4 py-1.5 rounded-full text-xs font-label-bold transition-all cursor-pointer ${profileActiveTab === 'orders' ? 'bg-primary text-on-primary shadow-xs' : 'bg-surface-container-high/60 text-on-surface-variant hover:bg-surface-container-high'}">
            <span>My Orders</span>
          </button>
          <button data-ptab="details" class="profile-tab-btn px-4 py-1.5 rounded-full text-xs font-label-bold transition-all cursor-pointer ${profileActiveTab === 'details' ? 'bg-primary text-on-primary shadow-xs' : 'bg-surface-container-high/60 text-on-surface-variant hover:bg-surface-container-high'}">
            <span>Profile Details</span>
          </button>
          <button data-ptab="security" class="profile-tab-btn px-4 py-1.5 rounded-full text-xs font-label-bold transition-all cursor-pointer ${profileActiveTab === 'security' ? 'bg-primary text-on-primary shadow-xs' : 'bg-surface-container-high/60 text-on-surface-variant hover:bg-surface-container-high'}">
            <span>Account Security</span>
          </button>
        </div>

        <!-- Active Tab Content -->
        ${tabBodyHTML}

      </div>
    `;

    attachLoggedInProfileEvents();
    return;
  }

  // Case 2: User is NOT Logged In - Render Auth Modes (Login / Sign Up / Forgot Password / Reset Password)
  if (titleEl) titleEl.textContent = currentAuthMode === 'reset_password' ? 'Set New Password' : (currentAuthMode === 'forgot_password' ? 'Password Recovery' : (currentAuthMode === 'signup' ? 'Join Brew & Bite' : 'Account Sign In'));
  if (subtitleEl) subtitleEl.textContent = 'Brew & Bite Coffee & Bites';

  if (currentAuthMode === 'reset_password') {
    profileContent.innerHTML = `
      <div class="flex flex-col gap-5 max-w-md mx-auto py-1">
        <div class="text-center">
          <div class="w-12 h-12 bg-secondary-container/20 text-secondary rounded-full flex items-center justify-center mx-auto mb-2.5">
            <span class="material-symbols-outlined text-2xl">lock_reset</span>
          </div>
          <h3 class="font-display text-xl font-bold text-primary">Set New Password</h3>
          <p class="font-body-md text-xs text-on-surface-variant mt-1">Please create a new, secure password for your account.</p>
        </div>

        <form id="reset-password-form" class="flex flex-col gap-3.5">
          <div>
            <label class="font-label-bold text-xs text-primary block mb-1">New Password</label>
            <input id="reset-pwd-new" type="password" required minlength="6" placeholder="••••••••" class="w-full text-xs px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-primary focus:outline-none focus:border-tertiary" />
          </div>

          <div>
            <label class="font-label-bold text-xs text-primary block mb-1">Confirm New Password</label>
            <input id="reset-pwd-confirm" type="password" required minlength="6" placeholder="••••••••" class="w-full text-xs px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-primary focus:outline-none focus:border-tertiary" />
          </div>

          <p id="reset-feedback-msg" class="text-xs font-medium hidden text-center"></p>

          <button type="submit" id="reset-submit-btn" class="w-full bg-tertiary text-on-tertiary font-label-bold text-xs py-3 px-4 rounded-full transition-all duration-200 shadow-sm mt-1 cursor-pointer active:scale-95">
            <span>Update Password &amp; Sign In</span>
          </button>
        </form>
      </div>
    `;
    attachResetPasswordEvents();
    return;
  }

  if (currentAuthMode === 'forgot_password') {
    profileContent.innerHTML = `
      <div class="flex flex-col gap-5 max-w-md mx-auto py-1">
        <div class="text-center">
          <div class="w-12 h-12 bg-secondary-container/20 text-secondary rounded-full flex items-center justify-center mx-auto mb-2.5">
            <span class="material-symbols-outlined text-2xl">mark_email_read</span>
          </div>
          <h3 class="font-display text-xl font-bold text-primary">Recover Password</h3>
          <p class="font-body-md text-xs text-on-surface-variant mt-1">Enter your email and we'll send you a secure recovery link.</p>
        </div>

        <form id="forgot-password-form" class="flex flex-col gap-3.5">
          <div>
            <label class="font-label-bold text-xs text-primary block mb-1">Email Address</label>
            <input id="forgot-email" type="email" required placeholder="name@example.com" class="w-full text-xs px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-primary focus:outline-none focus:border-tertiary" />
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

  // Default Auth Mode: Login or Sign Up
  profileContent.innerHTML = `
    <div class="flex flex-col gap-5 max-w-md mx-auto py-1">
      <div class="text-center">
        <div class="w-12 h-12 bg-secondary-container/20 text-secondary rounded-full flex items-center justify-center mx-auto mb-2.5">
          <span class="material-symbols-outlined text-2xl">account_circle</span>
        </div>
        <h3 class="font-display text-xl font-bold text-primary">
          ${currentAuthMode === 'login' ? 'Welcome Back' : 'Join Brew & Bite'}
        </h3>
        <p class="font-body-md text-xs text-on-surface-variant mt-1">
          ${currentAuthMode === 'login'
            ? 'Sign in to access your order history and profile.'
            : 'Create an account for quick orders and special perks.'}
        </p>
      </div>

      <!-- Verification Notice if awaiting email confirmation -->
      ${pendingVerificationEmail ? `
        <div class="p-3.5 bg-secondary-container/20 border border-secondary/40 rounded-2xl text-center">
          <span class="material-symbols-outlined text-secondary text-xl mb-1 block">mark_email_unread</span>
          <p class="text-xs font-bold text-primary mb-1">Check your inbox!</p>
          <p class="text-[11px] text-on-surface-variant">We sent a verification link to <strong class="text-primary">${pendingVerificationEmail}</strong>. Please confirm your email to sign in.</p>
        </div>
      ` : ''}

      <form id="auth-form" class="flex flex-col gap-3.5">
        ${currentAuthMode === 'signup' ? `
          <!-- First & Last Name Fields -->
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

          <!-- Country Selector Dropdown -->
          <div>
            <label class="font-label-bold text-xs text-primary block mb-1">Country</label>
            <div class="relative">
              <select id="auth-country-select" class="w-full text-xs px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-primary appearance-none pr-8 focus:outline-none focus:border-tertiary cursor-pointer font-medium">
                ${COUNTRIES.map(c => `<option value="${c.name}" data-dial="${c.dial}" data-flag="${c.flag}" ${c.code === 'IN' ? 'selected' : ''}>${c.flag} ${c.name} (${c.dial})</option>`).join('')}
              </select>
              <span class="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant pointer-events-none">expand_more</span>
            </div>
          </div>

          <!-- Phone Number with Dynamic Country Dial Code Badge -->
          <div>
            <label class="font-label-bold text-xs text-primary block mb-1">Phone Number</label>
            <div class="flex items-center gap-2">
              <span id="auth-dial-code-badge" class="text-xs font-label-bold bg-surface-container-high px-3 py-2.5 rounded-xl border border-outline-variant/40 text-primary whitespace-nowrap min-w-[55px] text-center">+91</span>
              <input id="auth-phone" type="tel" required placeholder="98765 43210" class="w-full text-xs px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-primary placeholder-on-surface-variant/50 focus:outline-none focus:border-tertiary" />
            </div>
          </div>
        ` : ''}

        <!-- Email Field -->
        <div>
          <label class="font-label-bold text-xs text-primary block mb-1">Email Address</label>
          <input id="auth-email" type="email" required placeholder="name@example.com" class="w-full text-xs px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-primary placeholder-on-surface-variant/50 focus:outline-none focus:border-tertiary" />
        </div>

        <!-- Password Field -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="font-label-bold text-xs text-primary">Password</label>
            ${currentAuthMode === 'login' ? `
              <button type="button" id="forgot-pwd-link-btn" class="text-[11px] font-label-bold text-secondary hover:text-tertiary underline cursor-pointer">
                Forgot Password?
              </button>
            ` : ''}
          </div>
          <input id="auth-password" type="password" required minlength="6" placeholder="••••••••" class="w-full text-xs px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-primary placeholder-on-surface-variant/50 focus:outline-none focus:border-tertiary" />
          ${currentAuthMode === 'signup' ? `<p class="text-[10px] text-on-surface-variant mt-1">Must be at least 6 characters.</p>` : ''}
        </div>

        <!-- Feedback / Status Error Message Container -->
        <p id="auth-status-msg" class="text-xs text-red-600 font-medium hidden text-center"></p>

        <!-- Submit Button -->
        <button id="auth-submit-btn" type="submit" class="w-full bg-secondary-container text-on-secondary-container hover:bg-tertiary hover:text-on-tertiary font-label-bold text-xs py-3 px-4 rounded-full transition-all duration-200 flex items-center justify-center gap-1.5 shadow-sm mt-1 cursor-pointer active:scale-95">
          <span>${currentAuthMode === 'login' ? 'Sign In' : 'Create Account'}</span>
          <span class="material-symbols-outlined text-base">arrow_forward</span>
        </button>
      </form>

      <!-- Toggle Mode Prompt -->
      <div class="text-center pt-2 border-t border-outline-variant/20">
        <p class="text-xs text-on-surface-variant">
          ${currentAuthMode === 'login' ? "Don't have an account?" : "Already have an account?"}
          <button id="auth-toggle-mode-btn" class="font-label-bold text-secondary hover:text-tertiary transition-colors ml-1 cursor-pointer underline">
            ${currentAuthMode === 'login' ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  `;

  attachDefaultAuthEvents();
}

// Attach Event Listeners for Logged-In Profile Tabs
function attachLoggedInProfileEvents() {
  // Tab Switching
  document.querySelectorAll('.profile-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-ptab');
      if (tab) {
        profileActiveTab = tab;
        renderProfileMain();
      }
    });
  });

  // Admin Dashboard CTA
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

  // Profile Details Form Listener
  const detailsForm = document.getElementById('profile-details-form');
  const editCountrySelect = document.getElementById('edit-country-select');
  const editDialBadge = document.getElementById('edit-dial-badge');

  if (editCountrySelect && editDialBadge) {
    editCountrySelect.addEventListener('change', () => {
      const opt = editCountrySelect.options[editCountrySelect.selectedIndex];
      editDialBadge.textContent = opt.getAttribute('data-dial') || '+91';
    });
  }

  if (detailsForm) {
    detailsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const firstName = document.getElementById('edit-first-name')?.value.trim();
      const lastName = document.getElementById('edit-last-name')?.value.trim();
      const country = editCountrySelect ? editCountrySelect.value : 'India';
      const dialCode = editDialBadge ? editDialBadge.textContent : '+91';
      const phone = document.getElementById('edit-phone')?.value.trim();
      await handleUpdateProfile(firstName, lastName, country, dialCode, phone);
    });
  }

  // Change Password Form Listener
  const pwdForm = document.getElementById('change-password-form');
  if (pwdForm) {
    pwdForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPwd = document.getElementById('pwd-current')?.value;
      const newPwd = document.getElementById('pwd-new')?.value;
      const confirmPwd = document.getElementById('pwd-confirm')?.value;
      await handleChangePassword(currentPwd, newPwd, confirmPwd);
    });
  }

  // Security Tab "Forgot current password" Trigger
  const secForgotBtn = document.getElementById('security-forgot-pwd-btn');
  if (secForgotBtn && currentUser) {
    secForgotBtn.addEventListener('click', async () => {
      if (confirm(`Send a password reset link to your email (${currentUser.email})?`)) {
        await handleForgotPassword(currentUser.email);
        const msgEl = document.getElementById('password-feedback-msg');
        if (msgEl) {
          msgEl.textContent = `A password reset link has been sent to ${currentUser.email}. Check your inbox.`;
          msgEl.className = 'text-xs text-green-700 font-bold text-center bg-green-50 p-2.5 rounded-xl border border-green-200';
          msgEl.classList.remove('hidden');
        }
      }
    });
  }

  // Change Email Form Listener
  const emailForm = document.getElementById('change-email-form');
  if (emailForm) {
    emailForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newEmail = document.getElementById('new-email-input')?.value.trim();
      await handleChangeEmail(newEmail);
    });
  }

  // Resend verification email
  const resendBtn = document.getElementById('resend-verification-btn');
  if (resendBtn && currentUser) {
    resendBtn.addEventListener('click', async () => {
      try {
        await supabaseClient.auth.resend({
          type: 'signup',
          email: currentUser.email
        });
        alert(`Verification email resent to ${currentUser.email}. Please check your inbox.`);
      } catch (err) {
        alert(err.message || "Failed to resend verification email.");
      }
    });
  }
}

// Attach Default Login/Signup Form Listeners
function attachDefaultAuthEvents() {
  const countrySelect = document.getElementById('auth-country-select');
  const dialBadge = document.getElementById('auth-dial-code-badge');
  if (countrySelect && dialBadge) {
    countrySelect.addEventListener('change', () => {
      const selectedOption = countrySelect.options[countrySelect.selectedIndex];
      dialBadge.textContent = selectedOption.getAttribute('data-dial') || '+91';
    });
  }

  const forgotBtn = document.getElementById('forgot-pwd-link-btn');
  if (forgotBtn) {
    forgotBtn.addEventListener('click', () => {
      currentAuthMode = 'forgot_password';
      renderProfileMain();
    });
  }

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

  const toggleBtn = document.getElementById('auth-toggle-mode-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      currentAuthMode = currentAuthMode === 'login' ? 'signup' : 'login';
      pendingVerificationEmail = null;
      renderProfileMain();
    });
  }
}

// Attach Forgot Password Form Listeners
function attachForgotPasswordEvents() {
  const form = document.getElementById('forgot-password-form');
  const backBtn = document.getElementById('back-to-login-btn');

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      currentAuthMode = 'login';
      renderProfileMain();
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('forgot-email')?.value.trim();
      await handleForgotPassword(email);
    });
  }
}

// Attach Reset Password Form Listeners
function attachResetPasswordEvents() {
  const form = document.getElementById('reset-password-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPwd = document.getElementById('reset-pwd-new')?.value;
      const confirmPwd = document.getElementById('reset-pwd-confirm')?.value;
      await handleResetPassword(newPwd, confirmPwd);
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

  if (typeof supabaseClient === 'undefined' || !supabaseClient) return;

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

// Handle Real Supabase Sign Up
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

  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.length < 6 || cleanPhone.length > 15) {
    if (statusMsg) {
      statusMsg.textContent = 'Please enter a valid phone number.';
      statusMsg.className = 'text-xs text-red-600 font-medium text-center';
      statusMsg.classList.remove('hidden');
    }
    return;
  }

  if (typeof supabaseClient === 'undefined' || !supabaseClient) return;

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
      if (data.session && data.user) {
        currentUser = data.user;
        await fetchOrCreateUserProfile(currentUser, { firstName, lastName, fullName, country, dialCode, phone: formattedPhone });
        if (typeof fetchOrdersForUser === 'function') {
          await fetchOrdersForUser(currentUser.id);
        }
        renderProfileMain();
      } else {
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

// Handle Forgot Password Request (Sends recovery email)
async function handleForgotPassword(email) {
  const msgEl = document.getElementById('forgot-feedback-msg');
  const submitBtn = document.getElementById('forgot-submit-btn');

  if (!email) {
    if (msgEl) {
      msgEl.textContent = 'Please enter your registered email address.';
      msgEl.className = 'text-xs text-red-600 font-medium text-center';
      msgEl.classList.remove('hidden');
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Sending Link...</span>';
  }

  try {
    const redirectUrl = window.location.href.split('#')[0];
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
        msgEl.textContent = `If an account exists for "${email}", a password reset link has been sent to your inbox.`;
        msgEl.className = 'text-xs text-green-700 font-bold text-center bg-green-50 p-3 rounded-xl border border-green-200';
        msgEl.classList.remove('hidden');
      }
    }
  } catch (err) {
    if (msgEl) {
      msgEl.textContent = err.message || 'Could not process password recovery.';
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

// Handle Set New Password (Upon clicking email recovery link)
async function handleResetPassword(newPassword, confirmPassword) {
  const msgEl = document.getElementById('reset-feedback-msg');
  const submitBtn = document.getElementById('reset-submit-btn');

  if (!newPassword || newPassword.length < 6) {
    if (msgEl) {
      msgEl.textContent = 'Password must be at least 6 characters.';
      msgEl.className = 'text-xs text-red-600 font-medium text-center';
      msgEl.classList.remove('hidden');
    }
    return;
  }

  if (newPassword !== confirmPassword) {
    if (msgEl) {
      msgEl.textContent = 'Passwords do not match.';
      msgEl.className = 'text-xs text-red-600 font-medium text-center';
      msgEl.classList.remove('hidden');
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Updating Password...</span>';
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
      // Clean up hash from URL
      if (window.history.replaceState) {
        window.history.replaceState(null, null, window.location.pathname);
      }
      alert("Password updated successfully! You are now logged in.");
      currentAuthMode = 'login';
      profileActiveTab = 'orders';
      renderProfileMain();
    }
  } catch (err) {
    if (msgEl) {
      msgEl.textContent = err.message || 'Failed to update password.';
      msgEl.className = 'text-xs text-red-600 font-medium text-center';
      msgEl.classList.remove('hidden');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Update Password &amp; Sign In</span>';
    }
  }
}

// Handle Change Password (Inside Profile -> Security tab)
async function handleChangePassword(currentPassword, newPassword, confirmPassword) {
  const msgEl = document.getElementById('password-feedback-msg');
  const submitBtn = document.getElementById('save-password-btn');

  if (!currentPassword) {
    if (msgEl) {
      msgEl.textContent = 'Please enter your current password.';
      msgEl.className = 'text-xs text-red-600 font-medium text-center';
      msgEl.classList.remove('hidden');
    }
    return;
  }

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
    // 1. Verify current password by attempting re-auth
    const { error: reauthError } = await supabaseClient.auth.signInWithPassword({
      email: currentUser.email,
      password: currentPassword
    });

    if (reauthError) {
      if (msgEl) {
        msgEl.textContent = 'Incorrect current password. Please try again.';
        msgEl.className = 'text-xs text-red-600 font-medium text-center';
        msgEl.classList.remove('hidden');
      }
      return;
    }

    // 2. Update password
    const { error: updateError } = await supabaseClient.auth.updateUser({
      password: newPassword
    });

    if (updateError) {
      if (msgEl) {
        msgEl.textContent = updateError.message;
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

// Handle Change Email Address (Sends confirmation to old & new email)
async function handleChangeEmail(newEmail) {
  const msgEl = document.getElementById('email-feedback-msg');
  const submitBtn = document.getElementById('save-email-btn');

  if (!newEmail || newEmail === currentUser.email) {
    if (msgEl) {
      msgEl.textContent = 'Please enter a new, different email address.';
      msgEl.className = 'text-xs text-red-600 font-medium text-center';
      msgEl.classList.remove('hidden');
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Requesting Change...</span>';
  }

  try {
    const { error } = await supabaseClient.auth.updateUser({
      email: newEmail
    });

    if (error) {
      if (msgEl) {
        msgEl.textContent = error.message;
        msgEl.className = 'text-xs text-red-600 font-medium text-center';
        msgEl.classList.remove('hidden');
      }
    } else {
      if (msgEl) {
        msgEl.textContent = `Confirmation links sent to both your current email and "${newEmail}". Please confirm both to complete the change.`;
        msgEl.className = 'text-xs text-green-700 font-bold text-center bg-green-50 p-3 rounded-xl border border-green-200';
        msgEl.classList.remove('hidden');
      }
    }
  } catch (err) {
    if (msgEl) {
      msgEl.textContent = err.message || 'Failed to request email change.';
      msgEl.className = 'text-xs text-red-600 font-medium text-center';
      msgEl.classList.remove('hidden');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Request Email Change</span>';
    }
  }
}

// Handle Update Profile Details (Name, Country, Phone)
async function handleUpdateProfile(firstName, lastName, country, dialCode, phone) {
  const msgEl = document.getElementById('details-feedback-msg');
  const submitBtn = document.getElementById('save-profile-details-btn');

  if (!firstName || !lastName || !phone) {
    if (msgEl) {
      msgEl.textContent = 'Please fill all required profile fields.';
      msgEl.className = 'text-xs text-red-600 font-medium text-center';
      msgEl.classList.remove('hidden');
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Saving Profile...</span>';
  }

  const fullName = `${firstName} ${lastName}`.trim();
  const formattedPhone = phone.startsWith('+') ? phone : `${dialCode} ${phone}`.trim();

  try {
    // 1. Update Supabase `public.profiles` table
    const { error: dbError } = await supabaseClient
      .from('profiles')
      .update({
        full_name: fullName,
        phone: formattedPhone,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentUser.id);

    if (dbError) throw dbError;

    // 2. Update Supabase `auth.users` user_metadata
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

    // Update in-memory profile
    userProfile.full_name = fullName;
    userProfile.phone = formattedPhone;

    if (msgEl) {
      msgEl.textContent = 'Profile details updated successfully!';
      msgEl.className = 'text-xs text-green-700 font-bold text-center bg-green-50 p-2.5 rounded-xl border border-green-200';
      msgEl.classList.remove('hidden');
    }

    // Re-render header
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

// Handle Real Supabase Sign Out (Purges Session State and In-Memory Orders)
async function handleSignOut() {
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      await supabaseClient.auth.signOut();
      currentUser = null;
      userProfile = null;
      pendingVerificationEmail = null;
      profileActiveTab = 'orders';
      currentAuthMode = 'login';
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
      if (mobileMenu) mobileMenu.classList.add('hidden');
      openProfile();
    });
  }

  // Close Profile Modal Button
  if (closeProfileBtn) {
    closeProfileBtn.addEventListener('click', closeProfile);
  }

  // Close Modal on Background Overlay Click
  const profileOverlay = document.getElementById('profile-overlay');
  if (profileOverlay) {
    profileOverlay.addEventListener('click', closeProfile);
  }

  // Escape key closes profile modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeProfile();
    }
  });

  // View order detail click delegation from order history cards
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

// Helper for opening menu section from inside profile
function browseMenuFromProfile() {
  closeProfile();
  const menuSection = document.getElementById('menu-section');
  if (menuSection) {
    menuSection.scrollIntoView({ behavior: 'smooth' });
  }
}

// Exports for testing / Node environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fetchOrCreateUserProfile,
    handleSignIn,
    handleSignUp,
    handleSignOut,
    handleForgotPassword,
    handleResetPassword,
    handleChangePassword,
    handleChangeEmail,
    handleUpdateProfile,
    renderProfileMain,
    openProfile,
    closeProfile,
    openOrderDetail
  };
}
