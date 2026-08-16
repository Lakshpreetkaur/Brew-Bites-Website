/**
 * Brew & Bite - Order Management Data Layer (orders.js)
 * Temporary localStorage implementation for frontend development and testing.
 * Replace with backend/database persistence in the production version.
 *
 * Responsibilities:
 * - Order ID generation (BB-DEMO-XXXX)
 * - Price & product snapshot creation (historical pricing)
 * - Order creation and persistence
 * - Order retrieval (getOrders, getOrderById)
 */

const ORDERS_STORAGE_KEY = "brewBiteOrders";

/**
 * Generate a unique, human-readable demo order reference.
 * Format: BB-DEMO-XXXX (e.g. BB-DEMO-4827)
 */
function generateOrderId() {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `BB-DEMO-${randomSuffix}`;
}

/**
 * Load all completed orders from localStorage.
 * Returns an empty array [] if no orders exist or if storage is invalid.
 */
function getOrders() {
  try {
    const rawData = localStorage.getItem(ORDERS_STORAGE_KEY);
    if (!rawData) return [];
    const parsed = JSON.parse(rawData);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Could not load orders from localStorage:", err);
    return [];
  }
}

/**
 * Find a specific completed order by its orderId.
 */
function getOrderById(orderId) {
  if (!orderId) return null;
  const orders = getOrders();
  return orders.find(order => order.orderId === orderId) || null;
}

/**
 * Save a newly created order to localStorage.
 * Appends the order to the existing order history.
 */
function saveOrder(order) {
  if (!order || !order.orderId) return false;
  try {
    const orders = getOrders();
    // Add new order to the beginning of the list (most recent first)
    orders.unshift(order);
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
    console.log("Order saved successfully:", order.orderId, order);
    return true;
  } catch (err) {
    console.warn("Could not save order to localStorage:", err);
    return false;
  }
}

/**
 * Create a completed order snapshot from current cart items and customer form inputs.
 * Takes a historical price snapshot so changes to the live product catalog never alter past orders.
 */
function createOrder(cartItems, customerDetails) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return null;
  }

  let calculatedSubtotal = 0;

  // Snapshot each product's unit price and calculate line totals
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

  const order = {
    orderId: generateOrderId(),
    createdAt: new Date().toISOString(),
    status: "placed",
    customer: {
      name: customerDetails.name || "",
      phone: customerDetails.phone || "",
      email: customerDetails.email || "",
      orderType: customerDetails.orderType || "pickup",
      address: customerDetails.address || "",
      notes: customerDetails.notes || ""
    },
    items: orderItems,
    subtotal: Number(calculatedSubtotal.toFixed(2))
  };

  return order;
}
