import { getDefaultModel, getModelsForProvider, fetchOpenRouterModels, testConnection } from './providers.js';

const ALL_LANGUAGES = [
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'tr', name: 'Turkish' },
  { code: 'pl', name: 'Polish' },
  { code: 'sv', name: 'Swedish' }
];

const providerEl = document.getElementById('provider');
const apiKeyEl = document.getElementById('apiKey');
const modelEl = document.getElementById('model');
const modelHintEl = document.getElementById('modelHint');
const defaultModeEl = document.getElementById('defaultMode');
const translateLangsEl = document.getElementById('translateLangs');
const saveBtn = document.getElementById('saveBtn');
const testBtn = document.getElementById('testBtn');
const statusEl = document.getElementById('status');

let openRouterModelsCache = null;

// Populate translate language checkboxes
function populateLanguages(enabledCodes) {
  while (translateLangsEl.firstChild) translateLangsEl.removeChild(translateLangsEl.firstChild);
  // If no saved preference, enable all by default
  const enabled = enabledCodes || ALL_LANGUAGES.map(l => l.code);

  for (const lang of ALL_LANGUAGES) {
    const label = document.createElement('label');
    label.className = 'checkbox-label';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = lang.code;
    checkbox.checked = enabled.includes(lang.code);
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${lang.name}`));
    translateLangsEl.appendChild(label);
  }
}

function getSelectedLanguages() {
  const checkboxes = translateLangsEl.querySelectorAll('input[type="checkbox"]:checked');
  return Array.from(checkboxes).map(cb => cb.value);
}

// Populate model dropdown when provider changes
async function populateModels(provider, selectedModel) {
  // Clear current options
  modelEl.length = 0;

  if (provider === 'openrouter') {
    // Show loading state
    const loadingOpt = document.createElement('option');
    loadingOpt.value = '';
    loadingOpt.textContent = 'Loading models from OpenRouter...';
    modelEl.appendChild(loadingOpt);
    modelHintEl.textContent = 'Fetching available models...';

    try {
      if (!openRouterModelsCache) {
        openRouterModelsCache = await fetchOpenRouterModels();
      }
      modelEl.length = 0;
      for (const m of openRouterModelsCache) {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        if (m.id === selectedModel) opt.selected = true;
        modelEl.appendChild(opt);
      }
      modelHintEl.textContent = `${openRouterModelsCache.length} models available`;
    } catch (err) {
      modelEl.length = 0;
      const errOpt = document.createElement('option');
      errOpt.value = '';
      errOpt.textContent = 'Failed to load models';
      modelEl.appendChild(errOpt);
      modelHintEl.textContent = 'Could not fetch models. Check your connection.';
    }
  } else {
    const models = getModelsForProvider(provider);
    const defaultId = getDefaultModel(provider);

    for (const m of models) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name;
      if (selectedModel ? m.id === selectedModel : m.default) {
        opt.selected = true;
      }
      modelEl.appendChild(opt);
    }
    modelHintEl.textContent = `Default: ${defaultId}`;
  }
}

// Provider change handler
providerEl.addEventListener('change', () => {
  populateModels(providerEl.value, null);
});

// Load saved settings
chrome.storage.sync.get(['provider', 'apiKey', 'model', 'defaultMode', 'translateLangs'], (data) => {
  if (data.provider) providerEl.value = data.provider;
  if (data.apiKey) apiKeyEl.value = data.apiKey;
  if (data.defaultMode) defaultModeEl.value = data.defaultMode;
  populateModels(data.provider || 'openai', data.model || null);
  populateLanguages(data.translateLangs || null);
});

// Save
saveBtn.addEventListener('click', () => {
  const settings = {
    provider: providerEl.value,
    apiKey: apiKeyEl.value.trim(),
    model: modelEl.value,
    defaultMode: defaultModeEl.value,
    translateLangs: getSelectedLanguages()
  };

  if (!settings.apiKey) {
    showStatus('Please enter an API key.', 'error');
    return;
  }

  if (!settings.model) {
    showStatus('Please select a model.', 'error');
    return;
  }

  chrome.storage.sync.set(settings, () => {
    showStatus('Settings saved.', 'success');
  });
});

// Test connection
testBtn.addEventListener('click', async () => {
  const provider = providerEl.value;
  const apiKey = apiKeyEl.value.trim();
  const model = modelEl.value;

  if (!apiKey) {
    showStatus('Please enter an API key first.', 'error');
    return;
  }

  if (!model) {
    showStatus('Please select a model first.', 'error');
    return;
  }

  testBtn.disabled = true;
  testBtn.textContent = 'Testing...';

  try {
    const result = await testConnection(provider, apiKey, model);
    showStatus(`Connection successful! Response: "${result.slice(0, 50)}"`, 'success');
  } catch (err) {
    showStatus(`Connection failed: ${err.message}`, 'error');
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = 'Test Connection';
  }
});

function showStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = `status ${type}`;
  statusEl.hidden = false;
  setTimeout(() => { statusEl.hidden = true; }, 5000);
}
