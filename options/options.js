const C = OMNI_CONSTANTS;

document.addEventListener('DOMContentLoaded', async () => {
  const enableToggle = document.getElementById('enableToggle');
  const currencySelect = document.getElementById('currencySelect');
  const decimalPlaces = document.getElementById('decimalPlaces');
  const refreshInterval = document.getElementById('refreshInterval');
  const ratesBody = document.getElementById('ratesBody');
  const resetBtn = document.getElementById('resetBtn');
  const statusMsg = document.getElementById('statusMsg');

  // Populate currency dropdown
  for (const [key, info] of Object.entries(C.CURRENCIES)) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = `${info.code} (${info.symbol}) — ${info.name}`;
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
  decimalPlaces.value = String(settings.decimalPlaces);
  refreshInterval.value = String(settings.refreshInterval);

  // Save helper
  async function saveSettings() {
    await chrome.storage.sync.set({ [C.STORAGE_KEYS.SETTINGS]: settings });
    showStatus('Settings saved');
  }

  function showStatus(msg) {
    statusMsg.textContent = msg;
    statusMsg.classList.add('visible');
    setTimeout(() => statusMsg.classList.remove('visible'), 2000);
  }

  // Event handlers
  enableToggle.addEventListener('change', () => {
    settings.enabled = enableToggle.checked;
    saveSettings();
  });

  currencySelect.addEventListener('change', () => {
    settings.fiatCurrency = currencySelect.value;
    saveSettings();
  });

  decimalPlaces.addEventListener('change', () => {
    settings.decimalPlaces = parseInt(decimalPlaces.value, 10);
    saveSettings();
  });

  refreshInterval.addEventListener('change', async () => {
    settings.refreshInterval = parseInt(refreshInterval.value, 10);
    await saveSettings();
    // Update the alarm in the background
    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_ALARM',
        intervalSeconds: settings.refreshInterval,
      });
    } catch {}
  });

  // Reset to defaults
  resetBtn.addEventListener('click', async () => {
    settings = { ...C.DEFAULTS };
    enableToggle.checked = settings.enabled;
    currencySelect.value = settings.fiatCurrency;
    decimalPlaces.value = String(settings.decimalPlaces);
    refreshInterval.value = String(settings.refreshInterval);
    await saveSettings();
    showStatus('Reset to defaults');
  });

  // Load and display rates table
  async function displayRates() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_RATES' });
      if (response && response.success) {
        ratesBody.innerHTML = '';
        for (const [key, info] of Object.entries(C.CURRENCIES)) {
          const rate = response.rates[key];
          const tr = document.createElement('tr');
          const tdCurrency = document.createElement('td');
          tdCurrency.textContent = `${info.code} (${info.symbol})`;
          const tdRate = document.createElement('td');
          tdRate.textContent = rate ? `${info.symbol}${rate.toLocaleString()}` : 'N/A';
          tr.appendChild(tdCurrency);
          tr.appendChild(tdRate);
          ratesBody.appendChild(tr);
        }
      } else {
        ratesBody.innerHTML = '<tr><td colspan="2" class="loading">Failed to load rates</td></tr>';
      }
    } catch {
      ratesBody.innerHTML = '<tr><td colspan="2" class="loading">Error loading rates</td></tr>';
    }
  }

  displayRates();
});
