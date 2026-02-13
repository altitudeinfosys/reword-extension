import { callProvider } from './providers.js';
import { PROMPTS } from './prompts.js';

const MODES = ['polish', 'formalize', 'shortify', 'elaborate', 'warm'];

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
  });
}

chrome.runtime.onInstalled.addListener(setupContextMenus);

// Also recreate menus when service worker starts (survives worker restarts)
setupContextMenus();

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const mode = info.menuItemId.replace('reword-', '');
  if (!MODES.includes(mode)) return;

  try {
    // Ask content script for the current selection
    const [response] = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTION' }).then(r => [r]).catch(() => [null]);

    if (!response || !response.text) {
      chrome.tabs.sendMessage(tab.id, { type: 'SHOW_ERROR', error: 'No text selected in an editable field.' });
      return;
    }

    // Show loading state
    chrome.tabs.sendMessage(tab.id, { type: 'SHOW_LOADING' });

    // Get settings
    const settings = await chrome.storage.sync.get(['provider', 'apiKey', 'model']);
    if (!settings.apiKey) {
      chrome.tabs.sendMessage(tab.id, { type: 'SHOW_ERROR', error: 'No API key configured. Open extension settings.' });
      return;
    }

    // Call AI
    const systemPrompt = PROMPTS[mode];
    const result = await callProvider(settings.provider || 'openai', settings.apiKey, settings.model, systemPrompt, response.text);

    // Replace text
    chrome.tabs.sendMessage(tab.id, { type: 'REPLACE_TEXT', text: result });
  } catch (err) {
    chrome.tabs.sendMessage(tab.id, { type: 'SHOW_ERROR', error: err.message || 'Something went wrong.' });
  }
});

// Handle messages from content script (floating toolbar)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'REWORD_REQUEST') {
    handleRewordRequest(message).then(sendResponse).catch(err => {
      sendResponse({ error: err.message || 'Something went wrong.' });
    });
    return true; // keep channel open for async response
  }
});

async function handleRewordRequest({ mode, text }) {
  const settings = await chrome.storage.sync.get(['provider', 'apiKey', 'model']);

  if (!settings.apiKey) {
    return { error: 'No API key configured. Open extension settings.' };
  }

  const systemPrompt = PROMPTS[mode];
  const result = await callProvider(settings.provider || 'openai', settings.apiKey, settings.model, systemPrompt, text);
  return { text: result };
}
