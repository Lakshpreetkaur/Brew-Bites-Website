/**
 * Brew & Bite - Notifications & Customer Communication Module (notifications.js)
 * Provides authenticated customer & admin notification centers, event-driven
 * notification triggers, Supabase Realtime updates, and RLS-protected database storage.
 */

// In-Memory Notifications State
let userNotifications = [];
let activeNotificationUserId = null;
let isNotificationPanelOpen = false;
let notificationRealtimeChannel = null;

/**
 * Format relative time (e.g. "Just now", "5m ago", "2h ago", "1d ago")
 */
function getRelativeTime(timestamp) {
  if (!timestamp) return 'Recently';
  const now = new Date();
  const date = new Date(timestamp);
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 30) return 'Just now';
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  const minutes = Math.floor(diffInSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * Get icon and style for notification type
 */
function getNotificationVisuals(type) {
  switch (type) {
    case 'order_placed':
      return { icon: 'receipt_long', bg: 'bg-secondary/15', text: 'text-secondary' };
    case 'order_status_update':
      return { icon: 'coffee_maker', bg: 'bg-primary/10', text: 'text-primary' };
    case 'payment_success':
      return { icon: 'check_circle', bg: 'bg-green-100', text: 'text-green-800' };
    case 'payment_failed':
      return { icon: 'error', bg: 'bg-red-100', text: 'text-red-800' };
    case 'payment_pending':
      return { icon: 'pending', bg: 'bg-amber-100', text: 'text-amber-800' };
    case 'order_cancelled':
      return { icon: 'cancel', bg: 'bg-red-100', text: 'text-red-800' };
    case 'admin_alert':
    case 'admin_new_order':
      return { icon: 'notifications_active', bg: 'bg-tertiary/20', text: 'text-tertiary' };
    default:
      return { icon: 'notifications', bg: 'bg-surface-container-high', text: 'text-primary' };
  }
}

/**
 * Fetch all notifications for active authenticated user from Supabase.
 */
async function fetchUserNotifications(userId) {
  if (!userId) {
    userNotifications = [];
    activeNotificationUserId = null;
    updateNotificationBadge();
    renderNotificationList();
    return [];
  }

  activeNotificationUserId = userId;

  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        console.warn("Notice: notifications table fetch note:", error.message);
        userNotifications = [];
      } else {
        userNotifications = data || [];
      }
    } catch (err) {
      console.warn("Could not fetch notifications from Supabase:", err);
      userNotifications = [];
    }
  }

  updateNotificationBadge();
  renderNotificationList();
  return userNotifications;
}

/**
 * Update Notification Badge counter in Navigation Bar.
 */
