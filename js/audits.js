/* exported runAudits */

/**
 * Audit engine — all checks operate on a parsed DOM Document.
 * Each check returns: { id, category, label, status, detail }
 * status: 'pass' | 'warn' | 'fail'
 */

const CHECKS = [
  // ── Document ──────────────────────────────────────────────
  {
    id: 'doc-lang',
    category: 'Document',
    label: 'html[lang] present',
    severity: 'fail',
    run(doc) {
      const html = doc.documentElement;
      const lang = html?.getAttribute('lang')?.trim();
      if (lang) {
        return pass(this, `Language declared as <code>${lang}</code>.`);
      }
      return fail(
        this,
        'The <code>&lt;html&gt;</code> element is missing a <code>lang</code> attribute. Screen readers need this to select the correct voice.'
      );
    },
  },
  {
    id: 'doc-charset',
    category: 'Document',
    label: 'Character encoding declared',
    severity: 'fail',
    run(doc) {
      const meta = doc.querySelector('meta[charset]');
      if (meta) {
        const charset = meta.getAttribute('charset');
        return pass(this, `Charset declared as <code>${charset}</code>.`);
      }
      return fail(
        this,
        'No <code>&lt;meta charset&gt;</code> found. Browsers may misinterpret character encoding, causing mojibake.'
      );
    },
  },
  {
    id: 'doc-viewport',
    category: 'Document',
    label: 'Viewport meta present',
    severity: 'fail',
    run(doc) {
      const meta = doc.querySelector('meta[name="viewport"]');
      if (meta) {
        return pass(this, `<code>${attr(meta, 'content')}</code>`);
      }
      return fail(
        this,
        'No <code>&lt;meta name="viewport"&gt;</code> found. The page will not scale correctly on mobile devices.'
      );
    },
  },

  {
    id: 'doc-title',
    category: 'Document',
    label: 'Page has a <title> element',
    severity: 'warn',
    run(doc) {
      const title = doc.querySelector('title');
      const text = title?.textContent?.trim();
      if (text) {
        return pass(this, `Title: <code>${truncate(text, 60)}</code>`);
      }
      if (title) {
        return warn(
          this,
          'A <code>&lt;title&gt;</code> element exists but is empty. Browsers and screen readers use it to identify the page.'
        );
      }
      return warn(
        this,
        'No <code>&lt;title&gt;</code> element found. Browsers, bookmarks, and search engines rely on the page title.'
      );
    },
  },

  // ── Images ────────────────────────────────────────────────
  {
    id: 'img-alt',
    category: 'Images',
    label: 'All images have alt attributes',
    severity: 'fail',
    run(doc) {
      const imgs = [...doc.querySelectorAll('img')];
      if (imgs.length === 0) {
        return pass(this, 'No images found.');
      }
      const missing = imgs.filter((img) => !img.hasAttribute('alt'));
      if (missing.length === 0) {
        return pass(this, `All ${imgs.length} image(s) have alt attributes.`);
      }
      const srcs = missing
        .slice(0, 3)
        .map((img) => `<code>${truncate(img.getAttribute('src') || '(no src)', 40)}</code>`)
        .join(', ');
      const more = missing.length > 3 ? ` and ${missing.length - 3} more` : '';
      return fail(
        this,
        `${missing.length} image(s) missing alt: ${srcs}${more}. Use <code>alt=""</code> for decorative images.`
      );
    },
  },
  {
    id: 'img-dimensions',
    category: 'Images',
    label: 'Images have explicit width and height',
    severity: 'warn',
    run(doc) {
      const imgs = [...doc.querySelectorAll('img')];
      if (imgs.length === 0) {
        return pass(this, 'No images found.');
      }
      const missing = imgs.filter(
        (img) => !img.hasAttribute('width') || !img.hasAttribute('height')
      );
      if (missing.length === 0) {
        return pass(this, `All ${imgs.length} image(s) have width and height attributes.`);
      }
      return warn(
        this,
        `${missing.length} image(s) missing explicit dimensions. This causes layout shift (CLS) while images load.`
      );
    },
  },
  {
    id: 'img-format',
    category: 'Images',
    label: 'Modern image formats in use',
    severity: 'warn',
    run(doc) {
      const imgs = [...doc.querySelectorAll('img[src]')];
      const sources = [...doc.querySelectorAll('source[srcset]')];
      if (imgs.length === 0 && sources.length === 0) {
        return pass(this, 'No images found.');
      }
      const hasModern = [...imgs, ...sources].some((el) => {
        const src = el.getAttribute('src') || el.getAttribute('srcset') || '';
        return /\.(webp|avif)/i.test(src);
      });
      if (hasModern) {
        return pass(this, 'At least one image uses WebP or AVIF format.');
      }
      return warn(
        this,
        'No WebP or AVIF images detected (checked src/srcset extensions). Modern formats reduce file size 25–50%.'
      );
    },
  },

  // ── Scripts ───────────────────────────────────────────────
  {
    id: 'script-blocking',
    category: 'Scripts',
    label: 'No render-blocking scripts in <head>',
    severity: 'warn',
    run(doc) {
      const head = doc.querySelector('head');
      if (!head) {
        return pass(this, 'No head element found.');
      }
      const blocking = [...head.querySelectorAll('script[src]')].filter(
        (s) => !s.hasAttribute('defer') && !s.hasAttribute('async')
      );
      if (blocking.length === 0) {
        return pass(this, 'All scripts in <code>&lt;head&gt;</code> use defer or async.');
      }
      const srcs = blocking
        .slice(0, 3)
        .map((s) => `<code>${truncate(s.getAttribute('src') || '', 40)}</code>`)
        .join(', ');
      return warn(
        this,
        `${blocking.length} render-blocking script(s) in <code>&lt;head&gt;</code>: ${srcs}. Add <code>defer</code> or <code>async</code>.`
      );
    },
  },

  // ── Fonts ─────────────────────────────────────────────────
  {
    id: 'font-display',
    category: 'Fonts',
    label: 'font-display used in @font-face',
    severity: 'warn',
    run(doc) {
      const styles = [...doc.querySelectorAll('style')].map((s) => s.textContent || '');
      const hasFontFace = styles.some((s) => /@font-face/i.test(s));
      if (!hasFontFace) {
        return pass(this, 'No inline @font-face rules found.');
      }
      const hasDisplay = styles.some((s) => /font-display\s*:/i.test(s));
      if (hasDisplay) {
        return pass(this, 'Inline @font-face includes font-display.');
      }
      return warn(
        this,
        'Inline @font-face rules found but none include <code>font-display</code>. Add <code>font-display: swap</code> to prevent invisible text during load.'
      );
    },
  },
  {
    id: 'font-preconnect',
    category: 'Fonts',
    label: 'Preconnect hints for external fonts',
    severity: 'warn',
    run(doc) {
      const fontLinks = [...doc.querySelectorAll('link[href]')].filter((l) => {
        const href = l.getAttribute('href') || '';
        return (
          /fonts\.(googleapis|gstatic)\.com/i.test(href) ||
          /typekit\.net|use\.typekit/i.test(href) ||
          /fonts\.bunny\.net/i.test(href)
        );
      });
      if (fontLinks.length === 0) {
        return pass(this, 'No external font links found.');
      }
      const preconnects = new Set(
        [...doc.querySelectorAll('link[rel="preconnect"]')].map(
          (l) => new URL(l.getAttribute('href') || '', 'https://x').hostname
        )
      );
      const fontDomains = [
        ...new Set(
          fontLinks.map((l) => {
            try {
              return new URL(l.getAttribute('href') || '', 'https://x').hostname;
            } catch {
              return '';
            }
          })
        ),
      ].filter(Boolean);
      const missing = fontDomains.filter((d) => !preconnects.has(d));
      if (missing.length === 0) {
        return pass(this, 'All external font domains have preconnect hints.');
      }
      return warn(
        this,
        `Missing preconnect for: ${missing.map((d) => `<code>${d}</code>`).join(', ')}. Add <code>&lt;link rel="preconnect" href="..."&gt;</code> before font links.`
      );
    },
  },

  // ── Structure ─────────────────────────────────────────────
  {
    id: 'struct-main',
    category: 'Structure',
    label: 'Page has a <main> landmark',
    severity: 'fail',
    run(doc) {
      const main = doc.querySelector('main');
      if (main) {
        return pass(this, '<code>&lt;main&gt;</code> landmark present.');
      }
      return fail(
        this,
        'No <code>&lt;main&gt;</code> element found. Screen reader users rely on this landmark to skip navigation.'
      );
    },
  },
  {
    id: 'struct-nav',
    category: 'Structure',
    label: 'Page has a <nav> landmark',
    severity: 'warn',
    run(doc) {
      const nav = doc.querySelector('nav');
      if (nav) {
        return pass(this, '<code>&lt;nav&gt;</code> landmark present.');
      }
      return warn(
        this,
        'No <code>&lt;nav&gt;</code> element found. Assistive technologies use this landmark for navigation shortcuts.'
      );
    },
  },
  {
    id: 'struct-h1',
    category: 'Structure',
    label: 'Exactly one <h1> on the page',
    severity: 'warn',
    run(doc) {
      const h1s = [...doc.querySelectorAll('h1')];
      if (h1s.length === 1) {
        const text = h1s[0].textContent?.trim().slice(0, 60) || '(empty)';
        return pass(this, `h1: <code>${text}</code>`);
      }
      if (h1s.length === 0) {
        return warn(
          this,
          'No <code>&lt;h1&gt;</code> found. Every page should have one primary heading.'
        );
      }
      return warn(
        this,
        `${h1s.length} <code>&lt;h1&gt;</code> elements found. Only one is expected per page.`
      );
    },
  },
  {
    id: 'struct-heading-order',
    category: 'Structure',
    label: "Heading levels don't skip",
    severity: 'warn',
    run(doc) {
      const headings = [...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')];
      if (headings.length === 0) {
        return pass(this, 'No headings found.');
      }
      const levels = headings.map((h) => parseInt(h.tagName[1], 10));
      const skips = [];
      for (let i = 1; i < levels.length; i++) {
        if (levels[i] > levels[i - 1] + 1) {
          skips.push(`h${levels[i - 1]} → h${levels[i]}`);
        }
      }
      if (skips.length === 0) {
        return pass(this, 'Heading order is logical.');
      }
      return warn(
        this,
        `Heading level(s) skipped: ${skips.map((s) => `<code>${s}</code>`).join(', ')}. Screen readers and crawlers expect sequential heading levels.`
      );
    },
  },

  // ── Forms ─────────────────────────────────────────────────
  {
    id: 'form-labels',
    category: 'Forms',
    label: 'All inputs have labels',
    severity: 'fail',
    run(doc) {
      const inputs = [...doc.querySelectorAll('input, select, textarea')].filter(
        (el) => el.getAttribute('type')?.toLowerCase() !== 'hidden'
      );
      if (inputs.length === 0) {
        return pass(this, 'No form inputs found.');
      }
      const unlabeled = inputs.filter((el) => {
        if (el.getAttribute('aria-label')?.trim()) return false;
        if (el.getAttribute('aria-labelledby')?.trim()) return false;
        const id = el.getAttribute('id');
        if (id && doc.querySelector(`label[for="${id}"]`)) return false;
        if (el.closest('label')) return false;
        return true;
      });
      if (unlabeled.length === 0) {
        return pass(this, `All ${inputs.length} input(s) are labeled.`);
      }
      const types = unlabeled
        .slice(0, 3)
        .map(
          (el) =>
            `<code>${el.tagName.toLowerCase()}[type=${el.getAttribute('type') || 'text'}]</code>`
        )
        .join(', ');
      return fail(
        this,
        `${unlabeled.length} unlabeled input(s): ${types}. Use <code>&lt;label for&gt;</code>, <code>aria-label</code>, or wrap inputs in a <code>&lt;label&gt;</code>.`
      );
    },
  },

  // ── Deprecated ────────────────────────────────────────────
  {
    id: 'deprecated',
    category: 'Deprecated',
    label: 'No deprecated HTML elements',
    severity: 'fail',
    run(doc) {
      const deprecated = ['center', 'font', 'marquee', 'blink', 'frameset'];
      const found = deprecated.filter((tag) => doc.querySelector(tag));
      if (found.length === 0) {
        return pass(this, 'No deprecated elements found.');
      }
      return fail(
        this,
        `Deprecated element(s) found: ${found.map((t) => `<code>&lt;${t}&gt;</code>`).join(', ')}. These elements were removed from the HTML spec.`
      );
    },
  },

  // ── Links ─────────────────────────────────────────────────
  {
    id: 'link-text',
    category: 'Links',
    label: 'All links have accessible text',
    severity: 'fail',
    run(doc) {
      const links = [...doc.querySelectorAll('a[href]')];
      if (links.length === 0) {
        return pass(this, 'No links found.');
      }
      const empty = links.filter((a) => {
        if (a.getAttribute('aria-label')?.trim()) return false;
        if (a.getAttribute('aria-labelledby')?.trim()) return false;
        const text = a.textContent?.trim();
        if (text) return false;
        const img = a.querySelector('img[alt]');
        if (img?.getAttribute('alt')?.trim()) return false;
        return true;
      });
      if (empty.length === 0) {
        return pass(this, `All ${links.length} link(s) have accessible text.`);
      }
      return fail(
        this,
        `${empty.length} link(s) have no accessible text. Screen readers will announce them as "link" with no context. Add visible text or <code>aria-label</code>.`
      );
    },
  },
  {
    id: 'link-target',
    category: 'Links',
    label: 'No bare href="#" buttons',
    severity: 'warn',
    run(doc) {
      const fakeButtons = [...doc.querySelectorAll('a[href="#"]')].filter(
        (a) => !a.getAttribute('role')
      );
      if (fakeButtons.length === 0) {
        return pass(this, 'No bare <code>href="#"</code> links without role found.');
      }
      return warn(
        this,
        `${fakeButtons.length} <code>&lt;a href="#"&gt;</code> element(s) used as buttons without <code>role="button"</code>. Use <code>&lt;button&gt;</code> instead.`
      );
    },
  },
];

/* ── Helpers ──────────────────────────────────────────────── */

function pass(check, detail) {
  return { id: check.id, category: check.category, label: check.label, status: 'pass', detail };
}

function warn(check, detail) {
  return { id: check.id, category: check.category, label: check.label, status: 'warn', detail };
}

function fail(check, detail) {
  return { id: check.id, category: check.category, label: check.label, status: 'fail', detail };
}

function attr(el, name) {
  return el.getAttribute(name) || '';
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

/* ── Public API ───────────────────────────────────────────── */

/**
 * Run all checks against a parsed Document.
 * Returns { results, score, grade, counts }.
 */
function runAudits(doc) {
  const results = CHECKS.map((check) => {
    try {
      return check.run(doc);
    } catch {
      return {
        id: check.id,
        category: check.category,
        label: check.label,
        status: 'warn',
        detail: 'Check could not run against this document.',
      };
    }
  });

  const FAIL_WEIGHT = 10;
  const WARN_WEIGHT = 5;
  const failChecks = CHECKS.filter((c) => c.severity === 'fail').length;
  const warnChecks = CHECKS.filter((c) => c.severity === 'warn').length;
  const maxScore = failChecks * FAIL_WEIGHT + warnChecks * WARN_WEIGHT;

  const penalty = results.reduce((acc, r) => {
    const check = CHECKS.find((c) => c.id === r.id);
    if (!check) return acc;
    if (r.status === 'fail') return acc + (check.severity === 'fail' ? FAIL_WEIGHT : WARN_WEIGHT);
    if (r.status === 'warn') return acc + (check.severity === 'warn' ? WARN_WEIGHT : FAIL_WEIGHT);
    return acc;
  }, 0);

  const rawScore = 100 - (penalty / maxScore) * 100;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D';
  const gradeLabel =
    score >= 90 ? 'Solid' : score >= 75 ? 'Good' : score >= 60 ? 'Fair' : 'Needs Work';

  const counts = results.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    { pass: 0, warn: 0, fail: 0 }
  );

  return { results, score, grade, gradeLabel, counts };
}
