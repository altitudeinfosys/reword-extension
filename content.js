// ─── Extension context check ────────────────────────────────────────

function isExtensionValid() {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

function safeSendMessage(msg) {
  if (!isExtensionValid()) {
    return Promise.reject(new Error('Extension updated. Refresh the page to continue using Reword.'));
  }
  return chrome.runtime.sendMessage(msg);
}

// ─── Editable field detection ───────────────────────────────────────

function isEditableElement(el) {
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  if (tag === 'textarea') return true;
  if (tag === 'input') {
    const type = (el.type || 'text').toLowerCase();
    return ['text', 'email', 'search', 'url', 'tel'].includes(type);
  }
  if (el.isContentEditable) return true;
  return false;
}

// ─── Selection helpers ──────────────────────────────────────────────

function getSelectedText() {
  const active = document.activeElement;
  const sel = window.getSelection();

  if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) {
    const start = active.selectionStart;
    const end = active.selectionEnd;
    const text = active.value.substring(start, end);
    if (!text) return null;
    return { text, element: active, type: 'native', start, end };
  }

  if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
    const range = sel.getRangeAt(0);
    let container = range.commonAncestorContainer;
    if (container.nodeType === Node.TEXT_NODE) container = container.parentElement;

    let editable = container;
    while (editable && !editable.isContentEditable && editable !== document.body) {
      editable = editable.parentElement;
    }

    if (editable && editable.isContentEditable) {
      const text = sel.toString();
      if (!text) return null;
      return { text, element: editable, type: 'contenteditable', range: range.cloneRange() };
    }
  }

  return null;
}

function replaceSelectedText(selectionData, newText) {
  if (!selectionData) return;

  if (selectionData.type === 'native') {
    const el = selectionData.element;
    el.value = el.value.substring(0, selectionData.start) + newText + el.value.substring(selectionData.end);
    const newEnd = selectionData.start + newText.length;
    el.setSelectionRange(newEnd, newEnd);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (selectionData.type === 'contenteditable') {
    // Restore selection to the saved range
    const range = selectionData.range;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    // Use execCommand to replace text — this preserves surrounding formatting
    // (bold, italic, links, etc.) because the browser inherits the style context
    selectionData.element.focus();
    document.execCommand('insertText', false, newText);
  }
}

// ─── Floating toolbar ───────────────────────────────────────────────
//
// State is controlled by a SINGLE CSS class on #reword-toolbar:
//   (no class)              → display: none (hidden)
//   .reword-state-buttons   → shows #reword-buttons
//   .reword-state-loading   → shows #reword-loading
//   .reword-state-error     → shows #reword-error
//
// This makes mixed states structurally impossible.

const MODES = [
  { id: 'polish', label: 'Polish', icon: '✨', key: '1' },
  { id: 'formalize', label: 'Formal', icon: '👔', key: '2' },
  { id: 'shortify', label: 'Short', icon: '✂️', key: '3' },
  { id: 'elaborate', label: 'More', icon: '📝', key: '4' },
  { id: 'warm', label: 'Warm', icon: '🤗', key: '5' }
];

const TRANSLATE_LANGUAGES = [
  { code: 'ar', name: 'Arabic' },
  { code: 'zh', name: 'Chinese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'hi', name: 'Hindi' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'pl', name: 'Polish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'es', name: 'Spanish' },
  { code: 'sv', name: 'Swedish' },
  { code: 'tr', name: 'Turkish' }
];

const STATE_CLASSES = ['reword-state-buttons', 'reword-state-loading', 'reword-state-error'];

let toolbar = null;
let toolbarError = null;
let translateMenu = null;
let enabledTranslateLangs = null;
let currentSelection = null;
let toolbarState = 'hidden';
let selectionCheckTimer = null;
let suppressUntil = 0;
let undoData = null;
let undoPill = null;
let undoTimer = null;
let lastFailedRequest = null;
let pendingUndoSnapshot = null;

function createToolbar() {
  if (toolbar) return;

  // Load enabled translate languages from storage
  chrome.storage.sync.get(['translateLangs'], (data) => {
    enabledTranslateLangs = data.translateLangs || null;
    if (translateMenu) refreshTranslateMenu();
  });

  toolbar = document.createElement('div');
  toolbar.id = 'reword-toolbar';

  // Buttons
  const buttonsDiv = document.createElement('div');
  buttonsDiv.id = 'reword-buttons';
  for (const mode of MODES) {
    const btn = document.createElement('button');
    btn.className = 'reword-btn';
    btn.dataset.mode = mode.id;
    btn.title = `${mode.label} (${mode.key})`;
    btn.textContent = `${mode.icon} ${mode.label}`;
    btn.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
    btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); handleToolbarClick(mode.id); });
    buttonsDiv.appendChild(btn);
  }

  // Translate button with sub-menu
  const translateWrapper = document.createElement('div');
  translateWrapper.className = 'reword-translate-wrapper';

  const translateBtn = document.createElement('button');
  translateBtn.className = 'reword-btn reword-translate-btn';
  translateBtn.title = 'Translate';
  translateBtn.textContent = '\u{1F310} Translate';
  translateBtn.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
  translateBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleTranslateMenu();
  });

  translateMenu = document.createElement('div');
  translateMenu.id = 'reword-translate-menu';
  buildTranslateMenuItems();

  translateWrapper.appendChild(translateBtn);
  translateWrapper.appendChild(translateMenu);
  buttonsDiv.appendChild(translateWrapper);

  // Loading
  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'reword-loading';
  const spinner = document.createElement('div');
  spinner.className = 'reword-spinner';
  const loadingText = document.createElement('span');
  loadingText.textContent = 'Rewording...';
  loadingDiv.appendChild(spinner);
  loadingDiv.appendChild(loadingText);

  // Error
  toolbarError = document.createElement('div');
  toolbarError.id = 'reword-error';

  const errorMsg = document.createElement('span');
  errorMsg.id = 'reword-error-msg';
  toolbarError.appendChild(errorMsg);

  const errorActions = document.createElement('div');
  errorActions.id = 'reword-error-actions';
  toolbarError.appendChild(errorActions);

  toolbar.appendChild(buttonsDiv);
  toolbar.appendChild(loadingDiv);
  toolbar.appendChild(toolbarError);
  document.body.appendChild(toolbar);
}