function updateNotificationBadge() {
  const badge = document.getElementById('notification-badge');
  const mobileBadge = document.getElementById('mobile-notification-badge');
  const unreadCount = userNotifications.filter(n => !n.read).length;

  [badge, mobileBadge].forEach(el => {
    if (!el) return;
    if (unreadCount > 0) {
      el.textContent = unreadCount > 9 ? '9+' : unreadCount;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });

  const countHeader = document.getElementById('notification-unread-header-count');
  if (countHeader) {
    countHeader.textContent = unreadCount > 0 ? `(${unreadCount} unread)` : '';
  }
}

/**
 * Render the Notifications list inside the Notification Panel.
 */
function renderNotificationList() {
  const container = document.getElementById('notification-list');
  if (!container) return;

  if (!activeNotificationUserId) {
    container.innerHTML = `
      <div class="py-10 px-4 text-center flex flex-col items-center justify-center">
        <span class="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-2">lock</span>
        <p class="font-display font-bold text-xs text-primary mb-1">Sign in to view notifications</p>
        <p class="text-[11px] text-on-surface-variant mb-4">Stay updated on your live orders and payments.</p>
        <button onclick="if(typeof openProfile==='function') openProfile(); toggleNotificationPanel(false);" class="bg-secondary-container text-on-secondary-container hover:bg-tertiary hover:text-on-tertiary font-label-bold text-xs px-4 py-2 rounded-full cursor-pointer transition-colors">
          <span>Sign In / Register</span>
        </button>
      </div>
    `;
    return;
  }

  if (userNotifications.length === 0) {
    container.innerHTML = `
      <div class="py-10 px-4 text-center flex flex-col items-center justify-center">
        <span class="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-2">notifications_none</span>
        <p class="font-display font-bold text-xs text-primary mb-1">No notifications yet</p>
        <p class="text-[11px] text-on-surface-variant">We'll alert you here when your orders update!</p>
      </div>
    `;
    return;
  }

  const itemsHTML = userNotifications.map(item => {
    const visuals = getNotificationVisuals(item.type);
    const relTime = getRelativeTime(item.created_at);
    const isUnread = !item.read;

    return `
      <div data-notification-id="${item.id}" data-order-id="${item.order_id || ''}" class="notification-item flex items-start gap-3 p-3.5 rounded-2xl transition-all cursor-pointer border ${isUnread ? 'bg-surface-container-high/40 border-outline-variant/30 hover:bg-surface-container-high' : 'bg-surface/50 border-outline-variant/15 hover:bg-surface'}">
        <div class="w-8 h-8 rounded-full ${visuals.bg} ${visuals.text} flex items-center justify-center flex-shrink-0 mt-0.5">
          <span class="material-symbols-outlined text-base">${visuals.icon}</span>
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-1 mb-0.5">
            <h4 class="text-xs font-bold text-primary truncate ${isUnread ? 'font-black' : ''}">${item.title}</h4>
            <span class="text-[10px] text-on-surface-variant/70 whitespace-nowrap flex-shrink-0">${relTime}</span>
          </div>
          <p class="text-[11px] text-on-surface-variant line-clamp-2 leading-relaxed">${item.message}</p>
        </div>

        ${isUnread ? `
          <div class="w-2 h-2 rounded-full bg-tertiary flex-shrink-0 mt-1.5 shadow-xs"></div>
        ` : ''}
      </div>
    `;
  }).join('');

  container.innerHTML = itemsHTML;

  // Attach item click handlers to mark read & navigate
  document.querySelectorAll('.notification-item').forEach(el => {
    el.addEventListener('click', async () => {
      const notifId = el.getAttribute('data-notification-id');
      const orderId = el.getAttribute('data-order-id');

      if (notifId) {
        await markNotificationAsRead(notifId);
      }

      toggleNotificationPanel(false);

      if (orderId && typeof openOrderDetail === 'function') {
        if (typeof openProfile === 'function') openProfile();
        openOrderDetail(orderId);
      }
    });
  });
}

/**
 * Toggle Notification Dropdown Panel visibility.
 */
function toggleNotificationPanel(forceState) {
  const panel = document.getElementById('notification-panel');
  if (!panel) return;

  if (typeof forceState === 'boolean') {
    isNotificationPanelOpen = forceState;
  } else {
    isNotificationPanelOpen = !isNotificationPanelOpen;
  }

  if (isNotificationPanelOpen) {
    panel.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
    panel.classList.add('opacity-100', 'pointer-events-auto', 'scale-100');
  } else {
    panel.classList.remove('opacity-100', 'pointer-events-auto', 'scale-100');
    panel.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
  }
}

/**
 * Mark a single notification as read in database and local cache.
 */
async function markNotificationAsRead(notificationId) {
  if (!notificationId) return;

  const notif = userNotifications.find(n => n.id === notificationId);
  if (notif) notif.read = true;

  updateNotificationBadge();
  renderNotificationList();

  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      await supabaseClient
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);
    } catch (e) {
      console.warn("Could not mark notification as read in Supabase:", e);
    }
  }
}

/**
 * Mark all notifications as read for the active user.
 */
async function markAllNotificationsAsRead() {
  if (!activeNotificationUserId) return;

  userNotifications.forEach(n => n.read = true);
  updateNotificationBadge();
  renderNotificationList();

  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      await supabaseClient
        .from('notifications')
        .update({ read: true })
        .eq('user_id', activeNotificationUserId)
        .eq('read', false);
    } catch (e) {
      console.warn("Could not mark all notifications as read in Supabase:", e);
    }
  }
}

/**
 * Dispatch a new notification into Supabase (non-blocking).
 */
async function createNotification(payload) {
  if (!payload || !payload.user_id || !payload.title || !payload.message) return null;

  const notifRecord = {
    user_id: payload.user_id,
    type: payload.type || 'general',
    title: payload.title,
    message: payload.message,
    order_id: payload.order_id || null,
    read: false
  };

  // If user is currently active, prepend to in-memory list
  if (activeNotificationUserId === payload.user_id) {
    userNotifications.unshift({
      ...notifRecord,
      id: notifRecord.id || `temp-${Date.now()}`,
      created_at: new Date().toISOString()
    });
    updateNotificationBadge();
    renderNotificationList();
  }

  // Persist to Supabase
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('notifications')
        .insert(notifRecord)
        .select()
        .maybeSingle();

      if (error) {
        console.warn("Notice: notifications insert note (fallback mode active):", error.message);
      }
      return data;
    } catch (err) {
      console.warn("Non-blocking notification insertion warning:", err);
    }
  }

  return null;
}

