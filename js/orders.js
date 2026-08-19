/**
 * Brew & Bite - Order Management & Supabase Data Layer (orders.js)
 * Enforces authenticated user order ownership, persistent historical order storage,
 * and verified database-first architecture.
 *
 * Supabase Tables:
 * - public.orders: (id, order_reference, user_id, customer_name, customer_phone, customer_email, order_type, delivery_address, subtotal, status, created_at)
 * - public.order_items: (id, order_id, product_id, product_name, quantity, unit_price, line_total)
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
      const { data, error } = await supabaseClient
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

      if (error) {
        console.error("Supabase orders query error:", error);
      } else if (Array.isArray(data)) {
        // Map database records into standard frontend order format
        currentUserOrders = data.map(record => ({
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
          subtotal: Number(record.subtotal) || 0
        }));

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

/**
 * Create and persist a new order to Supabase.
 * Enforces strict database verification: if Supabase insert fails, throws an error
 * so the frontend will NOT display a false success receipt.
 */
async function createAndSaveOrderInSupabase(cartItems, customerDetails, user) {
  if (!Array.isArray(cartItems) || cartItems.length === 0 || !user || !user.id) {
    console.error("Order creation blocked: Cart is empty or user is unauthenticated.");
    throw new Error("You must be logged in with items in your cart to place an order.");
  }

  if (typeof supabaseClient === 'undefined' || !supabaseClient) {
    console.error("Supabase client is not connected.");
    throw new Error("Database service is currently unreachable. Please try again.");
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

  // 2. Insert into Supabase `orders` table with verified column names
  const orderInsertPayload = {
    order_reference: generatedRef,
    user_id: user.id,
    customer_name: customerDetails.name || '',
    customer_phone: customerDetails.phone || '',
    customer_email: customerDetails.email || user.email || '',
    order_type: customerDetails.orderType || 'pickup',
    delivery_address: customerDetails.address || '',
    subtotal: subtotalValue,
    status: 'placed'
  };

  const { data: orderRecord, error: orderError } = await supabaseClient
    .from('orders')
    .insert(orderInsertPayload)
    .select()
    .single();

  if (orderError || !orderRecord) {
    console.error("Failed to insert into Supabase orders table:", orderError);
    throw new Error(orderError?.message || "Failed to create order record in database.");
  }

  // 3. Insert line items into Supabase `order_items` table
  const itemsToInsert = orderItems.map(item => ({
    order_id: orderRecord.id,
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
    console.error("Failed to insert into Supabase order_items table:", itemsError);
    throw new Error(itemsError?.message || "Failed to create order line items in database.");
  }

  // 4. Build standard completed order object
  const standardOrderObject = {
    id: orderRecord.id,
    orderId: generatedRef,
    userId: user.id,
    createdAt: orderRecord.created_at || new Date().toISOString(),
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

  console.log("Order successfully persisted to Supabase:", standardOrderObject.orderId, standardOrderObject.id);
  return standardOrderObject;
}
