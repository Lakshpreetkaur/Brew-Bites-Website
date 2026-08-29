/**
 * Brew & Bite - Centralized Country & Regional Configuration (country-config.js)
 * Single source of truth for supported countries, calling codes, and default currencies.
 */

const COUNTRIES = {
  IN: {
    code: 'IN',
    name: 'India',
    dial: '+91',
    flag: '🇮🇳',
    currency: 'INR'
  },
  US: {
    code: 'US',
    name: 'United States',
    dial: '+1',
    flag: '🇺🇸',
    currency: 'USD'
  },
  GB: {
    code: 'GB',
    name: 'United Kingdom',
    dial: '+44',
    flag: '🇬🇧',
    currency: 'GBP'
  },
  CA: {
    code: 'CA',
    name: 'Canada',
    dial: '+1',
    flag: '🇨🇦',
    currency: 'CAD'
  }
};

const COUNTRIES_LIST = Object.values(COUNTRIES);

// Export for Node testing environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { COUNTRIES, COUNTRIES_LIST };
}
