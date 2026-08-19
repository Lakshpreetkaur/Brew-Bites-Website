/**
 * Brew & Bite - Order Management & Supabase Data Layer (orders.js)
 * Enforces authenticated user order ownership and stores order records
 * in Supabase `orders` and `order_items` tables.
 *
 * Responsibilities:
 * - Order reference generation (BB-DEMO-XXXX)
 * - Historical price snapshotting
 * - Authenticated order creation in Supabase
 * - Secure user-specific order retrieval (getOrdersForUser)
 * - User session state isolation (clearUserOrderState on logout)
 */

// In-Memory cache for the currently active authenticated user's orders
let currentUserOrders = [];
let activeUserId = null;

/**
 * Generate a unique, human-readable demo order reference.
 * Format: BB-DEMO-XXXX (e.g. BB-DEMO-4827)
 */
function generateOrderId() {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `BB-DEMO-${randomSuffix}`;
}

/**
 * Clear cached orders from memory when a user signs out.
 * Ensures Account B never sees Account A's order history.
 */
function clearUserOrderState() {
  currentUserOrders = [];
  activeUserId = null;
  console.log("User order state cleared on logout.");
}

/**
 * Load completed orders for the current user from Supabase.
 * Returns only orders belonging to the specified userId.
 */
async function fetchOrdersForUser(userId) {
  if (!userId) {
    currentUserOrders = [];
    activeUserId = null;
    return [];
  }

  activeUserId = userId;

  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('orders')
        .select(`
          id,
          order_id,
          user_id,
          customer_name,
          customer_phone,
          customer_email,
          order_type,
          delivery_address,
          notes,
          subtotal,
          status,
          created_at,
          order_items (
            id,
            product_id,
            product_name,
            quantity,
            unit_price,
            line_total
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn("Supabase orders query note:", error.message);
      } else if (Array.isArray(data)) {
        // Normalize Supabase records into standard frontend order format
        currentUserOrders = data.map(record => ({
          id: record.id,
          orderId: record.order_id || record.id,
          userId: record.user_id,
          createdAt: record.created_at,
          status: record.status || 'placed',
          customer: {
            name: record.customer_name || '',
            phone: record.customer_phone || '',
            email: record.customer_email || '',
            orderType: record.order_type || 'pickup',
            address: record.delivery_address || '',
            notes: record.notes || ''
          },
          items: Array.isArray(record.order_items) ? record.order_items.map(item => ({
            productId: item.product_id,
            name: item.product_name || item.product_id,
            quantity: Number(item.quantity) || 1,
            unitPrice: Number(item.unit_price) || 0,
            lineTotal: Number(item.line_total) || 0
          })) : [],
          subtotal: Number(record.subtotal) || 0
        }));

        return currentUserOrders;
      }
    } catch (err) {
      console.warn("Error fetching user orders from Supabase:", err);
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
 * Find a specific completed order by its orderId from active user's orders.
 */
function getOrderById(orderId) {
  if (!orderId) return null;
  const orders = getOrders();
  return orders.find(order => order.orderId === orderId || order.id === orderId) || null;
}

/**
 * Create and persist a new order to Supabase linked to the authenticated user.
 * Captures historical product prices so future catalog updates do not alter past receipts.
 */
async function createAndSaveOrderInSupabase(cartItems, customerDetails, user) {
  if (!Array.isArray(cartItems) || cartItems.length === 0 || !user || !user.id) {
    console.error("Order creation blocked: Cart is empty or user is unauthenticated.");
    return null;
  }

  let calculatedSubtotal = 0;

  // 1. Snapshot items and lock unit prices
  const orderItems = cartItems.map(cartItem => {
    const product = (typeof PRODUCTS !== 'undefined' && Array.isArray(PRODUCTS))
      ? PRODUCTS.find(p => p.id === cartItem.productId)
      : null;

    const unitPrice = product ? Number(product.price) : 0;
    const quantity = Number(cartItem.quantity) || 1;
    const lineTotal = Number((unitPrice * quantity).toFixed(2));
    calculatedSubtotal += lineTotal;

    return {
      productId: cartItem.productId,
      name: product ? product.name : cartItem.productId,
      quantity: quantity,
      unitPrice: unitPrice,
      lineTotal: lineTotal
    };
  });

  const generatedRef = generateOrderId();
  const subtotalValue = Number(calculatedSubtotal.toFixed(2));

  const standardOrderObject = {
    orderId: generatedRef,
    userId: user.id,
    createdAt: new Date().toISOString(),
    status: "placed",
    customer: {
      name: customerDetails.name || "",
      phone: customerDetails.phone || "",
      email: customerDetails.email || user.email || "",
      orderType: customerDetails.orderType || "pickup",
      address: customerDetails.address || "",
      notes: customerDetails.notes || ""
    },
    items: orderItems,
    subtotal: subtotalValue
  };

  // 2. Insert into Supabase `orders` table
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      const { data: orderData, error: orderError } = await supabaseClient
        .from('orders')
        .insert({
          order_id: generatedRef,
          user_id: user.id,
          customer_name: customerDetails.name || '',
          customer_phone: customerDetails.phone || '',
          customer_email: customerDetails.email || user.email || '',
          order_type: customerDetails.orderType || 'pickup',
          delivery_address: customerDetails.address || '',
          notes: customerDetails.notes || '',
          subtotal: subtotalValue,
          status: 'placed'
        })
        .select()
        .maybeSingle();

      if (orderError) {
        console.warn("Supabase orders insert notice:", orderError.message);
      } else if (orderData && orderData.id) {
        standardOrderObject.id = orderData.id;

        // 3. Insert into Supabase `order_items` table
        const itemsToInsert = orderItems.map(item => ({
          order_id: orderData.id,
          product_id: item.productId,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          line_total: item.lineTotal
        }));

        const { error: itemsError } = await supabaseClient
          .from('order_items')
          .insert(itemsToInsert);

        if (itemsError) {
          console.warn("Supabase order_items insert notice:", itemsError.message);
        }
      }
    } catch (err) {
      console.warn("Error saving order to Supabase:", err);
    }
  }

  // Prepend to current in-memory user order history
  currentUserOrders.unshift(standardOrderObject);
  activeUserId = user.id;

  return standardOrderObject;
}
