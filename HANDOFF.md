# Groundwork — Handoff

## Current phase

**Phases 1–7 complete.** All core code is written and tested. Ready for Phase 8.

## Completed

| Phase | Description | Status |
|---|---|---|
| 1 | Pre-code declaration (structure, palette, checks, scoring, deps) | ✅ |
| 2 | HTML/CSS scaffold — layout, tabs, results panel, design system | ✅ |
| 3 | Netlify Function — URL fetch proxy with full error handling | ✅ |
| 4 | Audit engine — all 18 checks in `js/audits.js` | ✅ |
| 5 | Results UI — score ring, pass/warn/fail rows, grade display | ✅ |
| 6 | Error states — invalid URL, timeout, non-HTML, empty paste | ✅ |
| 7 | Real-world testing against 5+ live sites | ✅ |
| 8 | Pre-commit tooling (Husky, ESLint, Stylelint, Prettier) | ⏳ |
| 9 | Recruiter audit + Lighthouse CLI + README finalization | ⏳ |

## What was done in Phase 7

- `npm install` completed — `node_modules/` exists, Husky ran `prepare`
- Found and fixed a missing check: `doc-title` (warn) was absent, leaving 17 checks instead of 18. Added it to `js/audits.js` in the Document category. Count is now correct: 8 fail + 10 warn = 18, maxScore = 130.
- Renamed `netlify/functions/fetch-url.js` → `fetch-url.mjs` — required for the Netlify CLI dev server to recognize ESM format without warnings.
- Removed `export const config` from the function — it was redundant (filename already derives the correct path) and caused 404s locally.
- Verified all function error states programmatically:
  - No `url` param → 400 `Missing url parameter.` ✅
  - `url=not-a-url` → 400 `Invalid URL.` ✅
  - `url=ftp://...` → 400 `Only http and https URLs are supported.` ✅
  - Upstream 404 → 502 ✅
  - Non-HTML response → 422 ✅
  - Valid HTML URL (`example.com`) → 200 with `{ html }` ✅
- Verified audit logic against `example.com` HTML manually: score 81, Grade B, 2 fail (charset, main), 1 warn (nav) — correct.
- Server runs at `http://localhost:8888` via `npx netlify-cli dev --port 8888 --no-open`

## Exact next task — Phase 8: pre-commit tooling

`npm install` is already done. Create these five files:

1. `eslint.config.js` — flat config (ESLint v9); rules: `no-unused-vars`, `no-console`, enforce `===`
2. `.stylelintrc.json` — `stylelint-config-standard`; no duplicate selectors, no vendor prefixes, property order via `stylelint-order`
3. `.prettierrc` — consistent formatting for HTML, CSS, JS (single quotes, 2-space indent, 100-char line)
4. `.lintstagedrc.json` — run ESLint on `*.js`, Stylelint on `*.css`, Prettier on `*.{html,css,js}`
5. `.husky/pre-commit` — runs `npx lint-staged`

Then run `npm run prepare` to re-activate Husky now that the hook file exists.

After creating the config files, run `git add` on a JS file and attempt a commit to confirm the hook fires.

## Gotchas to watch for

- `eslint.config.js` (flat config) is the correct format for ESLint v9; do not use `.eslintrc.json`
- `font-preconnect` check uses `new URL(href, 'https://x')` with a dummy base for relative hrefs — intentional, not a bug
- `_redirects` catch-all (`/* /index.html 200`) is fine — Netlify resolves `/.netlify/functions/*` before redirect rules in production
- Score ring circumference is `2π×34 ≈ 213.63` — hardcoded in `app.js` as `RING_CIRCUMFERENCE`; must stay in sync with `r="34"` in the SVG in `index.html`
- Function file must stay `.mjs` — the Netlify CLI dev server treats `.js` as CommonJS even when the file contains ESM syntax
- `app.js` uses `innerHTML` on `.check-detail` elements intentionally — all strings come from the internal audit engine, never from user input
