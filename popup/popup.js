const C = OMNI_CONSTANTS;

document.addEventListener('DOMContentLoaded', async () => {
  const enableToggle = document.getElementById('enableToggle');
  const currencySelect = document.getElementById('currencySelect');
  const rateValue = document.getElementById('rateValue');
  const rateMeta = document.getElementById('rateMeta');
  const refreshBtn = document.getElementById('refreshBtn');
  const optionsBtn = document.getElementById('optionsBtn');

  // Populate currency dropdown
  for (const [key, info] of Object.entries(C.CURRENCIES)) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = `${info.code} (${info.symbol})`;
    currencySelect.appendChild(option);
  }

  // Load settings
  let settings;
  try {
    const stored = await chrome.storage.sync.get(C.STORAGE_KEYS.SETTINGS);
    settings = stored[C.STORAGE_KEYS.SETTINGS] || { ...C.DEFAULTS };
  } catch {
    settings = { ...C.DEFAULTS };
  }

  enableToggle.checked = settings.enabled;
  currencySelect.value = settings.fiatCurrency;

  // Display rate
  async function displayRate() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_RATES' });
      if (response && response.success) {
        const rate = response.rates[settings.fiatCurrency];
        if (rate) {
          const symbol = C.CURRENCIES[settings.fiatCurrency].symbol;
          rateValue.textContent = `1 ZEC = ${symbol}${rate.toLocaleString()}`;
          rateMeta.textContent = response.cached ? 'Cached rate' : 'Just updated';
        } else {
          rateValue.textContent = 'Rate unavailable';
          rateMeta.textContent = 'Currency not supported in API response';
        }
      } else {
        rateValue.textContent = 'Rate unavailable';
        rateMeta.textContent = response?.error || 'Network error';
      }
    } catch {
      rateValue.textContent = 'Rate unavailable';
      rateMeta.textContent = 'Extension error';
    }
  }

  displayRate();

  // Toggle conversion on/off
  enableToggle.addEventListener('change', async () => {
    settings.enabled = enableToggle.checked;
    await chrome.storage.sync.set({ [C.STORAGE_KEYS.SETTINGS]: settings });

    // Notify active tab
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'TOGGLE',
          enabled: settings.enabled,
        }).catch(() => {});
      }
    } catch {}
  });

  // Currency change
  currencySelect.addEventListener('change', async () => {
    settings.fiatCurrency = currencySelect.value;
    await chrome.storage.sync.set({ [C.STORAGE_KEYS.SETTINGS]: settings });
    displayRate();
  });

  // Refresh rate
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Refreshing...';
    try {
      await chrome.runtime.sendMessage({ type: 'GET_RATES', forceRefresh: true });
      await displayRate();
    } catch {}
    refreshBtn.disabled = false;
    refreshBtn.textContent = 'Refresh Rate';
  });

  // Open options page
  optionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});