/**
 * Clear in-memory notification state when user signs out.
 */
function clearNotificationState() {
  userNotifications = [];
  activeNotificationUserId = null;
  toggleNotificationPanel(false);
  updateNotificationBadge();
  renderNotificationList();

  if (notificationRealtimeChannel && typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      supabaseClient.removeChannel(notificationRealtimeChannel);
      notificationRealtimeChannel = null;
    } catch (e) {
      console.warn("Could not remove notification realtime channel:", e);
    }
  }
  console.log("Notification session state cleared.");
}

/**
 * Establish Supabase Realtime channel for live in-app notifications.
 */
function subscribeToUserNotifications(userId) {
  if (!userId || typeof supabaseClient === 'undefined' || !supabaseClient) return;

  if (notificationRealtimeChannel) {
    supabaseClient.removeChannel(notificationRealtimeChannel);
    notificationRealtimeChannel = null;
  }

  try {
    notificationRealtimeChannel = supabaseClient
      .channel(`public:notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        async (payload) => {
          console.log("[Realtime Notification] New notification received:", payload);
          if (payload.new) {
            // Avoid duplicate in-memory record if already prepended
            const exists = userNotifications.some(n => n.id === payload.new.id);
            if (!exists) {
              userNotifications.unshift(payload.new);
              updateNotificationBadge();
              renderNotificationList();
            }
          }
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime Notification] Channel status: ${status}`);
      });
  } catch (err) {
    console.warn("Could not establish Realtime notifications subscription:", err);
  }
}

// ==============================================================================
// BUSINESS EVENT NOTIFICATION DISPATCHERS (CUSTOMER & ADMIN)
// ==============================================================================

/**
 * Triggered when a customer successfully places an order.
 */
async function notifyOrderPlaced(order, user) {
  if (!order || !user || !user.id) return;
  const ref = order.orderId || order.order_reference || 'Recent Order';
  const orderCurr = order.currency || order.payment?.currency || 'USD';
  const formattedAmount = (typeof formatHistoricalCurrency === 'function')
    ? formatHistoricalCurrency(order.subtotal, orderCurr)
    : `$${Number(order.subtotal || 0).toFixed(2)}`;

  // 1. Customer Notification: Order Placed
  await createNotification({
    user_id: user.id,
    type: 'order_placed',
    title: `Order Placed: ${ref}`,
    message: `Your order for ${formattedAmount} has been placed successfully. We are getting it ready!`,
    order_id: order.id
  });

  // 2. Customer Notification: Payment Status
  if (order.payment?.method === 'online' && order.payment?.status === 'paid') {
    await createNotification({
      user_id: user.id,
      type: 'payment_success',
      title: `Payment Successful (${formattedAmount})`,
      message: `Your online payment was verified. Ref: ${order.payment.transactionRef || ref}.`,
      order_id: order.id
    });
  } else if (order.payment?.method === 'cash_on_delivery') {
    await createNotification({
      user_id: user.id,
      type: 'payment_pending',
      title: `Cash on Delivery Selected`,
      message: `Amount due on pickup/delivery: ${formattedAmount}.`,
      order_id: order.id
    });
  }

  // 3. Admin Notification: New Order Alert
  await notifyAdminNewOrder(order);
}

/**
 * Triggered when order status changes in Supabase by Admin.
 */
async function notifyOrderStatusChanged(order, newStatus, customerUserId) {
  if (!order || !customerUserId) return;
  const ref = order.order_reference || order.orderId || order.id?.slice(0, 8);

  const statusDescriptions = {
    'confirmed': 'Your order has been confirmed by our baristas.',
    'preparing': 'Your order is currently being freshly brewed & prepared.',
    'ready': order.order_type === 'delivery' ? 'Your order is on the way for delivery!' : 'Your order is ready for pickup at the counter!',
    'delivered': 'Your order has been completed. Enjoy your Brew & Bite!',
    'cancelled': 'Your order has been cancelled.'
  };

  const desc = statusDescriptions[newStatus] || `Your order status changed to "${newStatus}".`;

  await createNotification({
    user_id: customerUserId,
    type: newStatus === 'cancelled' ? 'order_cancelled' : 'order_status_update',
    title: `Order #${ref}: ${newStatus.toUpperCase()}`,
    message: desc,
    order_id: order.id
  });
}

