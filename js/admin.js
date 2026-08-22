/**
 * Brew & Bite - Admin Dashboard & Business Intelligence Controller (admin.js)
 * Enterprise-grade analytics, revenue trend charts, order lifecycle management,
 * customer activity insights, CSV data export, and live product catalog controls.
 */

// In-Memory Admin State
let adminOrders = [];
let adminOrderItems = [];
let adminPayments = [];
let adminProfiles = [];
let adminProducts = [];
let adminReviews = [];
let isAdminDataLoading = false;

// Navigation & Filters
let adminCurrentTab = 'overview'; // 'overview' | 'orders' | 'customers' | 'products' | 'reviews'
let adminAnalyticsRange = '7days'; // 'today' | '7days' | 'month' | 'all'
let adminStatusFilter = 'all';
let adminPaymentFilter = 'all'; // 'all' | 'paid' | 'pending' | 'cod'
let adminDateSort = 'desc'; // 'desc' | 'asc'
let adminSearchQuery = '';

// Customer & Product Sub-filters
let adminCustomerSearchQuery = '';
let adminProductSearchQuery = '';
let adminProductCategoryFilter = 'all';
let adminProductAvailFilter = 'all';

let adminSelectedCustomer = null; // For customer order history drill-down modal
let adminEditingProduct = null;   // For product edit modal

/**
 * Check if active session is an authorized Admin.
 */
function isUserAdmin() {
  if (typeof currentUser === 'undefined' || !currentUser) return false;
  if (typeof userProfile === 'undefined' || !userProfile) return false;
  return userProfile.role === 'admin';
}

/**
 * Open the Admin Dashboard Modal.
 */
async function openAdminDashboard() {
  const adminModal = document.getElementById('admin-modal');
  if (!adminModal) return;

  if (!isUserAdmin()) {
    alert("Access Denied: Admin authorization required. Your account does not have admin privileges.");
    return;
  }

  // Close profile modal if open
  const profileModal = document.getElementById('profile-modal');
  if (profileModal) {
    profileModal.classList.remove('opacity-100', 'pointer-events-auto');
    profileModal.classList.add('opacity-0', 'pointer-events-none');
  }

  adminModal.classList.remove('opacity-0', 'pointer-events-none');
  adminModal.classList.add('opacity-100', 'pointer-events-auto');
  document.body.classList.add('overflow-hidden');

  await loadAdminData();
  renderAdminDashboard();
}

/**
 * Close the Admin Dashboard Modal.
 */
function closeAdminDashboard() {
  const adminModal = document.getElementById('admin-modal');
  if (!adminModal) return;

  adminModal.classList.remove('opacity-100', 'pointer-events-auto');
  adminModal.classList.add('opacity-0', 'pointer-events-none');
  document.body.classList.remove('overflow-hidden');
  adminSelectedCustomer = null;
  adminEditingProduct = null;
}

/**
 * Fetch all relational data from Supabase for admin inspection.
 */
async function loadAdminData() {
  if (typeof supabaseClient === 'undefined' || !supabaseClient) return;

  isAdminDataLoading = true;
  renderAdminDashboard();

  try {
    const [ordersRes, itemsRes, profilesRes, productsRes] = await Promise.all([
      supabaseClient.from('orders').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('order_items').select('*'),
      supabaseClient.from('profiles').select('id, full_name, email, phone, created_at, updated_at').order('created_at', { ascending: false }),
      supabaseClient.from('products').select('*').order('category', { ascending: true })
    ]);

    adminOrders = ordersRes.data || [];
    adminOrderItems = itemsRes.data || [];
    adminProfiles = profilesRes.data || [];
    adminProducts = productsRes.data || [];

    try {
      const { data: payData } = await supabaseClient.from('payments').select('*');
      adminPayments = payData || [];
    } catch (payErr) {
      console.warn("Notice: payments table query note:", payErr);
      adminPayments = [];
    }

    try {
      const { data: revData } = await supabaseClient.from('reviews').select('*').order('created_at', { ascending: false });
      adminReviews = revData || [];
    } catch (revErr) {
      console.warn("Notice: reviews table query note:", revErr);
      adminReviews = [];
    }

    console.log(`[Admin] Loaded ${adminOrders.length} orders, ${adminPayments.length} payments, ${adminOrderItems.length} items, ${adminProfiles.length} profiles, ${adminProducts.length} products, ${adminReviews.length} reviews.`);
  } catch (err) {
    console.error("Error loading admin data from Supabase:", err);
  } finally {
    isAdminDataLoading = false;
  }
}

/**
 * Update an order's status in Supabase.
 */
async function updateAdminOrderStatus(orderId, newStatus) {
  if (!orderId || !newStatus || !supabaseClient) return;

  try {
    const { error } = await supabaseClient
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      alert(`Could not update order status: ${error.message}`);
      return;
    }

    const found = adminOrders.find(o => o.id === orderId);
    if (found) {
      found.status = newStatus;

      // Dispatch in-app notification to customer (Non-blocking)
      if (typeof notifyOrderStatusChanged === 'function' && found.user_id) {
        notifyOrderStatusChanged(found, newStatus, found.user_id).catch(err => {
          console.warn("Notice: status notification dispatch note:", err);
        });
      }
    }

    renderAdminDashboard();
  } catch (err) {
    console.error("Error updating order status:", err);
  }
}

/**
 * Toggle product availability in Supabase.
 */
async function toggleAdminProductAvailability(productId, currentAvailable) {
  if (!productId || typeof updateProductInSupabase !== 'function') return;

  try {
    const newAvail = !currentAvailable;
    await updateProductInSupabase(productId, { available: newAvail });

    const p = adminProducts.find(item => item.id === productId);
    if (p) p.available = newAvail;

    renderAdminDashboard();
  } catch (err) {
    alert(`Could not update product availability: ${err.message}`);
  }
}

/**
 * Save product edits (name, price, category, description, image).
 */
async function saveProductEdit(productId, formData) {
  if (!productId || typeof updateProductInSupabase !== 'function') return;

  try {
    await updateProductInSupabase(productId, formData);
    await loadAdminData();
    adminEditingProduct = null;
    renderAdminDashboard();
  } catch (err) {
    alert(`Error updating product: ${err.message}`);
  }
}

/**
 * Add a new product to Supabase.
 */
async function handleAddNewProduct(formData) {
  if (typeof createProductInSupabase !== 'function') return;

  try {
    await createProductInSupabase(formData);
    await loadAdminData();
    adminEditingProduct = null;
    renderAdminDashboard();
  } catch (err) {
    alert(`Error creating product: ${err.message}`);
  }
}

/**
 * Filter orders according to active time range.
 */
