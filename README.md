# Groundwork

A lightweight HTML audit tool that checks a page for structural, accessibility, and performance hygiene issues before deploy. Paste raw HTML or provide a URL — results appear in seconds with a score, grade, and per-check detail.

---

## What it checks

18 checks across 7 categories, weighted by severity:

| Category   | Check                                  | Severity |
| ---------- | -------------------------------------- | -------- |
| Document   | `html[lang]` present                   | fail     |
| Document   | Character encoding declared            | fail     |
| Document   | Viewport meta present                  | fail     |
| Document   | Page has a `<title>`                   | warn     |
| Images     | All images have `alt` attributes       | fail     |
| Images     | Images have explicit `width`/`height`  | warn     |
| Images     | Modern image formats (WebP/AVIF)       | warn     |
| Scripts    | No render-blocking scripts in `<head>` | warn     |
| Fonts      | `font-display` used in `@font-face`    | warn     |
| Fonts      | Preconnect hints for external fonts    | warn     |
| Structure  | Page has a `<main>` landmark           | fail     |
| Structure  | Page has a `<nav>` landmark            | warn     |
| Structure  | Exactly one `<h1>`                     | warn     |
| Structure  | Heading levels don't skip              | warn     |
| Forms      | All inputs have labels                 | fail     |
| Deprecated | No deprecated HTML elements            | fail     |
| Links      | All links have accessible text         | fail     |
| Links      | No bare `href="#"` buttons             | warn     |

**Scoring:** 8 fail-severity checks × 10 pts + 10 warn-severity checks × 5 pts = 130 max.  
`score = clamp(100 − (penalty / 130 × 100), 0, 100)`  
Grades: A ≥ 90 · B ≥ 75 · C ≥ 60 · D < 60

---

## Eats its own dogfood

Running Groundwork against its own `index.html` — 17 pass, 1 warn (no `<nav>` is expected for a single-page tool), 0 fail → **score 96, Grade A**.

Lighthouse results (local dev server):

|                | Score |
| -------------- | ----- |
| Performance    | 100   |
| Accessibility  | 100   |
| Best Practices | 100   |
| SEO            | 100   |

Core Web Vitals: FCP 1.4 s · LCP 1.4 s · TBT 0 ms · CLS 0.007

---

## Architecture

Vanilla HTML/CSS/JS — no build step, no framework, no runtime dependencies.

```
index.html                       shell, tabs, results panel
css/styles.css                   all styles; CSS custom properties for every token
js/audits.js                     pure audit engine (takes a Document, returns results)
js/app.js                        UI: tab switching, form handling, results rendering
netlify/functions/fetch-url.mjs  CORS proxy (Netlify Functions v2, Node 20)
```

The audit engine (`runAudits`) only depends on the DOM API, so it runs directly in the browser with no bundler.

---

## Running locally

Requires [Node.js](https://nodejs.org) and the [Netlify CLI](https://docs.netlify.com/cli/get-started/).

```bash
npm install
npx netlify-cli dev --port 8888
```

Open `http://localhost:8888`. The Netlify CLI dev server proxies `/.netlify/functions/*` to the local function runtime, so the URL fetch tab works without deploying.

---

## Deploy

Push to a Netlify-connected repo. `netlify.toml` configures:

- Publish directory: `.` (static files served directly)
- Functions directory: `netlify/functions`
- Security headers: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`
- Long-lived cache headers for `/css/*`, `/js/*`, `/favicon.svg`

---

## Development

Pre-commit hook runs ESLint + Stylelint + Prettier via lint-staged on every commit.

```bash
# Lint manually
npx eslint js/
npx stylelint css/
npx prettier --check .
```

Tooling:

| Tool        | Config                           |
| ----------- | -------------------------------- |
| ESLint v9   | `eslint.config.js` (flat config) |
| Stylelint   | `.stylelintrc.json`              |
| Prettier    | `.prettierrc`                    |
| lint-staged | `.lintstagedrc.json`             |
| Husky       | `.husky/pre-commit`              |

---

## Design

Palette is light-first (warm off-white `#f7f4ef` base). Forest green `#2d6a4f` is the pass color and primary interactive accent. All colors, spacing, radii, and shadows are CSS custom properties — nothing is hardcoded in component rules.
