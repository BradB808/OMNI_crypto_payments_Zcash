/**
 * OMNI Crypto Payments — Shared Constants
 * Works in both service worker (self) and content script (window) contexts.
 */
const OMNI_CONSTANTS = {
  CURRENCIES: {
    usd: { symbol: '$',   code: 'USD', name: 'US Dollar' },
    eur: { symbol: '€',   code: 'EUR', name: 'Euro' },
    gbp: { symbol: '£',   code: 'GBP', name: 'British Pound' },
    jpy: { symbol: '¥',   code: 'JPY', name: 'Japanese Yen' },
    cad: { symbol: 'CA$', code: 'CAD', name: 'Canadian Dollar' },
    aud: { symbol: 'A$',  code: 'AUD', name: 'Australian Dollar' },
    chf: { symbol: 'CHF', code: 'CHF', name: 'Swiss Franc' },
    cny: { symbol: 'CN¥', code: 'CNY', name: 'Chinese Yuan' },
    inr: { symbol: '₹',   code: 'INR', name: 'Indian Rupee' },
    brl: { symbol: 'R$',  code: 'BRL', name: 'Brazilian Real' },
  },

  API: {
    BASE_URL: 'https://api.coingecko.com/api/v3',
    PRICE_ENDPOINT: '/simple/price',
    COIN_ID: 'zcash',
    CACHE_TTL_MS: 60000,
  },

  DEFAULTS: {
    fiatCurrency: 'usd',
    enabled: true,
    refreshInterval: 60,
    decimalPlaces: 4,
  },

  STORAGE_KEYS: {
    SETTINGS: 'omni_settings',
    CACHED_RATES: 'omni_cached_rates',
    CACHE_TIMESTAMP: 'omni_cache_timestamp',
  },

  // Map browser language/region codes to currency keys
  LOCALE_TO_CURRENCY: {
    US: 'usd', CA: 'cad', AU: 'aud', GB: 'gbp', IE: 'gbp',
    DE: 'eur', FR: 'eur', IT: 'eur', ES: 'eur', NL: 'eur',
    BE: 'eur', AT: 'eur', PT: 'eur', FI: 'eur', GR: 'eur',
    LU: 'eur', SK: 'eur', SI: 'eur', EE: 'eur', LV: 'eur',
    LT: 'eur', MT: 'eur', CY: 'eur', HR: 'eur',
    JP: 'jpy', CN: 'cny', IN: 'inr', BR: 'brl', CH: 'chf',
    NZ: 'aud', HK: 'usd', SG: 'usd', MX: 'usd',
  },

  // Currencies that use a bare "$" symbol
  DOLLAR_CURRENCIES: ['usd', 'cad', 'aud'],

  BADGE_CLASS: 'omni-zec-badge',
  PROCESSED_ATTR: 'data-omni-processed',
};

if (typeof self !== 'undefined') self.OMNI_CONSTANTS = OMNI_CONSTANTS;
