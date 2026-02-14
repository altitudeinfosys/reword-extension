# Reword — AI Text Rewriter - Chrome Web Store Listing

Ready-to-paste text for the CWS developer dashboard.

---

## Name

Reword — AI Text Rewriter

## Short Description (manifest.json — 132 char max)

> "Rewrite, polish, translate, and shorten text with AI. BYO API key. Supports OpenAI, Anthropic, Gemini, and OpenRouter."

## Detailed Description (for CWS listing)

```
Reword lets you select text in any editable field — email compose boxes, chat inputs, text areas — and instantly rewrite it with AI. Use your own API key for full privacy and zero subscriptions.

HOW IT WORKS
1. Select text in any editable field on any website
2. A floating toolbar appears with rewrite modes, or right-click and choose "Reword"
3. Pick a mode and your text is rewritten in place

REWRITE MODES
- Polish — Fix grammar, spelling, and flow
- Formal — Professional, business-appropriate tone
- Short — Remove filler, keep it concise
- More — Expand with detail and context
- Warm — Friendly, personable tone with greetings
- Translate — Translate to 15 languages (Spanish, French, German, Chinese, Japanese, and more)

KEYBOARD SHORTCUTS
- Alt+R — Rewrite with your default mode
- 1-5 — Quick-select a mode when toolbar is visible
- Escape — Dismiss toolbar

UNDO SUPPORT
Made a mistake? Click the Undo pill or press Ctrl+Z to restore your original text.

BRING YOUR OWN API KEY
Reword uses your own API key — your data goes directly from your browser to the AI provider. No intermediary servers, no data collection, no subscription fees.

SUPPORTED PROVIDERS
- OpenAI (GPT-4o, GPT-4.1, etc.)
- Anthropic (Claude Sonnet 4, Opus 4, Haiku 4.5, etc.)
- Google Gemini (Gemini 2.0 Flash, 2.5 Pro, etc.)
- OpenRouter (access to hundreds of models)

PRIVACY FIRST
- No analytics or tracking
- No data collection of any kind
- API key stored locally in Chrome's encrypted sync storage
- Text is only sent when you explicitly trigger a rewrite

Works on Gmail, Slack, Notion, Google Docs, LinkedIn, Twitter/X, and any website with editable text fields.
```

## Category

**Productivity**

## Language

English

---

## Single Purpose Statement (Privacy tab)

```
Rewrite and translate selected text in editable fields using AI (user-provided API key, no data collection).
```

---

## Permission Justifications

| Permission | Justification |
|---|---|
| `contextMenus` | Adds a "Reword" submenu to the right-click context menu on editable fields so users can trigger rewrites and translations from the context menu. |
| `activeTab` | Needed to communicate with the content script on the current tab when the user triggers a rewrite via the context menu or keyboard shortcut. Only accesses the tab during a user-initiated action. |
| `storage` | Stores user settings (AI provider, API key, model preference, default mode, translation language preferences) in Chrome sync storage so preferences persist across sessions and devices. |

## Host Permissions Justification

The extension uses `content_scripts` with `<all_urls>` matching because it needs to inject a floating toolbar on any website where the user selects text in an editable field. The content script is passive — it only activates when the user selects text in an editable element.

---

## Data Disclosure (Privacy tab checkboxes)

**Does your extension collect or use any of the following data types?**

| Data Type | Collected? | Notes |
|---|---|---|
| Personally identifiable information | No | — |
| Health information | No | — |
| Financial and payment information | No | — |
| Authentication information | No | API keys are stored locally only, never collected |
| Personal communications | No | — |
| Location | No | — |
| Web history | No | — |
| User activity | No | — |
| Website content | No | Only user-selected text is sent to the user's chosen AI provider |

**Certifications:**
- [x] The extension does not sell user data to third parties
- [x] The extension does not use or transfer user data for purposes unrelated to the item's core functionality
- [x] The extension does not use or transfer user data to determine creditworthiness or for lending purposes

---

## Assets Checklist (User Must Provide)

- [ ] **Screenshots** (1-5, 1280x800px or 640x400px) — capture:
  - Floating toolbar appearing over selected text
  - Context menu with rewrite modes
  - Translate language sub-menu
  - Options/settings page
  - Onboarding wizard
- [ ] **Small promo image** (440x280px) — icon + tagline
- [ ] **Privacy policy URL** — host `privacy-policy.html` and paste the URL
- [ ] **Contact email** — update in privacy policy and CWS dashboard
- [ ] **CWS developer account** — register at https://chrome.google.com/webstore/devconsole ($5 one-time fee)
