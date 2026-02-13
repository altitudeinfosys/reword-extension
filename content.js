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
    const range = selectionData.range;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    range.deleteContents();
    const textNode = document.createTextNode(newText);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    sel.removeAllRanges();
    sel.addRange(range);
    selectionData.element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
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
  { id: 'polish', label: 'Polish', icon: '✨' },
  { id: 'formalize', label: 'Formal', icon: '👔' },
  { id: 'shortify', label: 'Short', icon: '✂️' },
  { id: 'elaborate', label: 'More', icon: '📝' },
  { id: 'warm', label: 'Warm', icon: '🤗' }
];

const STATE_CLASSES = ['reword-state-buttons', 'reword-state-loading', 'reword-state-error'];

let toolbar = null;
let toolbarError = null;
let currentSelection = null;
let toolbarState = 'hidden';
let selectionCheckTimer = null;
let suppressUntil = 0;

function createToolbar() {
  if (toolbar) return;

  toolbar = document.createElement('div');
  toolbar.id = 'reword-toolbar';

  // Buttons
  const buttonsDiv = document.createElement('div');
  buttonsDiv.id = 'reword-buttons';
  for (const mode of MODES) {
    const btn = document.createElement('button');
    btn.className = 'reword-btn';
    btn.dataset.mode = mode.id;
    btn.title = mode.label;
    btn.textContent = `${mode.icon} ${mode.label}`;
    btn.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
    btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); handleToolbarClick(mode.id); });
    buttonsDiv.appendChild(btn);
  }

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

  toolbar.appendChild(buttonsDiv);
  toolbar.appendChild(loadingDiv);
  toolbar.appendChild(toolbarError);
  document.body.appendChild(toolbar);
}

function setToolbarState(newState, opts) {
  createToolbar();
  toolbarState = newState;

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
    toolbarError.textContent = (opts && opts.message) || 'Something went wrong.';
    setTimeout(() => {
      if (toolbarState === 'error') setToolbarState('hidden');
    }, 4000);
  }
}

// ─── Toolbar click → background API call ────────────────────────────

async function handleToolbarClick(mode) {
  if (toolbarState !== 'buttons' || !currentSelection) return;

  clearTimeout(selectionCheckTimer);
  const savedSelection = currentSelection;

  setToolbarState('loading');

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'REWORD_REQUEST',
      mode,
      text: savedSelection.text
    });

    if (response.error) {
      setToolbarState('error', { message: response.error });
      currentSelection = null;
      return;
    }

    replaceSelectedText(savedSelection, response.text);
    currentSelection = null;
    setToolbarState('hidden');
    suppressUntil = Date.now() + 500;
  } catch (err) {
    setToolbarState('error', { message: err.message || 'Connection to extension lost.' });
    currentSelection = null;
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
    setToolbarState('loading');
    sendResponse();
    return;
  }

  if (message.type === 'REPLACE_TEXT') {
    if (currentSelection) {
      replaceSelectedText(currentSelection, message.text);
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