/**
 * Triggered when an order is cancelled by the customer.
 */
async function notifyOrderCancelled(order, user) {
  if (!order || !user || !user.id) return;
  const ref = order.orderId || order.order_reference || order.id?.slice(0, 8);

  // 1. Customer Notification
  await createNotification({
    user_id: user.id,
    type: 'order_cancelled',
    title: `Order #${ref} Cancelled`,
    message: `You have successfully cancelled order #${ref}. No charges were made.`,
    order_id: order.id
  });

  // 2. Admin Alert
  await notifyAdminOrderCancelled(order);
}

/**
 * Trigger Admin alert on new incoming order.
 */
async function notifyAdminNewOrder(order) {
  if (typeof supabaseClient === 'undefined' || !supabaseClient) return;
  const ref = order.orderId || order.order_reference || 'New Order';
  const custName = order.customer?.name || order.customer_name || 'Customer';
  const orderCurr = order.currency || order.payment?.currency || 'USD';
  const formattedAmount = (typeof formatHistoricalCurrency === 'function')
    ? formatHistoricalCurrency(order.subtotal, orderCurr)
    : `$${Number(order.subtotal || 0).toFixed(2)}`;

  try {
    // Find all profiles with role = 'admin'
    const { data: adminProfiles } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('role', 'admin');

    if (Array.isArray(adminProfiles)) {
      for (const admin of adminProfiles) {
        await createNotification({
          user_id: admin.id,
          type: 'admin_new_order',
          title: `🔔 New Order Received: ${ref}`,
          message: `New order from ${custName} for ${formattedAmount} (${order.customer?.orderType || order.order_type || 'pickup'}).`,
          order_id: order.id
        });
      }
    }
  } catch (err) {
    console.warn("Could not dispatch admin order notification:", err);
  }
}

/**
 * Trigger Admin alert on order cancellation.
 */
async function notifyAdminOrderCancelled(order) {
  if (typeof supabaseClient === 'undefined' || !supabaseClient) return;
  const ref = order.orderId || order.order_reference || order.id?.slice(0, 8);
  const custName = order.customer?.name || order.customer_name || 'Customer';

  try {
    const { data: adminProfiles } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('role', 'admin');

    if (Array.isArray(adminProfiles)) {
      for (const admin of adminProfiles) {
        await createNotification({
          user_id: admin.id,
          type: 'order_cancelled',
          title: `⚠️ Order #${ref} Cancelled`,
          message: `Customer ${custName} cancelled order #${ref}.`,
          order_id: order.id
        });
      }
    }
  } catch (err) {
    console.warn("Could not dispatch admin cancellation notification:", err);
  }
}

// Initialize Global Notification Handlers on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  const notifBtn = document.getElementById('notification-btn');
  const mobileNotifBtn = document.getElementById('mobile-notification-btn');
  const markAllReadBtn = document.getElementById('mark-all-read-btn');
  const closeNotifBtn = document.getElementById('close-notification-panel-btn');

  if (notifBtn) {
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNotificationPanel();
    });
  }

  if (mobileNotifBtn) {
    mobileNotifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNotificationPanel();
    });
  }

  if (markAllReadBtn) {
    markAllReadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      markAllNotificationsAsRead();
    });
  }

  if (closeNotifBtn) {
    closeNotifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNotificationPanel(false);
    });
  }

  // Close panel on outside click
  document.addEventListener('click', (e) => {
    const panel = document.getElementById('notification-panel');
    if (!panel || panel.classList.contains('opacity-0')) return;

    if (!panel.contains(e.target) && !notifBtn?.contains(e.target) && !mobileNotifBtn?.contains(e.target)) {
      toggleNotificationPanel(false);
    }
  });

  // Close on Escape Key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isNotificationPanelOpen) {
      toggleNotificationPanel(false);
    }
  });
});

// Exports for Node test environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fetchUserNotifications,
    createNotification,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    notifyOrderPlaced,
    notifyOrderStatusChanged,
    notifyOrderCancelled,
    notifyAdminNewOrder
  };
}
