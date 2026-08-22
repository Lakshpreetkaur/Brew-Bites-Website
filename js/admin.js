/**
 * Brew & Bite - Admin Dashboard Controller (admin.js)
 * Database-backed admin interface for sales analytics, readable order & payments management,
 * customer activity directory, and live product catalog management.
 */

// In-Memory Admin State
let adminOrders = [];
let adminOrderItems = [];
let adminPayments = [];
let adminProfiles = [];
let adminProducts = [];
let isAdminDataLoading = false;
let adminCurrentTab = 'overview'; // 'overview' | 'orders' | 'customers' | 'products'
let adminStatusFilter = 'all';
let adminPaymentFilter = 'all'; // 'all' | 'paid' | 'pending' | 'cod'
let adminDateSort = 'desc'; // 'desc' | 'asc'
let adminSearchQuery = '';
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

  // Verify Admin authorization
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

    // Attempt to load payments if table exists
    try {
      const { data: payData } = await supabaseClient.from('payments').select('*');
      adminPayments = payData || [];
    } catch (payErr) {
      console.warn("Notice: payments table query note:", payErr);
      adminPayments = [];
    }

    console.log(`[Admin] Loaded ${adminOrders.length} orders, ${adminPayments.length} payments, ${adminOrderItems.length} items, ${adminProfiles.length} profiles, ${adminProducts.length} products.`);
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
    if (found) found.status = newStatus;

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
 * Main Render Controller for Admin Dashboard View.
 */
