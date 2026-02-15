/**
 * OMNI Crypto Payments — Content Script
 * Detects fiat prices on any webpage and injects ZEC equivalent badges.
 */
(function () {
  'use strict';

  const C = OMNI_CONSTANTS;

  // --- Price detection patterns ---
  // Patterns with explicit currency codes always map to their exact currency.
  // The bare "$" pattern uses a special 'dollar' marker — resolved at runtime
  // to the user's configured fiat currency (CAD, AUD, or USD).

  const PRICE_PATTERNS = [
    // === Explicit multi-char symbols (must come before bare $) ===
    { regex: /(?<!\w)(R\$)\s?((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{1,2})?)(?!\d|[-\/])/g, currency: 'brl', valueGroup: 2 },
    { regex: /(?<!\w)(A\$)\s?((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{1,2})?)(?!\d|[-\/])/g, currency: 'aud', valueGroup: 2 },
    { regex: /(?<!\w)(CA\$)\s?((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{1,2})?)(?!\d|[-\/])/g, currency: 'cad', valueGroup: 2 },

    // === Explicit currency codes (always exact) ===
    { regex: /\b(USD|US\$)\s?((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{1,2})?)(?!\d|[-\/])/gi, currency: 'usd', valueGroup: 2 },
    { regex: /\b(CAD)\s?((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{1,2})?)(?!\d|[-\/])/gi, currency: 'cad', valueGroup: 2 },
    { regex: /\b(AUD)\s?((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{1,2})?)(?!\d|[-\/])/gi, currency: 'aud', valueGroup: 2 },
    { regex: /\b(EUR)\s?((?:\d{1,3}(?:,\d{3})*|\d+)(?:[.,]\d{1,2})?)(?!\d|[-\/])/gi, currency: 'eur', valueGroup: 2 },
    { regex: /\b(GBP)\s?((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{1,2})?)(?!\d|[-\/])/gi, currency: 'gbp', valueGroup: 2 },
    { regex: /\b(JPY)\s?((?:\d{1,3}(?:,\d{3})*|\d+))(?!\d|[-\/\.])/gi, currency: 'jpy', valueGroup: 2 },
    { regex: /\b(CHF)\s?((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{1,2})?)(?!\d|[-\/])/gi, currency: 'chf', valueGroup: 2 },
    { regex: /\b(INR)\s?((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{1,2})?)(?!\d|[-\/])/gi, currency: 'inr', valueGroup: 2 },
    { regex: /\b(BRL)\s?((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{1,2})?)(?!\d|[-\/])/gi, currency: 'brl', valueGroup: 2 },
    { regex: /\b(CNY|CN¥)\s?((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{1,2})?)(?!\d|[-\/])/gi, currency: 'cny', valueGroup: 2 },

    // Code-suffixed: 100 USD, 49.99 CAD, etc.
    { regex: /(?<!\d)((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{1,2})?)\s?(USD)(?!\w)/gi, currency: 'usd', valueGroup: 1 },
    { regex: /(?<!\d)((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{1,2})?)\s?(CAD)(?!\w)/gi, currency: 'cad', valueGroup: 1 },
    { regex: /(?<!\d)((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{1,2})?)\s?(AUD)(?!\w)/gi, currency: 'aud', valueGroup: 1 },
    { regex: /(?<!\d)((?:\d{1,3}(?:,\d{3})*|\d+)(?:[.,]\d{1,2})?)\s?(EUR)(?!\w)/gi, currency: 'eur', valueGroup: 1 },
    { regex: /(?<!\d)((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{1,2})?)\s?(GBP)(?!\w)/gi, currency: 'gbp', valueGroup: 1 },
    { regex: /(?<!\d)((?:\d{1,3}(?:,\d{3})*|\d+))\s?(JPY)(?!\w)/gi, currency: 'jpy', valueGroup: 1 },
    { regex: /(?<!\d)((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{1,2})?)\s?(CHF)(?!\w)/gi, currency: 'chf', valueGroup: 1 },
    { regex: /(?<!\d)((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{1,2})?)\s?(INR)(?!\w)/gi, currency: 'inr', valueGroup: 1 },
    { regex: /(?<!\d)((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{1,2})?)\s?(BRL)(?!\w)/gi, currency: 'brl', valueGroup: 1 },
    { regex: /(?<!\d)((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{1,2})?)\s?(CNY)(?!\w)/gi, currency: 'cny', valueGroup: 1 },

    // === Unambiguous symbols ===
    { regex: /(?<!\d)(€)\s?((?:\d{1,3}(?:,\d{3})*|\d+)(?:[.,]\d{1,2})?)(?!\d|[-\/])/g, currency: 'eur', valueGroup: 2 },
    { regex: /(?<!\d)(£)\s?((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{1,2})?)(?!\d|[-\/])/g, currency: 'gbp', valueGroup: 2 },
    { regex: /(?<!\d)(₹)\s?((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{1,2})?)(?!\d|[-\/])/g, currency: 'inr', valueGroup: 2 },
    { regex: /(?<!\d)(¥)\s?((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{0,2})?)(?!\d|[-\/])/g, currency: 'jpy', valueGroup: 2 },

    // === Bare "$" — ambiguous, resolved to user's configured dollar currency ===
    // This MUST be last so explicit CA$, A$, US$, USD, CAD, AUD match first.
    { regex: /(?<![A-Za-z\d])(\$)\s?((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{1,2})?)(?!\d|[-\/])/g, currency: 'dollar', valueGroup: 2 },
  ];

  const EXCLUDED_TAGS = new Set([
    'script', 'style', 'code', 'pre', 'input',
    'textarea', 'select', 'noscript', 'meta', 'svg', 'canvas',
  ]);

  let scanTimeout = null;
  let currentRates = null;
  let currentSettings = null;
  let observer = null;

  // --- Utility functions ---

  function isLikelyYear(value, raw) {
    return (
      Number.isInteger(value) &&
      value >= 1900 &&
      value <= 2099 &&
      !raw.includes(',') &&
      !raw.includes('.')
    );
  }

  function parseNumericValue(str) {
    // Handle European format where comma is decimal: "1.299,99" -> not handled in v1
    // Standard: remove commas as thousands separators, parse as float
    return parseFloat(str.replace(/,/g, ''));
  }

  function formatZec(amount, decimalPlaces) {
    if (amount >= 100) return amount.toFixed(2);
    if (amount >= 1) return amount.toFixed(Math.min(decimalPlaces, 4));
    // For small amounts, show more precision
    return amount.toFixed(decimalPlaces);
  }

  // --- DOM scanning ---

  function findPriceNodes() {
    if (!document.body) return [];

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;

          const tag = parent.tagName.toLowerCase();
          if (EXCLUDED_TAGS.has(tag)) return NodeFilter.FILTER_REJECT;

          // Skip already processed elements
          if (parent.closest(`[${C.PROCESSED_ATTR}]`)) return NodeFilter.FILTER_REJECT;

          // Skip our own badges
          if (parent.closest(`.${C.BADGE_CLASS}`)) return NodeFilter.FILTER_REJECT;

          const text = node.textContent;
          if (!text || text.trim().length < 2) return NodeFilter.FILTER_REJECT;

          // Quick check: does text contain any price-like character or currency code?
          if (/[\$€£₹¥]|R\$|A\$|CA\$|\b(USD|EUR|GBP|CHF|CAD|AUD|BRL|INR|CNY|JPY)\b/i.test(text)) {
            return NodeFilter.FILTER_ACCEPT;
          }

          return NodeFilter.FILTER_SKIP;
        },
      }
    );

    const nodes = [];
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }
    return nodes;
  }

  function processTextNode(textNode, rates, settings) {
    const text = textNode.textContent;
    const parent = textNode.parentElement;
    if (!parent || parent.hasAttribute(C.PROCESSED_ATTR)) return;

    for (const pattern of PRICE_PATTERNS) {
      pattern.regex.lastIndex = 0;
      let match;

      while ((match = pattern.regex.exec(text)) !== null) {
        const numericStr = match[pattern.valueGroup];
        if (!numericStr) continue;

        const numericValue = parseNumericValue(numericStr);

        // Validate
        if (isNaN(numericValue) || numericValue <= 0) continue;
        if (numericValue > 10000000) continue;
        if (isLikelyYear(numericValue, numericStr)) continue;

        // Resolve bare "$" to user's configured dollar currency
        let currency = pattern.currency;
        if (currency === 'dollar') {
          currency = C.DOLLAR_CURRENCIES.includes(settings.fiatCurrency)
            ? settings.fiatCurrency
            : 'usd';
        }

        const rate = rates[currency];
        if (!rate || rate <= 0) continue;

        const zecAmount = numericValue / rate;
        injectBadge(parent, zecAmount, settings);
        parent.setAttribute(C.PROCESSED_ATTR, 'true');
        return; // One badge per element to avoid clutter
      }
    }
  }

  function injectBadge(parentElement, zecAmount, settings) {
    // Don't inject if badge already exists in this element
    if (parentElement.querySelector(`.${C.BADGE_CLASS}`)) return;

    const badge = document.createElement('span');
    badge.className = C.BADGE_CLASS;
    const formatted = formatZec(zecAmount, settings.decimalPlaces);
    badge.textContent = ` \u2248 ${formatted} ZEC`;
    badge.title = `${zecAmount.toFixed(8)} ZEC (OMNI Converter)`;
    parentElement.appendChild(badge);
  }

  // --- Scanning orchestration ---

  function scanPage() {
    if (!currentRates || !currentSettings || !currentSettings.enabled) return;

    const nodes = findPriceNodes();
    for (const node of nodes) {
      processTextNode(node, currentRates, currentSettings);
    }
  }

  function setupObserver() {
    if (observer) observer.disconnect();

    observer = new MutationObserver((mutations) => {
      let needsScan = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (
              node.nodeType === Node.ELEMENT_NODE &&
              !node.classList?.contains(C.BADGE_CLASS)
            ) {
              needsScan = true;
              break;
            }
          }
        }
        if (needsScan) break;
      }

      if (needsScan) {
        clearTimeout(scanTimeout);
        scanTimeout = setTimeout(scanPage, 500);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function removeAllBadges() {
    document.querySelectorAll(`.${C.BADGE_CLASS}`).forEach((el) => el.remove());
    document.querySelectorAll(`[${C.PROCESSED_ATTR}]`).forEach((el) => {
      el.removeAttribute(C.PROCESSED_ATTR);
    });
  }

  // --- Initialization ---

  async function init() {
    try {
      currentSettings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
    } catch {
      currentSettings = C.DEFAULTS;
    }

    if (!currentSettings || !currentSettings.enabled) return;

    try {
      const rateResponse = await chrome.runtime.sendMessage({ type: 'GET_RATES' });
      if (!rateResponse || !rateResponse.success) {
        console.warn('OMNI: Could not get ZEC rates');
        return;
      }
      currentRates = rateResponse.rates;
    } catch {
      console.warn('OMNI: Failed to communicate with background worker');
      return;
    }

    scanPage();
    setupObserver();
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'TOGGLE') {
      if (message.enabled) {
        removeAllBadges();
        init();
      } else {
        removeAllBadges();
        if (observer) observer.disconnect();
      }
    }
    if (message.type === 'RATES_UPDATED' && message.rates) {
      currentRates = message.rates;
      removeAllBadges();
      scanPage();
    }
    if (message.type === 'SETTINGS_UPDATED' && message.settings) {
      currentSettings = message.settings;
      removeAllBadges();
      if (currentSettings.enabled) {
        scanPage();
      } else {
        if (observer) observer.disconnect();
      }
    }
  });

  // Listen for storage changes (settings changed from options page)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes[C.STORAGE_KEYS.SETTINGS]) {
      currentSettings = changes[C.STORAGE_KEYS.SETTINGS].newValue;
      removeAllBadges();
      if (currentSettings.enabled) {
        scanPage();
        if (!observer) setupObserver();
      } else {
        if (observer) observer.disconnect();
        observer = null;
      }
    }
  });

  init();
})();
