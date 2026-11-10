# Phrase – Professional Writing & Grammar Assistant

> **Write clearly. Communicate professionally.**

Phrase improves everyday workplace writing — emails, Teams messages, LinkedIn notes and general business English — **without any AI**. Every suggestion comes from a local grammar engine and hand-written, readable rule files. It is a static site: no backend, no API keys, no accounts, no tracking.

Live site: <https://phrase.rakeshvadnala.in>

## Features

| Area | What it does |
| --- | --- |
| **Editor** | Large auto-growing editor, paste / clear, live character, word and sentence counts, `Ctrl/⌘ + Enter` to improve. |
| **Grammar checker** | [Harper](https://writewithharper.com) (WebAssembly, runs in a Web Worker). Spelling, grammar, punctuation, capitalization, repetition. Issues are underlined as you type (debounced) and listed with suggestions you can apply or ignore one by one, or all at once. |
| **Rephrasing engine** | 640+ phrase rules. Phrase-level, whole-word, case-insensitive matching in a single pass (no cascading or repeated replacements). Preserves case, punctuation, names, numbers, dates, URLs, e-mail addresses, code, quoted text and identifiers. Alternatives are offered where available. |
| **Six modes** | Grammar Correction, Professional, Polite, Formal, Friendly, Concise — each with its own JSON rule file. |
| **Before / after** | Side-by-side panels highlighting added, removed and replaced text and grammar corrections. Copy original, copy improved, replace editor text, reset changes. |
| **Phrase library** | Browse, search and filter all rules; add, edit and delete your own; star favourites. |
| **Email templates** | 13 structured templates (meeting request, follow-up, status update, leave, WFH, escalation, technical/project update, approval, information request, thank-you, apology, reminder). Fill in fields → deterministic draft → edit → copy. |
| **History** | Optional and **off by default**. Latest 50 results, with date and time; reopen, delete one, or clear all. |
| **Settings** | Light / dark / system theme, English dialect, default mode, live-check toggle, personal dictionary, delete all stored data. |
| **Privacy** | All processing happens in the browser. No analytics, no external requests, no cookies. Works offline after the first load. |

The original text is never modified silently: every change is listed and can be swapped for an alternative or rejected.

## 1. Project structure

```
phrase/
├── .github/workflows/deploy.yml   # GitHub Pages deployment (build → test → deploy)
├── public/
│   ├── CNAME                      # phrase.rakeshvadnala.in
│   ├── 404.html                   # sends unknown paths back to the app
│   ├── favicon.svg
│   └── sw.js                      # offline cache (same-origin only)
├── src/
│   ├── components/                # Header, Footer, Editor, ActionToolbar, ResultPanel,
│   │                              # GrammarSuggestions, TextStatistics, ComparisonView, CopyButton
│   ├── pages/                     # Home, PhraseLibrary, EmailTemplates, History, Settings, Privacy, About
│   ├── engine/
│   │   ├── grammarEngine.ts       # Harper integration (lint → plain issues → selectable changes)
│   │   ├── spellingEngine.ts      # spelling policy + personal dictionary
│   │   ├── phraseEngine.ts        # rule matching, case/punctuation handling, protected spans
│   │   ├── toneEngine.ts          # per-mode rule configuration, analyzeText()
│   │   ├── changes.ts             # applies selected changes to the original text
│   │   ├── comparisonEngine.ts    # before/after segments + word-level diff
│   │   ├── templateEngine.ts      # deterministic e-mail drafting
│   │   └── textUtils.ts           # counters, sentence splitting, protected-span detection
│   ├── rules/                     # grammar / professional / polite / formal / friendly / concise .json
│   ├── templates/emailTemplates.json
│   ├── storage/                   # safeStorage, settingsStorage, phraseStorage, historyStorage
│   ├── hooks/                     # useAppState, useGrammarCheck, useHashRoute
│   ├── types/
│   ├── App.tsx · main.tsx · index.css
├── tests/                         # Vitest unit + Harper integration tests
├── index.html · vite.config.ts · tsconfig.json · package.json
├── README.md · LICENSE
```

UI, processing engines, rule data and storage are kept strictly separate; the engines have no React or DOM dependencies.

## 2. Technologies used

- **React 19**, **TypeScript**, **Vite**
- **Tailwind CSS 4** (via `@tailwindcss/vite`), **Lucide React** icons
- **Harper.js** — rule-based grammar checker compiled to WebAssembly (Apache-2.0)
- **Inter** variable font, bundled locally with `@fontsource-variable/inter` (no font CDN)
- **Vitest** + **jsdom** for tests
- Browser **LocalStorage** for persistence; a small hand-written **service worker** for offline use
- **GitHub Pages** + **GitHub Actions** for hosting and deployment

There is no backend, database, API token or external text-processing service of any kind.

## 3. Installation

Requires Node.js 22.12+ (24 LTS recommended) and npm.

```bash
git clone https://github.com/<your-github-username>/phrase.git
```

```bash
cd phrase
```

```bash
npm install
```

## 4. Local development

```bash
npm run dev
```

Open <http://localhost:5173>. The grammar engine (~20 MB WebAssembly, ~8 MB compressed) loads the first time you type or press *Improve My Message*.

## 5. Build and test

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm test` | Run all unit and integration tests once |
| `npm run test:watch` | Tests in watch mode |
| `npm run build` | Type-check, then production build into `dist/` |
| `npm run preview` | Serve the production build locally |

The test-suite (149 tests) covers: grammar-checking integration against the real Harper engine, phrase matching, case preservation, punctuation preservation, professional / polite / formal / friendly / concise transformations, custom phrase management, history storage (including the off-by-default guarantee), settings, missing LocalStorage, empty input, very long input, text comparison and e-mail templates.

## 6. GitHub repository setup

1. Create a new repository named **`phrase`** on GitHub (public, or private on a plan that includes Pages).
2. Push the project:

```bash
git init -b main
```

```bash
git add .
```

```bash
git commit -m "Initial commit: Phrase"
```

```bash
git remote add origin https://github.com/<your-github-username>/phrase.git
```

```bash
git push -u origin main
```

## 7. GitHub Pages deployment

1. In the repository go to **Settings → Pages**.
2. Under **Build and deployment → Source** choose **GitHub Actions**.
3. Push to `main` (or open **Actions → Deploy to GitHub Pages → Run workflow** for a manual run). The workflow installs dependencies, type-checks, runs the tests, builds, uploads `dist/` and deploys it to the `github-pages` environment.
4. Under **Settings → Pages → Custom domain** enter `phrase.rakeshvadnala.in` and save. (`public/CNAME` already contains the domain, so it is published with every build.)
5. Once the DNS check passes, tick **Enforce HTTPS**.

Notes:

- `vite.config.ts` uses `base: '/'`, which is correct for a custom domain. To host at `https://<user>.github.io/phrase/` instead, delete `public/CNAME` and build with `VITE_BASE=/phrase/`.
- Routing is hash-based (`/#/library`), so deep links and reloads work on GitHub Pages without rewrite rules. `404.html` returns any other path to the app.
- The workflow uses `actions/checkout@v7`, `actions/setup-node@v7`, `actions/configure-pages@v6`, `actions/upload-pages-artifact@v5` and `actions/deploy-pages@v5` (latest majors, verified November 2026).

## 8. DNS configuration

At the DNS provider for `rakeshvadnala.in`, add one record:

| Type | Name / Host | Value / Target | TTL |
| --- | --- | --- | --- |
| `CNAME` | `phrase` | `<your-github-username>.github.io` | 3600 (or default) |

- Point the record at `<your-github-username>.github.io` — not at the repository URL.
- If you use Cloudflare, set the record to **DNS only** (grey cloud) until GitHub has issued the HTTPS certificate.
- Propagation usually takes minutes but can take up to 24 hours. Verify with `nslookup phrase.rakeshvadnala.in`.
- Recommended: verify the domain under **GitHub → Settings → Pages → Verified domains** to prevent takeover.

## 9. Known limitations

- **Rules, not understanding.** Phrase matches phrases; it does not understand meaning or context. It will not restructure sentences, and a rule can occasionally fit a sentence poorly — which is why every change can be rejected or swapped.
- **Grammar coverage is Harper's coverage.** Harper is a rule-based checker, not a full parser. It misses some errors (for example it corrects `it dont work` to `don't`, not `doesn't`) and occasionally flags correct text.
- **Spelling suggestions are look-alikes.** For unknown words (names, product names, jargon) Harper offers similar dictionary words that are often wrong, so Phrase only pre-selects unambiguous corrections and leaves the rest for you to choose. Add recurring terms to the personal dictionary.
- **Single pass.** All changes are computed against the original text. A phrase rule will not match a phrase that contains a typo; use *Replace editor text* and improve again if needed.
- **Polite requests keep their punctuation.** `Send me the report.` becomes `Could you please send me the report.` — the full stop is preserved rather than turned into a question mark.
- **English only**, with American, British, Australian, Canadian and Indian dialect options for the checker.
- **First load is large.** The grammar engine is a ~20 MB WebAssembly file (~8 MB compressed). It is loaded lazily, cached, and reused offline afterwards; the rest of the app is ~120 KB gzipped.
- **Offline use** needs one complete online visit over HTTPS (service workers do not run on plain HTTP except `localhost`) and depends on the browser keeping its cache.
- **Storage is per browser.** Custom phrases, favourites, dictionary, settings and history live in this browser's LocalStorage; they do not sync between devices and are lost if site data is cleared. In private-browsing modes that block storage, Phrase still works but nothing persists.
- **Paste button** uses the Clipboard API, which requires permission; `Ctrl/⌘ + V` always works.
- **Very long messages.** Live underlining pauses above 20,000 characters; *Improve My Message* still processes the full text.

## Adding or changing rules

Rules are plain JSON in `src/rules/`:

```json
{
  "id": "pro-i-want-to-know",
  "original": "I want to know",
  "replacement": "I would like to understand",
  "alternatives": ["I would like to know", "Could you please clarify"],
  "tone": "professional",
  "priority": 70,
  "description": "A softer, more professional way to ask for information."
}
```

Optional fields: `variants` (other spellings), `pattern` (a regular expression instead of a literal phrase; `$1`…`$9` and `$0` are available in the replacement), `position: "sentenceStart"`, `unlessSentenceContains`, `context`. Run `npm test` after editing — the suite checks that every rule compiles and has a unique id.

## Privacy

Your text never leaves the browser. See the in-app Privacy page for the full statement.

## License

[MIT](LICENSE)
