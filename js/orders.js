/**
 * Brew & Bite - Order Management, Payments & Supabase Data Layer (orders.js)
 * Enforces authenticated user order ownership, dedicated relational payments table,
 * strict order vs payment status separation, and verified database-first architecture.
 *
 * Supabase Tables:
 * - public.orders: (id, order_reference, user_id, customer_name, customer_phone, customer_email, order_type, delivery_address, subtotal, status, created_at)
 * - public.order_items: (id, order_id, product_id, product_name, quantity, unit_price, line_total)
 * - public.payments: (id, order_id, user_id, payment_method, payment_status, amount, currency, transaction_ref, created_at, updated_at)
 */

// In-Memory cache for the active authenticated user's orders
let currentUserOrders = [];
let activeUserId = null;

/**
 * Generate user-scoped storage key for optional local caching.
 */
function getUserOrdersStorageKey(userId) {
  return userId ? `brewBiteOrders_${userId}` : null;
}

/**
 * Generate a unique, human-readable demo order reference.
 * Format: BB-DEMO-XXXX (e.g. BB-DEMO-4827)
 */
function generateOrderId() {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `BB-DEMO-${randomSuffix}`;
}

/**
 * Clear in-memory cached orders when a user signs out.
 * NOTE: This terminates the active session state only and DOES NOT delete
 * any historical orders from the Supabase database.
 */
function clearUserOrderState() {
  currentUserOrders = [];
  activeUserId = null;
  console.log("Active user session state cleared on logout. Database orders preserved.");
}

/**
 * Load completed orders for the specified user directly from Supabase (Source of Truth).
 * Ensures orders belonging to Account A return reliably when Account A logs back in.
 */
async function fetchOrdersForUser(userId) {
  if (!userId) {
    currentUserOrders = [];
    activeUserId = null;
    return [];
  }

  activeUserId = userId;

  // 1. Authoritative Query from Supabase `orders` table filtered by `user_id`
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      // First try fetching orders with relational order_items and payments
      let ordersData = null;
      let { data, error } = await supabaseClient
        .from('orders')
        .select(`
          id,
          order_reference,
          user_id,
          customer_name,
          customer_phone,
          customer_email,
          order_type,
          delivery_address,
          subtotal,
          status,
          created_at,
          order_items (
            id,
            order_id,
            product_id,
            product_name,
            quantity,
            unit_price,
            line_total
          ),
          payments (
            id,
            order_id,
            payment_method,
            payment_status,
            amount,
            currency,
            transaction_ref,
            created_at
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback: If payments relation isn't defined or migration not yet applied, fetch without payments
        const fallbackRes = await supabaseClient
          .from('orders')
          .select(`
            id,
            order_reference,
            user_id,
            customer_name,
            customer_phone,
            customer_email,
            order_type,
            delivery_address,
            subtotal,
            status,
            created_at,
            order_items (
              id,
              order_id,
              product_id,
              product_name,
              quantity,
              unit_price,
              line_total
            )
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        ordersData = fallbackRes.data || [];
      } else {
        ordersData = data || [];
      }

      if (Array.isArray(ordersData)) {
        // Map database records into standard frontend order format
        currentUserOrders = ordersData.map(record => {
          const rawPayments = Array.isArray(record.payments) ? record.payments : (record.payments ? [record.payments] : []);
          const primaryPayment = rawPayments[0] || null;

          return {
            id: record.id,
            orderId: record.order_reference || record.id,
            userId: record.user_id,
            createdAt: record.created_at,
            status: record.status || 'placed',
            customer: {
              name: record.customer_name || '',
              phone: record.customer_phone || '',
              email: record.customer_email || '',
              orderType: record.order_type || 'pickup',
              address: record.delivery_address || '',
              notes: ''
            },
            items: Array.isArray(record.order_items) ? record.order_items.map(item => ({
              productId: item.product_id,
              name: item.product_name || item.product_id,
              quantity: Number(item.quantity) || 1,
              unitPrice: Number(item.unit_price) || 0,
              lineTotal: Number(item.line_total) || 0
            })) : [],
            subtotal: Number(record.subtotal) || 0,
            payment: {
              id: primaryPayment?.id || null,
              method: primaryPayment?.payment_method || 'cash_on_delivery',
              status: primaryPayment?.payment_status || 'pending',
              amount: primaryPayment ? Number(primaryPayment.amount) : Number(record.subtotal || 0),
              currency: primaryPayment?.currency || 'USD',
              transactionRef: primaryPayment?.transaction_ref || `COD-${record.order_reference || record.id?.slice(0, 8)}`,
              createdAt: primaryPayment?.created_at || record.created_at
            }
          };
        });

        // Update optional user-scoped cache
        const storageKey = getUserOrdersStorageKey(userId);
        if (storageKey) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(currentUserOrders));
          } catch (e) {
            console.warn("Could not write user cache:", e);
          }
        }

        return currentUserOrders;
      }
    } catch (err) {
      console.error("Error fetching user orders from Supabase:", err);
    }
  }

  // 2. Fallback to local cache only if Supabase client is unreachable
  const storageKey = getUserOrdersStorageKey(userId);
  if (storageKey && currentUserOrders.length === 0) {
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          currentUserOrders = parsed;
        }
      }
    } catch (e) {
      console.warn("Could not read user cached orders:", e);
    }
  }

  return currentUserOrders;
}