function buildTranslateMenuItems() {
  if (!translateMenu) return;
  while (translateMenu.firstChild) translateMenu.removeChild(translateMenu.firstChild);

  const langs = enabledTranslateLangs
    ? TRANSLATE_LANGUAGES.filter(l => enabledTranslateLangs.includes(l.code))
    : TRANSLATE_LANGUAGES;

  for (const lang of langs) {
    const langBtn = document.createElement('button');
    langBtn.className = 'reword-lang-btn';
    langBtn.textContent = lang.name;
    langBtn.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
    langBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideTranslateMenu();
      handleToolbarClick(`translate-${lang.code}`);
    });
    translateMenu.appendChild(langBtn);
  }
}

function refreshTranslateMenu() {
  buildTranslateMenuItems();
}

function toggleTranslateMenu() {
  if (!translateMenu) return;
  translateMenu.classList.toggle('reword-translate-menu-visible');
}

function hideTranslateMenu() {
  if (!translateMenu) return;
  translateMenu.classList.remove('reword-translate-menu-visible');
}

function setToolbarState(newState, opts) {
  createToolbar();
  toolbarState = newState;
  hideTranslateMenu();

  // Remove all state classes — this is the key: only ONE class controls visibility
  toolbar.classList.remove(...STATE_CLASSES);

  if (newState === 'hidden') {
    return;
  }

  if (newState === 'buttons') {
    toolbar.classList.add('reword-state-buttons');
    if (opts && opts.x !== undefined) {
      toolbar.style.left = `${opts.x}px`;
      toolbar.style.top = `${opts.y}px`;
      requestAnimationFrame(() => {
        const rect = toolbar.getBoundingClientRect();
        if (rect.right > window.innerWidth) toolbar.style.left = `${window.innerWidth - rect.width - 8}px`;
        if (rect.left < 0) toolbar.style.left = '8px';
        if (rect.top < 0) toolbar.style.top = `${(opts.y || 0) + 30}px`;
      });
    }
  } else if (newState === 'loading') {
    toolbar.classList.add('reword-state-loading');
  } else if (newState === 'error') {
    toolbar.classList.add('reword-state-error');
    const msg = (opts && opts.message) || 'Something went wrong.';
    const errorMsg = toolbarError.querySelector('#reword-error-msg');
    const errorActions = toolbarError.querySelector('#reword-error-actions');
    errorMsg.textContent = msg;

    // Clear previous action buttons
    while (errorActions.firstChild) errorActions.removeChild(errorActions.firstChild);

    const isApiKeyError = msg.toLowerCase().includes('api key') || msg.toLowerCase().includes('settings');
    const isTransientError = msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('server error') || msg.toLowerCase().includes('try again');

    if (isApiKeyError) {
      const settingsBtn = document.createElement('button');
      settingsBtn.className = 'reword-error-btn';
      settingsBtn.textContent = 'Open Settings';
      settingsBtn.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
      settingsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        safeSendMessage({ type: 'OPEN_OPTIONS' });
        setToolbarState('hidden');
      });
      errorActions.appendChild(settingsBtn);
    }

    if (isTransientError && lastFailedRequest) {
      const retryBtn = document.createElement('button');
      retryBtn.className = 'reword-error-btn';
      retryBtn.textContent = 'Retry';
      retryBtn.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
      retryBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const req = lastFailedRequest;
        lastFailedRequest = null;
        handleToolbarClick(req.mode);
      });
      errorActions.appendChild(retryBtn);
    }

    // Always add dismiss button
    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'reword-error-btn reword-error-dismiss';
    dismissBtn.textContent = '\u2715';
    dismissBtn.title = 'Dismiss';
    dismissBtn.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
    dismissBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setToolbarState('hidden');
    });
    errorActions.appendChild(dismissBtn);
  }
}

