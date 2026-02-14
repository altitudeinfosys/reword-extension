const PROVIDER_MODELS = {
  openai: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini (fast, cheap)', default: true },
    { id: 'gpt-4o', name: 'GPT-4o (balanced)' },
    { id: 'gpt-4.1', name: 'GPT-4.1 (latest)' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini (latest, fast)' },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano (fastest)' },
    { id: 'o3-mini', name: 'o3-mini (reasoning)' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4 (balanced)', default: true },
    { id: 'claude-opus-4-20250514', name: 'Claude Opus 4 (most capable)' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5 (fast, cheap)' },
    { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5 (creative)' },
  ],
  gemini: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (fast)', default: true },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite (fastest)' },
    { id: 'gemini-2.5-pro-preview-05-06', name: 'Gemini 2.5 Pro (most capable)' },
    { id: 'gemini-2.5-flash-preview-04-17', name: 'Gemini 2.5 Flash (balanced)' },
  ],
  openrouter: []
};

export function getModelsForProvider(provider) {
  return PROVIDER_MODELS[provider] || [];
}

export function getDefaultModel(provider) {
  const models = PROVIDER_MODELS[provider];
  if (!models || models.length === 0) return '';
  const def = models.find(m => m.default);
  return def ? def.id : models[0].id;
}

// Fetch models from OpenRouter API (public endpoint, no auth needed)
export async function fetchOpenRouterModels() {
  const res = await fetch('https://openrouter.ai/api/v1/models');
  if (!res.ok) throw new Error('Failed to fetch OpenRouter models');
  const data = await res.json();
  return data.data
    .filter(m => m.id && m.name)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(m => ({ id: m.id, name: m.name }));
}

export async function callProvider(providerName, apiKey, model, systemPrompt, userText, { signal } = {}) {
  const provider = PROVIDERS[providerName];
  if (!provider) throw new Error(`Unknown provider: ${providerName}`);

  const effectiveModel = model || getDefaultModel(providerName);
  if (!effectiveModel) throw new Error('No model specified.');

  let result;
  try {
    result = await provider(apiKey, effectiveModel, systemPrompt, userText, signal);
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    if (err instanceof ProviderError) throw err;
    if (err instanceof TypeError) throw new Error('Network error. Check your internet connection.');
    throw err;
  }

  if (!result) throw new Error('Empty response from AI provider.');
  return result;
}

// Test connection with a minimal prompt
export async function testConnection(providerName, apiKey, model) {
  return callProvider(providerName, apiKey, model, 'Reply with OK.', 'Test');
}

const PROVIDERS = {
  async openai(apiKey, model, systemPrompt, userText, signal) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText }
        ],
        temperature: 0.7
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ProviderError(res.status, err.error?.message || `OpenAI API error ${res.status}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
  },

  async anthropic(apiKey, model, systemPrompt, userText, signal) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userText }
        ]
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ProviderError(res.status, err.error?.message || `Anthropic API error ${res.status}`);
    }

    const data = await res.json();
    return data.content?.[0]?.text?.trim() || '';
  },

  async gemini(apiKey, model, systemPrompt, userText, signal) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userText }] }],
        generationConfig: { temperature: 0.7 }
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ProviderError(res.status, err.error?.message || `Gemini API error ${res.status}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  },

  async openrouter(apiKey, model, systemPrompt, userText, signal) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'chrome-extension://reword',
        'X-Title': 'Reword Extension'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText }
        ],
        temperature: 0.7
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ProviderError(res.status, err.error?.message || `OpenRouter API error ${res.status}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
  }
};

class ProviderError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = 'ProviderError';

    if (status === 401) this.message = 'Invalid API key. Check your settings.';
    else if (status === 429) this.message = 'Rate limited. Please wait a moment and try again.';
    else if (status >= 500) this.message = 'AI provider server error. Try again later.';
  }
}
