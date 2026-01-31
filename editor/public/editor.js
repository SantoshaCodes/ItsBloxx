/**
 * Bloxx Visual Editor — Main Client Script (v3.2)
 * Updated: 2026-01-28T12:00
 *
 * Component-based editing with @id labels, extracted text fields,
 * Component Library modal, Update Schema button, drag-and-drop.
 * Added: Settings, Collections, Audit with detailed HTML analysis.
 */
(function () {
  'use strict';

  /* ─── Helpers ─── */
  const $ = (s, p) => (p || document).querySelector(s);
  const $$ = (s, p) => [...(p || document).querySelectorAll(s)];
  function esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }

  /* ─── Granular Text Editing ─── */
  // Only these elements should enter inline text edit mode on click
  const EDITABLE_SELECTORS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'li', 'blockquote', 'label', 'button'];

  // Check if an element tag is directly text-editable
  function isTextEditable(tag) {
    return EDITABLE_SELECTORS.includes((tag || '').toLowerCase());
  }

  // Check if element is a container (div, section, article, etc.)
  function isContainer(tag) {
    const containers = ['div', 'section', 'article', 'header', 'footer', 'main', 'nav', 'aside', 'form'];
    return containers.includes((tag || '').toLowerCase());
  }

  /* ─── Editor Bridge Script (injected into iframe HTML before doc.write) ─── */
  const EDITOR_BRIDGE_SCRIPT = `
<script id="bloxx-editor-bridge">
(function() {
  'use strict';
  if (window.__BLOXX_BRIDGE__) return;
  window.__BLOXX_BRIDGE__ = true;

  let hoveredEl = null;
  let selectedEl = null;
  const EDITOR_ORIGIN = location.origin;

  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('section, [itemprop], h1, h2, h3, h4, h5, h6, p, a, img, .card, .btn, [class*="col-"]');
    if (!el || el === hoveredEl) return;
    if (hoveredEl) hoveredEl.removeAttribute('data-bloxx-hovered');
    hoveredEl = el;
    el.setAttribute('data-bloxx-hovered', 'true');
  });

  document.addEventListener('mouseout', (e) => {
    if (hoveredEl) { hoveredEl.removeAttribute('data-bloxx-hovered'); hoveredEl = null; }
  });

  document.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.target.closest('section, [itemprop], h1, h2, h3, h4, h5, h6, p, a, img, .card, .btn, [class*="col-"]');
    if (!el) return;
    if (selectedEl) selectedEl.removeAttribute('data-bloxx-selected');
    selectedEl = el;
    el.setAttribute('data-bloxx-selected', 'true');
    const path = cssPath(el);
    window.parent.postMessage({
      type: 'bloxx:element-selected',
      tag: el.tagName.toLowerCase(),
      selector: path,
      text: el.textContent?.substring(0, 200) || '',
      html: el.outerHTML.substring(0, 2000),
      classes: el.className || '',
      attributes: Object.fromEntries(Array.from(el.attributes).map(a => [a.name, a.value])),
      rect: el.getBoundingClientRect(),
    }, EDITOR_ORIGIN);
  }, true);

  function extractFields(section) {
    const fields = [];
    const selectors = 'h1,h2,h3,h4,h5,h6,p,a.btn,a[class*="btn"],button,img,span[itemprop],li';
    section.querySelectorAll(selectors).forEach(el => {
      const tag = el.tagName.toLowerCase();
      const path = cssPath(el);
      if (tag === 'img') {
        fields.push({ tag, selector: path, label: 'Image: ' + (el.alt || 'image').substring(0, 30), src: el.src || '', alt: el.alt || '' });
      } else if (tag === 'a') {
        const text = el.textContent?.trim();
        if (text) fields.push({ tag, selector: path, label: tag.toUpperCase() + ': ' + text.substring(0, 30), text, href: el.href || '' });
      } else {
        const text = el.textContent?.trim();
        if (text && text.length > 1) fields.push({ tag, selector: path, label: tag.toUpperCase() + ': ' + text.substring(0, 30), text });
      }
    });
    return fields.slice(0, 30);
  }

  function reportSections() {
    const main = document.querySelector('main') || document.body;
    const sections = Array.from(main.querySelectorAll(':scope > section, :scope > header, :scope > footer'));
    const list = sections.map((s, i) => ({
      index: i, tag: s.tagName.toLowerCase(), id: s.id || '',
      ariaLabel: s.getAttribute('aria-label') || s.getAttribute('aria-labelledby') || '',
      heading: s.querySelector('h1,h2,h3')?.textContent?.trim()?.substring(0, 60) || '',
      classes: s.className || '', fields: extractFields(s),
    }));
    window.parent.postMessage({ type: 'bloxx:sections-list', sections: list }, EDITOR_ORIGIN);
  }
  reportSections();
  new MutationObserver(() => reportSections()).observe(document.body, { childList: true, subtree: true });

  window.addEventListener('message', (e) => {
    if (e.origin !== EDITOR_ORIGIN) return;
    const msg = e.data;
    if (!msg || !msg.type) return;
    switch (msg.type) {
      case 'bloxx:update-text': { const el = document.querySelector(msg.selector); if (el) { el.textContent = msg.value; notifyDirty(); } break; }
      case 'bloxx:update-attribute': { const el = document.querySelector(msg.selector); if (el) { el.setAttribute(msg.attr, msg.value); notifyDirty(); } break; }
      case 'bloxx:update-classes': { const el = document.querySelector(msg.selector); if (el) { el.className = msg.value; notifyDirty(); } break; }
      case 'bloxx:update-html': { const el = document.querySelector(msg.selector); if (el) { el.innerHTML = msg.value; notifyDirty(); } break; }
      case 'bloxx:delete-element': { const el = document.querySelector(msg.selector); if (el) { el.remove(); notifyDirty(); } break; }
      case 'bloxx:swap-sections': {
        const main = document.querySelector('main') || document.body;
        const sections = Array.from(main.querySelectorAll(':scope > section'));
        const a = sections[msg.indexA]; const b = sections[msg.indexB];
        if (a && b) { const aNext = a.nextSibling; main.insertBefore(a, b); main.insertBefore(b, aNext); notifyDirty(); }
        break;
      }
      case 'bloxx:get-html': {
        const clone = document.documentElement.cloneNode(true);
        clone.querySelector('#bloxx-editor-bridge')?.remove();
        clone.querySelector('#bloxx-editor-styles')?.remove();
        clone.querySelectorAll('[data-bloxx-selected]').forEach(el => el.removeAttribute('data-bloxx-selected'));
        clone.querySelectorAll('[data-bloxx-hovered]').forEach(el => el.removeAttribute('data-bloxx-hovered'));
        window.parent.postMessage({ type: 'bloxx:html-response', html: '<!DOCTYPE html>\\n' + clone.outerHTML }, EDITOR_ORIGIN);
        break;
      }
      case 'bloxx:replace-element': {
        const el = document.querySelector(msg.selector);
        if (el) { const temp = document.createElement('div'); temp.innerHTML = msg.html; const newEl = temp.firstElementChild; if (newEl) el.replaceWith(newEl); else el.outerHTML = msg.html; notifyDirty(); }
        break;
      }
      case 'bloxx:move-element': {
        const el = document.querySelector(msg.selector);
        if (!el || !el.parentElement) break;
        const parent = el.parentElement;
        if (msg.direction === 'up' && el.previousElementSibling) { parent.insertBefore(el, el.previousElementSibling); notifyDirty(); }
        else if (msg.direction === 'down' && el.nextElementSibling) { parent.insertBefore(el.nextElementSibling, el); notifyDirty(); }
        break;
      }
      case 'bloxx:replace-section': {
        const main = document.querySelector('main') || document.body;
        const sections = Array.from(main.querySelectorAll(':scope > section'));
        if (msg.index >= 0 && msg.index < sections.length) { const temp = document.createElement('div'); temp.innerHTML = msg.html; const ns = temp.firstElementChild || temp; sections[msg.index].replaceWith(ns); notifyDirty(); }
        break;
      }
      case 'bloxx:append-section': {
        const main = document.querySelector('main') || document.body;
        const footer = main.querySelector(':scope > footer');
        const temp = document.createElement('div'); temp.innerHTML = msg.html; const ns = temp.firstElementChild || temp;
        if (footer) main.insertBefore(ns, footer); else main.appendChild(ns);
        notifyDirty(); ns.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (msg.insertionId) {
          window.parent.postMessage({
            type: 'bloxx:section-inserted',
            insertionId: msg.insertionId,
            success: true,
            html: document.documentElement.outerHTML
          }, EDITOR_ORIGIN);
        }
        break;
      }
      case 'bloxx:move-section': {
        const main = document.querySelector('main') || document.body;
        const children = Array.from(main.querySelectorAll(':scope > section, :scope > header, :scope > footer'));
        const el = children[msg.fromIndex];
        if (!el) break;
        const ref = children[msg.toIndex];
        if (msg.fromIndex < msg.toIndex) {
          main.insertBefore(el, ref ? ref.nextSibling : null);
        } else {
          main.insertBefore(el, ref);
        }
        notifyDirty();
        break;
      }
      case 'bloxx:insert-section-at': {
        const main = document.querySelector('main') || document.body;
        const children = Array.from(main.querySelectorAll(':scope > section, :scope > header, :scope > footer'));
        const temp = document.createElement('div');
        temp.innerHTML = msg.html;
        const ns = temp.firstElementChild || temp;
        if (msg.index >= 0 && msg.index < children.length) {
          main.insertBefore(ns, children[msg.index]);
        } else {
          const footer = main.querySelector(':scope > footer');
          if (footer) main.insertBefore(ns, footer);
          else main.appendChild(ns);
        }
        notifyDirty();
        ns.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (msg.insertionId) {
          window.parent.postMessage({
            type: 'bloxx:section-inserted',
            insertionId: msg.insertionId,
            success: true,
            html: document.documentElement.outerHTML
          }, EDITOR_ORIGIN);
        }
        break;
      }
      case 'bloxx:get-section-rects': {
        const main = document.querySelector('main') || document.body;
        const children = Array.from(main.querySelectorAll(':scope > section, :scope > header, :scope > footer'));
        const rects = children.map((el, i) => {
          const r = el.getBoundingClientRect();
          return { index: i, top: r.top, bottom: r.bottom };
        });
        window.parent.postMessage({ type: 'bloxx:section-rects-response', rects }, EDITOR_ORIGIN);
        break;
      }
      case 'bloxx:delete-section': {
        const main = document.querySelector('main') || document.body;
        const sections = Array.from(main.querySelectorAll(':scope > section'));
        if (msg.index >= 0 && msg.index < sections.length) { sections[msg.index].remove(); notifyDirty(); }
        break;
      }
      case 'bloxx:get-section-html': {
        const main = document.querySelector('main') || document.body;
        const sections = Array.from(main.querySelectorAll(':scope > section, :scope > header, :scope > footer'));
        if (msg.index >= 0 && msg.index < sections.length) {
          window.parent.postMessage({ type: 'bloxx:section-html-response', index: msg.index, html: sections[msg.index].outerHTML }, EDITOR_ORIGIN);
        }
        break;
      }
      case 'bloxx:highlight-section': {
        const main = document.querySelector('main') || document.body;
        const sections = Array.from(main.querySelectorAll(':scope > section'));
        sections.forEach(s => s.removeAttribute('data-bloxx-section-highlight'));
        if (msg.index >= 0 && msg.index < sections.length) { sections[msg.index].setAttribute('data-bloxx-section-highlight', 'true'); sections[msg.index].scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        break;
      }
      case 'bloxx:get-schemas': {
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        const schemas = [];
        scripts.forEach(s => { try { schemas.push(JSON.parse(s.textContent)); } catch {} });
        window.parent.postMessage({ type: 'bloxx:schemas-response', schemas }, EDITOR_ORIGIN);
        break;
      }
      case 'bloxx:update-schemas': {
        document.querySelectorAll('script[type="application/ld+json"]').forEach(s => s.remove());
        const head = document.head || document.documentElement;
        (msg.schemas || []).forEach(schema => { const script = document.createElement('script'); script.type = 'application/ld+json'; script.textContent = JSON.stringify(schema, null, 2); head.appendChild(script); });
        notifyDirty();
        break;
      }
    }
  });

  function notifyDirty() { window.parent.postMessage({ type: 'bloxx:dirty' }, EDITOR_ORIGIN); }

  function cssPath(el) {
    if (el.id) return '#' + el.id;
    const parts = [];
    while (el && el.nodeType === 1) {
      let selector = el.tagName.toLowerCase();
      if (el.id) { parts.unshift('#' + el.id); break; }
      const parent = el.parentElement;
      if (parent) { const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName); if (siblings.length > 1) selector += ':nth-of-type(' + (siblings.indexOf(el) + 1) + ')'; }
      parts.unshift(selector);
      el = parent;
    }
    return parts.join(' > ');
  }
})();
<\/script>
<style id="bloxx-editor-styles">
  [data-bloxx-hovered] { outline: 2px dashed rgba(99, 102, 241, 0.5) !important; outline-offset: 2px; }
  [data-bloxx-selected] { outline: 2px solid #6366f1 !important; outline-offset: 2px; }
  [data-bloxx-section-highlight] { outline: 3px solid #6366f1 !important; outline-offset: 4px; transition: outline 0.2s; }
  * { cursor: default !important; }
  a, button, [role="button"] { pointer-events: auto !important; }
<\/style>`;

  /**
   * Inject bridge script into HTML string before </body>.
   * Includes dedup guard to prevent multiple bridge injections.
   */
  function injectBridgeIntoHTML(html) {
    if (html.includes('__BLOXX_BRIDGE__')) return html;
    if (html.includes('</body>')) return html.replace('</body>', EDITOR_BRIDGE_SCRIPT + '\n</body>');
    if (html.includes('</html>')) return html.replace('</html>', EDITOR_BRIDGE_SCRIPT + '\n</html>');
    return html + EDITOR_BRIDGE_SCRIPT;
  }

  /* ─── Utilities ─── */
  function stripBridgeArtifacts(html) {
    if (!html) return html;
    return html
      .replace(/<script[^>]*id=["']bloxx-editor-bridge["'][^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*id=["']bloxx-editor-styles["'][^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/\n\s*\n/g, '\n');
  }

  function validateHTML(html) {
    if (!html || typeof html !== 'string') return { valid: false, error: 'HTML is empty or invalid type' };
    if (html.length < 50) return { valid: false, error: 'HTML appears corrupted (too short)' };
    if (!html.includes('<html') && !html.includes('<body')) return { valid: false, error: 'HTML missing required structure' };
    return { valid: true };
  }

  function getAutoSaveKey() { return `bloxx-autosave-${state.site}-${state.page}`; }
  function getRecoveryMetaKey() { return `bloxx-recovery-meta-${state.site}-${state.page}`; }

  /* ─── State ─── */
  const params = new URLSearchParams(location.search);
  // If no site param, redirect to start page
  if (!params.get('site')) {
    window.location.href = '/start.html';
  }
  const state = {
    site: params.get('site') || '',
    page: params.get('page') || '',
    pages: [],
    sections: [],          // from bridge: { index, tag, id, ariaLabel, heading, classes, fields[] }
    selected: null,        // { tag, selector, text, html, classes, attributes, rect }
    selectedSectionIdx: -1,
    etag: null,
    dirty: false,
    html: '',              // Source of truth — canonical HTML string
    pendingSync: null,     // Tracks pending sync from iframe edits
    version: 0,
    lastSavedVersion: 0,
    recoveryAvailable: false,
  };

  /* ─── Undo / Redo (snapshot-based) ─── */
  const snapshots = { past: [], future: [] };
  const MAX_SNAP = 40;

  function snapshot() { return requestIframeHTML(); }

  async function pushSnapshot() {
    const html = await snapshot();
    if (!html) return;
    snapshots.past.push(html);
    if (snapshots.past.length > MAX_SNAP) snapshots.past.shift();
    snapshots.future = [];
    updateUndoRedo();
  }

  async function undo() {
    if (!snapshots.past.length) return;
    const current = await snapshot();
    if (current) snapshots.future.push(current);
    const prev = snapshots.past.pop();
    loadHTMLIntoIframe(prev);
    setDirty(true);
    updateUndoRedo();
  }

  async function redo() {
    if (!snapshots.future.length) return;
    const current = await snapshot();
    if (current) snapshots.past.push(current);
    const next = snapshots.future.pop();
    loadHTMLIntoIframe(next);
    setDirty(true);
    updateUndoRedo();
  }

  function updateUndoRedo() {
    $('#btn-undo').disabled = snapshots.past.length === 0;
    $('#btn-redo').disabled = snapshots.future.length === 0;
  }

  /* ─── Toast ─── */
  function toast(msg, type) {
    const el = document.createElement('div');
    el.className = 'toast-item ' + (type || '');
    el.textContent = msg;
    $('#toast-rack').appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3500);
  }

  /* ─── Save indicator ─── */
  function setStatus(s) {
    const el = $('#save-indicator');
    el.className = 'save-indicator ' + s;
    const icons = { saved: 'check-circle', dirty: 'circle-fill', saving: 'arrow-repeat', error: 'exclamation-circle', enhancing: 'stars' };
    const labels = { saved: 'Saved', dirty: 'Unsaved', saving: 'Saving…', error: 'Error', enhancing: 'AI enhancing…' };
    el.innerHTML = '<i class="bi bi-' + (icons[s] || 'circle') + '"></i> ' + (labels[s] || s);
  }

  function setDirty(v) {
    state.dirty = v;
    setStatus(v ? 'dirty' : 'saved');
  }

  /* ─── API calls ─── */
  async function api(path, opts) {
    const res = await fetch(path, opts);
    return res.json();
  }

  async function fetchPages() {
    const d = await api('/api/pages?site=' + encodeURIComponent(state.site));
    return d.pages || [];
  }

  async function saveToR2(html) {
    // Wait for any pending sync from inline edits
    if (state.pendingSync) await state.pendingSync;

    // Validate before saving
    const validation = validateHTML(html);
    if (!validation.valid) {
      toast('Cannot save: ' + validation.error, 'error');
      return { ok: false };
    }

    setStatus('saving');
    const d = await api('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site: state.site, page: state.page, html, etag: state.etag }),
    });
    if (d.ok) {
      state.etag = d.etag;
      setDirty(false);
      clearDraft();
      if (d.enhanced && d.html) {
        setStatus('enhancing');
        loadHTMLIntoIframe(d.html);
        toast('Saved — markup & schema auto-enhanced by AI', 'success');
        setTimeout(() => setStatus('saved'), 1500);
      } else {
        toast('Saved', 'success');
      }
    } else if (d.error === 'conflict') {
      setStatus('error');
      toast('Conflict — another user saved. Reload to get latest.', 'warning');
    } else {
      setStatus('error');
      toast('Save failed: ' + (d.error || 'unknown'), 'error');
    }
    return d;
  }

  async function deployToLive() {
    toast('Deploying…');
    const d = await api('/api/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site: state.site }),
    });
    if (d.ok) toast('Deployed ' + d.deployed.length + ' files to live', 'success');
    else toast('Deploy failed: ' + (d.error || 'unknown'), 'error');
  }

  async function callAI(body) {
    return api('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  /* ─── Auto-save & Recovery (localStorage) ─── */
  let autoSaveTimer = null;

  function triggerAutoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => {
      if (state.pendingSync) await state.pendingSync;
      if (!state.html || !state.site || !state.page) return;
      try {
        localStorage.setItem(getAutoSaveKey(), state.html);
        localStorage.setItem(getRecoveryMetaKey(), JSON.stringify({
          timestamp: Date.now(),
          version: state.version,
          site: state.site,
          page: state.page,
        }));
      } catch (e) {
        console.warn('Auto-save failed:', e);
      }
    }, 5000);
  }

  function clearAutoSave() {
    localStorage.removeItem(getAutoSaveKey());
    localStorage.removeItem(getRecoveryMetaKey());
  }

  // Keep legacy aliases for existing callers
  function clearDraft() { clearAutoSave(); }
  function startAutoSave() { triggerAutoSave(); }

  function checkForRecovery() {
    const recoveredHTML = localStorage.getItem(getAutoSaveKey());
    const metaJson = localStorage.getItem(getRecoveryMetaKey());
    if (!recoveredHTML || !metaJson) return;
    try {
      const meta = JSON.parse(metaJson);
      if (meta.site !== state.site || meta.page !== state.page) return;
      if (recoveredHTML === state.html) { clearAutoSave(); return; }
      const age = Date.now() - meta.timestamp;
      if (age > 24 * 60 * 60 * 1000) { clearAutoSave(); return; }
      const ageMinutes = Math.round(age / 60000);
      showRecoveryModal({
        ageMinutes,
        onRecover: () => {
          state.html = recoveredHTML;
          state.version++;
          loadHTMLIntoIframe(state.html);
          setDirty(true);
          clearAutoSave();
          toast('Changes recovered', 'success');
        },
        onDiscard: () => {
          clearAutoSave();
          toast('Recovery discarded');
        },
      });
    } catch (e) {
      console.error('Recovery check failed:', e);
      clearAutoSave();
    }
  }

  function showRecoveryModal({ ageMinutes, onRecover, onDiscard }) {
    const modal = document.createElement('div');
    modal.className = 'bloxx-recovery-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5)';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:24px;max-width:400px;width:90%;box-shadow:0 8px 30px rgba(0,0,0,.2)">
        <h3 style="margin:0 0 8px">Recover Unsaved Changes?</h3>
        <p style="margin:0 0 16px;color:#555">Found auto-saved changes from ${ageMinutes} minute${ageMinutes !== 1 ? 's' : ''} ago.</p>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button data-action="discard" style="padding:8px 16px;border:1px solid #ddd;border-radius:6px;background:#fff;cursor:pointer">Discard</button>
          <button data-action="recover" style="padding:8px 16px;border:none;border-radius:6px;background:#6366f1;color:#fff;cursor:pointer">Recover</button>
        </div>
      </div>`;
    modal.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (action === 'recover') { modal.remove(); onRecover(); }
      else if (action === 'discard') { modal.remove(); onDiscard(); }
    });
    document.body.appendChild(modal);
  }

  /* ─── Iframe communication ─── */
  const iframe = () => $('#preview-iframe');

  function sendMsg(msg) {
    const f = iframe();
    if (f && f.contentWindow) f.contentWindow.postMessage(msg, '*');
  }

  /** Old bridge-based HTML retrieval — used ONLY for initial load + dirty sync */
  function requestIframeHTMLDirect() {
    return new Promise(resolve => {
      let done = false;
      const handler = e => {
        if (e.data && e.data.type === 'bloxx:html-response') {
          done = true;
          window.removeEventListener('message', handler);
          resolve(stripBridgeArtifacts(e.data.html));
        }
      };
      window.addEventListener('message', handler);
      sendMsg({ type: 'bloxx:get-html' });
      setTimeout(() => { if (!done) { window.removeEventListener('message', handler); resolve(null); } }, 3000);
    });
  }

  /** Primary HTML accessor — returns state.html (source of truth) */
  async function requestIframeHTML() {
    if (state.pendingSync) await state.pendingSync;
    return state.html || null;
  }

  function loadHTMLIntoIframe(html, onReady) {
    // Update source of truth
    state.html = stripBridgeArtifacts(html);
    state.version++;

    const f = iframe();
    if (!f) {
      if (onReady) onReady();
      return;
    }
    const htmlWithBridge = injectBridgeIntoHTML(state.html);
    f.onload = () => { if (onReady) onReady(); };
    try {
      const doc = f.contentDocument || f.contentWindow.document;
      doc.open();
      doc.write(htmlWithBridge);
      doc.close();
    } catch (e) {
      console.warn('doc.write failed, using srcdoc fallback:', e);
      f.srcdoc = htmlWithBridge;
    }
  }

  /* ─── PostMessage handlers (from bridge) ─── */
  window.addEventListener('message', e => {
    const m = e.data;
    if (!m || !m.type) return;

    switch (m.type) {
      case 'bloxx:sections-list':
        state.sections = m.sections || [];
        renderComponentList();
        // Refresh schema panel on page load
        getCurrentSchemas().then(schemas => renderSchemaPanel(schemas));
        break;
      case 'bloxx:element-selected':
        state.selected = m;
        // Granular text editing: only show full properties for text-editable elements
        // Containers just show selection outline + component controls
        if (isTextEditable(m.tag)) {
          renderProperties();
          showTab('properties');
          syncCodePanel();
        } else if (isContainer(m.tag)) {
          // For containers, find the parent section and show its fields instead
          const sectionIdx = findSectionIndexByElement(m);
          if (sectionIdx >= 0) {
            state.selectedSectionIdx = sectionIdx;
            renderSectionFields(state.sections[sectionIdx], sectionIdx);
            showTab('properties');
            // Highlight in component list
            $$('.comp-card', $('#component-list')).forEach((el, i) => {
              el.classList.toggle('active', i === sectionIdx);
            });
          } else {
            renderContainerProperties(m);
            showTab('properties');
          }
          syncCodePanel();
        } else {
          renderProperties();
          showTab('properties');
          syncCodePanel();
        }
        break;
      case 'bloxx:dirty':
        if (!state.dirty) pushSnapshot();
        setDirty(true);
        // Sync state.html from iframe (bridge is alive during inline edits)
        state.pendingSync = requestIframeHTMLDirect().then(html => {
          if (html) {
            state.html = html;
            state.version++;
            triggerAutoSave();
          }
          state.pendingSync = null;
        }).catch(() => { state.pendingSync = null; });
        break;
    }
  });

  /* ─── Load a page ─── */
  async function loadPage(pageName) {
    if (!pageName) return;
    state.page = pageName;
    state.selected = null;
    state.selectedSectionIdx = -1;
    state.html = '';
    state.version = 0;
    state.lastSavedVersion = 0;
    setDirty(false);
    const cpe = $('#code-panel-editor');
    if (cpe) cpe.value = '';
    snapshots.past = [];
    snapshots.future = [];
    updateUndoRedo();

    const u = new URL(location.href);
    u.searchParams.set('site', state.site);
    u.searchParams.set('page', pageName);
    history.replaceState({}, '', u);

    const loading = $('#canvas-loading');
    loading.classList.remove('hidden');

    // Fetch raw HTML from API in parallel with iframe visual load
    const htmlPromise = fetch(
      '/api/page-html?site=' + encodeURIComponent(state.site) + '&page=' + encodeURIComponent(pageName)
    ).then(r => r.ok ? r.json() : null).then(d => d?.html || null).catch(() => null);

    const f = iframe();
    f.src = '/preview/' + state.site + '/' + pageName;
    f.onload = async () => {
      loading.classList.add('hidden');
      const info = state.pages.find(p => p.name === pageName);
      if (info) state.etag = info.etag;

      // Populate state.html — prefer API fetch, fallback to bridge
      const rawHTML = await htmlPromise;
      if (rawHTML) {
        state.html = rawHTML;
      } else {
        console.warn('API fetch failed, falling back to bridge query');
        const bridgeHTML = await requestIframeHTMLDirect();
        if (bridgeHTML) state.html = bridgeHTML;
      }
      state.lastSavedVersion = state.version;

      if (state.html) {
        console.log('state.html populated:', state.html.length, 'chars');
        checkForRecovery();
      }

      startAutoSave();
      renderProperties();
      loadImages();
      setTimeout(populatePageMeta, 500);
    };

    $('#page-select').value = pageName;
  }

  function populatePageMeta() {
    const f = iframe();
    if (!f || !f.contentDocument) return;
    const doc = f.contentDocument;
    $('#meta-title').value = doc.querySelector('title')?.textContent || '';
    $('#meta-desc').value = doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    $('#meta-canonical').value = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
    $('#meta-og-image').value = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
  }

  /* ─── Init ─── */
  async function init() {
    state.pages = await fetchPages();
    const sel = $('#page-select');
    sel.innerHTML = '';
    if (state.pages.length === 0) {
      sel.innerHTML = '<option value="">No pages found</option>';
      $('#canvas-loading').classList.add('hidden');
      return;
    }
    for (const p of state.pages) {
      const o = document.createElement('option');
      o.value = p.name;
      o.textContent = p.name;
      sel.appendChild(o);
    }
    const target = state.page || state.pages[0].name;
    loadPage(target);
  }

  /* ─── Render: component list (left sidebar) ─── */
  function renderComponentList() {
    const c = $('#component-list');
    if (!state.sections.length) {
      c.innerHTML = '<div class="empty-state"><i class="bi bi-grid-3x3-gap"></i><p>No components found</p></div>';
      return;
    }
    c.innerHTML = '';
    state.sections.forEach((s, i) => {
      const div = document.createElement('div');
      div.className = 'comp-card' + (i === state.selectedSectionIdx ? ' active' : '');
      div.dataset.index = i;

      const heading = s.heading || s.ariaLabel || s.id || (s.tag + ' #' + s.index);
      const shortId = generateShortId(s);

      div.innerHTML =
        '<span class="grip"><i class="bi bi-grip-vertical"></i></span>' +
        '<div class="comp-info">' +
          '<div class="comp-name">' + esc(heading) + '</div>' +
          '<span class="comp-id">@' + esc(shortId) + '</span>' +
        '</div>' +
        '<span class="comp-tag">' + s.tag + '</span>' +
        '<span class="comp-actions">' +
          '<button class="action-btn" data-act="up" title="Move up"><i class="bi bi-chevron-up"></i></button>' +
          '<button class="action-btn" data-act="down" title="Move down"><i class="bi bi-chevron-down"></i></button>' +
          '<button class="action-btn danger" data-act="delete" title="Delete"><i class="bi bi-trash3"></i></button>' +
        '</span>';

      // Click to highlight in preview and show fields in Edit panel
      div.addEventListener('click', e => {
        if (e.target.closest('.action-btn')) return;
        state.selectedSectionIdx = i;
        sendMsg({ type: 'bloxx:highlight-section', index: i });
        $$('.comp-card', c).forEach(el => el.classList.remove('active'));
        div.classList.add('active');

        // Show editable fields for this section in the Edit panel
        renderSectionFields(s, i);
        showTab('properties');
        syncCodePanel();
      });

      // Move up
      div.querySelector('[data-act="up"]').addEventListener('click', async () => {
        if (i === 0) return;
        await pushSnapshot();
        sendMsg({ type: 'bloxx:swap-sections', indexA: i, indexB: i - 1 });
        setDirty(true);
      });
      // Move down
      div.querySelector('[data-act="down"]').addEventListener('click', async () => {
        if (i >= state.sections.length - 1) return;
        await pushSnapshot();
        sendMsg({ type: 'bloxx:swap-sections', indexA: i, indexB: i + 1 });
        setDirty(true);
      });
      // Delete
      div.querySelector('[data-act="delete"]').addEventListener('click', async () => {
        if (!confirm('Delete this component?')) return;
        await pushSnapshot();
        sendMsg({ type: 'bloxx:delete-section', index: i });
        setDirty(true);
      });

      c.appendChild(div);
    });

    // SortableJS drag-and-drop
    if (window.Sortable) {
      Sortable.create(c, {
        handle: '.grip',
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        onEnd: async evt => {
          if (evt.oldIndex !== evt.newIndex) {
            await pushSnapshot();
            sendMsg({ type: 'bloxx:move-section', fromIndex: evt.oldIndex, toIndex: evt.newIndex });
            setDirty(true);
          }
        },
      });
    }
  }

  /** Generate a short @id from section data */
  function generateShortId(section) {
    if (section.id) return section.id;
    const heading = (section.heading || '').toLowerCase().trim();
    if (heading) {
      return heading.replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 24);
    }
    const label = (section.ariaLabel || '').toLowerCase().trim();
    if (label) {
      return label.replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 24);
    }
    return section.tag + '-' + section.index;
  }

  /* ─── Render: section fields in Edit panel ─── */
  function renderSectionFields(section, sectionIndex) {
    const c = $('#props-content');
    const shortId = generateShortId(section);

    let h = '';
    h += '<div class="element-badge">@' + esc(shortId) + '</div>';
    h += '<div class="selector-path">' + esc(section.tag) + ' — Section #' + sectionIndex + '</div>';

    // Editable text fields extracted from the section
    const fields = section.fields || [];
    if (fields.length) {
      fields.forEach((f, fi) => {
        h += '<div class="field-group">';
        h += '<label class="field-label">' + esc(f.label) + '</label>';
        if (f.tag === 'img') {
          h += '<input class="field-input" data-field-idx="' + fi + '" data-field-attr="src" value="' + esc(f.src) + '">';
          h += '<input class="field-input" data-field-idx="' + fi + '" data-field-attr="alt" value="' + esc(f.alt) + '" placeholder="Alt text" style="margin-top:4px">';
        } else if (f.tag === 'a' && f.href) {
          h += '<input class="field-input" data-field-idx="' + fi + '" data-field-type="text" value="' + esc(f.text) + '">';
          h += '<input class="field-input" data-field-idx="' + fi + '" data-field-attr="href" value="' + esc(f.href) + '" placeholder="Link URL" style="margin-top:4px">';
        } else {
          const rows = (f.text || '').length > 80 ? 3 : 1;
          if (rows > 1) {
            h += '<textarea class="field-input" data-field-idx="' + fi + '" data-field-type="text" rows="' + rows + '">' + esc(f.text) + '</textarea>';
          } else {
            h += '<input class="field-input" data-field-idx="' + fi + '" data-field-type="text" value="' + esc(f.text) + '">';
          }
        }
        h += '</div>';
      });
    } else {
      h += '<div class="empty-state" style="padding:16px"><p>No editable fields found in this component</p></div>';
    }

    // Component HTML code (collapsible)
    h += '<div class="field-group">';
    h += '<label class="field-label">Component HTML <button class="code-toggle-btn" id="p-toggle-code"><i class="bi bi-code-slash"></i></button></label>';
    h += '<div id="p-code-wrap" class="code-wrap collapsed">';
    h += '<textarea class="field-input field-input-code code-editor" id="p-section-code" rows="10" spellcheck="false">Loading…</textarea>';
    h += '<button class="btn-action btn-action-outline" id="p-apply-section-code" style="margin-top:6px"><i class="bi bi-check-lg"></i> Apply HTML</button>';
    h += '</div></div>';

    // Delete section
    h += '<button class="btn-action btn-action-danger" id="p-delete-section" style="margin-top:8px">';
    h += '<i class="bi bi-trash3"></i> Delete Component</button>';

    c.innerHTML = h;

    // Load section HTML into code editor (async via bridge)
    requestSectionHTML(sectionIndex);

    // Bind field change handlers
    $$('[data-field-idx]', c).forEach(inp => {
      let timer = null;
      inp.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const fi = parseInt(inp.dataset.fieldIdx);
          const field = fields[fi];
          if (!field) return;
          await pushSnapshot();

          if (inp.dataset.fieldType === 'text') {
            sendMsg({ type: 'bloxx:update-text', selector: field.selector, value: inp.value });
          } else if (inp.dataset.fieldAttr) {
            sendMsg({ type: 'bloxx:update-attribute', selector: field.selector, attr: inp.dataset.fieldAttr, value: inp.value });
          }
          setDirty(true);
          scheduleSchemaUpdate(sectionIndex);
        }, 400);
      });
    });

    // Trigger schema update for this section
    scheduleSchemaUpdate(sectionIndex);

    // Code toggle
    $('#p-toggle-code')?.addEventListener('click', () => {
      $('#p-code-wrap').classList.toggle('collapsed');
    });

    // Apply section HTML code
    $('#p-apply-section-code')?.addEventListener('click', async () => {
      const code = $('#p-section-code').value;
      if (!code.trim()) return;
      await pushSnapshot();
      sendMsg({ type: 'bloxx:replace-section', index: sectionIndex, html: code });
      setDirty(true);
      toast('HTML applied', 'success');
    });

    // Delete section
    $('#p-delete-section')?.addEventListener('click', async () => {
      if (!confirm('Delete this component?')) return;
      await pushSnapshot();
      sendMsg({ type: 'bloxx:delete-section', index: sectionIndex });
      state.selectedSectionIdx = -1;
      renderProperties();
      setDirty(true);
    });
  }

  /** Request section HTML from bridge */
  function requestSectionHTML(index) {
    const handler = e => {
      if (e.data && e.data.type === 'bloxx:section-html-response' && e.data.index === index) {
        window.removeEventListener('message', handler);
        const el = $('#p-section-code');
        if (el) el.value = e.data.html || '';
      }
    };
    window.addEventListener('message', handler);
    sendMsg({ type: 'bloxx:get-section-html', index });
    setTimeout(() => window.removeEventListener('message', handler), 3000);
  }

  /* ─── Schema panel: live Haiku-powered updates ─── */
  let _schemaCache = [];
  let _schemaTimer = null;

  function getCurrentSchemas() {
    return new Promise(resolve => {
      let done = false;
      const handler = e => {
        if (e.data && e.data.type === 'bloxx:schemas-response') {
          done = true;
          window.removeEventListener('message', handler);
          _schemaCache = e.data.schemas || [];
          resolve(_schemaCache);
        }
      };
      window.addEventListener('message', handler);
      sendMsg({ type: 'bloxx:get-schemas' });
      setTimeout(() => { if (!done) { window.removeEventListener('message', handler); resolve(_schemaCache); } }, 3000);
    });
  }

  function injectSchemas(schemas) {
    _schemaCache = schemas;
    sendMsg({ type: 'bloxx:update-schemas', schemas });
    renderSchemaPanel(schemas);
  }

  function scheduleSchemaUpdate(sectionIndex) {
    clearTimeout(_schemaTimer);
    setSchemaStatus('updating');
    _schemaTimer = setTimeout(async () => {
      try {
        // Get section HTML via bridge
        const sectionHtml = await new Promise(resolve => {
          let done = false;
          const handler = e => {
            if (e.data && e.data.type === 'bloxx:section-html-response' && e.data.index === sectionIndex) {
              done = true;
              window.removeEventListener('message', handler);
              resolve(e.data.html || '');
            }
          };
          window.addEventListener('message', handler);
          sendMsg({ type: 'bloxx:get-section-html', index: sectionIndex });
          setTimeout(() => { if (!done) { window.removeEventListener('message', handler); resolve(''); } }, 3000);
        });

        if (!sectionHtml) { setSchemaStatus('error'); return; }

        const currentSchemas = await getCurrentSchemas();
        const section = state.sections[sectionIndex];
        const componentType = section ? (section.heading || section.tag) : 'unknown';

        const d = await api('/api/schema-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sectionHtml, currentSchemas, componentType, pageName: state.page }),
        });

        if (d.ok && d.schemas) {
          injectSchemas(d.schemas);
          setDirty(true);
          setSchemaStatus('uptodate');
        } else {
          setSchemaStatus('error');
        }
      } catch {
        setSchemaStatus('error');
      }
    }, 2000);
  }

  function setSchemaStatus(s) {
    const el = $('#schema-status');
    if (!el) return;
    const map = {
      updating: '<i class="bi bi-arrow-repeat schema-spin"></i> Updating…',
      uptodate: '<i class="bi bi-check-circle"></i> Up to date',
      error: '<i class="bi bi-exclamation-circle"></i> Error',
    };
    el.className = 'schema-status schema-status-' + s;
    el.innerHTML = map[s] || map.uptodate;
  }

  function renderSchemaPanel(schemas) {
    const container = $('#schema-cards');
    const raw = $('#schema-raw');
    if (!container) return;

    if (!schemas || schemas.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:16px"><i class="bi bi-braces"></i><p>No JSON-LD schemas found. Edit content to auto-generate.</p></div>';
      if (raw) raw.textContent = '[]';
      return;
    }

    let h = '';
    schemas.forEach((schema, i) => {
      const type = schema['@type'] || 'Thing';
      h += '<div class="schema-card">';
      h += '<div class="schema-type-badge">' + esc(Array.isArray(type) ? type.join(', ') : type) + '</div>';

      const skipKeys = new Set(['@context', '@type']);
      Object.entries(schema).forEach(([key, val]) => {
        if (skipKeys.has(key)) return;
        let display = val;
        if (typeof val === 'object') display = JSON.stringify(val);
        if (typeof display === 'string' && display.length > 80) display = display.substring(0, 80) + '…';
        h += '<div class="schema-prop"><span class="schema-prop-key">' + esc(key) + '</span><span class="schema-prop-val">' + esc(String(display)) + '</span></div>';
      });
      h += '</div>';
    });
    container.innerHTML = h;
    if (raw) raw.textContent = JSON.stringify(schemas, null, 2);
  }

  /* ─── Find section index by element selector ─── */
  function findSectionIndexByElement(element) {
    if (!element || !element.selector) return -1;
    // Try to match element to a section based on selector path
    const selector = element.selector.toLowerCase();
    for (let i = 0; i < state.sections.length; i++) {
      const section = state.sections[i];
      // Check if selector starts with section pattern (e.g., section:nth-of-type(N))
      const sectionPattern = `${section.tag}:nth-of-type(${section.index + 1})`.toLowerCase();
      if (selector.startsWith(sectionPattern) || selector.includes(`section:nth-of-type(${i + 1})`)) {
        return i;
      }
    }
    return -1;
  }

  /* ─── Render: container-only properties (minimal UI for divs/sections) ─── */
  function renderContainerProperties(el) {
    const c = $('#props-content');
    if (!el) {
      c.innerHTML = '<div class="empty-state"><i class="bi bi-cursor"></i><p>Click a component in the preview</p></div>';
      return;
    }

    let h = '';
    h += '<div class="element-badge container-badge"><i class="bi bi-bounding-box"></i> Container</div>';
    h += '<div class="selector-path">' + esc(el.selector) + '</div>';

    h += '<div class="info-box">';
    h += '<i class="bi bi-info-circle"></i> ';
    h += '<span>Click directly on text elements (headings, paragraphs, links) to edit them. ';
    h += 'Use the Components panel to manage this section.</span>';
    h += '</div>';

    // Classes
    h += '<div class="field-group"><label class="field-label">CSS Classes</label>';
    h += '<input class="field-input field-input-code" id="p-classes" value="' + esc(el.classes) + '"></div>';

    // Quick actions for container
    h += '<div class="field-group"><label class="field-label">Container Actions</label>';
    h += '<div class="container-actions">';
    h += '<button class="btn-action btn-action-outline" id="p-select-parent" title="Select parent element"><i class="bi bi-box-arrow-up"></i> Parent</button>';
    h += '<button class="btn-action btn-action-outline" id="p-select-first-text" title="Select first text element"><i class="bi bi-cursor-text"></i> Edit Text</button>';
    h += '</div></div>';

    // Code (collapsed by default)
    h += '<div class="field-group">';
    h += '<label class="field-label">HTML <button class="code-toggle-btn" id="p-toggle-code"><i class="bi bi-code-slash"></i></button></label>';
    h += '<div id="p-code-wrap" class="code-wrap collapsed">';
    h += '<textarea class="field-input field-input-code code-editor" id="p-code" rows="10" spellcheck="false">' + esc(el.html) + '</textarea>';
    h += '<button class="btn-action btn-action-outline" id="p-apply-code" style="margin-top:6px"><i class="bi bi-check-lg"></i> Apply HTML</button>';
    h += '</div></div>';

    c.innerHTML = h;

    // Bind handlers
    function bindInput(id, fn) {
      const inp = $('#' + id);
      if (!inp) return;
      let timer = null;
      inp.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          await pushSnapshot();
          fn(inp.value);
          setDirty(true);
        }, 300);
      });
    }

    bindInput('p-classes', v => sendMsg({ type: 'bloxx:update-classes', selector: el.selector, value: v }));

    $('#p-toggle-code')?.addEventListener('click', () => $('#p-code-wrap').classList.toggle('collapsed'));

    $('#p-apply-code')?.addEventListener('click', async () => {
      const code = $('#p-code').value;
      if (!code.trim()) return;
      await pushSnapshot();
      sendMsg({ type: 'bloxx:replace-element', selector: el.selector, html: code });
      setDirty(true);
      toast('HTML applied', 'success');
    });

    $('#p-select-parent')?.addEventListener('click', () => {
      sendMsg({ type: 'bloxx:select-parent', selector: el.selector });
    });

    $('#p-select-first-text')?.addEventListener('click', () => {
      sendMsg({ type: 'bloxx:select-first-text', selector: el.selector });
    });
  }

  /* ─── Render: properties panel (element click) ─── */
  function renderProperties() {
    const c = $('#props-content');
    const el = state.selected;
    if (!el) {
      c.innerHTML = '<div class="empty-state"><i class="bi bi-cursor"></i><p>Click a component in the preview</p></div>';
      return;
    }

    let h = '';
    h += '<div class="element-badge">&lt;' + el.tag + '&gt;</div>';
    h += '<div class="selector-path">' + esc(el.selector) + '</div>';

    // Text content
    if (el.text && el.tag !== 'img') {
      h += '<div class="field-group"><label class="field-label">Text Content</label>';
      h += '<textarea class="field-input" id="p-text" rows="3">' + esc(el.text) + '</textarea></div>';
    }

    // Image
    if (el.tag === 'img') {
      h += '<div class="field-group"><label class="field-label">Image Source</label>';
      h += '<input class="field-input" id="p-src" value="' + esc(el.attributes?.src) + '"></div>';
      h += '<div class="field-group"><label class="field-label">Alt Text</label>';
      h += '<input class="field-input" id="p-alt" value="' + esc(el.attributes?.alt) + '"></div>';
    }

    // Link
    if (el.tag === 'a') {
      h += '<div class="field-group"><label class="field-label">Link URL</label>';
      h += '<input class="field-input" id="p-href" value="' + esc(el.attributes?.href) + '"></div>';
    }

    // Classes
    h += '<div class="field-group"><label class="field-label">CSS Classes</label>';
    h += '<input class="field-input field-input-code" id="p-classes" value="' + esc(el.classes) + '"></div>';

    // Code
    h += '<div class="field-group">';
    h += '<label class="field-label">HTML <button class="code-toggle-btn" id="p-toggle-code"><i class="bi bi-code-slash"></i></button></label>';
    h += '<div id="p-code-wrap" class="code-wrap collapsed">';
    h += '<textarea class="field-input field-input-code code-editor" id="p-code" rows="10" spellcheck="false">' + esc(el.html) + '</textarea>';
    h += '<button class="btn-action btn-action-outline" id="p-apply-code" style="margin-top:6px"><i class="bi bi-check-lg"></i> Apply HTML</button>';
    h += '</div></div>';

    // Move
    h += '<div class="field-group"><label class="field-label">Position</label>';
    h += '<div class="move-btns">';
    h += '<button class="btn-move" id="p-move-up"><i class="bi bi-arrow-up"></i> Up</button>';
    h += '<button class="btn-move" id="p-move-down"><i class="bi bi-arrow-down"></i> Down</button>';
    h += '</div></div>';

    // Delete
    h += '<button class="btn-action btn-action-danger" id="p-delete" style="margin-top:8px">';
    h += '<i class="bi bi-trash3"></i> Delete Element</button>';

    c.innerHTML = h;

    // Bind handlers
    function bindInput(id, fn) {
      const inp = $('#' + id);
      if (!inp) return;
      let timer = null;
      inp.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          await pushSnapshot();
          fn(inp.value);
          setDirty(true);
        }, 300);
      });
    }

    bindInput('p-text', v => sendMsg({ type: 'bloxx:update-text', selector: el.selector, value: v }));
    bindInput('p-src', v => sendMsg({ type: 'bloxx:update-attribute', selector: el.selector, attr: 'src', value: v }));
    bindInput('p-alt', v => sendMsg({ type: 'bloxx:update-attribute', selector: el.selector, attr: 'alt', value: v }));
    bindInput('p-href', v => sendMsg({ type: 'bloxx:update-attribute', selector: el.selector, attr: 'href', value: v }));
    bindInput('p-classes', v => sendMsg({ type: 'bloxx:update-classes', selector: el.selector, value: v }));

    $('#p-toggle-code')?.addEventListener('click', () => $('#p-code-wrap').classList.toggle('collapsed'));

    $('#p-apply-code')?.addEventListener('click', async () => {
      const code = $('#p-code').value;
      if (!code.trim()) return;
      await pushSnapshot();
      sendMsg({ type: 'bloxx:replace-element', selector: el.selector, html: code });
      setDirty(true);
      toast('HTML applied', 'success');
    });

    $('#p-move-up')?.addEventListener('click', async () => {
      await pushSnapshot();
      sendMsg({ type: 'bloxx:move-element', selector: el.selector, direction: 'up' });
      setDirty(true);
    });
    $('#p-move-down')?.addEventListener('click', async () => {
      await pushSnapshot();
      sendMsg({ type: 'bloxx:move-element', selector: el.selector, direction: 'down' });
      setDirty(true);
    });

    $('#p-delete')?.addEventListener('click', async () => {
      if (!confirm('Delete this element?')) return;
      await pushSnapshot();
      sendMsg({ type: 'bloxx:delete-element', selector: el.selector });
      state.selected = null;
      const cpe = $('#code-panel-editor');
      if (cpe) cpe.value = '';
      renderProperties();
      setDirty(true);
    });
  }

  /* ─── Sidebar tabs ─── */
  function showTab(name) {
    $$('.sidebar-tab').forEach(t => t.classList.toggle('active', t.dataset.panel === name));
    $$('.sidebar-panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + name));
  }
  $$('.sidebar-tab').forEach(t => t.addEventListener('click', () => showTab(t.dataset.panel)));

  // Schema raw toggle
  $('#schema-toggle-raw')?.addEventListener('click', () => {
    $('#schema-raw-wrap')?.classList.toggle('collapsed');
  });

  /* ─── Viewport toggles ─── */
  $$('#viewport-group .toolbar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#viewport-group .toolbar-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $('#canvas-frame').className = 'canvas-frame viewport-' + btn.dataset.vp;
    });
  });

  /* ─── Page & site selectors ─── */
  $('#page-select').addEventListener('change', e => { if (e.target.value) loadPage(e.target.value); });
  $('#site-select').addEventListener('change', e => { state.site = e.target.value; init(); });

  /* ─── Toolbar buttons ─── */
  $('#btn-undo').addEventListener('click', undo);
  $('#btn-redo').addEventListener('click', redo);

  // Save — auto-enhances via Claude
  $('#btn-save').addEventListener('click', async () => {
    const html = await requestIframeHTML();
    if (html) saveToR2(html);
  });

  // Update Schema — saves + re-enhances
  $('#btn-schema')?.addEventListener('click', async () => {
    toast('Updating schema…');
    const html = await requestIframeHTML();
    if (html) saveToR2(html);
  });

  // Deploy
  $('#btn-deploy').addEventListener('click', () => {
    if (confirm('Deploy all draft pages to live?')) deployToLive();
  });

  /* ─── Component Library Modal (Xano-backed) ─── */
  let libraryComponents = []; // fetched from Xano

  async function fetchLibraryComponents(type) {
    try {
      let url = '/api/components';
      if (type && type !== 'all') url += '?type=' + encodeURIComponent(type);
      const d = await api(url);
      libraryComponents = d.components || [];
    } catch {
      libraryComponents = [];
    }
    return libraryComponents;
  }

  const typeIcons = {
    hero: 'bi-megaphone', features: 'bi-grid-3x3', pricing: 'bi-currency-dollar',
    cta: 'bi-megaphone', testimonial: 'bi-chat-quote', faq: 'bi-question-circle',
    footer: 'bi-layout-text-window-reverse', form: 'bi-envelope', article: 'bi-file-text',
    product: 'bi-box',
  };

  function renderLibrary(filter, search) {
    const grid = $('#library-grid');
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="spinner"></div><p>Loading…</p></div>';

    fetchLibraryComponents(filter).then(items => {
      grid.innerHTML = '';
      const q = (search || '').toLowerCase();
      const filtered = items.filter(c => {
        if (q && !c.name.toLowerCase().includes(q) && !(c.short_id || '').toLowerCase().includes(q)) return false;
        return true;
      });
      filtered.forEach(c => {
        const cat = (c.type || '').toLowerCase();
        const icon = typeIcons[cat] || 'bi-grid-3x3-gap';
        const card = document.createElement('div');
        card.className = 'lib-card';
        card.innerHTML =
          '<div class="lib-card-preview"><i class="bi ' + icon + '"></i></div>' +
          '<div class="lib-card-body">' +
            '<div class="lib-card-name">' + esc(c.name) + '</div>' +
            '<span class="lib-card-id">@' + esc(c.short_id || '') + '</span>' +
            '<span class="lib-card-cat">' + esc(c.type || '') + '</span>' +
          '</div>';
        card.addEventListener('click', () => insertLibraryComponent(c));
        grid.appendChild(card);
      });
      if (!filtered.length) {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><p>No components match</p></div>';
      }
    });
  }

  async function insertLibraryComponent(comp, atIndex) {
    closeAllModals();

    const insertionId = 'ins-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

    // Resolve HTML first (before any UI feedback)
    let html = null;
    if (comp.html && !comp.html.includes('{{')) {
      html = comp.html;
    } else {
      toast('Loading ' + comp.name + '…');
      try {
        const d = await api('/api/components?action=render&uid=' + encodeURIComponent(comp.short_id));
        if (!d.ok || !d.html) {
          toast('Failed: ' + (d.error || 'Render returned no HTML'), 'error');
          return;
        }
        if (d.html.includes('{{')) {
          toast('This component requires configuration and cannot be inserted directly', 'error');
          return;
        }
        html = d.html;
      } catch (err) {
        toast('Network error loading component — check connection and retry', 'error');
        return;
      }
    }

    // Register listener BEFORE sending message (prevents race)
    const confirmed = new Promise((resolve) => {
      const timeout = setTimeout(() => resolve({ success: false, error: 'timeout' }), 3000);
      const handler = (e) => {
        if (e.data?.type === 'bloxx:section-inserted' && e.data.insertionId === insertionId) {
          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          resolve(e.data);
        }
      };
      window.addEventListener('message', handler);
    });

    await pushSnapshot();
    toast('Inserting ' + comp.name + '…');

    sendMsg(atIndex != null
      ? { type: 'bloxx:insert-section-at', html, index: atIndex, insertionId }
      : { type: 'bloxx:append-section', html, insertionId });

    // Wait for bridge confirmation
    const result = await confirmed;
    if (result.success) {
      if (result.html) {
        state.html = result.html;
        state.version++;
      }
      setDirty(true);
      toast(comp.name + ' added — save to keep', 'success');
    } else {
      // Rollback: pop the snapshot we pushed
      if (state.undoStack.length) {
        const prev = state.undoStack.pop();
        if (prev?.html) { state.html = prev.html; reloadIframe(); }
      }
      toast('Failed to insert ' + comp.name + (result.error === 'timeout' ? ' (no response from page)' : ''), 'error');
    }
  }

  // Open library modal
  $('#btn-add-component')?.addEventListener('click', () => {
    $('#library-modal').hidden = false;
    renderLibrary('all', '');
    $('#library-search').value = '';
    $$('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === 'all'));
  });
  $('#library-close')?.addEventListener('click', () => { $('#library-modal').hidden = true; });
  $('#library-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) $('#library-modal').hidden = true; });

  // Category filter
  $$('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderLibrary(btn.dataset.cat, $('#library-search').value);
    });
  });

  // Search
  $('#library-search')?.addEventListener('input', e => {
    const activeCat = $('.cat-btn.active')?.dataset.cat || 'all';
    renderLibrary(activeCat, e.target.value);
  });

  // "Create New Component" button in library → opens create modal
  $('#library-create')?.addEventListener('click', () => {
    $('#library-modal').hidden = true;
    $('#create-modal').hidden = false;
    $('#create-prompt').value = '';
    $('#create-prompt').focus();
    $('#create-loading').hidden = true;
  });

  // Create Component modal
  $('#create-close')?.addEventListener('click', () => { $('#create-modal').hidden = true; });
  $('#create-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) $('#create-modal').hidden = true; });

  $('#create-go')?.addEventListener('click', async () => {
    const prompt = $('#create-prompt').value.trim();
    const type = $('#create-type')?.value || 'Hero';
    if (!prompt) { toast('Describe the component', 'warning'); return; }

    $('#create-loading').hidden = false;
    const modalBody = $('#create-modal').querySelector('.modal-body');
    if (modalBody) modalBody.style.display = 'none';

    try {
      const d = await api('/api/components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: type + ' Component', type, category: type, prompt }),
      });

      if (d.ok && d.html) {
        await pushSnapshot();
        sendMsg({ type: 'bloxx:append-section', html: d.html });
        setDirty(true);
        const scoreMsg = d.score ? ' (score: ' + d.score + ')' : '';
        toast('Component created' + scoreMsg + ' — save to enhance', 'success');
        $('#create-modal').hidden = true;
      } else {
        toast('Generation failed: ' + (d.error || 'unknown'), 'error');
      }
    } catch (err) {
      toast('Generation failed', 'error');
    }
    if (modalBody) modalBody.style.display = '';
    $('#create-loading').hidden = true;
  });

  function closeAllModals() {
    $('#library-modal').hidden = true;
    $('#create-modal').hidden = true;
    $('#newpage-modal').hidden = true;
  }

  /* ─── New Page Modal ─── */
  $('#btn-new-page')?.addEventListener('click', () => {
    $('#newpage-modal').hidden = false;
    $('#newpage-name').value = '';
    $('#newpage-brand').value = '';
    $('#newpage-loading').hidden = true;
    const modalBody = $('#newpage-modal').querySelector('.modal-body');
    if (modalBody) modalBody.style.display = '';
    $('#newpage-name').focus();
  });
  $('#newpage-close')?.addEventListener('click', () => { $('#newpage-modal').hidden = true; });
  $('#newpage-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) $('#newpage-modal').hidden = true; });

  $('#newpage-go')?.addEventListener('click', async () => {
    const pageName = $('#newpage-name').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const template = $('#newpage-template').value;
    const brandContext = $('#newpage-brand').value.trim();

    if (!pageName) { toast('Enter a page name', 'warning'); return; }

    $('#newpage-loading').hidden = false;
    const modalBody = $('#newpage-modal').querySelector('.modal-body');
    if (modalBody) modalBody.style.display = 'none';

    try {
      const d = await api('/api/pages-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site: state.site, pageName, template, brandContext: brandContext || undefined }),
      });

      if (d.ok) {
        const scoreMsg = d.score ? ' (score: ' + d.score + ')' : '';
        toast('Page "' + pageName + '" created' + scoreMsg, 'success');
        $('#newpage-modal').hidden = true;
        // Reload pages and navigate to the new one
        state.pages = await fetchPages();
        const sel = $('#page-select');
        sel.innerHTML = '';
        for (const p of state.pages) {
          const o = document.createElement('option');
          o.value = p.name;
          o.textContent = p.name;
          sel.appendChild(o);
        }
        loadPage(pageName);
      } else {
        toast('Failed: ' + (d.error || 'unknown'), 'error');
      }
    } catch (err) {
      toast('Page creation failed', 'error');
    }
    if (modalBody) modalBody.style.display = '';
    $('#newpage-loading').hidden = true;
  });

  /* ─── Page meta apply ─── */
  $('#btn-apply-meta')?.addEventListener('click', async () => {
    await pushSnapshot();
    const f = iframe();
    if (!f || !f.contentDocument) return;
    const doc = f.contentDocument;

    const title = $('#meta-title').value;
    const desc = $('#meta-desc').value;
    const canonical = $('#meta-canonical').value;
    const ogImage = $('#meta-og-image').value;

    const tEl = doc.querySelector('title');
    if (tEl) tEl.textContent = title;
    const dEl = doc.querySelector('meta[name="description"]');
    if (dEl) dEl.setAttribute('content', desc);
    const ogT = doc.querySelector('meta[property="og:title"]');
    if (ogT) ogT.setAttribute('content', title);
    const ogD = doc.querySelector('meta[property="og:description"]');
    if (ogD) ogD.setAttribute('content', desc);
    const cEl = doc.querySelector('link[rel="canonical"]');
    if (cEl) cEl.setAttribute('href', canonical);
    const ogI = doc.querySelector('meta[property="og:image"]');
    if (ogI) ogI.setAttribute('content', ogImage);

    setDirty(true);
    toast('Page meta updated — save to persist', 'success');
  });

  /* ─── Keyboard shortcuts ─── */
  document.addEventListener('keydown', e => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    if (mod && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
    if (mod && e.key === 'y') { e.preventDefault(); redo(); }
    if (mod && e.key === 's') {
      e.preventDefault();
      requestIframeHTML().then(html => { if (html) saveToR2(html); });
    }
    if (mod && e.key === 'k') {
      e.preventDefault();
      $('#library-modal').hidden = false;
      renderLibrary('all', '');
    }
    if (e.key === 'Escape') closeAllModals();
  });

  /* ─── Image upload ─── */
  const dropzone = $('#upload-dropzone');
  const fileInput = $('#file-input');

  dropzone?.addEventListener('click', () => fileInput.click());
  dropzone?.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone?.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) uploadImage(e.dataTransfer.files[0]);
  });
  fileInput?.addEventListener('change', () => {
    if (fileInput.files[0]) uploadImage(fileInput.files[0]);
    fileInput.value = '';
  });

  async function uploadImage(file) {
    toast('Uploading…');
    const fd = new FormData();
    fd.append('site', state.site);
    fd.append('file', file);
    const res = await fetch('/api/images', { method: 'POST', body: fd });
    const d = await res.json();
    if (d.ok) {
      toast('Image uploaded', 'success');
      loadImages();
      return d.url;
    }
    toast('Upload failed: ' + (d.error || 'unknown'), 'error');
    return null;
  }

  async function loadImages() {
    const d = await api('/api/images?site=' + encodeURIComponent(state.site));
    const grid = $('#image-grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (const img of (d.images || [])) {
      const wrap = document.createElement('div');
      wrap.className = 'image-thumb';
      wrap.innerHTML = '<img src="' + esc(img.url) + '" alt="uploaded" loading="lazy"><span class="copy-badge">Click to copy</span>';
      wrap.addEventListener('click', async () => {
        await navigator.clipboard.writeText(img.url);
        toast('URL copied', 'success');
      });
      grid.appendChild(wrap);
    }
  }

  /* ─── Collab (best-effort) ─── */
  let ws = null;
  function connectCollab() {
    if (ws) { ws.close(); ws = null; }
    if (!state.page) return;
    try {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const name = 'User-' + Math.random().toString(36).slice(2, 6);
      ws = new WebSocket(proto + '//' + location.host + '/api/collab?site=' + state.site + '&page=' + state.page + '&user=' + name);
      ws.onmessage = e => {
        try {
          const m = JSON.parse(e.data);
          if (m.type === 'users') renderCollabUsers(m.users);
          if (m.type === 'bloxx:remote-save') {
            state.etag = m.etag;
            toast('Another user saved this page', 'warning');
          }
        } catch {}
      };
      ws.onclose = () => setTimeout(() => { if (state.page) connectCollab(); }, 5000);
    } catch {}
  }

  function renderCollabUsers(users) {
    const c = $('#collab-avatars');
    if (!c) return;
    c.innerHTML = '';
    (users || []).forEach(u => {
      const d = document.createElement('div');
      d.className = 'collab-avatar';
      d.style.background = u.color || '#6366f1';
      d.textContent = (u.name || '?')[0].toUpperCase();
      d.title = u.name;
      c.appendChild(d);
    });
  }

  /* ─── Audit Gamification State ─── */
  let _fixCombo = 0;
  let _auditSessionFixes = 0;

  function getAuditHistoryKey() {
    return `audit-history-${state.site}-${state.page}`;
  }

  function getAuditHistory() {
    try { return JSON.parse(localStorage.getItem(getAuditHistoryKey()) || '[]'); }
    catch { return []; }
  }

  function pushAuditHistory(score, delta) {
    const history = getAuditHistory();
    history.push({ score, delta, ts: Date.now() });
    if (history.length > 50) history.shift();
    localStorage.setItem(getAuditHistoryKey(), JSON.stringify(history));
    return history;
  }

  function renderSparkline(history) {
    const el = document.getElementById('audit-sparkline');
    if (!el) return;
    const recent = history.slice(-10);
    if (recent.length < 2) { el.innerHTML = ''; return; }
    const scores = recent.map(h => h.score);
    const min = Math.min(...scores, 0);
    const max = Math.max(...scores, 100);
    const range = max - min || 1;
    const w = 120, h = 24, pad = 2;
    const points = scores.map((s, i) => {
      const x = pad + (i / (scores.length - 1)) * (w - pad * 2);
      const y = h - pad - ((s - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    });
    const last = scores[scores.length - 1];
    const color = last >= 90 ? 'var(--bx-success)' : last >= 75 ? 'var(--bx-primary)' : last >= 50 ? 'var(--bx-warning)' : 'var(--bx-danger)';
    el.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${points.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${points[points.length-1].split(',')[0]}" cy="${points[points.length-1].split(',')[1]}" r="3" fill="${color}"/></svg>`;
  }

  function updateStreakBadge(history) {
    const el = document.getElementById('audit-streak');
    if (!el) return;
    let streak = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].delta > 0) streak++;
      else break;
    }
    if (streak >= 2) {
      el.textContent = streak + '-fix streak!';
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  }

  function showConfetti() {
    const ring = document.querySelector('.audit-score-ring');
    if (!ring) return;
    const container = document.createElement('div');
    container.className = 'confetti-container';
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    for (let i = 0; i < 8; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-particle';
      p.style.background = colors[i % colors.length];
      p.style.left = (Math.random() * 60 - 30) + 'px';
      p.style.animationDelay = (Math.random() * 0.3) + 's';
      container.appendChild(p);
    }
    ring.style.position = 'relative';
    ring.appendChild(container);
    setTimeout(() => container.remove(), 1500);
  }

  function showLevelUp() {
    const el = document.getElementById('audit-level-up');
    if (!el) return;
    el.textContent = 'Level Up!';
    el.hidden = false;
    setTimeout(() => { el.hidden = true; }, 3000);
  }

  function showPersonalBest() {
    const existing = document.querySelector('.personal-best-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'personal-best-toast';
    toast.textContent = 'New Personal Best!';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  function showComboBadge(count) {
    const ring = document.querySelector('.audit-score-ring');
    if (!ring) return;
    ring.style.position = 'relative';
    let badge = ring.querySelector('.combo-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'combo-badge';
      ring.appendChild(badge);
    }
    badge.textContent = count + 'x combo';
    badge.style.animation = 'none';
    badge.offsetHeight; // reflow
    badge.style.animation = '';
  }

  /* ─── Page Audit (local audit-details scoring) ─── */
  async function runPageAudit() {
    _fixCombo = 0;
    if (!state.page) {
      toast('Please select a page first', 'error');
      return;
    }

    // Show modal with loading state
    $('#audit-modal').hidden = false;
    $('#audit-loading').hidden = false;
    $('#audit-results').hidden = true;
    $('#audit-error').hidden = true;

    try {
      // Use state.html directly — avoids iframe timing issues
      const currentHtml = state.html || await requestIframeHTML();
      if (!currentHtml) {
        throw new Error('Could not get page HTML');
      }

      const detailsData = await api('/api/audit-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: currentHtml, pageName: state.page })
      });

      // Hide loading, show results
      $('#audit-loading').hidden = true;
      $('#audit-results').hidden = false;

      if (detailsData.ok) {
        const scores = detailsData.scores || {};
        const overallScore = detailsData.summary?.overallScore ?? 0;
        const roundedScore = Math.round(overallScore);
        _lastAuditScore = roundedScore;

        // Update main score ring
        updateScoreRing(roundedScore);
        $('#audit-score-label').textContent = detailsData.summary?.grade || getScoreLabel(roundedScore);

        // Store breakdowns for tooltip rendering
        _scoreBreakdowns = detailsData.scoreBreakdowns || {};

        // Render score cards grid from local scores
        const scoresGrid = $('#audit-scores-grid');
        scoresGrid.innerHTML = renderScoreCard(scores.meta, 'Meta', 'meta') +
          renderScoreCard(scores.content, 'Content', 'content') +
          renderScoreCard(scores.schema, 'Schema', 'schema') +
          renderScoreCard(scores.headings, 'Headings', 'headings') +
          renderScoreCard(scores.semantic, 'Semantic', 'semantic') +
          renderScoreCard(scores.images, 'Images', 'images') +
          renderScoreCard(scores.links, 'Links', 'links');

        console.log('[Audit] Local scores:', JSON.stringify(scores), 'Overall:', roundedScore);

        // Gamification: push initial score to history + render sparkline
        const history = pushAuditHistory(roundedScore, 0);
        renderSparkline(history);
        updateStreakBadge(history);

        renderDetailedFindings(detailsData);
      } else {
        $('#audit-issues-section').hidden = true;
        $('#audit-quickwins-section').hidden = true;
        $('#audit-details-dropdown').hidden = true;
      }

    } catch (err) {
      console.error('Audit error:', err);
      $('#audit-loading').hidden = true;
      $('#audit-error').hidden = false;
      $('#audit-error-message').textContent = err.message || 'Failed to connect to audit service';
    }
  }

  function updateScoreRing(roundedScore) {
    $('#audit-score-value').textContent = roundedScore;
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (roundedScore / 100) * circumference;
    const circleEl = $('#audit-score-circle');
    circleEl.style.strokeDashoffset = offset;
    let color = 'var(--bx-success)';
    if (roundedScore < 50) color = 'var(--bx-danger)';
    else if (roundedScore < 75) color = 'var(--bx-warning)';
    else if (roundedScore < 90) color = 'var(--bx-primary)';
    circleEl.style.stroke = color;
  }

  // Store last audit data for re-running
  let _lastAuditAllFixes = [];

  function renderDetailedFindings(data) {
    const topIssues = data.topIssues || [];
    const allFixes = data.allFixes || [];
    _lastAuditAllFixes = allFixes;

    // Dedup key: fixType + issue text
    const fixKey = (f) => (f.fixType || '') + '||' + (f.issue || '');

    // Filter quickWins to exclude items already in topIssues
    const topKeys = new Set(topIssues.map(fixKey));
    const quickWins = (data.quickWins || []).filter(f => !topKeys.has(fixKey(f)));

    // Filter detailed report to exclude items already shown in topIssues or quickWins
    const shownKeys = new Set([...topIssues, ...quickWins].map(fixKey));
    const remainingFixes = allFixes.filter(f => !shownKeys.has(fixKey(f)));

    // Count fixes per tier
    const clientCount = allFixes.filter(f => f.fixMethod === 'client' && f.fixType).length;
    const pythonCount = allFixes.filter(f => f.fixMethod === 'python' && f.fixType).length;
    const llmCount = allFixes.filter(f => f.fixMethod === 'llm' && f.fixType).length;
    const componentCount = allFixes.filter(f => f.fixMethod === 'component' && f.fixType).length;
    const imageGenCount = allFixes.filter(f => f.fixMethod === 'image_gen' && f.fixType).length;

    // Top Issues section
    const issuesSection = $('#audit-issues-section');
    const issuesList = $('#audit-top-issues');

    // 3-tier Fix All banner
    let fixAllBanner = '';
    if (clientCount > 0 || pythonCount > 0 || llmCount > 0 || imageGenCount > 0) {
      fixAllBanner = '<div class="audit-fix-all-banner three-tier">';
      if (clientCount > 0) {
        fixAllBanner += `<div class="fix-all-group">
          <span>${clientCount} instant fix${clientCount > 1 ? 'es' : ''}</span>
          <button class="audit-fix-all-btn" id="audit-fix-all-client"><i class="bi bi-wrench"></i> Fix All (Free)</button>
        </div>`;
      }
      if (pythonCount > 0) {
        fixAllBanner += `<div class="fix-all-group">
          <span>${pythonCount} schema fix${pythonCount > 1 ? 'es' : ''}</span>
          <button class="audit-fix-all-btn schema" id="audit-fix-all-python"><i class="bi bi-braces"></i> Generate All Schemas</button>
        </div>`;
      }
      if (llmCount > 0) {
        const estCost = (llmCount * 0.001).toFixed(3);
        fixAllBanner += `<div class="fix-all-group">
          <span>${llmCount} content fix${llmCount > 1 ? 'es' : ''}</span>
          <button class="audit-fix-all-btn llm" id="audit-fix-all-llm"><i class="bi bi-stars"></i> Generate All (~$${estCost})</button>
        </div>`;
      }
      if (imageGenCount > 0) {
        const estCost = (imageGenCount * 0.01).toFixed(2);
        fixAllBanner += `<div class="fix-all-group">
          <span>${imageGenCount} image fix${imageGenCount > 1 ? 'es' : ''}</span>
          <button class="audit-fix-all-btn image-gen" id="audit-fix-all-image-gen"><i class="bi bi-image"></i> Generate All (~$${estCost})</button>
        </div>`;
      }
      fixAllBanner += '</div>';
    }

    if (topIssues.length > 0) {
      issuesSection.hidden = false;
      issuesList.innerHTML = fixAllBanner + topIssues.map(renderIssueCard).join('');
    } else {
      issuesSection.hidden = true;
    }

    // Quick Wins section
    const quickWinsSection = $('#audit-quickwins-section');
    const quickWinsList = $('#audit-quick-wins');
    if (quickWins.length > 0) {
      quickWinsSection.hidden = false;
      quickWinsList.innerHTML = quickWins.map(item => renderIssueCard({ ...item, severity: 'low' })).join('');
    } else {
      quickWinsSection.hidden = true;
    }

    // Score Boosters section (component recommendations)
    const componentRecs = data.componentRecommendations || [];
    let boostersContainer = document.getElementById('audit-boosters-section');
    if (!boostersContainer) {
      boostersContainer = document.createElement('div');
      boostersContainer.id = 'audit-boosters-section';
      boostersContainer.innerHTML = '<h3 style="font-size:14px;font-weight:700;margin:16px 0 8px;color:#7c3aed;"><i class="bi bi-rocket-takeoff"></i> Score Boosters</h3><div id="audit-boosters-list"></div>';
      const quickWinsEl = $('#audit-quickwins-section');
      if (quickWinsEl) quickWinsEl.parentElement.insertBefore(boostersContainer, quickWinsEl.nextSibling);
    }
    if (componentRecs.length > 0) {
      boostersContainer.hidden = false;
      document.getElementById('audit-boosters-list').innerHTML = componentRecs.map(rec => {
        const btn = rec.fixType ? `<button class="audit-fix-btn" data-fix-type="${esc(rec.fixType)}" data-fix-method="component" data-category="${esc(rec.category || '')}"><i class="bi bi-plus-lg"></i> Add Component</button>` : '';
        return `<div class="audit-issue-card severity-info" style="border-left:3px solid #7c3aed;">
          <div class="audit-issue-title">${esc(rec.issue)}</div>
          <div class="audit-issue-impact">${esc(rec.impact)}</div>
          <div class="audit-issue-footer">${btn}</div>
        </div>`;
      }).join('');
    } else {
      boostersContainer.hidden = true;
    }

    // Detailed Report dropdown
    const fixCount = $('#audit-fix-count');
    fixCount.textContent = `${remainingFixes.length} items`;

    const fixesList = $('#audit-all-fixes');
    fixesList.innerHTML = remainingFixes.map(fix => {
      const fixBtn = fix.fixType ? renderFixButton(fix) : '';
      return `
      <div class="audit-fix-item" data-category="${fix.category}">
        <div class="audit-fix-icon ${fix.severity}">
          <i class="bi ${getSeverityIcon(fix.severity)}"></i>
        </div>
        <div class="audit-fix-content">
          <div class="audit-fix-title">${esc(fix.issue)}</div>
          <div class="audit-fix-detail">${esc(fix.impact)}</div>
        </div>
        ${fixBtn}
      </div>
    `}).join('');

    // Setup category filter tabs
    setupAuditCategoryTabs();

    // Bind fix buttons
    bindAuditFixButtons();
  }

  function renderFixButton(item) {
    if (!item.fixType) return '';
    const method = item.fixMethod || 'client';
    let label, icon, costLabel;
    switch (method) {
      case 'client':
        label = 'Fix'; icon = 'bi-wrench'; costLabel = 'Free';
        break;
      case 'python':
        label = 'Generate Schema'; icon = 'bi-braces'; costLabel = 'Free';
        break;
      case 'llm':
        label = 'Generate Fix'; icon = 'bi-stars'; costLabel = '~$0.001';
        break;
      case 'image_gen':
        label = 'Generate Image'; icon = 'bi-image'; costLabel = '~$0.01';
        break;
      case 'component':
        label = 'Add Component'; icon = 'bi-plus-lg'; costLabel = '';
        break;
      default:
        label = 'Fix'; icon = 'bi-wrench'; costLabel = '';
    }
    return `<button class="audit-fix-btn" data-fix-type="${esc(item.fixType)}" data-fix-method="${esc(method)}" data-category="${esc(item.category || '')}">
      <i class="bi ${icon}"></i> ${label}
      ${costLabel ? `<span class="fix-cost">${costLabel}</span>` : ''}
    </button>`;
  }

  function renderIssueCard(item) {
    const severity = item.severity || 'medium';
    const fixBtn = item.fixType ? renderFixButton(item) : '';
    return `
      <div class="audit-issue-card severity-${severity}">
        <div class="audit-issue-header">
          <span class="audit-severity-badge ${severity}">${severity}</span>
          <span class="audit-category-badge">${esc(item.category || 'general')}</span>
        </div>
        <div class="audit-issue-title">${esc(item.issue)}</div>
        <div class="audit-issue-impact">${esc(item.impact)}</div>
        ${item.fix ? `<div class="audit-issue-fix">${esc(item.fix)}</div>` : ''}
        <div class="audit-issue-footer">
          ${item.timeEstimate ? `<span class="audit-issue-meta"><i class="bi bi-clock"></i> ${esc(item.timeEstimate)}</span>` : ''}
          ${fixBtn}
        </div>
      </div>
    `;
  }

  /* ─── Audit Fix Logic — 3-Tier (Client / Python / LLM) ─── */

  /**
   * DOMParser-based client fixes. Parses HTML, manipulates DOM, serializes back.
   * All 12 client fix types.
   */
  function applyClientFix(html, fixType, context) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    switch (fixType) {
      case 'add_viewport': {
        if (doc.querySelector('meta[name="viewport"]')) break;
        const meta = doc.createElement('meta');
        meta.setAttribute('name', 'viewport');
        meta.setAttribute('content', 'width=device-width, initial-scale=1');
        doc.head.appendChild(meta);
        break;
      }
      case 'add_charset': {
        if (doc.querySelector('meta[charset]')) break;
        const meta = doc.createElement('meta');
        meta.setAttribute('charset', 'UTF-8');
        doc.head.prepend(meta);
        break;
      }
      case 'add_lang': {
        if (doc.documentElement.getAttribute('lang')) break;
        doc.documentElement.setAttribute('lang', 'en');
        break;
      }
      case 'add_canonical': {
        if (doc.querySelector('link[rel="canonical"]')) break;
        const link = doc.createElement('link');
        link.setAttribute('rel', 'canonical');
        link.setAttribute('href', window.location.origin + '/' + (state.page || ''));
        doc.head.appendChild(link);
        break;
      }
      case 'add_main': {
        if (doc.querySelector('main')) break;
        const main = doc.createElement('main');
        // Move body children (except header/footer/nav/script) into main
        const bodyChildren = [...doc.body.children];
        const wrapper = [];
        for (const child of bodyChildren) {
          const tag = child.tagName?.toLowerCase();
          if (tag === 'header' || tag === 'footer' || tag === 'nav' || tag === 'script') continue;
          wrapper.push(child);
        }
        const header = doc.querySelector('body > header');
        const footer = doc.querySelector('body > footer');
        wrapper.forEach(el => main.appendChild(el));
        if (header) header.after(main);
        else if (doc.body.firstChild) doc.body.insertBefore(main, doc.body.firstChild);
        else doc.body.appendChild(main);
        break;
      }
      case 'add_header': {
        if (doc.querySelector('header')) break;
        const header = doc.createElement('header');
        doc.body.prepend(header);
        break;
      }
      case 'add_footer': {
        if (doc.querySelector('footer')) break;
        const footer = doc.createElement('footer');
        doc.body.appendChild(footer);
        break;
      }
      case 'wrap_nav': {
        if (doc.querySelector('nav')) break;
        const nav = doc.createElement('nav');
        nav.setAttribute('aria-label', 'Main navigation');
        const header = doc.querySelector('header');
        if (header) header.after(nav);
        else doc.body.prepend(nav);
        break;
      }
      case 'fix_multiple_h1': {
        const h1s = doc.querySelectorAll('h1');
        if (h1s.length <= 1) break;
        // Keep first H1, convert rest to H2
        for (let i = 1; i < h1s.length; i++) {
          const h2 = doc.createElement('h2');
          h2.innerHTML = h1s[i].innerHTML;
          // Copy attributes
          for (const attr of h1s[i].attributes) {
            h2.setAttribute(attr.name, attr.value);
          }
          h1s[i].replaceWith(h2);
        }
        break;
      }
      case 'add_noopener': {
        doc.querySelectorAll('a[target="_blank"]').forEach(a => {
          const rel = a.getAttribute('rel') || '';
          if (!rel.includes('noopener')) {
            a.setAttribute('rel', (rel + ' noopener').trim());
          }
        });
        break;
      }
      case 'add_lazy_loading': {
        doc.querySelectorAll('img').forEach((img, i) => {
          // Skip first image (likely above fold)
          if (i === 0) return;
          if (!img.getAttribute('loading')) {
            img.setAttribute('loading', 'lazy');
          }
        });
        break;
      }
      case 'add_skip_link': {
        if (doc.querySelector('a[href="#main"], a[href="#content"], a[href="#main-content"]')) break;
        const main = doc.querySelector('main');
        if (main && !main.id) main.id = 'main';
        const link = doc.createElement('a');
        link.href = '#' + (main?.id || 'main');
        link.className = 'skip-link';
        link.textContent = 'Skip to content';
        link.setAttribute('style', 'position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;z-index:9999;');
        doc.body.prepend(link);
        break;
      }
      default:
        return html;
    }

    // Serialize back — use full doctype + html
    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  }

  /**
   * Apply multiple fixes as a batch (single undo step, single re-render)
   */
  async function applyBatchFixes(fixes) {
    if (!fixes || fixes.length === 0) return;
    if (state.pendingSync) await state.pendingSync;
    await pushSnapshot();
    let successCount = 0;
    for (const fix of fixes) {
      try {
        state.html = applyClientFix(state.html, fix.type || fix.fixType, fix.data || fix.context || {});
        successCount++;
      } catch (e) {
        console.error('Fix ' + (fix.type || fix.fixType) + ' failed:', e);
      }
    }
    state.version++;
    loadHTMLIntoIframe(state.html);
    setDirty(true);
    scheduleReaudit();
    return { applied: successCount, total: fixes.length };
  }

  /**
   * Preview modal — shows generated snippet before applying.
   * Returns Promise<boolean> (true = apply, false = cancel).
   */
  function showPreviewModal(snippet, fixType, normalizedType) {
    return new Promise(resolve => {
      // Remove existing preview modal
      const existing = document.getElementById('preview-modal-overlay');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = 'preview-modal-overlay';
      overlay.className = 'preview-modal';

      const typeLabel = normalizedType || fixType.replace(/_/g, ' ');
      overlay.innerHTML = `
        <div class="preview-modal-content">
          <div class="modal-header">
            <i class="bi bi-code-square"></i> Preview: ${esc(typeLabel)}
            <button class="modal-close preview-cancel"><i class="bi bi-x-lg"></i></button>
          </div>
          <div class="modal-body">
            <pre class="preview-code">${esc(snippet)}</pre>
          </div>
          <div class="preview-actions">
            <button class="btn-secondary preview-cancel">Cancel</button>
            <button class="btn-sm preview-apply"><i class="bi bi-check-lg"></i> Apply</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const cleanup = (result) => {
        overlay.remove();
        resolve(result);
      };

      overlay.querySelectorAll('.preview-cancel').forEach(b => b.addEventListener('click', () => cleanup(false)));
      overlay.querySelector('.preview-apply').addEventListener('click', () => cleanup(true));
      overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(false); });
    });
  }

  /**
   * Apply a server-side fix (python or LLM) — fetches snippet, optionally previews, then applies.
   */
  async function applyServerFix(fixType, category, html) {
    const res = await api('/api/audit-fix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fixType, category, html, context: { url: window.location.origin + '/' + (state.page || ''), site: state.site || 'default' } }),
    });

    if (!res.ok) throw new Error(res.error || 'Fix generation failed');

    const snippet = res.snippet;

    // Show preview for schema and LLM fixes
    if (res.preview || fixType.startsWith('generate_schema')) {
      const apply = await showPreviewModal(snippet, fixType, res.normalizedType);
      if (!apply) return null; // user cancelled
    }

    let modifiedHtml = html;

    if (res.location === 'head') {
      if (fixType === 'generate_title' && /<title[^>]*>[\s\S]*?<\/title>/i.test(modifiedHtml)) {
        const titleMatch = snippet.match(/<title[^>]*>[\s\S]*?<\/title>/i);
        if (titleMatch) {
          modifiedHtml = modifiedHtml.replace(/<title[^>]*>[\s\S]*?<\/title>/i, titleMatch[0]);
        }
      } else if (fixType === 'generate_meta_description' && /<meta[^>]*name=["']description["'][^>]*>/i.test(modifiedHtml)) {
        // Extract content from snippet using DOMParser for robustness
        try {
          const snippetDoc = new DOMParser().parseFromString('<head>' + snippet + '</head>', 'text/html');
          const newMeta = snippetDoc.querySelector('meta[name="description"]');
          const newContent = newMeta ? newMeta.getAttribute('content') : null;
          if (newContent) {
            modifiedHtml = modifiedHtml.replace(
              /<meta[^>]*name=["']description["'][^>]*>/i,
              '<meta name="description" content="' + newContent.replace(/"/g, '&quot;') + '">'
            );
          }
        } catch {
          // Fallback to regex replacement
          const metaMatch = snippet.match(/<meta[^>]*name=["']description["'][^>]*>/i);
          if (metaMatch) {
            modifiedHtml = modifiedHtml.replace(/<meta[^>]*name=["']description["'][^>]*>/i, metaMatch[0]);
          }
        }
      } else {
        modifiedHtml = modifiedHtml.replace(/<\/head>/i, snippet + '\n</head>');
      }
    } else if (res.location === 'replace' && res.target === 'img-alt') {
      try {
        const altMap = JSON.parse(snippet);
        for (const [src, alt] of Object.entries(altMap)) {
          const escapedSrc = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const imgRegex = new RegExp(`(<img[^>]*src=["']${escapedSrc}["'])([^>]*>)`, 'gi');
          modifiedHtml = modifiedHtml.replace(imgRegex, (match, pre, post) => {
            if (/alt=["']/i.test(match)) return match;
            return `${pre} alt="${alt}"${post}`;
          });
        }
      } catch { /* ignore parse errors */ }
    } else if (res.location === 'body-end') {
      modifiedHtml = modifiedHtml.replace(/<\/body>/i, snippet + '\n</body>');
    } else if (res.location === 'body-start') {
      modifiedHtml = modifiedHtml.replace(/(<body[^>]*>)/i, '$1\n' + snippet);
    }

    return modifiedHtml;
  }

  // Inline CSS for fix diff
  (function addFixDiffStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .fix-diff { margin-top: 8px; padding: 8px 10px; border-radius: 6px; background: #f8f9fa; font-size: 12px; font-family: monospace; border: 1px solid #e2e8f0; }
      .fix-diff-label { font-weight: 600; font-size: 11px; color: #64748b; margin-bottom: 4px; }
      .fix-diff-before { background: #fef2f2; color: #991b1b; padding: 4px 6px; border-radius: 4px; margin-bottom: 4px; text-decoration: line-through; white-space: pre-wrap; word-break: break-all; }
      .fix-diff-after { background: #f0fdf4; color: #166534; padding: 4px 6px; border-radius: 4px; white-space: pre-wrap; word-break: break-all; }
    `;
    document.head.appendChild(style);
  })();

  function renderFixDiff(beforeHtml, afterHtml) {
    const parser = new DOMParser();
    const beforeDoc = parser.parseFromString(beforeHtml, 'text/html');
    const afterDoc = parser.parseFromString(afterHtml, 'text/html');
    const diffs = [];

    // Compare title
    const bTitle = beforeDoc.querySelector('title')?.textContent || '';
    const aTitle = afterDoc.querySelector('title')?.textContent || '';
    if (bTitle !== aTitle) diffs.push({ label: '<title>', before: bTitle, after: aTitle });

    // Compare meta description
    const bDesc = beforeDoc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    const aDesc = afterDoc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    if (bDesc !== aDesc) diffs.push({ label: 'meta description', before: bDesc || '(missing)', after: aDesc });

    // Compare OG tags
    ['og:title', 'og:description', 'og:image', 'og:type'].forEach(prop => {
      const bVal = beforeDoc.querySelector(`meta[property="${prop}"]`)?.getAttribute('content') || '';
      const aVal = afterDoc.querySelector(`meta[property="${prop}"]`)?.getAttribute('content') || '';
      if (bVal !== aVal) diffs.push({ label: prop, before: bVal || '(missing)', after: aVal });
    });

    // Compare JSON-LD schemas
    const bSchemas = beforeDoc.querySelectorAll('script[type="application/ld+json"]').length;
    const aSchemas = afterDoc.querySelectorAll('script[type="application/ld+json"]').length;
    if (aSchemas > bSchemas) diffs.push({ label: 'JSON-LD', before: bSchemas + ' schema(s)', after: aSchemas + ' schema(s)' });

    // Compare lang attribute
    const bLang = beforeDoc.documentElement.getAttribute('lang') || '';
    const aLang = afterDoc.documentElement.getAttribute('lang') || '';
    if (bLang !== aLang) diffs.push({ label: 'lang', before: bLang || '(missing)', after: aLang });

    if (diffs.length === 0) return '';

    return '<div class="fix-diff">' + diffs.map(d =>
      '<div class="fix-diff-label">' + esc(d.label) + '</div>' +
      '<div class="fix-diff-before">' + esc(d.before) + '</div>' +
      '<div class="fix-diff-after">' + esc(d.after) + '</div>'
    ).join('') + '</div>';
  }

  function bindAuditFixButtons() {
    // Individual fix buttons
    $$('.audit-fix-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const fixType = btn.dataset.fixType;
        const fixMethod = btn.dataset.fixMethod;
        const category = btn.dataset.category;

        if (btn.classList.contains('applied') || btn.classList.contains('loading')) return;

        btn.classList.add('loading');
        const methodLabels = { client: 'Fixing...', python: 'Generating...', llm: 'Generating...', image_gen: 'Generating image...' };
        btn.innerHTML = '<span class="spinner-sm"></span> ' + (methodLabels[fixMethod] || 'Fixing...');

        try {
          await pushSnapshot();
          let currentHtml = await requestIframeHTML();
          if (!currentHtml) throw new Error('Could not get page HTML');
          const beforeHtml = currentHtml;

          if (fixMethod === 'component') {
            const typeMap = { add_component_faq: 'faq', add_component_testimonial: 'testimonial', add_component_features: 'features' };
            const componentType = typeMap[fixType] || '';
            btn.classList.remove('loading');
            btn.innerHTML = '<i class="bi bi-plus-lg"></i> Add Component';
            // Close audit modal, open library filtered to this component type
            $('#audit-modal').hidden = true;
            $('#library-modal').hidden = false;
            $('#library-search').value = '';
            $$('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === (componentType || 'all')));
            // Fetch components filtered to this type and show appropriate message if none found
            fetchLibraryComponents(componentType || 'all').then(items => {
              const grid = $('#library-grid');
              const q = componentType.toLowerCase();
              const filtered = items.filter(c => {
                const cat = (c.type || '').toLowerCase();
                return !q || cat === q || c.name.toLowerCase().includes(q);
              });
              grid.innerHTML = '';
              if (filtered.length > 0) {
                filtered.forEach(c => {
                  const cat = (c.type || '').toLowerCase();
                  const icon = typeIcons[cat] || 'bi-grid-3x3-gap';
                  const card = document.createElement('div');
                  card.className = 'lib-card';
                  card.innerHTML =
                    '<div class="lib-card-preview"><i class="bi ' + icon + '"></i></div>' +
                    '<div class="lib-card-body">' +
                      '<div class="lib-card-name">' + esc(c.name) + '</div>' +
                      '<span class="lib-card-id">@' + esc(c.short_id || '') + '</span>' +
                      '<span class="lib-card-cat">' + esc(c.type || '') + '</span>' +
                    '</div>';
                  card.addEventListener('click', () => insertLibraryComponent(c));
                  grid.appendChild(card);
                });
              } else {
                grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;text-align:center;padding:32px 16px;">' +
                  '<i class="bi bi-box-seam" style="font-size:2rem;color:#94a3b8;"></i>' +
                  '<p style="margin:8px 0 4px;font-weight:600;">No ' + esc(componentType) + ' component in your or the global library</p>' +
                  '<p style="color:#64748b;font-size:13px;margin-bottom:12px;">Create a new one with AI in seconds</p>' +
                  '<button class="btn btn-primary btn-sm" id="audit-create-component" style="margin:0 auto;font-size:13px;padding:6px 14px;"><i class="bi bi-plus-lg"></i> Create New ' + esc(componentType.charAt(0).toUpperCase() + componentType.slice(1)) + ' Component</button>' +
                '</div>';
                document.getElementById('audit-create-component')?.addEventListener('click', () => {
                  $('#library-modal').hidden = true;
                  $('#create-modal').hidden = false;
                  const typeSelect = $('#create-type');
                  if (typeSelect) {
                    // Try to select the matching type in dropdown
                    for (const opt of typeSelect.options) {
                      if (opt.value.toLowerCase() === componentType) { typeSelect.value = opt.value; break; }
                    }
                  }
                  $('#create-prompt').value = '';
                  $('#create-prompt').focus();
                  $('#create-loading').hidden = true;
                });
              }
            });
            return;
          } else if (fixMethod === 'client') {
            currentHtml = applyClientFix(currentHtml, fixType);
          } else {
            const result = await applyServerFix(fixType, category, currentHtml);
            if (result === null) {
              // User cancelled preview
              btn.classList.remove('loading');
              const btnInfo = getFixBtnInfo(fixMethod);
              btn.innerHTML = `<i class="bi ${btnInfo.icon}"></i> ${btnInfo.label}`;
              return;
            }
            currentHtml = result;
          }

          setDirty(true);
          btn.classList.remove('loading');
          btn.classList.add('applied');
          btn.innerHTML = '<i class="bi bi-check-lg"></i> Applied';
          toast('Fix applied', 'success');

          // Gamification: combo tracking
          _fixCombo++;
          _auditSessionFixes++;
          if (_fixCombo >= 3) showComboBadge(_fixCombo);

          // Show before/after diff
          const diffHtml = renderFixDiff(beforeHtml, currentHtml);
          if (diffHtml) {
            const diffContainer = document.createElement('div');
            diffContainer.innerHTML = diffHtml;
            btn.parentElement.appendChild(diffContainer.firstElementChild);
          }

          loadHTMLIntoIframe(currentHtml, () => {
            scheduleReaudit();
          });
        } catch (err) {
          btn.classList.remove('loading');
          btn.innerHTML = '<i class="bi bi-x-lg"></i> Failed';
          toast(err.message || 'Fix failed', 'error');
          setTimeout(() => {
            const btnInfo = getFixBtnInfo(fixMethod);
            btn.innerHTML = `<i class="bi ${btnInfo.icon}"></i> ${btnInfo.label}`;
          }, 2000);
        }
      });
    });

    // Fix All buttons (3-tier)
    bindFixAllButton('audit-fix-all-client', 'client');
    bindFixAllButton('audit-fix-all-python', 'python');
    bindFixAllButton('audit-fix-all-llm', 'llm');
    bindFixAllButton('audit-fix-all-image-gen', 'image_gen');
  }

  let _reauditTimer = null;
  let _lastAuditScore = null;
  let _isReauditing = false;

  function scheduleReaudit() {
    clearTimeout(_reauditTimer);
    _reauditTimer = setTimeout(reauditAfterFix, 1500);
  }

  async function reauditAfterFix() {
    if (_isReauditing) return;
    _isReauditing = true;
    try {
      showReauditSpinner();
      // Use state.html directly — guaranteed to have the fix applied
      const html = state.html;
      if (!html) { console.error('Re-audit: No HTML in state'); return; }

      const detailsResponse = await api('/api/audit-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, pageName: state.page })
      });

      if (detailsResponse && detailsResponse.ok) {
        const scores = detailsResponse.scores || {};
        const newScore = Math.round(detailsResponse.summary?.overallScore ?? 0);

        // Compute delta
        const delta = _lastAuditScore !== null ? newScore - _lastAuditScore : 0;
        _lastAuditScore = newScore;

        // Update score ring
        updateScoreRing(newScore);
        $('#audit-score-label').textContent = detailsResponse.summary?.grade || getScoreLabel(newScore);

        // Update breakdowns and score cards
        _scoreBreakdowns = detailsResponse.scoreBreakdowns || {};
        const scoresGrid = $('#audit-scores-grid');
        if (scoresGrid) {
          scoresGrid.innerHTML = renderScoreCard(scores.meta, 'Meta', 'meta') +
            renderScoreCard(scores.content, 'Content', 'content') +
            renderScoreCard(scores.schema, 'Schema', 'schema') +
            renderScoreCard(scores.headings, 'Headings', 'headings') +
            renderScoreCard(scores.semantic, 'Semantic', 'semantic') +
            renderScoreCard(scores.images, 'Images', 'images') +
            renderScoreCard(scores.links, 'Links', 'links');
        }

        console.log('[Re-audit] Local scores:', JSON.stringify(scores), 'Overall:', newScore, 'Delta:', delta);

        // Gamification: update history, sparkline, streak, celebrations
        const history = pushAuditHistory(newScore, delta);
        renderSparkline(history);
        updateStreakBadge(history);
        if (delta > 0) {
          showConfetti();
          if (delta >= 10) showLevelUp();
          const allScores = history.map(h => h.score);
          if (newScore >= Math.max(...allScores.slice(0, -1), 0)) showPersonalBest();
        }

        renderDetailedFindings(detailsResponse);
        showScoreDelta(delta);
      }
    } catch (err) {
      console.error('Re-audit failed:', err);
    } finally {
      _isReauditing = false;
      hideReauditSpinner();
    }
  }

  function showScoreDelta(delta) {
    const el = document.getElementById('audit-score-delta');
    if (!el) return;
    if (delta > 0) { el.textContent = '+' + delta; el.className = 'score-delta score-up'; }
    else if (delta < 0) { el.textContent = '' + delta; el.className = 'score-delta score-down'; }
    else { el.textContent = '\u00b10'; el.className = 'score-delta score-same'; }
    el.style.opacity = '1';
    el.style.display = 'inline-block';
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => { el.style.display = 'none'; }, 300); }, 3000);
  }

  function showReauditSpinner() {
    const ring = $('.audit-score-ring');
    if (ring) ring.classList.add('auditing');
    const ind = document.getElementById('reaudit-indicator');
    if (ind) { ind.style.display = 'block'; ind.textContent = 'Re-checking\u2026'; }
  }

  function hideReauditSpinner() {
    const ring = $('.audit-score-ring');
    if (ring) ring.classList.remove('auditing');
    const ind = document.getElementById('reaudit-indicator');
    if (ind) ind.style.display = 'none';
  }

  function getFixBtnInfo(method) {
    switch (method) {
      case 'client': return { icon: 'bi-wrench', label: 'Fix' };
      case 'python': return { icon: 'bi-braces', label: 'Generate Schema' };
      case 'llm': return { icon: 'bi-stars', label: 'Generate Fix' };
      case 'image_gen': return { icon: 'bi-image', label: 'Generate Image' };
      case 'component': return { icon: 'bi-plus-lg', label: 'Add Component' };
      default: return { icon: 'bi-wrench', label: 'Fix' };
    }
  }

  function bindFixAllButton(btnId, method) {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    btn.addEventListener('click', async () => {
      if (btn.classList.contains('loading') || btn.classList.contains('applied')) return;
      btn.classList.add('loading');
      const origText = btn.textContent;
      btn.textContent = 'Applying...';

      try {
        await pushSnapshot();
        let currentHtml = await requestIframeHTML();
        if (!currentHtml) throw new Error('Could not get page HTML');

        const fixes = _lastAuditAllFixes.filter(f => f.fixMethod === method && f.fixType);
        let appliedCount = 0;

        if (method === 'client') {
          for (const fix of fixes) {
            const before = currentHtml;
            currentHtml = applyClientFix(currentHtml, fix.fixType);
            if (currentHtml !== before) appliedCount++;
          }
        } else {
          // For python/llm, apply sequentially (each needs fresh HTML context)
          for (const fix of fixes) {
            try {
              const result = await applyServerFix(fix.fixType, fix.category, currentHtml);
              if (result) {
                currentHtml = result;
                appliedCount++;
              }
            } catch { /* skip failed fixes */ }
          }
        }

        setDirty(true);

        // Mark individual fix buttons as applied
        $$(`.audit-fix-btn[data-fix-method="${method}"]`).forEach(b => {
          b.classList.add('applied');
          b.innerHTML = '<i class="bi bi-check-lg"></i> Applied';
        });

        btn.textContent = `${appliedCount} applied`;
        btn.classList.remove('loading');
        btn.classList.add('applied');
        toast(`${appliedCount} ${method} fixes applied`, 'success');

        loadHTMLIntoIframe(currentHtml, () => {
          reauditAfterFix(); // Immediate re-audit, not debounced
        });
      } catch (err) {
        btn.classList.remove('loading');
        btn.textContent = origText;
        toast(err.message || 'Fix All failed', 'error');
      }
    });
  }

  function getSeverityIcon(severity) {
    switch (severity) {
      case 'critical': return 'bi-x-circle-fill';
      case 'high': return 'bi-exclamation-triangle-fill';
      case 'medium': return 'bi-exclamation-circle';
      case 'low': return 'bi-info-circle';
      default: return 'bi-circle';
    }
  }

  function setupAuditCategoryTabs() {
    const tabs = $$('#audit-category-tabs .audit-cat-btn');
    const items = $$('#audit-all-fixes .audit-fix-item');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const cat = tab.dataset.cat;
        items.forEach(item => {
          if (cat === 'all' || item.dataset.category === cat) {
            item.classList.remove('hidden');
          } else {
            item.classList.add('hidden');
          }
        });
      });
    });
  }

  function getScoreLabel(score) {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 50) return 'Needs Work';
    return 'Poor';
  }

  function getScoreClass(score) {
    if (score >= 90) return 'score-good';
    if (score >= 75) return 'score-ok';
    if (score >= 50) return 'score-warn';
    return 'score-bad';
  }

  // Store latest breakdowns for tooltip rendering
  let _scoreBreakdowns = {};

  function renderScoreCard(score, label, key) {
    const val = Math.round(score || 0);
    const bd = _scoreBreakdowns[key];
    let tooltipContent = '';
    if (bd) {
      const lines = bd.items.map(item => {
        const icon = item.earned ? '\u2705' : '\u274c';
        const pts = item.earned ? `+${item.points}` : `0/${item.points}`;
        const detail = item.detail ? ` (${item.detail})` : '';
        return `${icon} ${item.label}: ${pts}${detail}`;
      });
      tooltipContent = `<div class="score-tooltip"><div class="score-tooltip-desc">${esc(bd.description)}</div><div class="score-tooltip-items">${lines.map(l => `<div class="score-tooltip-line">${esc(l)}</div>`).join('')}</div></div>`;
    }
    // Progress bar: earned items / total items
    let progressHtml = '';
    if (bd && bd.items && bd.items.length > 0) {
      const earned = bd.items.filter(i => i.earned).length;
      const total = bd.items.length;
      const pct = Math.round((earned / total) * 100);
      const pColor = val >= 90 ? 'var(--bx-success)' : val >= 75 ? 'var(--bx-primary)' : val >= 50 ? 'var(--bx-warning)' : 'var(--bx-danger)';
      progressHtml = `<div class="score-card-progress"><div class="score-card-progress-fill" style="width:${pct}%;background:${pColor}"></div></div>`;
    }
    return `
      <div class="audit-score-card" data-score-key="${esc(key || '')}">
        <div class="audit-score-card-value ${getScoreClass(val)}">${val}</div>
        <div class="audit-score-card-label">${esc(label)}</div>
        ${progressHtml}
        ${tooltipContent}
      </div>
    `;
  }


  // Audit button in toolbar
  $('#btn-audit')?.addEventListener('click', runPageAudit);

  // Audit modal close
  $('#audit-close')?.addEventListener('click', () => { $('#audit-modal').hidden = true; });
  $('#audit-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) $('#audit-modal').hidden = true; });

  /* ─── Site Settings ─── */
  let siteSettings = {};

  async function loadSettings() {
    try {
      const d = await api('/api/settings?site=' + encodeURIComponent(state.site));
      if (d.ok && d.settings) {
        siteSettings = d.settings;

        // Populate form fields
        $('#setting-business-name').value = siteSettings.business?.name || '';
        $('#setting-phone').value = siteSettings.business?.phone || '';
        $('#setting-email').value = siteSettings.business?.email || '';
        $('#setting-address').value = siteSettings.business?.address || '';

        $('#setting-ga-id').value = siteSettings.analytics?.googleAnalyticsId || '';
        $('#setting-fb-pixel').value = siteSettings.analytics?.facebookPixelId || '';
        $('#setting-gtm-id').value = siteSettings.analytics?.gtmContainerId || '';

        $('#setting-primary-color').value = siteSettings.branding?.primaryColor || '#6366f1';
        $('#setting-secondary-color').value = siteSettings.branding?.secondaryColor || '#10b981';
        $('#setting-heading-font').value = siteSettings.branding?.headingFont || '';
        $('#setting-body-font').value = siteSettings.branding?.bodyFont || '';

        $('#setting-title-suffix').value = siteSettings.seo?.titleSuffix || '';
        $('#setting-default-og').value = siteSettings.seo?.defaultOgImage || '';
      }
    } catch (err) {
      console.error('Settings load error:', err);
    }
  }

  async function saveSettings() {
    const settings = {
      business: {
        name: $('#setting-business-name')?.value || '',
        phone: $('#setting-phone')?.value || '',
        email: $('#setting-email')?.value || '',
        address: $('#setting-address')?.value || ''
      },
      analytics: {
        googleAnalyticsId: $('#setting-ga-id')?.value || '',
        facebookPixelId: $('#setting-fb-pixel')?.value || '',
        gtmContainerId: $('#setting-gtm-id')?.value || ''
      },
      branding: {
        primaryColor: $('#setting-primary-color')?.value || '#6366f1',
        secondaryColor: $('#setting-secondary-color')?.value || '#10b981',
        headingFont: $('#setting-heading-font')?.value || '',
        bodyFont: $('#setting-body-font')?.value || ''
      },
      seo: {
        titleSuffix: $('#setting-title-suffix')?.value || '',
        defaultOgImage: $('#setting-default-og')?.value || ''
      }
    };

    try {
      const d = await api('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site: state.site, settings })
      });

      if (d.ok) {
        siteSettings = settings;
        toast('Settings saved', 'success');
      } else {
        toast('Failed to save settings: ' + (d.error || 'unknown'), 'error');
      }
    } catch (err) {
      toast('Error saving settings', 'error');
    }
  }

  $('#btn-save-settings')?.addEventListener('click', saveSettings);

  /* ─── Collections (CMS) ─── */
  let collections = [];
  let currentCollection = null;
  let currentCollectionItems = [];
  let editingItem = null;

  async function loadCollections() {
    const list = $('#collections-list');
    if (!list) return;

    try {
      const d = await api('/api/collections?site=' + encodeURIComponent(state.site));
      collections = d.collections || [];

      if (collections.length === 0) {
        list.innerHTML = '<div class="empty-state"><i class="bi bi-collection"></i><p>No collections yet</p></div>';
        return;
      }

      list.innerHTML = '';
      collections.forEach(col => {
        const card = document.createElement('div');
        card.className = 'collection-card';
        card.innerHTML = `
          <div class="collection-card-header">
            <div class="collection-card-name">${esc(col.name)}</div>
            <span class="collection-card-count">${col.itemCount || 0} items</span>
          </div>
          <div class="collection-card-desc">${esc(col.description || col.slug)}</div>
        `;
        card.addEventListener('click', () => openCollection(col));
        list.appendChild(card);
      });
    } catch (err) {
      console.error('Collections error:', err);
      list.innerHTML = '<div class="empty-state"><p>Failed to load collections</p></div>';
    }
  }

  async function openCollection(collection) {
    currentCollection = collection;
    $('#collection-items-title').textContent = collection.name;
    $('#collection-items-modal').hidden = false;

    const list = $('#collection-items-list');
    list.innerHTML = '<div class="empty-state"><div class="spinner"></div><p>Loading items...</p></div>';

    try {
      const d = await api('/api/collections?site=' + encodeURIComponent(state.site) + '&collection=' + encodeURIComponent(collection.slug));
      currentCollectionItems = d.items || [];

      if (currentCollectionItems.length === 0) {
        list.innerHTML = '<div class="empty-state"><i class="bi bi-inbox"></i><p>No items yet. Click "Add Item" to create one.</p></div>';
        return;
      }

      list.innerHTML = '';
      currentCollectionItems.forEach(item => {
        const title = item.data?.title || item.data?.name || item.slug;
        const thumb = item.data?.image || item.data?.featuredImage;
        const row = document.createElement('div');
        row.className = 'collection-item-row';
        row.innerHTML = `
          <div class="collection-item-thumb">
            ${thumb ? '<img src="' + esc(thumb) + '" alt="">' : '<i class="bi bi-file-text"></i>'}
          </div>
          <div class="collection-item-info">
            <div class="collection-item-title">${esc(title)}</div>
            <div class="collection-item-meta">${esc(item.slug)} &bull; ${new Date(item.updatedAt || item.createdAt).toLocaleDateString()}</div>
          </div>
          <span class="collection-item-status ${item.status || 'draft'}">${item.status || 'draft'}</span>
          <div class="collection-item-actions">
            <button class="btn-sm-icon edit-item" title="Edit"><i class="bi bi-pencil"></i></button>
            <button class="btn-sm-icon delete-item" title="Delete"><i class="bi bi-trash"></i></button>
          </div>
        `;

        row.querySelector('.edit-item').addEventListener('click', (e) => {
          e.stopPropagation();
          editCollectionItem(item);
        });

        row.querySelector('.delete-item').addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm('Delete this item?')) {
            await deleteCollectionItem(item);
          }
        });

        list.appendChild(row);
      });
    } catch (err) {
      console.error('Items error:', err);
      list.innerHTML = '<div class="empty-state"><p>Failed to load items</p></div>';
    }
  }

  function editCollectionItem(item) {
    editingItem = item;
    $('#item-edit-title').textContent = item ? 'Edit Item' : 'New Item';

    const fields = $('#item-edit-fields');
    fields.innerHTML = '';

    // Build form from schema
    const schema = currentCollection?.schema;
    if (!schema || !schema.fields) {
      fields.innerHTML = '<p>No schema defined for this collection</p>';
      return;
    }

    schema.fields.forEach(field => {
      const value = item?.data?.[field.id] || field.defaultValue || '';
      const div = document.createElement('div');
      div.className = 'field-group';

      let input;
      switch (field.type) {
        case 'textarea':
        case 'richtext':
          input = `<textarea class="field-input" id="item-field-${field.id}" rows="4">${esc(value)}</textarea>`;
          break;
        case 'image':
          input = `<input type="text" class="field-input" id="item-field-${field.id}" value="${esc(value)}" placeholder="Image URL">`;
          break;
        case 'select':
          const opts = (field.options || []).map(o =>
            `<option value="${esc(o)}" ${o === value ? 'selected' : ''}>${esc(o)}</option>`
          ).join('');
          input = `<select class="field-input" id="item-field-${field.id}">${opts}</select>`;
          break;
        case 'boolean':
          input = `<input type="checkbox" id="item-field-${field.id}" ${value ? 'checked' : ''}>`;
          break;
        case 'number':
          input = `<input type="number" class="field-input" id="item-field-${field.id}" value="${esc(value)}">`;
          break;
        case 'date':
          input = `<input type="date" class="field-input" id="item-field-${field.id}" value="${esc(value)}">`;
          break;
        default:
          input = `<input type="text" class="field-input" id="item-field-${field.id}" value="${esc(value)}">`;
      }

      div.innerHTML = `
        <label class="field-label">${esc(field.name)} ${field.required ? '<span style="color:var(--bx-danger)">*</span>' : ''}</label>
        ${input}
      `;
      fields.appendChild(div);
    });

    // Status field
    const statusDiv = document.createElement('div');
    statusDiv.className = 'field-group';
    statusDiv.innerHTML = `
      <label class="field-label">Status</label>
      <select class="field-input" id="item-field-status">
        <option value="draft" ${(item?.status || 'draft') === 'draft' ? 'selected' : ''}>Draft</option>
        <option value="published" ${item?.status === 'published' ? 'selected' : ''}>Published</option>
        <option value="archived" ${item?.status === 'archived' ? 'selected' : ''}>Archived</option>
      </select>
    `;
    fields.appendChild(statusDiv);

    $('#item-edit-modal').hidden = false;
  }

  async function saveCollectionItem() {
    if (!currentCollection) return;

    const schema = currentCollection.schema;
    const data = {};

    schema.fields.forEach(field => {
      const el = $('#item-field-' + field.id);
      if (!el) return;

      if (field.type === 'boolean') {
        data[field.id] = el.checked;
      } else if (field.type === 'number') {
        data[field.id] = parseFloat(el.value) || 0;
      } else {
        data[field.id] = el.value;
      }
    });

    const status = $('#item-field-status')?.value || 'draft';

    try {
      let url, method;
      if (editingItem) {
        url = '/api/collections?collection=' + encodeURIComponent(currentCollection.slug) + '&item=' + encodeURIComponent(editingItem.slug);
        method = 'PUT';
      } else {
        url = '/api/collections?collection=' + encodeURIComponent(currentCollection.slug);
        method = 'POST';
      }

      const d = await api(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site: state.site, data, status })
      });

      if (d.ok) {
        toast(editingItem ? 'Item updated' : 'Item created', 'success');
        $('#item-edit-modal').hidden = true;
        openCollection(currentCollection);
      } else {
        toast('Error: ' + (d.error || 'unknown'), 'error');
      }
    } catch (err) {
      toast('Failed to save item', 'error');
    }
  }

  async function deleteCollectionItem(item) {
    try {
      const d = await api('/api/collections?site=' + encodeURIComponent(state.site) + '&collection=' + encodeURIComponent(currentCollection.slug) + '&item=' + encodeURIComponent(item.slug), {
        method: 'DELETE'
      });

      if (d.ok) {
        toast('Item deleted', 'success');
        openCollection(currentCollection);
      } else {
        toast('Delete failed: ' + (d.error || 'unknown'), 'error');
      }
    } catch (err) {
      toast('Failed to delete item', 'error');
    }
  }

  async function createCollection() {
    const name = $('#collection-name')?.value?.trim();
    const preset = $('#collection-preset')?.value;
    const description = $('#collection-description')?.value?.trim();

    if (!name) {
      toast('Please enter a collection name', 'error');
      return;
    }

    try {
      const d = await api('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site: state.site, name, preset, description })
      });

      if (d.ok) {
        toast('Collection created', 'success');
        $('#collection-modal').hidden = true;
        loadCollections();
      } else {
        toast('Error: ' + (d.error || 'unknown'), 'error');
      }
    } catch (err) {
      toast('Failed to create collection', 'error');
    }
  }

  // Collection modal handlers
  $('#btn-add-collection')?.addEventListener('click', () => {
    $('#collection-name').value = '';
    $('#collection-description').value = '';
    $('#collection-preset').value = 'blog-posts';
    $('#collection-modal').hidden = false;
  });

  $('#collection-close')?.addEventListener('click', () => { $('#collection-modal').hidden = true; });
  $('#collection-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) $('#collection-modal').hidden = true; });
  $('#collection-go')?.addEventListener('click', createCollection);

  // Collection items modal handlers
  $('#collection-items-close')?.addEventListener('click', () => { $('#collection-items-modal').hidden = true; });
  $('#collection-items-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) $('#collection-items-modal').hidden = true; });

  $('#btn-add-item')?.addEventListener('click', () => {
    editingItem = null;
    editCollectionItem(null);
  });

  // Item edit modal handlers
  $('#item-edit-close')?.addEventListener('click', () => { $('#item-edit-modal').hidden = true; });
  $('#item-edit-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) $('#item-edit-modal').hidden = true; });
  $('#item-cancel')?.addEventListener('click', () => { $('#item-edit-modal').hidden = true; });
  $('#item-save')?.addEventListener('click', saveCollectionItem);

  // Load panels when tab is clicked
  const originalShowTab = showTab;
  function showTab(name) {
    $$('.sidebar-tab').forEach(t => t.classList.toggle('active', t.dataset.panel === name));
    $$('.sidebar-panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + name));

    // Lazy load panel data
    if (name === 'settings') {
      loadSettings();
    } else if (name === 'collections') {
      loadCollections();
    }
  }
  $$('.sidebar-tab').forEach(t => {
    t.removeEventListener('click', () => {});
    t.addEventListener('click', () => showTab(t.dataset.panel));
  });

  /* ─── Drag from Library onto Canvas ─── */
  let draggedLibComp = null;
  let dragOverlay = null;
  let dropIndicator = null;
  let sectionRects = [];
  let dropIndex = -1;

  function setupLibCardDrag(card, comp) {
    card.setAttribute('draggable', 'true');
    card.addEventListener('dragstart', e => {
      draggedLibComp = comp;
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', comp.name);
      // Create overlay on iframe to capture drag events
      const iframe = $('#preview-iframe');
      if (!iframe) return;
      const rect = iframe.getBoundingClientRect();
      dragOverlay = document.createElement('div');
      dragOverlay.style.cssText = 'position:fixed;z-index:500;background:transparent;pointer-events:auto;' +
        'top:' + rect.top + 'px;left:' + rect.left + 'px;width:' + rect.width + 'px;height:' + rect.height + 'px;';
      document.body.appendChild(dragOverlay);

      dropIndicator = document.createElement('div');
      dropIndicator.className = 'drop-zone-indicator';
      dropIndicator.style.cssText = 'position:fixed;z-index:501;height:3px;background:#6366f1;border-radius:2px;pointer-events:none;display:none;' +
        'left:' + (rect.left + 20) + 'px;width:' + (rect.width - 40) + 'px;box-shadow:0 0 8px rgba(99,102,241,0.5);';
      document.body.appendChild(dropIndicator);

      // Request section rects from bridge
      sendMsg({ type: 'bloxx:get-section-rects' });
      const handler = ev => {
        if (ev.data?.type === 'bloxx:section-rects-response') {
          window.removeEventListener('message', handler);
          sectionRects = ev.data.rects || [];
        }
      };
      window.addEventListener('message', handler);
      setTimeout(() => window.removeEventListener('message', handler), 2000);

      dragOverlay.addEventListener('dragover', onDragOverCanvas);
      dragOverlay.addEventListener('dragleave', onDragLeaveCanvas);
      dragOverlay.addEventListener('drop', onDropCanvas);
    });
    card.addEventListener('dragend', cleanupDrag);
  }

  function onDragOverCanvas(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!sectionRects.length || !dropIndicator) return;
    const iframe = $('#preview-iframe');
    if (!iframe) return;
    const iframeRect = iframe.getBoundingClientRect();
    const mouseY = e.clientY - iframeRect.top;

    // Find insertion index based on mouseY relative to section midpoints
    dropIndex = sectionRects.length; // default: append at end
    for (let i = 0; i < sectionRects.length; i++) {
      const mid = (sectionRects[i].top + sectionRects[i].bottom) / 2;
      if (mouseY < mid) { dropIndex = i; break; }
    }

    // Position indicator
    let indicatorY;
    if (dropIndex === 0 && sectionRects.length) {
      indicatorY = iframeRect.top + sectionRects[0].top;
    } else if (dropIndex < sectionRects.length) {
      indicatorY = iframeRect.top + (sectionRects[dropIndex - 1].bottom + sectionRects[dropIndex].top) / 2;
    } else if (sectionRects.length) {
      indicatorY = iframeRect.top + sectionRects[sectionRects.length - 1].bottom;
    } else {
      indicatorY = iframeRect.top + iframeRect.height / 2;
    }
    dropIndicator.style.top = (indicatorY - 1) + 'px';
    dropIndicator.style.display = 'block';
  }

  function onDragLeaveCanvas() {
    if (dropIndicator) dropIndicator.style.display = 'none';
    dropIndex = -1;
  }

  function onDropCanvas(e) {
    e.preventDefault();
    if (draggedLibComp && dropIndex >= 0) {
      insertLibraryComponent(draggedLibComp, dropIndex);
    }
    cleanupDrag();
  }

  function cleanupDrag() {
    if (dragOverlay) { dragOverlay.remove(); dragOverlay = null; }
    if (dropIndicator) { dropIndicator.remove(); dropIndicator = null; }
    draggedLibComp = null;
    sectionRects = [];
    dropIndex = -1;
  }

  // Patch renderLibrary to add draggable to lib-cards
  const _origRenderLibrary = typeof renderLibrary === 'function' ? renderLibrary : null;

  // Observe library grid for new cards and make them draggable
  const libGrid = $('#library-grid');
  if (libGrid) {
    new MutationObserver(() => {
      libGrid.querySelectorAll('.lib-card:not([draggable])').forEach(card => {
        // Find corresponding component data from card content
        const nameEl = card.querySelector('.lib-card-name');
        const idEl = card.querySelector('.lib-card-id');
        if (nameEl && idEl) {
          const shortId = (idEl.textContent || '').replace('@', '').trim();
          // Store component reference on the card for drag
          card._libComp = { name: nameEl.textContent, short_id: shortId };
          setupLibCardDrag(card, card._libComp);
        }
      });
    }).observe(libGrid, { childList: true });
  }

  /* ─── Code Editor Panel ─── */
  $('#btn-code-panel')?.addEventListener('click', () => {
    const panel = $('#code-panel');
    if (!panel) return;
    panel.hidden = !panel.hidden;
    document.documentElement.style.setProperty('--code-panel-w', panel.hidden ? '0px' : '400px');
    $('#btn-code-panel').classList.toggle('active', !panel.hidden);
    if (!panel.hidden) syncCodePanel();
  });

  function syncCodePanel() {
    if ($('#code-panel')?.hidden) return;
    const editor = $('#code-panel-editor');
    if (!editor) return;

    // Primary: show selected element's HTML
    if (state.selected?.html) {
      editor.value = state.selected.html;
      return;
    }

    // Secondary: fetch full section HTML via bridge
    if (state.selectedSectionIdx < 0) return;
    const handler = e => {
      if (e.data?.type === 'bloxx:section-html-response' && e.data.index === state.selectedSectionIdx) {
        window.removeEventListener('message', handler);
        editor.value = e.data.html || '';
      }
    };
    window.addEventListener('message', handler);
    sendMsg({ type: 'bloxx:get-section-html', index: state.selectedSectionIdx });
    setTimeout(() => window.removeEventListener('message', handler), 3000);
  }

  $('#code-panel-apply')?.addEventListener('click', async () => {
    const code = $('#code-panel-editor')?.value;
    if (!code?.trim() || state.selectedSectionIdx < 0) return;
    await pushSnapshot();
    sendMsg({ type: 'bloxx:replace-section', index: state.selectedSectionIdx, html: code });
    setDirty(true);
    toast('HTML applied', 'success');
  });

  $('#code-panel-close')?.addEventListener('click', () => {
    const panel = $('#code-panel');
    if (!panel) return;
    panel.hidden = true;
    document.documentElement.style.setProperty('--code-panel-w', '0px');
    $('#btn-code-panel')?.classList.remove('active');
  });

  /* ─── Boot ─── */
  // Populate site dropdown from R2
  (async () => {
    try {
      const d = await api('/api/sites');
      const sel = $('#site-select');
      sel.innerHTML = '';
      for (const s of (d.sites || [])) {
        const o = document.createElement('option');
        o.value = s;
        o.textContent = s;
        if (s === state.site) o.selected = true;
        sel.appendChild(o);
      }
      // If current site not in list, add it
      if (state.site && !(d.sites || []).includes(state.site)) {
        const o = document.createElement('option');
        o.value = state.site;
        o.textContent = state.site;
        o.selected = true;
        sel.prepend(o);
      }
    } catch {}
  })();

  init();

})();
