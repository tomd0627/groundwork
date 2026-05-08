/* global runAudits */

(function () {
  'use strict';

  /* ── DOM refs ──────────────────────────────────────────── */
  const tabBtns = document.querySelectorAll('.tab-btn');
  const panelUrl = document.getElementById('panel-url');
  const panelPaste = document.getElementById('panel-paste');
  const formUrl = document.getElementById('form-url');
  const formPaste = document.getElementById('form-paste');
  const inputUrl = document.getElementById('input-url');
  const inputPaste = document.getElementById('input-paste');
  const urlError = document.getElementById('url-error');
  const pasteError = document.getElementById('paste-error');
  const resultsSection = document.getElementById('results-section');
  const loadingState = document.getElementById('loading-state');
  const inputSection = document.querySelector('.input-section');
  const scoreNumber = document.getElementById('score-number');
  const scoreGrade = document.getElementById('score-grade');
  const scoreLabel = document.getElementById('score-label');
  const countFail = document.getElementById('count-fail');
  const countWarn = document.getElementById('count-warn');
  const countPass = document.getElementById('count-pass');
  const auditedUrl = document.getElementById('audited-url');
  const resultsBody = document.getElementById('results-body');
  const btnReset = document.getElementById('btn-reset');
  const ringFill = document.querySelector('.score-ring__fill');

  const RING_CIRCUMFERENCE = 2 * Math.PI * 34; // r=34 → 213.63

  /* ── Tab switching ─────────────────────────────────────── */
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      tabBtns.forEach((b) => {
        b.classList.toggle('tab-btn--active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      panelUrl.hidden = target !== 'url';
      panelPaste.hidden = target !== 'paste';
      clearError(urlError);
      clearError(pasteError);
    });
  });

  /* ── URL form ──────────────────────────────────────────── */
  formUrl.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError(urlError);
    const raw = inputUrl.value.trim();

    if (!raw) {
      return showError(urlError, 'Please enter a URL.');
    }
    if (!isValidUrl(raw)) {
      return showError(urlError, 'Enter a valid URL starting with http:// or https://.');
    }

    showLoading();
    try {
      const html = await fetchViaProxy(raw);
      const doc = parseHtml(html);
      renderResults(doc, raw);
    } catch (err) {
      hideLoading();
      showError(urlError, err.message);
    }
  });

  /* ── Paste form ────────────────────────────────────────── */
  formPaste.addEventListener('submit', (e) => {
    e.preventDefault();
    clearError(pasteError);
    const raw = inputPaste.value.trim();

    if (!raw) {
      return showError(pasteError, 'Paste some HTML first.');
    }

    const doc = parseHtml(raw);
    if (!doc.documentElement) {
      return showError(pasteError, 'Could not parse that as HTML. Make sure it is valid markup.');
    }

    renderResults(doc, 'Pasted HTML');
  });

  /* ── Reset ─────────────────────────────────────────────── */
  btnReset.addEventListener('click', resetToInput);

  /* ── Fetch proxy ───────────────────────────────────────── */
  async function fetchViaProxy(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    let res;
    try {
      res = await fetch(`/.netlify/functions/fetch-url?url=${encodeURIComponent(url)}`, {
        signal: controller.signal,
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(
          'Request timed out after 10 seconds. The server may be slow or unreachable.'
        );
      }
      throw new Error('Network error — check your connection and try again.');
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Server responded with ${res.status}.`);
    }

    const data = await res.json();
    if (!data.html) {
      throw new Error('The server returned an empty response.');
    }
    return data.html;
  }

  /* ── HTML parsing ──────────────────────────────────────── */
  function parseHtml(html) {
    return new DOMParser().parseFromString(html, 'text/html');
  }

  /* ── Render results ────────────────────────────────────── */
  function renderResults(doc, source) {
    hideLoading();

    const { results, score, grade, gradeLabel, counts } = runAudits(doc);

    scoreNumber.textContent = score;
    scoreGrade.textContent = grade;
    scoreLabel.textContent = gradeLabel;
    countFail.textContent = counts.fail;
    countWarn.textContent = counts.warn;
    countPass.textContent = counts.pass;
    auditedUrl.textContent = source;
    auditedUrl.title = source;

    const ringColor = score >= 90 ? 'var(--pass)' : score >= 60 ? 'var(--warn)' : 'var(--fail)';
    ringFill.style.stroke = ringColor;
    scoreGrade.style.color = ringColor;

    const offset = RING_CIRCUMFERENCE * (1 - score / 100);
    ringFill.style.strokeDashoffset = offset;

    resultsBody.innerHTML = '';

    const byCategory = groupByCategory(results);
    const ORDER = [
      'Document',
      'Images',
      'Scripts',
      'Fonts',
      'Structure',
      'Forms',
      'Deprecated',
      'Links',
    ];

    ORDER.forEach((cat) => {
      const checks = byCategory[cat];
      if (!checks) return;

      const group = document.createElement('div');
      group.className = 'category-group';
      group.setAttribute('role', 'list');

      const heading = document.createElement('h2');
      heading.className = 'category-heading';
      heading.textContent = cat;
      group.append(heading);

      checks.forEach((result) => {
        group.append(buildCheckRow(result));
      });

      resultsBody.append(group);
    });

    inputSection.hidden = true;
    resultsSection.hidden = false;
    resultsSection.focus();
  }

  /* ── Build check row ───────────────────────────────────── */
  function buildCheckRow(result) {
    const row = document.createElement('div');
    row.className = `check-row check-row--${result.status}`;
    row.setAttribute('role', 'listitem');

    const badge = document.createElement('span');
    badge.className = `check-badge check-badge--${result.status}`;
    badge.textContent =
      result.status === 'pass' ? 'Pass' : result.status === 'warn' ? 'Warn' : 'Fail';
    badge.setAttribute('aria-label', result.status);

    const content = document.createElement('div');
    content.className = 'check-content';

    const label = document.createElement('p');
    label.className = 'check-label';
    label.textContent = result.label;

    const detail = document.createElement('p');
    detail.className = 'check-detail';
    detail.innerHTML = result.detail;

    content.append(label, detail);
    row.append(badge, content);
    return row;
  }

  /* ── Grouping ──────────────────────────────────────────── */
  function groupByCategory(results) {
    return results.reduce((acc, r) => {
      if (!acc[r.category]) acc[r.category] = [];
      acc[r.category].push(r);
      return acc;
    }, {});
  }

  /* ── State helpers ─────────────────────────────────────── */
  function showLoading() {
    inputSection.hidden = true;
    resultsSection.hidden = true;
    loadingState.hidden = false;
  }

  function hideLoading() {
    loadingState.hidden = true;
  }

  function resetToInput() {
    resultsSection.hidden = true;
    loadingState.hidden = true;
    inputSection.hidden = false;
    clearError(urlError);
    clearError(pasteError);
    inputUrl.focus();
  }

  function showError(el, msg) {
    el.textContent = msg;
    el.hidden = false;
  }

  function clearError(el) {
    el.hidden = true;
    el.textContent = '';
  }

  /* ── Validation ────────────────────────────────────────── */
  function isValidUrl(str) {
    try {
      const u = new URL(str);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }
})();
