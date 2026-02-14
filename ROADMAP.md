# Reword — Product Roadmap

## Competitive Landscape

### Direct Competitors
- **Wordtune** — AI rewriting with tones (casual, formal, shorten, expand). Free tier + subscription. Strengths: inline suggestions, sentence alternatives. Weakness: vendor-locked to their API, privacy concerns.
- **QuillBot** — Paraphraser with modes (standard, fluency, formal, creative, etc.). Freemium. Strengths: synonym slider, grammar checker. Weakness: rate limits on free tier, no BYO key.
- **Grammarly** — Grammar + tone detection + rewriting. Freemium. Strengths: deep integrations, real-time checking. Weakness: expensive premium, always-on monitoring.
- **LanguageTool** — Open-source grammar checker with rewriting. Freemium. Strengths: multi-language, privacy mode. Weakness: limited AI rewriting capabilities.

### Reword's Differentiation
- **BYO API Key** — No subscription, full privacy, no vendor lock-in
- **Multi-provider** — OpenAI, Anthropic, Gemini, OpenRouter (hundreds of models)
- **Lightweight** — No background monitoring, only activates on selection
- **Open architecture** — Users choose their model and provider

---

## Confirmed Features (v1.1)

### Keyboard Shortcuts
- `Alt+R` global shortcut to trigger default mode rewrite
- `1-5` keys when toolbar visible to select mode
- `Escape` to dismiss toolbar
- Shortcut hints on toolbar buttons

### Translate Mode
- New translate button on toolbar with language sub-menu
- Configurable target languages in settings
- Context menu translate sub-items
- Supports all major languages

### Undo Last Rewrite
- Save original text before replacement
- Show "Undo" pill for 6 seconds after rewrite
- `Ctrl/Cmd+Z` also restores original
- Single undo stack (last rewrite only)

### Enhanced Prompts
- Rewrite all 5 mode prompts with structured steps
- Add few-shot examples for each mode
- Add explicit constraints to prevent common AI mistakes
- Add translate prompt template

### Request Cancellation
- AbortController per request
- New request automatically cancels previous
- Prevents stale responses from overwriting newer ones

### Actionable Error Messages
- Persistent errors (no auto-hide) with dismiss button
- "Open Settings" button for API key errors
- "Retry" button for transient errors (rate limit, network)
- Clear error type indication

### First-Run Onboarding
- 3-step setup wizard on install
- Provider selection, API key entry, test connection
- Only shown once (stored flag)

### CWS Store SEO
- Keyword-optimized name: "Reword — AI Text Rewriter"
- Updated description with search terms
- Updated store listing copy

---

## Future Features (v1.2+)

### Custom Modes
- Let users define their own rewrite modes with custom prompts
- Store in sync storage, appear on toolbar

### Streaming Responses
- Show text being generated in real-time
- Better UX for longer texts and slower models

### Multi-Language UI
- Localize toolbar, options page, and onboarding
- Auto-detect browser language

### Text History
- Log of recent rewrites with before/after
- Quick access from popup or options page

### Token/Cost Estimation
- Show estimated token count before sending
- Track cumulative usage per session

### Popup Quick-Access
- Browser action popup for quick settings toggle
- Show last rewrite status

---

## UX Improvements

- Toolbar fade-in/fade-out animations
- Loading progress indicator (dots or bar)
- Toast notifications for success states
- Toolbar repositioning on scroll
- Dark/light theme auto-detection

## Performance Improvements

- Request deduplication (prevent double-clicks)
- Response caching for identical inputs
- Lazy toolbar creation (defer until first selection)
- Minimal DOM footprint

## Quality Improvements

- Better contenteditable handling for complex editors
- Google Docs canvas support investigation
- Preserve formatting (bold, italic) in contenteditable
- Handle very long text (chunking strategy)

---

## Growth & Monetization Strategy

### Growth
- Chrome Web Store SEO (keyword-rich name, description)
- Product Hunt launch
- Reddit communities (r/productivity, r/ChatGPT, r/chrome)
- GitHub open-source presence
- Blog post: "Why BYO API Key extensions are the future"

### Monetization (if pursued)
- **Freemium with premium modes** — Base modes free, advanced modes (translate, custom) require one-time payment
- **Tip jar / Sponsor** — GitHub Sponsors or Buy Me a Coffee
- **Enterprise features** — Team settings sync, admin-managed API keys

### Key Metrics
- Chrome Web Store installs and ratings
- Active users (weekly)
- Most-used modes and providers
- Error rates by provider

---

## Implementation Priority

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 1 | Keyboard Shortcuts | Low | High |
| 2 | Translate Mode | Medium | High |
| 3 | Undo Last Rewrite | Low | High |
| 4 | Enhanced Prompts | Low | Medium |
| 5 | Request Cancellation | Low | Medium |
| 6 | Actionable Errors | Low | Medium |
| 7 | First-Run Onboarding | Medium | High |
| 8 | CWS Store SEO | Low | Medium |
