import { callProvider } from './providers.js';
import { PROMPTS, getTranslatePrompt, LANGUAGES, buildContextHint } from './prompts.js';

const MODES = ['polish', 'formalize', 'shortify', 'elaborate', 'warm'];
const TRANSLATE_PREFIX = 'reword-translate-';

// Request cancellation — abort previous request when a new one comes in
let currentAbortController = null;

function createAbortSignal() {
  if (currentAbortController) {
    currentAbortController.abort();
  }
  currentAbortController = new AbortController();
  return currentAbortController.signal;
}

// Create context menus on install/update
function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'reword-parent',
      title: 'Reword',
      contexts: ['editable']
    });

    for (const mode of MODES) {
      chrome.contextMenus.create({
        id: `reword-${mode}`,
        parentId: 'reword-parent',
        title: mode.charAt(0).toUpperCase() + mode.slice(1),
        contexts: ['editable']
      });
    }

    // Translate sub-menu
    chrome.contextMenus.create({
      id: 'reword-translate-parent',
      parentId: 'reword-parent',
      title: 'Translate',
      contexts: ['editable']
    });

    for (const lang of LANGUAGES) {
      chrome.contextMenus.create({
        id: `${TRANSLATE_PREFIX}${lang.code}`,
        parentId: 'reword-translate-parent',
        title: lang.name,
        contexts: ['editable']
      });
    }
  });
}

chrome.runtime.onInstalled.addListener((details) => {
  setupContextMenus();

  // Show onboarding on first install only
  if (details.reason === 'install') {
    chrome.storage.sync.get(['onboardingComplete'], (data) => {
      if (!data.onboardingComplete) {
        chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
        chrome.storage.sync.set({ onboardingComplete: true });
      }
    });
  }
});

// Also recreate menus when service worker starts (survives worker restarts)
setupContextMenus();

// Handle keyboard shortcut (Alt+R)
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'trigger-default-rewrite') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  try {
    const settings = await chrome.storage.sync.get(['provider', 'apiKey', 'model', 'defaultMode']);
    const mode = settings.defaultMode || 'polish';

    const [response] = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTION' }).then(r => [r]).catch(() => [null]);
    if (!response || !response.text) {
      chrome.tabs.sendMessage(tab.id, { type: 'SHOW_ERROR', error: 'No text selected in an editable field.' });
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: 'SHOW_LOADING' });

    if (!settings.apiKey) {
      chrome.tabs.sendMessage(tab.id, { type: 'SHOW_ERROR', error: 'No API key configured. Open extension settings.' });
      return;
    }

    const signal = createAbortSignal();
    let systemPrompt = PROMPTS[mode];
    const contextHint = buildContextHint(response.context);
    if (contextHint) systemPrompt += contextHint;
    const result = await callProvider(settings.provider || 'openai', settings.apiKey, settings.model, systemPrompt, response.text, { signal });
    chrome.tabs.sendMessage(tab.id, { type: 'REPLACE_TEXT', text: result });
  } catch (err) {
    if (err.name === 'AbortError') return;
    chrome.tabs.sendMessage(tab.id, { type: 'SHOW_ERROR', error: err.message || 'Something went wrong.' });
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const menuId = info.menuItemId;

  // Determine if this is a translate or rewrite action
  let systemPrompt;
  if (menuId.startsWith(TRANSLATE_PREFIX)) {
    const langCode = menuId.replace(TRANSLATE_PREFIX, '');
    const lang = LANGUAGES.find(l => l.code === langCode);
    if (!lang) return;
    systemPrompt = getTranslatePrompt(lang.name);
  } else {
    const mode = menuId.replace('reword-', '');
    if (!MODES.includes(mode)) return;
    systemPrompt = PROMPTS[mode];
  }

  try {
    const [response] = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTION' }).then(r => [r]).catch(() => [null]);

    if (!response || !response.text) {
      chrome.tabs.sendMessage(tab.id, { type: 'SHOW_ERROR', error: 'No text selected in an editable field.' });
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: 'SHOW_LOADING' });

    const settings = await chrome.storage.sync.get(['provider', 'apiKey', 'model']);
    if (!settings.apiKey) {
      chrome.tabs.sendMessage(tab.id, { type: 'SHOW_ERROR', error: 'No API key configured. Open extension settings.' });
      return;
    }

    const contextHint = buildContextHint(response.context);
    if (contextHint) systemPrompt += contextHint;

    const signal = createAbortSignal();
    const result = await callProvider(settings.provider || 'openai', settings.apiKey, settings.model, systemPrompt, response.text, { signal });
    chrome.tabs.sendMessage(tab.id, { type: 'REPLACE_TEXT', text: result });
  } catch (err) {
    if (err.name === 'AbortError') return;
    chrome.tabs.sendMessage(tab.id, { type: 'SHOW_ERROR', error: err.message || 'Something went wrong.' });
  }
});

// Handle messages from content script (floating toolbar)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    sendResponse();
    return;
  }

  if (message.type === 'REWORD_REQUEST') {
    handleRewordRequest(message).then(sendResponse).catch(err => {
      if (err.name === 'AbortError') {
        sendResponse({ error: null, aborted: true });
        return;
      }
      sendResponse({ error: err.message || 'Something went wrong.' });
    });
    return true; // keep channel open for async response
  }
});

async function handleRewordRequest({ mode, text, context }) {
  const signal = createAbortSignal();
  const settings = await chrome.storage.sync.get(['provider', 'apiKey', 'model']);

  if (!settings.apiKey) {
    return { error: 'No API key configured. Open extension settings.' };
  }

  let systemPrompt;
  if (mode.startsWith('translate-')) {
    const langCode = mode.replace('translate-', '');
    const lang = LANGUAGES.find(l => l.code === langCode);
    if (!lang) return { error: 'Unknown language.' };
    systemPrompt = getTranslatePrompt(lang.name);
  } else {
    systemPrompt = PROMPTS[mode];
  }

  const contextHint = buildContextHint(context);
  if (contextHint) systemPrompt += contextHint;

  const result = await callProvider(settings.provider || 'openai', settings.apiKey, settings.model, systemPrompt, text, { signal });
  return { text: result };
}
