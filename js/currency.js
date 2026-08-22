/**
 * Brew & Bite - Multi-Currency & Regional Pricing Engine (currency.js)
 * Live currency conversion and formatting for INR (₹), USD ($), CAD (CA$), and GBP (£).
 */

const CURRENCIES = {
  USD: { code: 'USD', symbol: '$', rate: 1.0, name: 'USD ($)', flag: '🇺🇸' },
  INR: { code: 'INR', symbol: '₹', rate: 83.0, name: 'INR (₹)', flag: '🇮🇳' },
  CAD: { code: 'CAD', symbol: 'CA$', rate: 1.35, name: 'CAD (CA$)', flag: '🇨🇦' },
  GBP: { code: 'GBP', symbol: '£', rate: 0.78, name: 'GBP (£)', flag: '🇬🇧' }
};

let activeCurrency = 'USD';
const currencyChangeListeners = [];

/**
 * Get active currency code.
 */
function getActiveCurrency() {
  return activeCurrency || 'USD';
}

/**
 * Get active currency metadata.
 */
function getActiveCurrencyMeta() {
  return CURRENCIES[activeCurrency] || CURRENCIES.USD;
}

/**
 * Set active currency and trigger subscribers.
 */
function setActiveCurrency(code) {
  if (!CURRENCIES[code]) return;
  activeCurrency = code;
  try {
    localStorage.setItem('bb_active_currency', code);
  } catch (e) {
    console.warn("Could not save currency preference:", e);
  }

  // Update navbar selector if present
  const sel = document.getElementById('currency-selector');
  if (sel && sel.value !== code) sel.value = code;

  // Notify listeners
  currencyChangeListeners.forEach(cb => {
    try { cb(activeCurrency); } catch (err) { console.error(err); }
  });

  // Re-render UI components
  if (typeof renderProducts === 'function') renderProducts();
  if (typeof renderCartDrawer === 'function') renderCartDrawer();
  if (typeof updateCartBadge === 'function') updateCartBadge();
}

/**
 * Register callback on currency update.
 */
function onCurrencyChanged(callback) {
  if (typeof callback === 'function') {
    currencyChangeListeners.push(callback);
  }
}

/**
 * Convert USD base price to target currency amount.
 */
function convertUSD(usdAmount, targetCurrency = null) {
  const code = targetCurrency || activeCurrency;
  const meta = CURRENCIES[code] || CURRENCIES.USD;
  return Number(usdAmount || 0) * meta.rate;
}

/**
 * Format a USD base amount into the active or specified currency string.
 * Example: formatCurrency(5.50) -> "₹456.50" (if INR) or "$5.50" (if USD).
 */
function formatCurrency(usdAmount, customCurrency = null) {
  const code = customCurrency || activeCurrency;
  const meta = CURRENCIES[code] || CURRENCIES.USD;
  const converted = Number(usdAmount || 0) * meta.rate;

  if (code === 'INR') {
    return `${meta.symbol}${Math.round(converted).toLocaleString('en-IN')}`;
  } else if (code === 'CAD') {
    return `${meta.symbol}${converted.toFixed(2)}`;
  } else if (code === 'GBP') {
    return `${meta.symbol}${converted.toFixed(2)}`;
  }
  return `${meta.symbol}${converted.toFixed(2)}`;
}

/**
 * Format an already converted historical amount with a specific currency symbol.
 */
function formatHistoricalCurrency(amount, currencyCode) {
  const meta = CURRENCIES[currencyCode] || CURRENCIES.USD;
  if (currencyCode === 'INR') {
    return `${meta.symbol}${Math.round(Number(amount || 0)).toLocaleString('en-IN')}`;
  }
  return `${meta.symbol}${Number(amount || 0).toFixed(2)}`;
}

/**
 * Initialize active currency from LocalStorage or user country.
 */
function initCurrency() {
  try {
    const saved = localStorage.getItem('bb_active_currency');
    if (saved && CURRENCIES[saved]) {
      activeCurrency = saved;
    } else if (typeof currentUser !== 'undefined' && currentUser?.user_metadata?.country === 'India') {
      activeCurrency = 'INR';
    }
  } catch (e) {
    activeCurrency = 'USD';
  }

  const sel = document.getElementById('currency-selector');
  if (sel) {
    sel.value = activeCurrency;
    sel.addEventListener('change', (e) => {
      setActiveCurrency(e.target.value);
    });
  }
}

document.addEventListener('DOMContentLoaded', initCurrency);

// Exports for Node testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CURRENCIES,
    getActiveCurrency,
    setActiveCurrency,
    convertUSD,
    formatCurrency,
    formatHistoricalCurrency,
    onCurrencyChanged
  };
}
