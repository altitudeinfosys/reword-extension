# Reword - Chrome Extension

## Overview
A Chrome extension that lets users select text in editable fields (textarea, input, contenteditable) on any webpage and rewrite it using AI. Supports multiple AI providers with user-supplied API keys.

## Rewrite Modes
- **Polish** - Fix grammar, improve clarity, keep tone
- **Formalize** - Make professional and formal
- **Shortify** - Make concise, remove filler
- **Elaborate** - Expand with more detail and context

## Architecture

### File Purposes
| File | Purpose |
|------|---------|
| `manifest.json` | MV3 config: permissions, service worker, content scripts |
| `background.js` | Service worker: context menus, API routing, message hub |
| `content.js` | Content script: selection detection, floating toolbar, text replacement |
| `content.css` | Floating toolbar styles (prefixed with `#reword-`) |
| `providers.js` | AI provider abstraction (OpenAI, Anthropic, Gemini, OpenRouter) |
| `prompts.js` | System prompts for each rewrite mode |
| `options.html` | Settings page markup |
| `options.js` | Settings page logic (save/load/test) |
| `options.css` | Settings page styles |
| `icons/` | Extension icons (16, 32, 48, 128px) |

### Message Flow

```
User selects text in editable field
        │
        ├──── [Right-click] ──── Context Menu ("Reword > Mode")
        │                              │
        │                    background.js receives click
        │                    sends GET_SELECTION to content.js
        │                    content.js returns selection data
        │                    background.js calls AI provider
        │                    sends REPLACE_TEXT to content.js
        │                              │
        ├──── [Mouseup] ──── Floating Toolbar appears
        │                         │
        │                    User clicks mode button
        │                    content.js sends REWORD_REQUEST to background.js
        │                    background.js calls AI provider
        │                    responds via sendResponse
        │                    content.js replaces text
        │                         │
        └──── Text replaced in DOM, input/change events dispatched
```

### Settings Flow
```
options.js ←→ chrome.storage.sync ←→ background.js (reads on API call)
```

### AI Providers
| Provider | Endpoint | Auth | Default Model |
|----------|----------|------|---------------|
| OpenAI | `POST /v1/chat/completions` | Bearer token | `gpt-4o-mini` |
| Anthropic | `POST /v1/messages` | `x-api-key` + `anthropic-dangerous-direct-browser-access` | `claude-sonnet-4-20250514` |
| Gemini | `POST /v1beta/models/{model}:generateContent?key=` | Query param | `gemini-2.0-flash` |
| OpenRouter | `POST /v1/chat/completions` | Bearer + `HTTP-Referer` + `X-Title` | User-specified |

### Key Design Decisions
- **No build step**: Plain JS, directly loadable in Chrome
- **MV3 service worker**: ES modules for clean imports
- **`contexts: ['editable']`**: Context menu only appears in editable fields
- **Selection metadata stored before API call**: Selection can be lost during async operations
- **Synthetic events dispatched**: React/Vue/Angular compatibility after text replacement
- **CSS prefixed with `#reword-`**: Avoids style collisions with host pages
