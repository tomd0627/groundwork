# Groundwork — CLAUDE.md

## Architecture

Vanilla HTML/CSS/JS single-page app deployed on Netlify. No runtime dependencies — everything runs in the browser.

```
index.html                      → shell, no JS framework
css/styles.css                  → all styles, CSS custom properties for every token
js/audits.js                    → pure audit engine; takes a Document, returns results
js/app.js                       → UI logic: tab switching, form handling, results rendering
netlify/functions/fetch-url.mjs → CORS proxy, Netlify Functions v2 ESM, Node.js 20
```

## Design tokens

All colors, spacing, radii, and shadows live as CSS custom properties in `css/styles.css` under `:root`. Never hardcode values in component rules.

Palette is **light-first** (warm off-white `#f7f4ef` base), distinct from the portfolio's dark teal. Forest green `#2d6a4f` is both the pass color and the primary interactive accent.

## Audit engine contract

`runAudits(doc)` in `audits.js` accepts a parsed `Document` and returns:
```js
{
  results: [{ id, category, label, status, detail }],
  score: 0–100,
  grade: 'A'|'B'|'C'|'D',
  gradeLabel: 'Solid'|'Good'|'Fair'|'Needs Work',
  counts: { pass, warn, fail }
}
```

Each check in `CHECKS[]` has: `id`, `category`, `label`, `severity` ('fail'|'warn'), and `run(doc)`.

## Scoring

- 8 FAIL-severity checks × 10pts = 80
- 10 WARN-severity checks × 5pts = 50
- maxScore = 130
- score = clamp(100 − (penalty / 130 × 100), 0, 100)

Grades: A ≥ 90, B ≥ 75, C ≥ 60, D < 60.

## Score ring

`score-ring__fill` uses SVG `stroke-dashoffset` animation. `r=34` → circumference = `2π×34 ≈ 213.63`. This constant is hardcoded as `RING_CIRCUMFERENCE` in `app.js`. The ring stroke color interpolates: green (≥90) → amber (60–89) → red (<60) via CSS variables set at render time.

## Netlify Function

`netlify/functions/fetch-url.mjs` uses Netlify Functions **v2 ESM** format (`export default handler`). The `.mjs` extension is required for the Netlify CLI dev server to treat the file as ES modules — do not rename to `.js`. No `export const config` is present; the filename derives the path `/.netlify/functions/fetch-url` automatically. The function:
- Validates URL (http/https only), returns 400 for invalid/missing
- Enforces a 10s `AbortController` timeout, returns 504 on expiry
- Returns 422 for non-HTML content-type or empty body
- Returns 502 for upstream network errors or non-2xx responses
- Returns `{ html }` on success, `{ error }` on all failures
- Sets `Cache-Control: no-store` so audits are never stale

## innerHTML in results

`check-detail` paragraphs are populated with `innerHTML` to render `<code>` tags embedded in audit detail strings. This is intentional and safe — all strings originate from the internal audit engine, never from user input or fetched content.

## CSS conventions

- Logical properties (`block-size`, `inline-size`, `margin-block-end`) preferred over physical
- No vendor prefixes — target last 2 major evergreen browsers
- Reduced motion: `@media (prefers-reduced-motion: reduce)` at bottom of file
- All interactive elements must have `:focus-visible` styles

## JS conventions

- IIFE in `app.js` to avoid global scope pollution
- `runAudits` is the only global exposed (from `audits.js`)
- No `console.log` in production code
- Strict equality (`===`) everywhere
- No jQuery, no framework

## Pre-commit tooling (Phase 8 — config files not yet created)

`npm install` has been run — `node_modules/` exists and Husky ran its `prepare` script. Config files still to create:
- `eslint.config.js` (flat config format)
- `.stylelintrc.json`
- `.prettierrc`
- `.lintstagedrc.json`
- `.husky/pre-commit`