function renderAdminDashboard() {
  const container = document.getElementById('admin-dashboard-content');
  if (!container) return;

  if (isAdminDataLoading) {
    container.innerHTML = `
      <div class="py-24 flex flex-col items-center justify-center text-center">
        <div class="w-12 h-12 border-3 border-secondary-container border-t-tertiary rounded-full animate-spin mb-4"></div>
        <p class="font-display font-bold text-sm text-primary">Loading Admin Workspace...</p>
        <p class="text-xs text-on-surface-variant">Connecting securely to Supabase Database</p>
      </div>
    `;
    return;
  }

  // Calculate Metrics
  const totalSales = adminOrders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + Number(o.subtotal || 0), 0);

  const totalOrders = adminOrders.length;
  const totalCustomers = adminProfiles.length;
  const totalProducts = adminProducts.length;

  // Today's orders
  const todayStr = new Date().toISOString().split('T')[0];
  const todayOrders = adminOrders.filter(o => (o.created_at || '').startsWith(todayStr)).length;

  // Best-Selling Products Calculation
  const productSalesMap = {};
  adminOrderItems.forEach(item => {
    const key = item.product_name || item.product_id;
    if (!productSalesMap[key]) {
      productSalesMap[key] = { name: key, count: 0, revenue: 0 };
    }
    productSalesMap[key].count += Number(item.quantity || 1);
    productSalesMap[key].revenue += Number(item.line_total || 0);
  });
  const bestSellers = Object.values(productSalesMap).sort((a, b) => b.count - a.count).slice(0, 4);

  // Top KPI Overview Cards
  let contentHTML = `
    <!-- Top KPI Overview Metrics -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
      <div class="bg-surface p-4 rounded-2xl border border-outline-variant/30 shadow-xs flex flex-col">
        <span class="text-[11px] font-label-bold text-on-surface-variant uppercase tracking-wider">Total Revenue</span>
        <span class="font-display text-xl sm:text-2xl font-black text-primary mt-1">$${totalSales.toFixed(2)}</span>
        <span class="text-[10px] text-secondary font-medium mt-1">Excludes cancelled orders</span>
      </div>

      <div class="bg-surface p-4 rounded-2xl border border-outline-variant/30 shadow-xs flex flex-col">
        <span class="text-[11px] font-label-bold text-on-surface-variant uppercase tracking-wider">Total Orders</span>
        <span class="font-display text-xl sm:text-2xl font-black text-primary mt-1">${totalOrders}</span>
        <span class="text-[10px] text-on-surface-variant mt-1">${todayOrders} placed today</span>
      </div>

      <div class="bg-surface p-4 rounded-2xl border border-outline-variant/30 shadow-xs flex flex-col">
        <span class="text-[11px] font-label-bold text-on-surface-variant uppercase tracking-wider">Total Customers</span>
        <span class="font-display text-xl sm:text-2xl font-black text-primary mt-1">${totalCustomers}</span>
        <span class="text-[10px] text-on-surface-variant mt-1">Registered members</span>
      </div>

      <div class="bg-surface p-4 rounded-2xl border border-outline-variant/30 shadow-xs flex flex-col">
        <span class="text-[11px] font-label-bold text-on-surface-variant uppercase tracking-wider">Active Menu</span>
        <span class="font-display text-xl sm:text-2xl font-black text-primary mt-1">${totalProducts}</span>
        <span class="text-[10px] text-on-surface-variant mt-1">${adminProducts.filter(p => p.available).length} available</span>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="flex items-center gap-2 border-b border-outline-variant/20 pb-3 mb-6 overflow-x-auto">
      <button data-admin-tab="overview" class="admin-tab-btn px-4 py-2 rounded-full text-xs font-label-bold transition-all cursor-pointer ${adminCurrentTab === 'overview' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-high/60 text-on-surface-variant hover:bg-surface-container-high'}">
        <span>Overview &amp; Trends</span>
      </button>
      <button data-admin-tab="orders" class="admin-tab-btn px-4 py-2 rounded-full text-xs font-label-bold transition-all cursor-pointer ${adminCurrentTab === 'orders' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-high/60 text-on-surface-variant hover:bg-surface-container-high'}">
        <span>Orders &amp; Payments (${totalOrders})</span>
      </button>
      <button data-admin-tab="customers" class="admin-tab-btn px-4 py-2 rounded-full text-xs font-label-bold transition-all cursor-pointer ${adminCurrentTab === 'customers' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-high/60 text-on-surface-variant hover:bg-surface-container-high'}">
        <span>Customers (${totalCustomers})</span>
      </button>
      <button data-admin-tab="products" class="admin-tab-btn px-4 py-2 rounded-full text-xs font-label-bold transition-all cursor-pointer ${adminCurrentTab === 'products' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-high/60 text-on-surface-variant hover:bg-surface-container-high'}">
        <span>Products (${totalProducts})</span>
      </button>
    </div>
  `;

  // Render Active Tab Content
  if (adminCurrentTab === 'overview') {
    contentHTML += renderOverviewTab(bestSellers);
  } else if (adminCurrentTab === 'orders') {
    contentHTML += renderOrdersTab();
  } else if (adminCurrentTab === 'customers') {
    contentHTML += renderCustomersTab();
  } else if (adminCurrentTab === 'products') {
    contentHTML += renderProductsTab();
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
 * Tab 1: Overview Layout with Best Sellers & Recent Orders
 */
function renderOverviewTab(bestSellers) {
  const recentOrders = adminOrders.slice(0, 5);

  const recentOrdersRows = recentOrders.length === 0
    ? `<tr><td colspan="5" class="py-6 text-center text-xs text-on-surface-variant">No orders recorded yet.</td></tr>`
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
    ? `<p class="text-xs text-on-surface-variant">No sales recorded yet.</p>`
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
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Recent Orders Feed (Left 2 Columns) -->
      <div class="lg:col-span-2 bg-surface rounded-2xl p-5 border border-outline-variant/30 shadow-xs">
        <div class="flex items-center justify-between mb-4">
          <h4 class="font-display text-base font-bold text-primary">Recent Orders Feed</h4>
          <button data-admin-tab="orders" class="admin-tab-btn text-xs font-label-bold text-secondary hover:text-tertiary cursor-pointer">View All →</button>
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

      <!-- Best-Selling Products (Right 1 Column) -->
      <div class="bg-surface rounded-2xl p-5 border border-outline-variant/30 shadow-xs flex flex-col gap-3">
        <h4 class="font-display text-base font-bold text-primary mb-1">🔥 Best-Selling Products</h4>
        <div class="flex flex-col gap-2.5">
          ${bestSellersHTML}
        </div>
      </div>
    </div>
  `;
}

/**
 * Tab 2: Orders & Payments Management Layout with Search, Status Filter, Payment Filter, and Date Sort
 */
function renderOrdersTab() {
  let filtered = [...adminOrders];

  // Lifecycle Status Filter
  if (adminStatusFilter !== 'all') {
    filtered = filtered.filter(o => (o.status || 'placed').toLowerCase() === adminStatusFilter.toLowerCase());
  }

  // Payment Status / Method Filter
  if (adminPaymentFilter !== 'all') {
    filtered = filtered.filter(o => {
      const p = adminPayments.find(pay => pay.order_id === o.id);
      if (adminPaymentFilter === 'paid') return p?.payment_status === 'paid';
      if (adminPaymentFilter === 'pending') return p?.payment_status === 'pending';
      if (adminPaymentFilter === 'cod') return p?.payment_method === 'cash_on_delivery' || !p;
      return true;
    });
  }

  // Search Filter
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

  // Date Sorting
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

        // Find relational payment
        const payment = adminPayments.find(p => p.order_id === order.id);
        const isPaid = payment?.payment_status === 'paid';
        const isCOD = payment?.payment_method === 'cash_on_delivery' || !payment;
        const txnRef = payment?.transaction_ref || `COD-${order.order_reference || order.id?.slice(0, 8)}`;

        // Find relational order items for this order ID
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
                  <!-- Lifecycle Status Badge -->
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-label-bold uppercase tracking-wider ${getStatusBadgeClass(order.status)}">${order.status || 'placed'}</span>
                  <!-- Payment Status Badge -->
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-label-bold uppercase tracking-wider ${isPaid ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}">
                    ${isCOD ? 'COD: Pending' : (isPaid ? 'Online: Paid' : 'Online: Pending')}
                  </span>
                </div>
                <p class="text-[11px] text-on-surface-variant mt-0.5">${dateStr} • Order ID: ${order.id}</p>
              </div>

              <!-- Status Changer Dropdown -->
              <div class="flex items-center gap-2">
                <label class="text-[11px] font-label-bold text-on-surface-variant">Update Order Status:</label>
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
                <span class="text-on-surface-variant font-bold block mb-0.5">Customer Name:</span>
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
                <span class="text-on-surface-variant font-bold block mb-0.5">Transaction Ref:</span>
                <span class="font-mono text-primary font-medium text-[11px]">${txnRef}</span>
              </div>
              ${order.order_type ? `
                <div>
                  <span class="text-on-surface-variant font-bold block mb-0.5">Order Type:</span>
                  <span class="text-secondary font-bold uppercase">${order.order_type}</span>
                </div>
              ` : ''}
              ${order.delivery_address ? `
                <div class="sm:col-span-3">
                  <span class="text-on-surface-variant font-bold block mb-0.5">Delivery Address:</span>
                  <span class="text-primary font-medium">${order.delivery_address}</span>
                </div>
              ` : ''}
              ${order.notes ? `
                <div class="sm:col-span-3">
                  <span class="text-on-surface-variant font-bold block mb-0.5">Customer Notes:</span>
                  <span class="text-primary font-medium">${order.notes}</span>
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
              <span class="text-xs font-label-bold text-on-surface-variant">Order Total</span>
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
          <input id="admin-orders-search" type="text" placeholder="Search by Order Ref, Customer Name, or Email..." value="${adminSearchQuery}" class="w-full md:w-80 text-xs px-3.5 py-2 rounded-xl bg-surface-container-high/40 border border-outline-variant/40 text-primary placeholder-on-surface-variant/60 focus:outline-none focus:border-tertiary" />

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
          <!-- Status Filter Buttons -->
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

          <!-- Payment Filter Buttons -->
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
 * Tab 3: Customers Management Layout
 */
function renderCustomersTab() {
  const customerRows = adminProfiles.length === 0
    ? `<tr><td colspan="6" class="py-6 text-center text-xs text-on-surface-variant">No registered customers found.</td></tr>`
    : adminProfiles.map(p => {
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
    <div class="bg-surface rounded-2xl p-5 border border-outline-variant/30 shadow-xs">
      <div class="flex items-center justify-between mb-4">
        <h4 class="font-display text-base font-bold text-primary">Customer Directory</h4>
        <span class="text-xs text-on-surface-variant">${adminProfiles.length} Total Customers</span>
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
 * Tab 4: Products Catalog Management Layout with Add / Edit
 */
function renderProductsTab() {
  const productRows = adminProducts.map(p => {
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
    <div class="flex flex-col gap-6">
      <div class="bg-surface rounded-2xl p-5 border border-outline-variant/30 shadow-xs">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h4 class="font-display text-base font-bold text-primary">Catalog Management</h4>
            <span class="text-xs text-on-surface-variant font-medium">Changes immediately update the customer-facing website.</span>
          </div>
          <button id="admin-add-product-btn" class="bg-primary text-on-primary hover:bg-tertiary text-xs font-label-bold px-4 py-2 rounded-full transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto shadow-sm">
            <span class="material-symbols-outlined text-sm">add</span>
            <span>Add Product</span>
          </button>
        </div>
        <div class="overflow-x-auto">
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
            <span class="font-black text-primary">$${Number(order.subtotal || 0).toFixed(2)}</span>
          </div>
        </div>
      `).join('');

  return `
    <div class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div class="w-full max-w-lg bg-surface-container-lowest rounded-3xl p-6 shadow-2xl border border-outline-variant/30 flex flex-col max-h-[85vh] overflow-y-auto">
        <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3 mb-4">
          <div>
            <h3 class="font-display font-bold text-lg text-primary">${customer.full_name || 'Customer Profile'}</h3>
            <p class="text-xs text-on-surface-variant">${customer.email || 'No email'} • ${customer.phone || 'No phone'}</p>
          </div>
          <button id="close-customer-modal-btn" class="p-1.5 rounded-full hover:bg-surface-container-high text-on-surface-variant cursor-pointer">
            <span class="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div class="grid grid-cols-2 gap-3 mb-4">
          <div class="p-3 rounded-xl bg-surface border border-outline-variant/20 text-center">
            <span class="text-[11px] text-on-surface-variant uppercase font-bold block">Total Orders</span>
            <span class="font-display font-black text-lg text-primary">${customerOrders.length}</span>
          </div>
          <div class="p-3 rounded-xl bg-surface border border-outline-variant/20 text-center">
            <span class="text-[11px] text-on-surface-variant uppercase font-bold block">Lifetime Spend</span>
            <span class="font-display font-black text-lg text-primary">$${totalSpent.toFixed(2)}</span>
          </div>
        </div>

        <h4 class="text-xs font-label-bold text-primary uppercase tracking-wider mb-2">Order History</h4>
        <div class="flex flex-col gap-2.5 overflow-y-auto max-h-[250px] pr-1">
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
  const title = isNew ? 'Add New Product' : `Edit ${product.name}`;

  return `
    <div class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div class="w-full max-w-md bg-surface-container-lowest rounded-3xl p-6 shadow-2xl border border-outline-variant/30 flex flex-col">
        <div class="flex items-center justify-between border-b border-outline-variant/20 pb-3 mb-4">
          <h3 class="font-display font-bold text-base text-primary">${title}</h3>
          <button id="close-product-edit-modal-btn" class="p-1.5 rounded-full hover:bg-surface-container-high text-on-surface-variant cursor-pointer">
            <span class="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <form id="admin-product-form" class="flex flex-col gap-3">
          ${isNew ? `
            <div>
              <label class="font-label-bold text-xs text-primary block mb-1">Product ID (slug)</label>
              <input id="prod-id" type="text" required placeholder="matcha-latte" class="w-full text-xs px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-primary" />
            </div>
          ` : ''}

          <div>
            <label class="font-label-bold text-xs text-primary block mb-1">Product Name</label>
            <input id="prod-name" type="text" required value="${product?.name || ''}" placeholder="Matcha Latte" class="w-full text-xs px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-primary" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="font-label-bold text-xs text-primary block mb-1">Category</label>
              <select id="prod-category" class="w-full text-xs px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-primary">
                <option value="coffee" ${product?.category === 'coffee' ? 'selected' : ''}>Coffee</option>
                <option value="bites" ${product?.category === 'bites' ? 'selected' : ''}>Bites</option>
              </select>
            </div>
            <div>
              <label class="font-label-bold text-xs text-primary block mb-1">Price ($)</label>
              <input id="prod-price" type="number" step="0.01" required value="${product?.price || '4.50'}" class="w-full text-xs px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-primary" />
            </div>
          </div>

          <div>
            <label class="font-label-bold text-xs text-primary block mb-1">Description</label>
            <textarea id="prod-desc" rows="2" class="w-full text-xs px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-primary" placeholder="Rich Japanese green tea blend...">${product?.description || ''}</textarea>
          </div>

          <div>
            <label class="font-label-bold text-xs text-primary block mb-1">Image URL</label>
            <input id="prod-image" type="url" value="${product?.image || ''}" placeholder="https://..." class="w-full text-xs px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-primary" />
          </div>

          <button type="submit" class="mt-2 bg-tertiary text-on-tertiary hover:bg-primary font-label-bold text-xs py-3 px-4 rounded-full transition-all duration-200 shadow-sm cursor-pointer active:scale-95">
            <span>${isNew ? 'Create Product' : 'Save Changes'}</span>
          </button>
        </form>
      </div>
    </div>
  `;
}

/**
 * Helper to get badge CSS color based on order status.
 */
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

/**
 * Event Delegation and Listeners for Admin Dashboard.
 */
function attachAdminEvents() {
  // Tab Switching
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-admin-tab');
      if (tab) {
        adminCurrentTab = tab;
        renderAdminDashboard();
      }
    });
  });

  // Order Status Filter Buttons
  document.querySelectorAll('.admin-status-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-filter');
      if (filter) {
        adminStatusFilter = filter;
        renderAdminDashboard();
      }
    });
  });

  // Payment Status Filter Buttons
  document.querySelectorAll('.admin-pay-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const payFilter = btn.getAttribute('data-pay-filter');
      if (payFilter) {
        adminPaymentFilter = payFilter;
        renderAdminDashboard();
      }
    });
  });

  // Date Sort Selector
  const dateSort = document.getElementById('admin-date-sort');
  if (dateSort) {
    dateSort.addEventListener('change', (e) => {
      adminDateSort = e.target.value;
      renderAdminDashboard();
    });
  }

  // Search Input Handler
  const searchInput = document.getElementById('admin-orders-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      adminSearchQuery = e.target.value;
      renderAdminDashboard();
      const updatedInput = document.getElementById('admin-orders-search');
      if (updatedInput) {
        updatedInput.focus();
        updatedInput.setSelectionRange(updatedInput.value.length, updatedInput.value.length);
      }
    });
  }

  // Order Status Dropdown Change
  document.querySelectorAll('.order-status-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const orderId = select.getAttribute('data-order-id');
      const newStatus = e.target.value;
      updateAdminOrderStatus(orderId, newStatus);
    });
  });

  // Product Availability Toggle Button
  document.querySelectorAll('.admin-toggle-avail-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const productId = btn.getAttribute('data-product-id');
      const currentAvail = btn.getAttribute('data-current-avail') === 'true';
      toggleAdminProductAvailability(productId, currentAvail);
    });
  });

  // View Customer Order History Modal
  document.querySelectorAll('.admin-view-customer-orders-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const customerId = btn.getAttribute('data-customer-id');
      const customer = adminProfiles.find(p => p.id === customerId);
      if (customer) {
        adminSelectedCustomer = customer;
        renderAdminDashboard();
      }
    });
  });

  // Close Customer Modal
  const closeCustBtn = document.getElementById('close-customer-modal-btn');
  if (closeCustBtn) {
    closeCustBtn.addEventListener('click', () => {
      adminSelectedCustomer = null;
      renderAdminDashboard();
    });
  }

  // Open Add Product Modal
  const addProdBtn = document.getElementById('admin-add-product-btn');
  if (addProdBtn) {
    addProdBtn.addEventListener('click', () => {
      adminEditingProduct = {}; // empty object represents new product
      renderAdminDashboard();
    });
  }

  // Open Edit Product Modal
  document.querySelectorAll('.admin-open-edit-product-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const prodId = btn.getAttribute('data-edit-product-id');
      const product = adminProducts.find(p => p.id === prodId);
      if (product) {
        adminEditingProduct = product;
        renderAdminDashboard();
      }
    });
  });

  // Close Product Edit Modal
  const closeProdBtn = document.getElementById('close-product-edit-modal-btn');
  if (closeProdBtn) {
    closeProdBtn.addEventListener('click', () => {
      adminEditingProduct = null;
      renderAdminDashboard();
    });
  }

  // Product Form Submit Handler (Add or Edit)
  const prodForm = document.getElementById('admin-product-form');
  if (prodForm) {
    prodForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const isNew = !adminEditingProduct || !adminEditingProduct.id;
      const id = isNew ? document.getElementById('prod-id')?.value.trim() : adminEditingProduct.id;
      const name = document.getElementById('prod-name')?.value.trim();
      const category = document.getElementById('prod-category')?.value;
      const price = parseFloat(document.getElementById('prod-price')?.value);
      const description = document.getElementById('prod-desc')?.value.trim();
      const image = document.getElementById('prod-image')?.value.trim();

      const payload = {
        id,
        name,
        category,
        price,
        description,
        image,
        available: isNew ? true : adminEditingProduct.available
      };

      if (isNew) {
        handleAddNewProduct(payload);
      } else {
        saveProductEdit(id, payload);
      }
    });
  }
}

// Attach Admin Global Listeners on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  const closeAdminBtn = document.getElementById('close-admin-btn');
  const adminOverlay = document.getElementById('admin-overlay');

  if (closeAdminBtn) closeAdminBtn.addEventListener('click', closeAdminDashboard);
  if (adminOverlay) adminOverlay.addEventListener('click', closeAdminDashboard);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAdminDashboard();
  });
});
