importScripts('../shared/constants.js');

const C = self.OMNI_CONSTANTS;

// Fetch live ZEC rates from CoinGecko for all supported fiat currencies
async function fetchRates() {
  const currencyCodes = Object.keys(C.CURRENCIES).join(',');
  const url = `${C.API.BASE_URL}${C.API.PRICE_ENDPOINT}?ids=${C.API.COIN_ID}&vs_currencies=${currencyCodes}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const rates = data[C.API.COIN_ID];

    if (!rates || typeof rates !== 'object') {
      throw new Error('Invalid API response format');
    }

    await chrome.storage.local.set({
      [C.STORAGE_KEYS.CACHED_RATES]: rates,
      [C.STORAGE_KEYS.CACHE_TIMESTAMP]: Date.now(),
    });

    return { success: true, rates };
  } catch (error) {
    console.error('OMNI: Rate fetch failed:', error.message);
    // Return cached rates if available
    const stored = await chrome.storage.local.get([C.STORAGE_KEYS.CACHED_RATES]);
    if (stored[C.STORAGE_KEYS.CACHED_RATES]) {
      return { success: true, rates: stored[C.STORAGE_KEYS.CACHED_RATES], cached: true, error: error.message };
    }
    return { success: false, error: error.message };
  }
}

// Get rates with cache check
async function getRates(forceRefresh = false) {
  if (!forceRefresh) {
    const stored = await chrome.storage.local.get([
      C.STORAGE_KEYS.CACHED_RATES,
      C.STORAGE_KEYS.CACHE_TIMESTAMP,
    ]);
    const age = Date.now() - (stored[C.STORAGE_KEYS.CACHE_TIMESTAMP] || 0);
    if (stored[C.STORAGE_KEYS.CACHED_RATES] && age < C.API.CACHE_TTL_MS) {
      return { success: true, rates: stored[C.STORAGE_KEYS.CACHED_RATES], cached: true };
    }
  }
  return fetchRates();
}

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_RATES') {
    getRates(message.forceRefresh).then(sendResponse);
    return true;
  }
  if (message.type === 'GET_SETTINGS') {
    chrome.storage.sync.get(C.STORAGE_KEYS.SETTINGS).then((result) => {
      sendResponse(result[C.STORAGE_KEYS.SETTINGS] || C.DEFAULTS);
    });
    return true;
  }
  if (message.type === 'UPDATE_ALARM') {
    const minutes = Math.max(message.intervalSeconds / 60, 0.5);
    chrome.alarms.clear('omni-rate-refresh').then(() => {
      chrome.alarms.create('omni-rate-refresh', { periodInMinutes: minutes });
    });
    sendResponse({ success: true });
    return true;
  }
});

// Periodic rate refresh via alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'omni-rate-refresh') {
    fetchRates();
  }
});

// Detect user's currency from browser locale
function detectCurrencyFromLocale() {
  // navigator.language returns e.g. "en-CA", "fr-FR", "en-US"
  const lang = (self.navigator?.language || 'en-US');
  // Extract region code (the part after the dash)
  const parts = lang.split('-');
  const region = (parts[1] || '').toUpperCase();

  if (region && C.LOCALE_TO_CURRENCY[region]) {
    return C.LOCALE_TO_CURRENCY[region];
  }

  // Fallback: try chrome.i18n if available
  try {
    const uiLang = chrome.i18n.getUILanguage();
    const uiParts = uiLang.split('-');
    const uiRegion = (uiParts[1] || '').toUpperCase();
    if (uiRegion && C.LOCALE_TO_CURRENCY[uiRegion]) {
      return C.LOCALE_TO_CURRENCY[uiRegion];
    }
  } catch {}

  return C.DEFAULTS.fiatCurrency;
}

// Set defaults on install, fetch initial rates
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    const detectedCurrency = detectCurrencyFromLocale();
    await chrome.storage.sync.set({
      [C.STORAGE_KEYS.SETTINGS]: { ...C.DEFAULTS, fiatCurrency: detectedCurrency },
    });
  }

  await fetchRates();

  const stored = await chrome.storage.sync.get(C.STORAGE_KEYS.SETTINGS);
  const settings = stored[C.STORAGE_KEYS.SETTINGS] || C.DEFAULTS;
  const minutes = Math.max(settings.refreshInterval / 60, 0.5);
  chrome.alarms.create('omni-rate-refresh', { periodInMinutes: minutes });
});
