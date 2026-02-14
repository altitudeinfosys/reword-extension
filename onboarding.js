import { getDefaultModel, getModelsForProvider, fetchOpenRouterModels, testConnection } from './providers.js';

const steps = [
  document.getElementById('step1'),
  document.getElementById('step2'),
  document.getElementById('step3')
];
const dots = document.querySelectorAll('.dot');

const providerEl = document.getElementById('ob-provider');
const apiKeyEl = document.getElementById('ob-apiKey');
const modelEl = document.getElementById('ob-model');
const statusEl = document.getElementById('ob-status');

let currentStep = 0;
let openRouterModelsCache = null;

function showStep(idx) {
  steps.forEach((s, i) => {
    s.classList.toggle('hidden', i !== idx);
  });
  dots.forEach((d, i) => {
    d.classList.toggle('active', i === idx);
  });
  currentStep = idx;
}

// Model population (same logic as options.js)
async function populateModels(provider, selectedModel) {
  modelEl.length = 0;

  if (provider === 'openrouter') {
    const loadingOpt = document.createElement('option');
    loadingOpt.value = '';
    loadingOpt.textContent = 'Loading models from OpenRouter...';
    modelEl.appendChild(loadingOpt);

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
    } catch {
      modelEl.length = 0;
      const errOpt = document.createElement('option');
      errOpt.value = '';
      errOpt.textContent = 'Failed to load models';
      modelEl.appendChild(errOpt);
    }
  } else {
    const models = getModelsForProvider(provider);
    for (const m of models) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name;
      if (selectedModel ? m.id === selectedModel : m.default) {
        opt.selected = true;
      }
      modelEl.appendChild(opt);
    }
  }
}

function showStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = `status ${type}`;
  statusEl.hidden = false;
}

// Event listeners
document.getElementById('startBtn').addEventListener('click', () => showStep(1));
document.getElementById('backBtn').addEventListener('click', () => showStep(0));

providerEl.addEventListener('change', () => {
  populateModels(providerEl.value, null);
});

document.getElementById('testSaveBtn').addEventListener('click', async () => {
  const provider = providerEl.value;
  const apiKey = apiKeyEl.value.trim();
  const model = modelEl.value;

  if (!apiKey) {
    showStatus('Please enter an API key.', 'error');
    return;
  }
  if (!model) {
    showStatus('Please select a model.', 'error');
    return;
  }

  const btn = document.getElementById('testSaveBtn');
  btn.disabled = true;
  btn.textContent = 'Testing...';

  try {
    await testConnection(provider, apiKey, model);

    // Save settings
    await chrome.storage.sync.set({
      provider,
      apiKey,
      model,
      defaultMode: 'polish'
    });

    showStatus('Connection successful! Settings saved.', 'success');
    setTimeout(() => showStep(2), 1000);
  } catch (err) {
    showStatus(`Connection failed: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Test & Save';
  }
});

document.getElementById('doneBtn').addEventListener('click', () => {
  window.close();
});

// Initialize
populateModels('openai', null);