// ─── Undo feature ───────────────────────────────────────────────────

function saveUndoSnapshot(selectionData) {
  if (selectionData.type === 'native') {
    return { type: 'native', element: selectionData.element, value: selectionData.element.value };
  } else {
    return { type: 'contenteditable', element: selectionData.element, html: selectionData.element.innerHTML };
  }
}

function showUndoPill(snapshot) {
  hideUndoPill();

  undoData = snapshot;

  undoPill = document.createElement('div');
  undoPill.id = 'reword-undo-pill';
  undoPill.textContent = '\u21A9 Undo';
  undoPill.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
  undoPill.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    performUndo();
  });

  // Position near the toolbar's last location
  if (toolbar) {
    undoPill.style.left = toolbar.style.left;
    undoPill.style.top = toolbar.style.top;
  }

  document.body.appendChild(undoPill);

  undoTimer = setTimeout(hideUndoPill, 6000);
}

function hideUndoPill() {
  clearTimeout(undoTimer);
  if (undoPill && undoPill.parentNode) {
    undoPill.parentNode.removeChild(undoPill);
  }
  undoPill = null;
  undoData = null;
}

function performUndo() {
  if (!undoData) return;

  if (undoData.type === 'native') {
    undoData.element.value = undoData.value;
    undoData.element.dispatchEvent(new Event('input', { bubbles: true }));
    undoData.element.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (undoData.type === 'contenteditable') {
    // Safe: restoring the element's own captured innerHTML from moments ago
    undoData.element.innerHTML = undoData.html; // eslint-disable-line no-unsanitized/property
    undoData.element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
  }

  hideUndoPill();
}

// ─── Toolbar click → background API call ────────────────────────────

async function handleToolbarClick(mode) {
  if ((toolbarState !== 'buttons' && toolbarState !== 'error') || !currentSelection) return;

  clearTimeout(selectionCheckTimer);
  const savedSelection = currentSelection;
  const snapshot = saveUndoSnapshot(savedSelection);

  setToolbarState('loading');

  try {
    const response = await safeSendMessage({
      type: 'REWORD_REQUEST',
      mode,
      text: savedSelection.text
    });

    if (response.aborted) return;

    if (response.error) {
      lastFailedRequest = { mode };
      currentSelection = savedSelection;
      setToolbarState('error', { message: response.error });
      return;
    }

    lastFailedRequest = null;
    replaceSelectedText(savedSelection, response.text);
    showUndoPill(snapshot);
    currentSelection = null;
    setToolbarState('hidden');
    suppressUntil = Date.now() + 500;
  } catch (err) {
    lastFailedRequest = { mode };
    currentSelection = savedSelection;
    setToolbarState('error', { message: err.message || 'Connection to extension lost.' });
  }
}

// ─── Selection detection ────────────────────────────────────────────

function scheduleSelectionCheck(delay) {
  clearTimeout(selectionCheckTimer);
  selectionCheckTimer = setTimeout(() => {
    if (toolbarState === 'loading' || toolbarState === 'error') return;
    if (Date.now() < suppressUntil) return;

    const sel = getSelectedText();
    if (sel) {
      currentSelection = sel;
      const pos = getToolbarPosition(sel);
      if (pos) setToolbarState('buttons', pos);
    } else if (toolbarState === 'buttons') {
      setToolbarState('hidden');
      currentSelection = null;
    }
  }, delay);
}

function getToolbarPosition(sel) {
  const winSel = window.getSelection();
  let x, y;

  if (sel.type === 'native') {
    const rect = sel.element.getBoundingClientRect();
    x = rect.left + window.scrollX;
    y = rect.top + window.scrollY - 48;
  } else if (winSel && winSel.rangeCount > 0) {
    const range = winSel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;
    x = rect.left + window.scrollX;
    y = rect.top + window.scrollY - 48;
  }

  return (x !== undefined) ? { x, y } : null;
}

// ─── Event listeners ────────────────────────────────────────────────

document.addEventListener('mouseup', (e) => {
  if (toolbar && toolbar.contains(e.target)) return;
  scheduleSelectionCheck(50);
});

document.addEventListener('keyup', (e) => {
  if (!e.shiftKey && e.key !== 'a') return;
  if (!isEditableElement(document.activeElement)) return;
  scheduleSelectionCheck(100);
});

document.addEventListener('selectionchange', () => {
  if (!isEditableElement(document.activeElement)) return;
  scheduleSelectionCheck(150);
});

document.addEventListener('mousedown', (e) => {
  if (toolbar && !toolbar.contains(e.target) && toolbarState === 'buttons') {
    setToolbarState('hidden');
    currentSelection = null;
  }
});

// Keyboard shortcuts: 1-5 to select mode, Escape to dismiss, Ctrl/Cmd+Z to undo
document.addEventListener('keydown', (e) => {
  // Undo: Ctrl+Z / Cmd+Z when undo pill is visible
  if (e.key === 'z' && (e.ctrlKey || e.metaKey) && undoData) {
    e.preventDefault();
    performUndo();
    return;
  }

  if (toolbarState !== 'buttons') return;

  if (e.key === 'Escape') {
    e.preventDefault();
    setToolbarState('hidden');
    currentSelection = null;
    return;
  }

  const mode = MODES.find(m => m.key === e.key);
  if (mode && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    handleToolbarClick(mode.id);
  }
});

// ─── Message listener (for context menu flow) ───────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SELECTION') {
    const sel = getSelectedText();
    currentSelection = sel;
    sendResponse({ text: sel ? sel.text : null });
    return;
  }

  if (message.type === 'SHOW_LOADING') {
    clearTimeout(selectionCheckTimer);
    const sel = getSelectedText();
    if (sel) {
      const pos = getToolbarPosition(sel);
      if (pos) {
        createToolbar();
        toolbar.style.left = `${pos.x}px`;
        toolbar.style.top = `${pos.y}px`;
      }
    }
    // Capture snapshot now, before the API call modifies anything
    if (currentSelection) pendingUndoSnapshot = saveUndoSnapshot(currentSelection);
    setToolbarState('loading');
    sendResponse();
    return;
  }

  if (message.type === 'REPLACE_TEXT') {
    if (currentSelection) {
      // Snapshot was already saved in SHOW_LOADING; fall back if missing
      if (!pendingUndoSnapshot) pendingUndoSnapshot = saveUndoSnapshot(currentSelection);
      replaceSelectedText(currentSelection, message.text);
      showUndoPill(pendingUndoSnapshot);
      pendingUndoSnapshot = null;
      currentSelection = null;
    }
    setToolbarState('hidden');
    suppressUntil = Date.now() + 500;
    sendResponse();
    return;
  }

  if (message.type === 'SHOW_ERROR') {
    setToolbarState('error', { message: message.error });
    sendResponse();
    return;
  }
});