function getFilteredOrdersByRange(range) {
  const now = new Date();
  if (range === 'today') {
    const todayStr = now.toISOString().split('T')[0];
    return adminOrders.filter(o => (o.created_at || '').startsWith(todayStr));
  } else if (range === '7days') {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return adminOrders.filter(o => new Date(o.created_at || 0) >= sevenDaysAgo);
  } else if (range === 'month') {
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return adminOrders.filter(o => {
      const d = new Date(o.created_at || 0);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  }
  return [...adminOrders]; // 'all'
}

/**
 * Main Render Controller for Admin Dashboard View.
 */
function renderAdminDashboard() {
  const container = document.getElementById('admin-dashboard-content');
  if (!container) return;

  if (isAdminDataLoading) {
    container.innerHTML = `
      <div class="py-24 flex flex-col items-center justify-center text-center">
        <div class="w-12 h-12 border-3 border-secondary-container border-t-tertiary rounded-full animate-spin mb-4"></div>
        <p class="font-display font-bold text-sm text-primary">Loading Admin Intelligence Workspace...</p>
        <p class="text-xs text-on-surface-variant">Synchronizing live data with Supabase Database</p>
      </div>
    `;
    return;
  }

  // 1. Calculate Time-Range Filtered Metrics
  const rangeOrders = getFilteredOrdersByRange(adminAnalyticsRange);
  const nonCancelledRangeOrders = rangeOrders.filter(o => o.status !== 'cancelled');

  const rangeRevenue = nonCancelledRangeOrders.reduce((sum, o) => sum + Number(o.subtotal || 0), 0);
  const totalOrdersCount = rangeOrders.length;
  const nonCancelledCount = nonCancelledRangeOrders.length;

  // Average Order Value (AOV)
  const aov = nonCancelledCount > 0 ? (rangeRevenue / nonCancelledCount) : 0;

  // Lifetime All-Time Stats
  const allNonCancelled = adminOrders.filter(o => o.status !== 'cancelled');
  const allRevenue = allNonCancelled.reduce((sum, o) => sum + Number(o.subtotal || 0), 0);
  const totalCustomers = adminProfiles.length;
  const totalProducts = adminProducts.length;

  // Repeat Customer Rate Calculation
  // Customers with > 1 completed order / Customers with >= 1 completed order * 100
  const customerOrderCounts = {};
  allNonCancelled.forEach(o => {
    if (o.user_id) {
      customerOrderCounts[o.user_id] = (customerOrderCounts[o.user_id] || 0) + 1;
    }
  });
  const customerWithOrdersCount = Object.keys(customerOrderCounts).length;
  const repeatCustomerCount = Object.values(customerOrderCounts).filter(count => count > 1).length;
  const repeatRate = customerWithOrdersCount > 0 ? ((repeatCustomerCount / customerWithOrdersCount) * 100) : 0;

  // Best-Selling Products Calculation
  const rangeOrderIds = new Set(rangeOrders.map(o => o.id));
  const productSalesMap = {};
  adminOrderItems.forEach(item => {
    if (adminAnalyticsRange === 'all' || rangeOrderIds.has(item.order_id)) {
      const key = item.product_name || item.product_id;
      if (!productSalesMap[key]) {
        productSalesMap[key] = { name: key, count: 0, revenue: 0 };
      }
      productSalesMap[key].count += Number(item.quantity || 1);
      productSalesMap[key].revenue += Number(item.line_total || 0);
    }
  });
  const bestSellers = Object.values(productSalesMap).sort((a, b) => b.count - a.count).slice(0, 4);

  // Top KPI Overview Cards (Enhanced with AOV & Repeat Rate)
  let contentHTML = `
    <!-- Time Range Selector & Export Header -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
      <!-- Time Range Filter Pills -->
      <div class="flex items-center gap-1.5 bg-surface p-1 rounded-2xl border border-outline-variant/30 shadow-xs">
        <button data-range="today" class="admin-range-btn px-3 py-1.5 rounded-xl text-xs font-label-bold transition-all cursor-pointer ${adminAnalyticsRange === 'today' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant hover:bg-surface-container-high'}">Today</button>
        <button data-range="7days" class="admin-range-btn px-3 py-1.5 rounded-xl text-xs font-label-bold transition-all cursor-pointer ${adminAnalyticsRange === '7days' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant hover:bg-surface-container-high'}">Last 7 Days</button>
        <button data-range="month" class="admin-range-btn px-3 py-1.5 rounded-xl text-xs font-label-bold transition-all cursor-pointer ${adminAnalyticsRange === 'month' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant hover:bg-surface-container-high'}">This Month</button>
        <button data-range="all" class="admin-range-btn px-3 py-1.5 rounded-xl text-xs font-label-bold transition-all cursor-pointer ${adminAnalyticsRange === 'all' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant hover:bg-surface-container-high'}">All Time</button>
      </div>

      <!-- Export to CSV Button -->
      <button id="admin-export-csv-btn" class="bg-secondary-container text-on-secondary-container hover:bg-tertiary hover:text-on-tertiary text-xs font-label-bold px-4 py-2 rounded-full transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95">
        <span class="material-symbols-outlined text-base">download</span>
        <span>Export Orders CSV</span>
      </button>
    </div>

    <!-- Top KPI Overview Metrics (6 Key Indicators) -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      <div class="bg-surface p-3.5 rounded-2xl border border-outline-variant/30 shadow-xs flex flex-col justify-between">
        <span class="text-[10px] font-label-bold text-on-surface-variant uppercase tracking-wider">Revenue (${adminAnalyticsRange})</span>
        <span class="font-display text-lg sm:text-xl font-black text-primary mt-1">$${rangeRevenue.toFixed(2)}</span>
        <span class="text-[9px] text-secondary font-medium mt-1">Excl. cancelled</span>
      </div>

      <div class="bg-surface p-3.5 rounded-2xl border border-outline-variant/30 shadow-xs flex flex-col justify-between">
        <span class="text-[10px] font-label-bold text-on-surface-variant uppercase tracking-wider">Orders Count</span>
        <span class="font-display text-lg sm:text-xl font-black text-primary mt-1">${totalOrdersCount}</span>
        <span class="text-[9px] text-on-surface-variant mt-1">${nonCancelledCount} fulfilled</span>
      </div>

      <div class="bg-surface p-3.5 rounded-2xl border border-outline-variant/30 shadow-xs flex flex-col justify-between">
        <span class="text-[10px] font-label-bold text-on-surface-variant uppercase tracking-wider">Avg Order Value (AOV)</span>
        <span class="font-display text-lg sm:text-xl font-black text-primary mt-1">$${aov.toFixed(2)}</span>
        <span class="text-[9px] text-on-surface-variant mt-1">Per completed order</span>
      </div>

      <div class="bg-surface p-3.5 rounded-2xl border border-outline-variant/30 shadow-xs flex flex-col justify-between">
        <span class="text-[10px] font-label-bold text-on-surface-variant uppercase tracking-wider">Repeat Rate</span>
        <span class="font-display text-lg sm:text-xl font-black text-primary mt-1">${repeatRate.toFixed(1)}%</span>
        <span class="text-[9px] text-on-surface-variant mt-1">${repeatCustomerCount} returning</span>
      </div>

      <div class="bg-surface p-3.5 rounded-2xl border border-outline-variant/30 shadow-xs flex flex-col justify-between">
        <span class="text-[10px] font-label-bold text-on-surface-variant uppercase tracking-wider">Customers</span>
        <span class="font-display text-lg sm:text-xl font-black text-primary mt-1">${totalCustomers}</span>
        <span class="text-[9px] text-on-surface-variant mt-1">${customerWithOrdersCount} with orders</span>
      </div>

      <div class="bg-surface p-3.5 rounded-2xl border border-outline-variant/30 shadow-xs flex flex-col justify-between">
        <span class="text-[10px] font-label-bold text-on-surface-variant uppercase tracking-wider">Menu Items</span>
        <span class="font-display text-lg sm:text-xl font-black text-primary mt-1">${totalProducts}</span>
        <span class="text-[9px] text-on-surface-variant mt-1">${adminProducts.filter(p => p.available).length} active</span>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="flex items-center gap-2 border-b border-outline-variant/20 pb-3 mb-6 overflow-x-auto">
      <button data-admin-tab="overview" class="admin-tab-btn px-4 py-2 rounded-full text-xs font-label-bold transition-all cursor-pointer ${adminCurrentTab === 'overview' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-high/60 text-on-surface-variant hover:bg-surface-container-high'}">
        <span>Analytics &amp; Trends</span>
      </button>
      <button data-admin-tab="orders" class="admin-tab-btn px-4 py-2 rounded-full text-xs font-label-bold transition-all cursor-pointer ${adminCurrentTab === 'orders' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-high/60 text-on-surface-variant hover:bg-surface-container-high'}">
        <span>Orders &amp; Payments (${adminOrders.length})</span>
      </button>
      <button data-admin-tab="customers" class="admin-tab-btn px-4 py-2 rounded-full text-xs font-label-bold transition-all cursor-pointer ${adminCurrentTab === 'customers' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-high/60 text-on-surface-variant hover:bg-surface-container-high'}">
        <span>Customers (${totalCustomers})</span>
      </button>
      <button data-admin-tab="products" class="admin-tab-btn px-4 py-2 rounded-full text-xs font-label-bold transition-all cursor-pointer ${adminCurrentTab === 'products' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-high/60 text-on-surface-variant hover:bg-surface-container-high'}">
        <span>Catalog (${totalProducts})</span>
      </button>
      <button data-admin-tab="reviews" class="admin-tab-btn px-4 py-2 rounded-full text-xs font-label-bold transition-all cursor-pointer ${adminCurrentTab === 'reviews' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-high/60 text-on-surface-variant hover:bg-surface-container-high'}">
        <span>Reviews (${adminReviews.length})</span>
      </button>
    </div>
  `;

  // Render Active Tab Content
  if (adminCurrentTab === 'overview') {
    contentHTML += renderOverviewTab(bestSellers, rangeOrders);
  } else if (adminCurrentTab === 'orders') {
    contentHTML += renderOrdersTab();
  } else if (adminCurrentTab === 'customers') {
    contentHTML += renderCustomersTab();
  } else if (adminCurrentTab === 'products') {
    contentHTML += renderProductsTab();
  } else if (adminCurrentTab === 'reviews') {
    contentHTML += renderReviewsTab();
  }

  // Drill-down Modal (Customer Orders)
  if (adminSelectedCustomer) {
    contentHTML += renderCustomerHistoryModal(adminSelectedCustomer);
  }

  // Product Edit / Create Modal
  if (adminEditingProduct !== null) {
    contentHTML += renderProductEditModal(adminEditingProduct);
  }

  container.innerHTML = contentHTML;
  attachAdminEvents();
}

/**
 * Generate lightweight responsive SVG line/area trend chart
 */
function generateRevenueTrendSVG(rangeOrders) {
  // Aggregate daily revenue
  const dailyMap = {};
  const numDays = adminAnalyticsRange === 'today' ? 1 : (adminAnalyticsRange === '7days' ? 7 : (adminAnalyticsRange === 'month' ? 30 : 14));
  const now = new Date();

  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    dailyMap[key] = { label, revenue: 0, count: 0 };
  }

  rangeOrders.forEach(o => {
    if (o.status !== 'cancelled' && o.created_at) {
      const key = o.created_at.split('T')[0];
      if (dailyMap[key]) {
        dailyMap[key].revenue += Number(o.subtotal || 0);
        dailyMap[key].count += 1;
      }
    }
  });

  const points = Object.values(dailyMap);
  const maxRevenue = Math.max(10, ...points.map(p => p.revenue));

  const width = 500;
  const height = 160;
  const paddingX = 30;
  const paddingY = 25;

  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;

  const stepX = points.length > 1 ? chartW / (points.length - 1) : chartW / 2;

  const coords = points.map((p, idx) => {
    const x = paddingX + (points.length > 1 ? idx * stepX : chartW / 2);
    const y = height - paddingY - ((p.revenue / maxRevenue) * chartH);
    return { ...p, x, y };
  });

  const pathD = coords.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const areaD = coords.length > 0
    ? `${pathD} L ${coords[coords.length - 1].x} ${height - paddingY} L ${coords[0].x} ${height - paddingY} Z`
    : '';

  return `
    <div class="w-full flex flex-col">
      <div class="flex items-center justify-between text-xs text-on-surface-variant mb-2">
        <span class="font-bold text-primary">Daily Revenue Trend ($)</span>
        <span>Peak: <strong class="text-primary font-bold">$${maxRevenue.toFixed(2)}</strong></span>
      </div>
      <div class="relative w-full h-[180px] bg-surface-container-high/20 rounded-2xl p-2 border border-outline-variant/20">
        <svg viewBox="0 0 ${width} ${height}" class="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="revenueGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#805b10" stop-opacity="0.35" />
              <stop offset="100%" stop-color="#805b10" stop-opacity="0.0" />
            </linearGradient>
          </defs>

          <!-- Horizontal Gridlines -->
          <line x1="${paddingX}" y1="${paddingY}" x2="${width - paddingX}" y2="${paddingY}" stroke="#e0e0e0" stroke-dasharray="3" stroke-width="1" />
          <line x1="${paddingX}" y1="${paddingY + chartH / 2}" x2="${width - paddingX}" y2="${paddingY + chartH / 2}" stroke="#e0e0e0" stroke-dasharray="3" stroke-width="1" />
          <line x1="${paddingX}" y1="${height - paddingY}" x2="${width - paddingX}" y2="${height - paddingY}" stroke="#ccc" stroke-width="1.5" />

          <!-- Filled Area Gradient -->
          <path d="${areaD}" fill="url(#revenueGrad)" />

          <!-- Line Chart Path -->
          <path d="${pathD}" fill="none" stroke="#805b10" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

          <!-- Interactive Points & Labels -->
          ${coords.map(pt => `
            <circle cx="${pt.x}" cy="${pt.y}" r="4" fill="#805b10" stroke="#ffffff" stroke-width="2" />
            <text x="${pt.x}" y="${height - 8}" text-anchor="middle" font-size="9" font-weight="600" fill="#666">${pt.label}</text>
            ${pt.revenue > 0 ? `<text x="${pt.x}" y="${pt.y - 8}" text-anchor="middle" font-size="9" font-weight="bold" fill="#805b10">$${pt.revenue.toFixed(0)}</text>` : ''}
          `).join('')}
        </svg>
      </div>
    </div>
  `;
}

/**
 * Tab 1: Overview Layout with Trend Chart, Distributions, Best Sellers & Recent Orders
 */
function renderOverviewTab(bestSellers, rangeOrders) {
  const recentOrders = rangeOrders.slice(0, 5);

  // Status Distribution Calculation
  const statuses = ['placed', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
  const statusCounts = {};
  statuses.forEach(s => statusCounts[s] = 0);
  rangeOrders.forEach(o => {
    const s = (o.status || 'placed').toLowerCase();
    if (statusCounts[s] !== undefined) statusCounts[s]++;
    else statusCounts['placed']++;
  });

  // Payment Method Distribution Calculation
  const rangeOrderIds = new Set(rangeOrders.map(o => o.id));
  let onlineCount = 0;
  let codCount = 0;
  adminPayments.forEach(p => {
    if (rangeOrderIds.has(p.order_id)) {
      if (p.payment_method === 'online') onlineCount++;
      else codCount++;
    }
  });
  if (onlineCount === 0 && codCount === 0) {
    rangeOrders.forEach(o => {
      if (o.payment_method === 'online') onlineCount++;
      else codCount++;
    });
  }
  const totalPay = (onlineCount + codCount) || 1;
  const onlinePct = Math.round((onlineCount / totalPay) * 100);
  const codPct = Math.round((codCount / totalPay) * 100);

  const recentOrdersRows = recentOrders.length === 0
    ? `<tr><td colspan="5" class="py-6 text-center text-xs text-on-surface-variant">No orders recorded for this time range.</td></tr>`
    : recentOrders.map(order => {
        const profile = adminProfiles.find(p => p.id === order.user_id);
        const customerName = profile?.full_name || order.customer_name || 'Customer';
        const dateStr = order.created_at ? new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Recent';

        return `
          <tr class="border-b border-outline-variant/15 hover:bg-surface/50 text-xs">
            <td class="py-3 px-3 font-display font-bold text-primary">${order.order_reference || order.id?.slice(0, 8)}</td>
            <td class="py-3 px-3 text-primary font-medium">${customerName}</td>
            <td class="py-3 px-3 text-on-surface-variant">${dateStr}</td>
            <td class="py-3 px-3 font-bold text-primary">$${Number(order.subtotal || 0).toFixed(2)}</td>
            <td class="py-3 px-3">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-label-bold uppercase tracking-wider ${getStatusBadgeClass(order.status)}">${order.status || 'placed'}</span>
            </td>
          </tr>
        `;
      }).join('');

  const bestSellersHTML = bestSellers.length === 0
    ? `<p class="text-xs text-on-surface-variant">No sales recorded in this time range.</p>`
    : bestSellers.map((b, idx) => `
        <div class="flex items-center justify-between p-3 rounded-xl bg-surface border border-outline-variant/20 shadow-xs">
          <div class="flex items-center gap-3">
            <span class="w-6 h-6 rounded-full bg-secondary-container text-on-secondary-container font-display font-bold text-xs flex items-center justify-center">${idx + 1}</span>
            <div>
              <span class="font-bold text-xs text-primary block">${b.name}</span>
              <span class="text-[11px] text-on-surface-variant">${b.count} ordered</span>
            </div>
          </div>
          <span class="font-black text-xs text-primary">$${b.revenue.toFixed(2)}</span>
        </div>
      `).join('');

  return `
    <div class="flex flex-col gap-6">
      
      <!-- Top Row: Interactive SVG Revenue Trend & Distributions -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Revenue Trend Visual Chart (Left 2 Columns) -->
        <div class="lg:col-span-2 bg-surface rounded-2xl p-5 border border-outline-variant/30 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h4 class="font-display text-base font-bold text-primary">Sales &amp; Revenue Analytics</h4>
              <p class="text-xs text-on-surface-variant">Real-time daily transaction velocity</p>
            </div>
            <span class="px-2.5 py-1 rounded-full bg-secondary-container/40 text-on-secondary-container text-[11px] font-label-bold uppercase">${adminAnalyticsRange}</span>
          </div>
          ${generateRevenueTrendSVG(rangeOrders)}
        </div>

        <!-- Distributions Widget (Right 1 Column) -->
        <div class="bg-surface rounded-2xl p-5 border border-outline-variant/30 shadow-xs flex flex-col gap-4">
          <!-- Order Status Distribution -->
          <div>
            <h4 class="font-display text-xs font-bold text-primary uppercase tracking-wider mb-2.5">Order Lifecycle Breakdown</h4>
            <div class="flex flex-col gap-2 text-xs">
              ${statuses.map(st => {
                const count = statusCounts[st] || 0;
                const pct = rangeOrders.length > 0 ? ((count / rangeOrders.length) * 100).toFixed(0) : 0;
                return `
                  <div class="flex flex-col gap-1">
                    <div class="flex items-center justify-between text-[11px]">
                      <span class="capitalize font-bold text-primary">${st}</span>
                      <span class="text-on-surface-variant font-medium">${count} (${pct}%)</span>
                    </div>
                    <div class="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                      <div class="h-full bg-primary rounded-full" style="width: ${pct}%"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Payment Method Distribution -->
          <div class="border-t border-outline-variant/15 pt-3">
            <h4 class="font-display text-xs font-bold text-primary uppercase tracking-wider mb-2">Payment Methods</h4>
            <div class="grid grid-cols-2 gap-2 text-center text-xs">
              <div class="p-2.5 rounded-xl bg-surface-container-high/30 border border-outline-variant/20 flex flex-col">
                <span class="text-[10px] font-bold text-on-surface-variant">Online</span>
                <span class="font-black text-sm text-primary mt-0.5">${onlineCount}</span>
                <span class="text-[10px] text-green-700 font-bold">${onlinePct}%</span>
              </div>
              <div class="p-2.5 rounded-xl bg-surface-container-high/30 border border-outline-variant/20 flex flex-col">
                <span class="text-[10px] font-bold text-on-surface-variant">Cash on Delivery</span>
                <span class="font-black text-sm text-primary mt-0.5">${codCount}</span>
                <span class="text-[10px] text-secondary font-bold">${codPct}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Row: Recent Orders Feed & Best-Selling Products -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Recent Orders Feed -->
        <div class="lg:col-span-2 bg-surface rounded-2xl p-5 border border-outline-variant/30 shadow-xs">
          <div class="flex items-center justify-between mb-4">
            <h4 class="font-display text-base font-bold text-primary">Recent Orders Feed</h4>
            <button data-admin-tab="orders" class="admin-tab-btn text-xs font-label-bold text-secondary hover:text-tertiary cursor-pointer">View All Orders →</button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left">
              <thead>
                <tr class="border-b border-outline-variant/20 text-[11px] font-label-bold text-on-surface-variant uppercase tracking-wider">
                  <th class="py-2 px-3">Order Ref</th>
                  <th class="py-2 px-3">Customer</th>
                  <th class="py-2 px-3">Date</th>
                  <th class="py-2 px-3">Total</th>
                  <th class="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                ${recentOrdersRows}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Best-Selling Products -->
        <div class="bg-surface rounded-2xl p-5 border border-outline-variant/30 shadow-xs flex flex-col gap-3">
          <h4 class="font-display text-base font-bold text-primary mb-1">🔥 Top-Selling Products</h4>
          <div class="flex flex-col gap-2.5">
            ${bestSellersHTML}
          </div>
        </div>
      </div>

    </div>
  `;
}

/**
 * Tab 2: Orders & Payments Management Layout
 */
function renderOrdersTab() {
  let filtered = [...adminOrders];

  if (adminStatusFilter !== 'all') {
    filtered = filtered.filter(o => (o.status || 'placed').toLowerCase() === adminStatusFilter.toLowerCase());
  }

  if (adminPaymentFilter !== 'all') {
    filtered = filtered.filter(o => {
      const p = adminPayments.find(pay => pay.order_id === o.id);
      if (adminPaymentFilter === 'paid') return p?.payment_status === 'paid';
      if (adminPaymentFilter === 'pending') return p?.payment_status === 'pending';
      if (adminPaymentFilter === 'cod') return p?.payment_method === 'cash_on_delivery' || !p;
      return true;
    });
  }

  if (adminSearchQuery) {
    const q = adminSearchQuery.toLowerCase();
    filtered = filtered.filter(o => {
      const ref = (o.order_reference || '').toLowerCase();
      const profile = adminProfiles.find(p => p.id === o.user_id);
      const name = (profile?.full_name || o.customer_name || '').toLowerCase();
      const email = (profile?.email || o.customer_email || '').toLowerCase();
      return ref.includes(q) || name.includes(q) || email.includes(q);
    });
  }

  filtered.sort((a, b) => {
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    return adminDateSort === 'asc' ? timeA - timeB : timeB - timeA;
  });

  const orderCardsHTML = filtered.length === 0
    ? `<div class="p-8 text-center bg-surface rounded-2xl border border-outline-variant/20 text-xs text-on-surface-variant">No orders match your filter criteria.</div>`
    : filtered.map(order => {
        const profile = adminProfiles.find(p => p.id === order.user_id);
        const customerName = profile?.full_name || order.customer_name || 'Brew & Bite Customer';
        const customerEmail = profile?.email || order.customer_email || 'No email provided';
        const customerPhone = profile?.phone || order.customer_phone || 'No phone provided';
        const dateStr = order.created_at
          ? new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          : 'Recent';

        const payment = adminPayments.find(p => p.order_id === order.id);
        const isPaid = payment?.payment_status === 'paid';
        const isCOD = payment?.payment_method === 'cash_on_delivery' || !payment;
        const txnRef = payment?.transaction_ref || `COD-${order.order_reference || order.id?.slice(0, 8)}`;

        const items = adminOrderItems.filter(item => item.order_id === order.id);

        const itemsHTML = items.length === 0
          ? `<p class="text-xs text-on-surface-variant">No line item details recorded.</p>`
          : items.map(item => `
              <div class="flex items-center justify-between py-1 border-b border-outline-variant/10 text-xs">
                <div>
                  <span class="font-bold text-primary">${item.product_name || item.product_id}</span>
                  <span class="text-[11px] text-on-surface-variant ml-1.5">$${Number(item.unit_price || 0).toFixed(2)} × ${item.quantity}</span>
                </div>
                <span class="font-bold text-primary">$${Number(item.line_total || 0).toFixed(2)}</span>
              </div>
            `).join('');

        return `
          <div class="bg-surface rounded-2xl p-4 sm:p-5 border border-outline-variant/30 shadow-xs flex flex-col gap-3.5">
            <!-- Order Header -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-outline-variant/15 pb-3">
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-display text-base font-black text-primary">${order.order_reference || order.id?.slice(0, 8)}</span>
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-label-bold uppercase tracking-wider ${getStatusBadgeClass(order.status)}">${order.status || 'placed'}</span>
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-label-bold uppercase tracking-wider ${isPaid ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}">
                    ${isCOD ? 'COD: Pending' : (isPaid ? 'Online: Paid' : 'Online: Pending')}
                  </span>
                </div>
                <p class="text-[11px] text-on-surface-variant mt-0.5">${dateStr} • ID: ${order.id}</p>
              </div>

              <!-- Status Changer Dropdown -->
              <div class="flex items-center gap-2">
                <label class="text-[11px] font-label-bold text-on-surface-variant">Status:</label>
                <select data-order-id="${order.id}" class="order-status-select text-xs font-label-bold bg-surface-container-high/60 border border-outline-variant/40 rounded-lg px-2.5 py-1.5 text-primary cursor-pointer">
                  <option value="placed" ${order.status === 'placed' ? 'selected' : ''}>Placed</option>
                  <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                  <option value="preparing" ${order.status === 'preparing' ? 'selected' : ''}>Preparing</option>
                  <option value="ready" ${order.status === 'ready' ? 'selected' : ''}>Ready</option>
                  <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                  <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
              </div>
            </div>

            <!-- Customer, Delivery & Payment Information -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs bg-surface-container-high/30 p-3.5 rounded-xl border border-outline-variant/15">
              <div>
                <span class="text-on-surface-variant font-bold block mb-0.5">Customer:</span>
                <span class="text-primary font-medium">${customerName}</span>
              </div>
              <div>
                <span class="text-on-surface-variant font-bold block mb-0.5">Email:</span>
                <span class="text-primary font-medium">${customerEmail}</span>
              </div>
              <div>
                <span class="text-on-surface-variant font-bold block mb-0.5">Phone:</span>
                <span class="text-primary font-medium">${customerPhone}</span>
              </div>
              <div>
                <span class="text-on-surface-variant font-bold block mb-0.5">Payment Method:</span>
                <span class="text-secondary font-bold uppercase">${isCOD ? 'Cash on Delivery' : 'Online Payment'}</span>
              </div>
              <div>
                <span class="text-on-surface-variant font-bold block mb-0.5">Txn Ref:</span>
                <span class="font-mono text-primary font-medium text-[11px]">${txnRef}</span>
              </div>
              ${order.order_type ? `
                <div>
                  <span class="text-on-surface-variant font-bold block mb-0.5">Type:</span>
                  <span class="text-secondary font-bold uppercase">${order.order_type}</span>
                </div>
              ` : ''}
              ${order.delivery_address ? `
                <div class="sm:col-span-3">
                  <span class="text-on-surface-variant font-bold block mb-0.5">Delivery Address:</span>
                  <span class="text-primary font-medium">${order.delivery_address}</span>
                </div>
              ` : ''}
            </div>

            <!-- Line Items Breakdown -->
            <div class="flex flex-col gap-1">
              <span class="text-[11px] font-label-bold text-on-surface-variant uppercase tracking-wider">Line Items</span>
              <div class="max-h-[140px] overflow-y-auto pr-1">
                ${itemsHTML}
              </div>
            </div>

            <!-- Total Calculation -->
            <div class="border-t border-outline-variant/20 pt-2.5 flex items-center justify-between">
              <span class="text-xs font-label-bold text-on-surface-variant">Total Amount</span>
              <span class="font-display font-black text-lg text-primary">$${Number(order.subtotal || 0).toFixed(2)}</span>
            </div>
          </div>
        `;
      }).join('');

  return `
    <div class="flex flex-col gap-4">
      <!-- Search & Filters Bar -->
      <div class="flex flex-col gap-3 bg-surface p-4 rounded-2xl border border-outline-variant/25">
        <div class="flex flex-col md:flex-row items-center justify-between gap-3">
          <input id="admin-orders-search" type="text" placeholder="Search by Order Ref, Customer Name, or Email..." value="${adminSearchQuery}" class="w-full md:w-80 text-xs px-3.5 py-2 rounded-xl bg-surface-container-high/40 border border-outline-variant/40 text-primary focus:outline-none focus:border-tertiary" />

          <!-- Date Sort Selector -->
          <div class="flex items-center gap-2 self-end md:self-auto">
            <span class="text-[11px] font-label-bold text-on-surface-variant">Sort:</span>
            <select id="admin-date-sort" class="text-[11px] font-label-bold bg-surface-container-high/60 border border-outline-variant/40 rounded-lg px-2.5 py-1.5 text-primary cursor-pointer">
              <option value="desc" ${adminDateSort === 'desc' ? 'selected' : ''}>Newest First</option>
              <option value="asc" ${adminDateSort === 'asc' ? 'selected' : ''}>Oldest First</option>
            </select>
          </div>
        </div>

        <!-- Filter Pills Rows -->
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-outline-variant/15 pt-3">
          <div class="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
            <span class="text-[10px] uppercase font-label-bold text-on-surface-variant mr-1">Status:</span>
            <button data-filter="all" class="admin-status-filter-btn px-2.5 py-1 rounded-full text-[11px] font-label-bold transition-all cursor-pointer ${adminStatusFilter === 'all' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-high/50 text-on-surface-variant'}">All</button>
            <button data-filter="placed" class="admin-status-filter-btn px-2.5 py-1 rounded-full text-[11px] font-label-bold transition-all cursor-pointer ${adminStatusFilter === 'placed' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-high/50 text-on-surface-variant'}">Placed</button>
            <button data-filter="confirmed" class="admin-status-filter-btn px-2.5 py-1 rounded-full text-[11px] font-label-bold transition-all cursor-pointer ${adminStatusFilter === 'confirmed' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-high/50 text-on-surface-variant'}">Confirmed</button>
            <button data-filter="preparing" class="admin-status-filter-btn px-2.5 py-1 rounded-full text-[11px] font-label-bold transition-all cursor-pointer ${adminStatusFilter === 'preparing' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-high/50 text-on-surface-variant'}">Preparing</button>
            <button data-filter="ready" class="admin-status-filter-btn px-2.5 py-1 rounded-full text-[11px] font-label-bold transition-all cursor-pointer ${adminStatusFilter === 'ready' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-high/50 text-on-surface-variant'}">Ready</button>
            <button data-filter="delivered" class="admin-status-filter-btn px-2.5 py-1 rounded-full text-[11px] font-label-bold transition-all cursor-pointer ${adminStatusFilter === 'delivered' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-high/50 text-on-surface-variant'}">Delivered</button>
            <button data-filter="cancelled" class="admin-status-filter-btn px-2.5 py-1 rounded-full text-[11px] font-label-bold transition-all cursor-pointer ${adminStatusFilter === 'cancelled' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-high/50 text-on-surface-variant'}">Cancelled</button>
          </div>

          <div class="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
            <span class="text-[10px] uppercase font-label-bold text-on-surface-variant mr-1">Payment:</span>
            <button data-pay-filter="all" class="admin-pay-filter-btn px-2.5 py-1 rounded-full text-[11px] font-label-bold transition-all cursor-pointer ${adminPaymentFilter === 'all' ? 'bg-primary text-on-primary' : 'bg-surface-container-high/50 text-on-surface-variant'}">All</button>
            <button data-pay-filter="paid" class="admin-pay-filter-btn px-2.5 py-1 rounded-full text-[11px] font-label-bold transition-all cursor-pointer ${adminPaymentFilter === 'paid' ? 'bg-green-700 text-white' : 'bg-surface-container-high/50 text-on-surface-variant'}">Paid</button>
            <button data-pay-filter="pending" class="admin-pay-filter-btn px-2.5 py-1 rounded-full text-[11px] font-label-bold transition-all cursor-pointer ${adminPaymentFilter === 'pending' ? 'bg-amber-700 text-white' : 'bg-surface-container-high/50 text-on-surface-variant'}">Pending</button>
            <button data-pay-filter="cod" class="admin-pay-filter-btn px-2.5 py-1 rounded-full text-[11px] font-label-bold transition-all cursor-pointer ${adminPaymentFilter === 'cod' ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high/50 text-on-surface-variant'}">COD</button>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-3">
        ${orderCardsHTML}
      </div>
    </div>
  `;
}

/**
 * Tab 3: Customers Directory Layout with Search
 */
function renderCustomersTab() {
  let filteredCustomers = [...adminProfiles];

  if (adminCustomerSearchQuery) {
    const q = adminCustomerSearchQuery.toLowerCase();
    filteredCustomers = filteredCustomers.filter(p => {
      const name = (p.full_name || '').toLowerCase();
      const email = (p.email || '').toLowerCase();
      const phone = (p.phone || '').toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q);
    });
  }

  const customerRows = filteredCustomers.length === 0
    ? `<tr><td colspan="7" class="py-6 text-center text-xs text-on-surface-variant">No customers match your search query.</td></tr>`
    : filteredCustomers.map(p => {
        const userOrders = adminOrders.filter(o => o.user_id === p.id);
        const spend = userOrders
          .filter(o => o.status !== 'cancelled')
          .reduce((sum, o) => sum + Number(o.subtotal || 0), 0);
        const joinDate = p.created_at ? new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown';

        return `
          <tr class="border-b border-outline-variant/15 hover:bg-surface/50 text-xs">
            <td class="py-3 px-3 font-bold text-primary">${p.full_name || 'Member'}</td>
            <td class="py-3 px-3 text-on-surface-variant">${p.email || '—'}</td>
            <td class="py-3 px-3 text-on-surface-variant">${p.phone || '—'}</td>
            <td class="py-3 px-3 text-on-surface-variant">${joinDate}</td>
            <td class="py-3 px-3 font-bold text-primary">${userOrders.length}</td>
            <td class="py-3 px-3 font-black text-primary">$${spend.toFixed(2)}</td>
            <td class="py-3 px-3 text-right">
              <button data-customer-id="${p.id}" class="admin-view-customer-orders-btn text-xs font-label-bold text-secondary hover:text-tertiary px-3 py-1 rounded-full border border-outline-variant/30 hover:bg-surface-container-high cursor-pointer">
                View History (${userOrders.length})
              </button>
            </td>
          </tr>
        `;
      }).join('');

  return `
    <div class="bg-surface rounded-2xl p-5 border border-outline-variant/30 shadow-xs flex flex-col gap-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 class="font-display text-base font-bold text-primary">Customer Directory</h4>
          <span class="text-xs text-on-surface-variant">${filteredCustomers.length} of ${adminProfiles.length} Total Customers</span>
        </div>
        <input id="admin-customers-search" type="text" placeholder="Search by Name, Email, or Phone..." value="${adminCustomerSearchQuery}" class="w-full sm:w-72 text-xs px-3.5 py-2 rounded-xl bg-surface-container-high/40 border border-outline-variant/40 text-primary focus:outline-none focus:border-tertiary" />
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="border-b border-outline-variant/20 text-[11px] font-label-bold text-on-surface-variant uppercase tracking-wider">
              <th class="py-2 px-3">Customer Name</th>
              <th class="py-2 px-3">Email</th>
              <th class="py-2 px-3">Phone</th>
              <th class="py-2 px-3">Registration Date</th>
              <th class="py-2 px-3">Orders</th>
              <th class="py-2 px-3">Total Spend</th>
              <th class="py-2 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            ${customerRows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * Tab 4: Catalog Management Layout with Search and Filters
 */
function renderProductsTab() {
  let filteredProducts = [...adminProducts];

  if (adminProductCategoryFilter !== 'all') {
    filteredProducts = filteredProducts.filter(p => (p.category || '').toLowerCase() === adminProductCategoryFilter.toLowerCase());
  }

  if (adminProductAvailFilter !== 'all') {
    if (adminProductAvailFilter === 'available') filteredProducts = filteredProducts.filter(p => p.available);
    else if (adminProductAvailFilter === 'soldout') filteredProducts = filteredProducts.filter(p => !p.available);
  }

  if (adminProductSearchQuery) {
    const q = adminProductSearchQuery.toLowerCase();
    filteredProducts = filteredProducts.filter(p => (p.name || '').toLowerCase().includes(q) || (p.id || '').toLowerCase().includes(q));
  }

  const productRows = filteredProducts.length === 0
    ? `<tr><td colspan="5" class="py-6 text-center text-xs text-on-surface-variant">No products match your filter criteria.</td></tr>`
    : filteredProducts.map(p => {
        return `
          <tr class="border-b border-outline-variant/15 hover:bg-surface/50 text-xs">
            <td class="py-3 px-3">
              <div class="flex items-center gap-2.5">
                <div class="w-10 h-10 rounded-lg overflow-hidden bg-surface-container-high flex-shrink-0">
                  <img src="${p.image || 'assets/frames/ezgif-frame-001.jpg'}" alt="${p.name}" class="w-full h-full object-cover" />
                </div>
                <div>
                  <span class="font-bold text-primary block">${p.name}</span>
                  <span class="text-[10px] text-on-surface-variant">${p.id}</span>
                </div>
              </div>
            </td>
            <td class="py-3 px-3 capitalize text-on-surface-variant">${p.category}</td>
            <td class="py-3 px-3 font-bold text-primary">$${Number(p.price || 0).toFixed(2)}</td>
            <td class="py-3 px-3">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-label-bold uppercase ${p.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                ${p.available ? 'Available' : 'Sold Out'}
              </span>
            </td>
            <td class="py-3 px-3 text-right">
              <div class="flex items-center justify-end gap-1.5">
                <button data-product-id="${p.id}" data-current-avail="${p.available}" class="admin-toggle-avail-btn text-xs font-label-bold px-3 py-1 rounded-full border border-outline-variant/40 hover:bg-surface-container-high transition-colors cursor-pointer">
                  <span>${p.available ? 'Mark Sold Out' : 'Mark Available'}</span>
                </button>
                <button data-edit-product-id="${p.id}" class="admin-open-edit-product-btn text-xs font-label-bold px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container hover:bg-tertiary hover:text-on-tertiary transition-colors cursor-pointer">
                  <span>Edit</span>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

  return `
    <div class="flex flex-col gap-4">
      <!-- Catalog Controls & Filters -->
      <div class="bg-surface rounded-2xl p-5 border border-outline-variant/30 shadow-xs flex flex-col gap-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 class="font-display text-base font-bold text-primary">Catalog Management</h4>
            <span class="text-xs text-on-surface-variant font-medium">${filteredProducts.length} of ${adminProducts.length} Items</span>
          </div>
          <button id="admin-add-product-btn" class="bg-primary text-on-primary hover:bg-tertiary text-xs font-label-bold px-4 py-2 rounded-full transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto shadow-sm">
            <span class="material-symbols-outlined text-sm">add</span>
            <span>Add Product</span>
          </button>
        </div>

        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-outline-variant/15 pt-3">
          <input id="admin-products-search" type="text" placeholder="Search product name..." value="${adminProductSearchQuery}" class="w-full sm:w-60 text-xs px-3.5 py-1.5 rounded-xl bg-surface-container-high/40 border border-outline-variant/40 text-primary focus:outline-none focus:border-tertiary" />

          <div class="flex items-center gap-2 flex-wrap">
            <select id="admin-prod-category-select" class="text-xs font-label-bold bg-surface-container-high/60 border border-outline-variant/40 rounded-lg px-2.5 py-1.5 text-primary cursor-pointer">
              <option value="all" ${adminProductCategoryFilter === 'all' ? 'selected' : ''}>All Categories</option>
              <option value="coffee" ${adminProductCategoryFilter === 'coffee' ? 'selected' : ''}>Coffee</option>
              <option value="bites" ${adminProductCategoryFilter === 'bites' ? 'selected' : ''}>Bites</option>
            </select>

            <select id="admin-prod-avail-select" class="text-xs font-label-bold bg-surface-container-high/60 border border-outline-variant/40 rounded-lg px-2.5 py-1.5 text-primary cursor-pointer">
              <option value="all" ${adminProductAvailFilter === 'all' ? 'selected' : ''}>All Status</option>
              <option value="available" ${adminProductAvailFilter === 'available' ? 'selected' : ''}>Available Only</option>
              <option value="soldout" ${adminProductAvailFilter === 'soldout' ? 'selected' : ''}>Sold Out Only</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Products Table -->
      <div class="bg-surface rounded-2xl p-5 border border-outline-variant/30 shadow-xs overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="border-b border-outline-variant/20 text-[11px] font-label-bold text-on-surface-variant uppercase tracking-wider">
              <th class="py-2 px-3">Product</th>
              <th class="py-2 px-3">Category</th>
              <th class="py-2 px-3">Price</th>
              <th class="py-2 px-3">Availability</th>
              <th class="py-2 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${productRows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * Delete a review as admin.
 */
async function deleteAdminReview(reviewId) {
  if (!reviewId || typeof supabaseClient === 'undefined' || !supabaseClient) return;

  try {
    const { error } = await supabaseClient.from('reviews').delete().eq('id', reviewId);
    if (error) {
      alert(`Could not delete review: ${error.message}`);
      return;
    }

    adminReviews = adminReviews.filter(r => r.id !== reviewId);
    renderAdminDashboard();
    if (typeof fetchAllReviewsFromSupabase === 'function') fetchAllReviewsFromSupabase();
  } catch (err) {
    console.error("Error moderating review:", err);
  }
}

/**
 * Tab 5: Customer Reviews Moderation Layout
 */
function renderReviewsTab() {
  const reviewsRows = adminReviews.length === 0
    ? `<tr><td colspan="7" class="py-6 text-center text-xs text-on-surface-variant">No customer reviews submitted yet.</td></tr>`
    : adminReviews.map(r => {
        const prod = adminProducts.find(p => p.id === r.product_id);
        const prodName = prod?.name || r.product_id;
        const dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent';
        const starsStr = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);

        return `
          <tr class="border-b border-outline-variant/15 hover:bg-surface/50 text-xs">
            <td class="py-3 px-3">
              <span class="font-bold text-primary block">${prodName}</span>
              <span class="text-[10px] text-on-surface-variant font-mono">${r.product_id}</span>
            </td>
            <td class="py-3 px-3 font-medium text-primary">${r.user_name}</td>
            <td class="py-3 px-3">
              <span class="text-amber-500 font-bold">${starsStr}</span>
              <span class="text-[10px] text-on-surface-variant ml-1">(${r.rating}/5)</span>
            </td>
            <td class="py-3 px-3 max-w-[240px] truncate text-on-surface" title="${r.review_text}">${r.review_text}</td>
            <td class="py-3 px-3">
              <span class="px-2 py-0.5 rounded-full text-[9px] font-label-bold uppercase ${r.verified_purchase ? 'bg-green-100 text-green-800' : 'bg-surface-container-high text-on-surface-variant'}">
                ${r.verified_purchase ? 'Verified' : 'Unverified'}
              </span>
            </td>
            <td class="py-3 px-3 text-on-surface-variant">${dateStr}</td>
            <td class="py-3 px-3 text-right">
              <button data-review-id="${r.id}" class="admin-delete-review-btn text-xs font-label-bold px-3 py-1 rounded-full text-red-600 hover:text-red-800 border border-red-200 hover:bg-red-50 transition-colors cursor-pointer">
                <span>Delete</span>
              </button>
            </td>
          </tr>
        `;
      }).join('');

  return `
    <div class="bg-surface rounded-2xl p-5 border border-outline-variant/30 shadow-xs flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <div>
          <h4 class="font-display text-base font-bold text-primary">Customer Reviews &amp; Moderation</h4>
          <span class="text-xs text-on-surface-variant">${adminReviews.length} Total Verified Reviews</span>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="border-b border-outline-variant/20 text-[11px] font-label-bold text-on-surface-variant uppercase tracking-wider">
              <th class="py-2 px-3">Product</th>
              <th class="py-2 px-3">Reviewer</th>
              <th class="py-2 px-3">Rating</th>
              <th class="py-2 px-3">Review Text</th>
              <th class="py-2 px-3">Status</th>
              <th class="py-2 px-3">Date</th>
              <th class="py-2 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            ${reviewsRows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * Customer Order History Drill-down Modal
 */
function renderCustomerHistoryModal(customer) {
  const customerOrders = adminOrders.filter(o => o.user_id === customer.id);
  const totalSpent = customerOrders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.subtotal || 0), 0);

  const ordersHTML = customerOrders.length === 0
    ? `<p class="text-xs text-on-surface-variant text-center py-6">No orders placed by this customer yet.</p>`
    : customerOrders.map(order => `
        <div class="p-3.5 rounded-xl bg-surface border border-outline-variant/20 flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="font-bold text-xs text-primary">${order.order_reference || order.id?.slice(0, 8)}</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-label-bold uppercase ${getStatusBadgeClass(order.status)}">${order.status || 'placed'}</span>
          </div>
          <p class="text-[11px] text-on-surface-variant">${order.created_at ? new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent'}</p>
          <div class="border-t border-outline-variant/15 pt-2 flex items-center justify-between text-xs">
            <span class="text-on-surface-variant">Subtotal:</span>
            <span class="font-bold text-primary">$${Number(order.subtotal || 0).toFixed(2)}</span>
          </div>
        </div>
      `).join('');

  return `
    <div id="customer-history-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div class="bg-surface-container-lowest max-w-lg w-full rounded-3xl p-6 border border-outline-variant/30 flex flex-col gap-4 max-h-[85vh] shadow-2xl">
        <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3">
          <div>
            <h3 class="font-display font-bold text-base text-primary">${customer.full_name || 'Customer History'}</h3>
            <p class="text-xs text-on-surface-variant">${customer.email} • ${customerOrders.length} Orders • $${totalSpent.toFixed(2)} Spent</p>
          </div>
          <button id="close-customer-history-modal-btn" class="p-1.5 rounded-full text-on-surface-variant hover:text-primary cursor-pointer">
            <span class="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1">
          ${ordersHTML}
        </div>
      </div>
    </div>
  `;
}

/**
 * Product Edit / Create Modal
 */
function renderProductEditModal(product) {
  const isNew = !product || !product.id;
  return `
    <div id="product-edit-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div class="bg-surface-container-lowest max-w-md w-full rounded-3xl p-6 border border-outline-variant/30 flex flex-col gap-4 shadow-2xl">
        <div class="flex items-center justify-between border-b border-outline-variant/20 pb-2">
          <h3 class="font-display font-bold text-base text-primary">${isNew ? 'Add New Product' : 'Edit Product'}</h3>
          <button id="close-product-edit-modal-btn" class="p-1.5 rounded-full text-on-surface-variant hover:text-primary cursor-pointer">
            <span class="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <form id="admin-product-edit-form" class="flex flex-col gap-3">
          <input type="hidden" id="prod-id" value="${product?.id || ''}" />
          <div>
            <label class="font-label-bold text-xs text-primary block mb-1">Product Name</label>
            <input id="prod-name" type="text" required value="${product?.name || ''}" class="w-full text-xs px-3.5 py-2 rounded-xl bg-surface border border-outline-variant/40 text-primary" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="font-label-bold text-xs text-primary block mb-1">Price ($)</label>
              <input id="prod-price" type="number" step="0.01" required value="${product?.price || 0}" class="w-full text-xs px-3.5 py-2 rounded-xl bg-surface border border-outline-variant/40 text-primary" />
            </div>
            <div>
              <label class="font-label-bold text-xs text-primary block mb-1">Category</label>
              <select id="prod-category" class="w-full text-xs px-3.5 py-2 rounded-xl bg-surface border border-outline-variant/40 text-primary">
                <option value="coffee" ${product?.category === 'coffee' ? 'selected' : ''}>Coffee</option>
                <option value="bites" ${product?.category === 'bites' ? 'selected' : ''}>Bites</option>
              </select>
            </div>
          </div>

          <div>
            <label class="font-label-bold text-xs text-primary block mb-1">Image URL / Path</label>
            <input id="prod-image" type="text" value="${product?.image || ''}" class="w-full text-xs px-3.5 py-2 rounded-xl bg-surface border border-outline-variant/40 text-primary" />
          </div>

          <div>
            <label class="font-label-bold text-xs text-primary block mb-1">Description</label>
            <textarea id="prod-desc" rows="2" class="w-full text-xs px-3.5 py-2 rounded-xl bg-surface border border-outline-variant/40 text-primary resize-none">${product?.description || ''}</textarea>
          </div>

          <button type="submit" class="w-full bg-tertiary text-on-tertiary font-label-bold text-xs py-2.5 rounded-full shadow-sm hover:bg-primary transition-all mt-2 cursor-pointer">
            <span>${isNew ? 'Create Product' : 'Save Changes'}</span>
          </button>
        </form>
      </div>
    </div>
  `;
}

/**
 * Export Orders to CSV (1-Click Download)
 */
function exportAdminOrdersToCSV() {
  if (!adminOrders || adminOrders.length === 0) {
    alert("No orders available to export.");
    return;
  }

  const headers = [
    "Order Reference",
    "Created Date",
    "Customer Name",
    "Customer Email",
    "Customer Phone",
    "Order Type",
    "Items Summary",
    "Subtotal ($)",
    "Payment Method",
    "Payment Status",
    "Transaction Ref",
    "Order Status",
    "Delivery Address"
  ];

  const rows = adminOrders.map(order => {
    const profile = adminProfiles.find(p => p.id === order.user_id);
    const payment = adminPayments.find(p => p.order_id === order.id);
    const items = adminOrderItems.filter(i => i.order_id === order.id);

    const itemsSummary = items.map(i => `${i.product_name || i.product_id} (x${i.quantity})`).join("; ");
    const name = profile?.full_name || order.customer_name || 'Brew & Bite Customer';
    const email = profile?.email || order.customer_email || '';
    const phone = profile?.phone || order.customer_phone || '';
    const payMethod = payment?.payment_method || (order.payment_method || 'cash_on_delivery');
    const payStatus = payment?.payment_status || (order.payment_status || 'pending');
    const txnRef = payment?.transaction_ref || `COD-${order.order_reference || order.id?.slice(0, 8)}`;
    const address = (order.delivery_address || '').replace(/"/g, '""');

    return [
      `"${order.order_reference || order.id}"`,
      `"${order.created_at || ''}"`,
      `"${name.replace(/"/g, '""')}"`,
      `"${email.replace(/"/g, '""')}"`,
      `"${phone.replace(/"/g, '""')}"`,
      `"${order.order_type || 'pickup'}"`,
      `"${itemsSummary.replace(/"/g, '""')}"`,
      Number(order.subtotal || 0).toFixed(2),
      `"${payMethod}"`,
      `"${payStatus}"`,
      `"${txnRef}"`,
      `"${order.status || 'placed'}"`,
      `"${address}"`
    ].join(',');
  });

  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `brew_bites_orders_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Attach Event Listeners inside Admin Dashboard
 */
function attachAdminEvents() {
  // Range Filter Switcher
  document.querySelectorAll('.admin-range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      adminAnalyticsRange = btn.getAttribute('data-range') || '7days';
      renderAdminDashboard();
    });
  });

  // CSV Export Button
  const exportBtn = document.getElementById('admin-export-csv-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportAdminOrdersToCSV);
  }

  // Navigation Tab Switching
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-admin-tab');
      if (tab) {
        adminCurrentTab = tab;
        renderAdminDashboard();
      }
    });
  });

  // Status Filter Buttons
  document.querySelectorAll('.admin-status-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      adminStatusFilter = btn.getAttribute('data-filter') || 'all';
      renderAdminDashboard();
    });
  });

  // Payment Filter Buttons
  document.querySelectorAll('.admin-pay-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      adminPaymentFilter = btn.getAttribute('data-pay-filter') || 'all';
      renderAdminDashboard();
    });
  });

  // Orders Search Input
  const ordersSearchInput = document.getElementById('admin-orders-search');
  if (ordersSearchInput) {
    ordersSearchInput.addEventListener('input', (e) => {
      adminSearchQuery = e.target.value;
      renderAdminDashboard();
    });
  }

  // Customers Search Input
  const custSearchInput = document.getElementById('admin-customers-search');
  if (custSearchInput) {
    custSearchInput.addEventListener('input', (e) => {
      adminCustomerSearchQuery = e.target.value;
      renderAdminDashboard();
    });
  }

  // Products Search Input
  const prodSearchInput = document.getElementById('admin-products-search');
  if (prodSearchInput) {
    prodSearchInput.addEventListener('input', (e) => {
      adminProductSearchQuery = e.target.value;
      renderAdminDashboard();
    });
  }

  // Products Category Filter Select
  const prodCatSelect = document.getElementById('admin-prod-category-select');
  if (prodCatSelect) {
    prodCatSelect.addEventListener('change', (e) => {
      adminProductCategoryFilter = e.target.value;
      renderAdminDashboard();
    });
  }

  // Products Availability Filter Select
  const prodAvailSelect = document.getElementById('admin-prod-avail-select');
  if (prodAvailSelect) {
    prodAvailSelect.addEventListener('change', (e) => {
      adminProductAvailFilter = e.target.value;
      renderAdminDashboard();
    });
  }

  // Date Sort Select
  const dateSortSelect = document.getElementById('admin-date-sort');
  if (dateSortSelect) {
    dateSortSelect.addEventListener('change', (e) => {
      adminDateSort = e.target.value;
      renderAdminDashboard();
    });
  }

  // Order Status Updater Selects
  document.querySelectorAll('.order-status-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const id = sel.getAttribute('data-order-id');
      const newStatus = e.target.value;
      if (id && newStatus) updateAdminOrderStatus(id, newStatus);
    });
  });

  // Product Availability Toggles
  document.querySelectorAll('.admin-toggle-avail-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-product-id');
      const cur = btn.getAttribute('data-current-avail') === 'true';
      if (id) toggleAdminProductAvailability(id, cur);
    });
  });

  // Open Edit Product Modal
  document.querySelectorAll('.admin-open-edit-product-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-edit-product-id');
      const p = adminProducts.find(item => item.id === id);
      if (p) {
        adminEditingProduct = p;
        renderAdminDashboard();
      }
    });
  });

  // Open Add Product Modal
  const addProdBtn = document.getElementById('admin-add-product-btn');
  if (addProdBtn) {
    addProdBtn.addEventListener('click', () => {
      adminEditingProduct = {}; // empty indicates new
      renderAdminDashboard();
    });
  }

  // Close Edit Product Modal
  const closeProdEditBtn = document.getElementById('close-product-edit-modal-btn');
  if (closeProdEditBtn) {
    closeProdEditBtn.addEventListener('click', () => {
      adminEditingProduct = null;
      renderAdminDashboard();
    });
  }

  // Save Product Edit Form Submit
  const prodForm = document.getElementById('admin-product-edit-form');
  if (prodForm) {
    prodForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('prod-id')?.value;
      const name = document.getElementById('prod-name')?.value;
      const price = parseFloat(document.getElementById('prod-price')?.value) || 0;
      const category = document.getElementById('prod-category')?.value;
      const image = document.getElementById('prod-image')?.value;
      const description = document.getElementById('prod-desc')?.value;

      const payload = {
        name,
        price,
        category,
        image: image || 'assets/frames/ezgif-frame-001.jpg',
        description
      };

      if (id) {
        await saveProductEdit(id, payload);
      } else {
        await handleAddNewProduct({
          ...payload,
          id: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        });
      }
    });
  }

  // View Customer History Modal Trigger
  document.querySelectorAll('.admin-view-customer-orders-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-customer-id');
      const cust = adminProfiles.find(p => p.id === id);
      if (cust) {
        adminSelectedCustomer = cust;
        renderAdminDashboard();
      }
    });
  });

  // Close Customer History Modal
  const closeCustModalBtn = document.getElementById('close-customer-history-modal-btn');
  if (closeCustModalBtn) {
    closeCustModalBtn.addEventListener('click', () => {
      adminSelectedCustomer = null;
      renderAdminDashboard();
    });
  }

  // Delete Review Action (Admin Moderation)
  document.querySelectorAll('.admin-delete-review-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-review-id');
      if (id && confirm("Are you sure you want to moderate and permanently delete this review?")) {
        deleteAdminReview(id);
      }
    });
  });
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

// Attach Admin Close Event on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  const closeAdminBtn = document.getElementById('close-admin-btn');
  const adminOverlay = document.getElementById('admin-overlay');

  if (closeAdminBtn) closeAdminBtn.addEventListener('click', closeAdminDashboard);
  if (adminOverlay) adminOverlay.addEventListener('click', closeAdminDashboard);
});

// Exports for Node testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isUserAdmin,
    openAdminDashboard,
    closeAdminDashboard,
    loadAdminData,
    updateAdminOrderStatus,
    exportAdminOrdersToCSV,
    getFilteredOrdersByRange
  };
}