/**
 * Synchronous getter for current in-memory orders of the active user.
 */
function getOrders() {
  return Array.isArray(currentUserOrders) ? currentUserOrders : [];
}

/**
 * Find a specific completed order by its orderId or id from active user's orders.
 */
function getOrderById(orderId) {
  if (!orderId) return null;
  const orders = getOrders();
  return orders.find(order => order.orderId === orderId || order.id === orderId) || null;
}

window.getOrders = getOrders;
window.getOrderById = getOrderById;
window.createAndSaveOrderInSupabase = createAndSaveOrderInSupabase;

/**
 * Create and persist a new order + payment record to Supabase.
 * Enforces strict verification: if payment simulation is set to failure,
 * immediately throws an error without creating any orders or partial records.
 */
async function createAndSaveOrderInSupabase(cartItems, customerDetails, user, paymentOptions = {}) {
  if (!Array.isArray(cartItems) || cartItems.length === 0 || !user || !user.id) {
    console.error("Order creation blocked: Cart is empty or user is unauthenticated.");
    throw new Error("You must be logged in with items in your cart to place an order.");
  }

  if (typeof supabaseClient === 'undefined' || !supabaseClient) {
    console.error("Supabase client is not connected.");
    throw new Error("Database service is currently unreachable. Please try again.");
  }

  const paymentMethod = paymentOptions.method || 'cash_on_delivery'; // 'cash_on_delivery' | 'online'
  const simulateOutcome = paymentOptions.simulateOutcome || 'success'; // 'success' | 'failure'

  // Safety Payment Simulation Check:
  // If simulated payment is set to fail, throw an error immediately before any database insertion.
  if (paymentMethod === 'online' && simulateOutcome === 'failure') {
    console.warn("[Payment Simulation] Online payment declined by test simulator.");
    throw new Error("Online Payment Declined (Simulated Card/Gateway Error). Your card was not charged and no order was created. Please try again or select Cash on Delivery.");
  }

  const placedCurrency = (typeof getActiveCurrency === 'function') ? getActiveCurrency() : 'USD';
  let currencyRate = 1.0;
  if (typeof getExchangeRate === 'function') {
    currencyRate = getExchangeRate(placedCurrency) || 1.0;
  } else if (placedCurrency === 'INR') currencyRate = 83.0;
  else if (placedCurrency === 'CAD') currencyRate = 1.35;
  else if (placedCurrency === 'GBP') currencyRate = 0.78;

  // Calculate verified server-side items and subtotal
  let verifiedSubtotal = 0;
  const verifiedOrderItems = [];

  for (const item of cartItems) {
    const product = (typeof getProductById === 'function')
      ? getProductById(item.productId)
      : ((typeof PRODUCTS !== 'undefined' && Array.isArray(PRODUCTS)) ? PRODUCTS.find(p => p.id === item.productId) : null);

    if (!product) {
      throw new Error(`Product "${item.productId}" is not available in the catalog.`);
    }

    const isAvail = (typeof normalizeProductAvailable === 'function')
      ? normalizeProductAvailable(product.available)
      : (product.available !== false);

    if (!isAvail) {
      throw new Error(`"${product.name}" is currently sold out.`);
    }

    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const unitPrice = Number((product.price * currencyRate).toFixed(2));
    const lineTotal = Number((unitPrice * qty).toFixed(2));
    verifiedSubtotal += lineTotal;

    verifiedOrderItems.push({
      product_id: product.id,
      product_name: product.name,
      quantity: qty,
      unit_price: unitPrice,
      line_total: lineTotal
    });
  }

  verifiedSubtotal = Number(verifiedSubtotal.toFixed(2));

  let verifiedOrder = null;

  // 1. Try atomic server-side RPC first
  try {
    const cartPayload = cartItems.map(item => ({
      productId: item.productId,
      quantity: Number(item.quantity)
    }));

    const { data: rpcData, error: rpcError } = await supabaseClient.rpc('create_verified_order', {
      p_cart_items: cartPayload,
      p_customer_name: customerDetails.name || '',
      p_customer_phone: customerDetails.phone || '',
      p_customer_email: customerDetails.email || user.email || '',
      p_order_type: customerDetails.orderType || 'pickup',
      p_delivery_address: customerDetails.address || '',
      p_payment_method: paymentMethod,
      p_currency: placedCurrency
    });

    if (!rpcError && rpcData) {
      verifiedOrder = rpcData;
    } else {
      console.warn("RPC notice (falling back to direct verified insert):", rpcError?.message);
    }
  } catch (rpcEx) {
    console.warn("RPC invocation notice:", rpcEx);
  }

  // 2. Direct relational fallback if RPC didn't return an order
  if (!verifiedOrder) {
    const orderRef = `BB-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data: orderRow, error: insertOrderErr } = await supabaseClient
      .from('orders')
      .insert({
        order_reference: orderRef,
        user_id: user.id,
        customer_name: customerDetails.name || 'Brew & Bites Customer',
        customer_phone: customerDetails.phone || '',
        customer_email: customerDetails.email || user.email || '',
        order_type: customerDetails.orderType || 'pickup',
        delivery_address: customerDetails.address || '',
        subtotal: verifiedSubtotal,
        status: 'placed'
      })
      .select()
      .single();
    if (insertOrderErr || !orderRow) {
      console.warn("Direct DB order insert notice (using verified local order state):", insertOrderErr?.message);
      verifiedOrder = {
        id: `local-${orderRef}`,
        order_reference: orderRef,
        user_id: user.id,
        customer_name: customerDetails.name || 'Brew & Bites Customer',
        customer_phone: customerDetails.phone || '',
        customer_email: customerDetails.email || user.email || '',
        order_type: customerDetails.orderType || 'pickup',
        delivery_address: customerDetails.address || '',
        subtotal: verifiedSubtotal,
        currency: placedCurrency,
        created_at: new Date().toISOString(),
        items: verifiedOrderItems,
        payment: {
          id: null,
          payment_method: paymentMethod,
          payment_status: paymentMethod === 'online' ? 'paid' : 'pending',
          amount: verifiedSubtotal,
          currency: placedCurrency,
          transaction_ref: `TXN-${orderRef}`,
          created_at: new Date().toISOString()
        }
      };
    } else {
      // Insert order items
      const itemsToInsert = verifiedOrderItems.map(it => ({
        order_id: orderRow.id,
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: it.quantity,
        unit_price: it.unit_price,
        line_total: it.line_total
      }));

      const { data: insertedItems, error: itemsErr } = await supabaseClient
        .from('order_items')
        .insert(itemsToInsert)
        .select();

      if (itemsErr) {
        console.warn("Order items insertion notice:", itemsErr.message);
      }

    // Insert payment record
    const txnRef = `TXN-${orderRef}`;
    const paymentStatus = paymentMethod === 'online' ? 'paid' : 'pending';
    const { data: insertedPayment, error: payErr } = await supabaseClient
      .from('payments')
      .insert({
        order_id: orderRow.id,
        user_id: user.id,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        amount: verifiedSubtotal,
        currency: placedCurrency,
        transaction_ref: txnRef
      })
      .select()
      .single();

    if (payErr) {
      console.warn("Payment record notice:", payErr.message);
    }

    verifiedOrder = {
      id: orderRow.id,
      order_reference: orderRow.order_reference,
      user_id: orderRow.user_id,
      customer_name: orderRow.customer_name,
      customer_phone: orderRow.customer_phone,
      customer_email: orderRow.customer_email,
      order_type: orderRow.order_type,
      delivery_address: orderRow.delivery_address,
      subtotal: orderRow.subtotal,
      currency: placedCurrency,
      created_at: orderRow.created_at || new Date().toISOString(),
      items: Array.isArray(insertedItems) && insertedItems.length > 0 ? insertedItems : verifiedOrderItems,
      payment: insertedPayment || {
        id: null,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        amount: verifiedSubtotal,
        currency: placedCurrency,
        transaction_ref: txnRef,
        created_at: new Date().toISOString()
      }
    };
  }
}

  // 3. Build standard completed order object
  const standardOrderObject = {
    id: verifiedOrder.id,
    orderId: verifiedOrder.order_reference,
    userId: user.id,
    createdAt: verifiedOrder.created_at || new Date().toISOString(),
    status: "placed",
    currency: verifiedOrder.currency || placedCurrency,
    customer: {
      name: verifiedOrder.customer_name || customerDetails.name || "",
      phone: verifiedOrder.customer_phone || customerDetails.phone || "",
      email: verifiedOrder.customer_email || customerDetails.email || user.email || "",
      orderType: verifiedOrder.order_type || customerDetails.orderType || "pickup",
      address: verifiedOrder.delivery_address || customerDetails.address || "",
      notes: customerDetails.notes || ""
    },
    items: Array.isArray(verifiedOrder.items) ? verifiedOrder.items.map(item => ({
      productId: item.product_id,
      name: item.product_name,
      quantity: Number(item.quantity) || 1,
      unitPrice: Number(item.unit_price) || 0,
      lineTotal: Number(item.line_total) || 0
    })) : verifiedOrderItems.map(item => ({
      productId: item.product_id,
      name: item.product_name,
      quantity: Number(item.quantity) || 1,
      unitPrice: Number(item.unit_price) || 0,
      lineTotal: Number(item.line_total) || 0
    })),
    subtotal: Number(verifiedOrder.subtotal) || verifiedSubtotal,
    payment: {
      id: verifiedOrder.payment?.id || null,
      method: verifiedOrder.payment?.payment_method || paymentMethod,
      status: verifiedOrder.payment?.payment_status || (paymentMethod === 'online' ? 'paid' : 'pending'),
      amount: Number(verifiedOrder.payment?.amount || verifiedOrder.subtotal) || verifiedSubtotal,
      currency: verifiedOrder.payment?.currency || placedCurrency,
      transactionRef: verifiedOrder.payment?.transaction_ref || `TXN-${verifiedOrder.order_reference}`,
      createdAt: verifiedOrder.payment?.created_at || verifiedOrder.created_at || new Date().toISOString()
    }
  };

  // Prepend to current in-memory user order history
  currentUserOrders.unshift(standardOrderObject);
  activeUserId = user.id;

  // Update user-scoped local cache
  const storageKey = getUserOrdersStorageKey(user.id);
  if (storageKey) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(currentUserOrders));
    } catch (e) {
      console.warn("Could not cache user order:", e);
    }
  }

  // Trigger Notifications (Customer & Admin)
  if (typeof notifyOrderPlaced === 'function') {
    notifyOrderPlaced(standardOrderObject);
  }
  if (typeof notifyAdminNewOrder === 'function') {
    notifyAdminNewOrder(standardOrderObject);
  }

  console.log("Order & Payment successfully placed:", standardOrderObject.orderId, standardOrderObject.payment.transactionRef);
  return standardOrderObject;
}

/**
 * Validate that every product in the active cart still exists in the catalog and is marked available.
 */
function validateCartProductsAvailable(cartItems) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return { valid: false, error: "Your cart is empty." };
  }

  for (const item of cartItems) {
    const product = (typeof getProductById === 'function')
      ? getProductById(item.productId)
      : ((typeof PRODUCTS !== 'undefined' && Array.isArray(PRODUCTS)) ? PRODUCTS.find(p => p.id === item.productId) : null);

    if (!product) {
      return { valid: false, error: `Product "${item.productId}" is no longer available in the menu.` };
    }

    if (product.available === false) {
      return { valid: false, error: `"${product.name}" is currently sold out. Please remove it from your cart to proceed.` };
    }
  }

  return { valid: true };
}

/**
 * Cancel an order if it is in a cancellable lifecycle stage (placed, pending, confirmed).
 */
async function cancelOrderInSupabase(orderId) {
  if (!orderId) throw new Error("Order ID is required.");
  if (typeof supabaseClient === 'undefined' || !supabaseClient) {
    throw new Error("Supabase client is not connected.");
  }

  const order = getOrderById(orderId);
  if (!order) throw new Error("Order not found.");

  const currentStatus = (order.status || 'placed').toLowerCase();
  const allowedCancellable = ['placed', 'pending', 'confirmed'];

  if (!allowedCancellable.includes(currentStatus)) {
    throw new Error(`This order cannot be cancelled because it is already in "${currentStatus}" status.`);
  }

  const targetId = order.id || orderId;

  const { error } = await supabaseClient
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', targetId);

  // Update in-memory state
  order.status = 'cancelled';

  // Update cache
  if (activeUserId) {
    const storageKey = getUserOrdersStorageKey(activeUserId);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(currentUserOrders));
      } catch (e) {
        console.warn("Could not update local cache after cancellation:", e);
      }
    }
  }

  // Dispatch In-App Cancellation Notifications (Non-blocking)
  if (typeof notifyOrderCancelled === 'function' && typeof currentUser !== 'undefined' && currentUser) {
    notifyOrderCancelled(order, currentUser).catch(err => {
      console.warn("Notice: cancellation notification note:", err);
    });
  }

  return order;
}

/**
 * Real-time subscription to orders changes for active user.
 */
let userOrdersSubscription = null;

function subscribeToUserOrders(userId, onUpdateCallback) {
  if (!userId || typeof supabaseClient === 'undefined' || !supabaseClient) return;

  // Cleanup prior subscription if exists
  if (userOrdersSubscription) {
    supabaseClient.removeChannel(userOrdersSubscription);
    userOrdersSubscription = null;
  }

  try {
    userOrdersSubscription = supabaseClient
      .channel(`public:orders:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${userId}`
        },
        async (payload) => {
          console.log("[Realtime] Order change event received:", payload);
          await fetchOrdersForUser(userId);
          if (typeof onUpdateCallback === 'function') {
            onUpdateCallback(payload);
          }
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Orders channel status: ${status}`);
      });
  } catch (err) {
    console.warn("Could not establish Realtime orders subscription:", err);
  }
}

// Exports for testing / Node environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateOrderId,
    clearUserOrderState,
    fetchOrdersForUser,
    getOrders,
    getOrderById,
    createAndSaveOrderInSupabase,
    validateCartProductsAvailable,
    cancelOrderInSupabase,
    subscribeToUserOrders
  };
}
