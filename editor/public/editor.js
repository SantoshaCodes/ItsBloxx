/**
 * Bloxx Visual Editor — Main Client Script (v3.1)
 * Updated: 2026-01-28
 *
 * Component-based editing with @id labels, extracted text fields,
 * Component Library modal, Update Schema button, drag-and-drop.
 * Added: Settings, Collections, and Audit panels.
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

  /* ─── State ─── */
  const params = new URLSearchParams(location.search);
  const state = {
    site: params.get('site') || 'goforma',
    page: params.get('page') || '',
    pages: [],
    sections: [],          // from bridge: { index, tag, id, ariaLabel, heading, classes, fields[] }
    selected: null,        // { tag, selector, text, html, classes, attributes, rect }
    selectedSectionIdx: -1,
    etag: null,
    dirty: false,
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

  /* ─── Auto-save (localStorage) ─── */
  function draftKey() { return 'bloxx-draft-' + state.site + '-' + state.page; }
  function saveDraft(html) { try { localStorage.setItem(draftKey(), html); } catch {} }
  function clearDraft() { localStorage.removeItem(draftKey()); }

  let autoSaveTimer = null;
  function startAutoSave() {
    if (autoSaveTimer) clearInterval(autoSaveTimer);
    autoSaveTimer = setInterval(async () => {
      if (state.dirty && state.page) {
        const html = await requestIframeHTML();
        if (html) saveDraft(html);
      }
    }, 5000);
  }

  /* ─── Iframe communication ─── */
  const iframe = () => $('#preview-iframe');

  function sendMsg(msg) {
    const f = iframe();
    if (f && f.contentWindow) f.contentWindow.postMessage(msg, '*');
  }

  function requestIframeHTML() {
    return new Promise(resolve => {
      let done = false;
      const handler = e => {
        if (e.data && e.data.type === 'bloxx:html-response') {
          done = true;
          window.removeEventListener('message', handler);
          resolve(e.data.html);
        }
      };
      window.addEventListener('message', handler);
      sendMsg({ type: 'bloxx:get-html' });
      setTimeout(() => { if (!done) { window.removeEventListener('message', handler); resolve(null); } }, 3000);
    });
  }

  function loadHTMLIntoIframe(html) {
    const f = iframe();
    if (!f) return;
    f.onload = null;
    const doc = f.contentDocument || f.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
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
        } else {
          renderProperties();
          showTab('properties');
        }
        break;
      case 'bloxx:dirty':
        if (!state.dirty) pushSnapshot();
        setDirty(true);
        break;
    }
  });

  /* ─── Load a page ─── */
  async function loadPage(pageName) {
    if (!pageName) return;
    state.page = pageName;
    state.selected = null;
    state.selectedSectionIdx = -1;
    setDirty(false);
    snapshots.past = [];
    snapshots.future = [];
    updateUndoRedo();

    const u = new URL(location.href);
    u.searchParams.set('site', state.site);
    u.searchParams.set('page', pageName);
    history.replaceState({}, '', u);

    const loading = $('#canvas-loading');
    loading.classList.remove('hidden');

    const f = iframe();
    f.src = '/preview/' + state.site + '/' + pageName;
    f.onload = () => {
      loading.classList.add('hidden');
      const info = state.pages.find(p => p.name === pageName);
      if (info) state.etag = info.etag;
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
            sendMsg({ type: 'bloxx:swap-sections', indexA: evt.oldIndex, indexB: evt.newIndex });
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
          body: JSON.stringify({ sectionHtml, currentSchemas, componentType }),
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

  async function insertLibraryComponent(comp) {
    closeAllModals();
    toast('Loading ' + comp.name + '…');

    // If component already has html, use it directly
    if (comp.html) {
      await pushSnapshot();
      sendMsg({ type: 'bloxx:append-section', html: comp.html });
      setDirty(true);
      toast(comp.name + ' added — save to enhance', 'success');
      return;
    }

    // Otherwise fetch rendered HTML from Xano
    try {
      const d = await api('/api/components?action=render&uid=' + encodeURIComponent(comp.short_id));
      if (d.ok && d.html) {
        await pushSnapshot();
        sendMsg({ type: 'bloxx:append-section', html: d.html });
        setDirty(true);
        toast(comp.name + ' added — save to enhance', 'success');
      } else {
        toast('Failed: ' + (d.error || 'unknown'), 'error');
      }
    } catch (err) {
      toast('Failed to load component', 'error');
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

  /* ─── Page Audit (Xano API v2) ─── */
  async function runPageAudit() {
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
      // Build the public preview URL for Xano to crawl
      const previewUrl = `${location.origin}/preview/${state.site}/${state.page}`;

      // Call Xano API v2 endpoint with URL
      const response = await fetch('https://xyrm-sqqj-hx6t.n7c.xano.io/api:la4i98J3/auditv2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: previewUrl })
      });

      const data = await response.json();

      // Hide loading, show results
      $('#audit-loading').hidden = true;

      if (data.score !== undefined) {
        $('#audit-results').hidden = false;

        const scoreEl = $('#audit-score-value');
        const labelEl = $('#audit-score-label');
        const circleEl = $('#audit-score-circle');
        const itemsEl = $('#audit-items');

        const score = Math.round(data.score);
        scoreEl.textContent = score;

        // Update circle progress
        const circumference = 2 * Math.PI * 45; // 283
        const offset = circumference - (score / 100) * circumference;
        circleEl.style.strokeDashoffset = offset;

        // Update color based on score
        let color = 'var(--bx-success)';
        let label = 'Excellent';
        if (score < 50) {
          color = 'var(--bx-danger)';
          label = 'Needs Work';
        } else if (score < 75) {
          color = 'var(--bx-warning)';
          label = 'Good';
        } else if (score < 90) {
          color = 'var(--bx-primary)';
          label = 'Very Good';
        }
        circleEl.style.stroke = color;
        labelEl.textContent = label;

        // Render audit items
        itemsEl.innerHTML = '';
        const items = data.items || data.checks || [];
        items.forEach(item => {
          const status = item.passed ? 'pass' : (item.warning ? 'warn' : 'fail');
          const icon = item.passed ? 'bi-check-lg' : (item.warning ? 'bi-exclamation' : 'bi-x-lg');
          const div = document.createElement('div');
          div.className = 'audit-item';
          div.innerHTML = `
            <div class="audit-item-icon ${status}"><i class="bi ${icon}"></i></div>
            <div class="audit-item-content">
              <div class="audit-item-title">${esc(item.name || item.rule || '')}</div>
              <div class="audit-item-detail">${esc(item.message || item.detail || '')}</div>
            </div>
            <div class="audit-item-score">${item.score || 0}/${item.maxScore || item.weight || 0}</div>
          `;
          itemsEl.appendChild(div);
        });
      } else {
        // Show error from API
        $('#audit-error').hidden = false;
        $('#audit-error-message').textContent = data.message || data.error || 'Unable to audit page';
      }
    } catch (err) {
      console.error('Audit error:', err);
      $('#audit-loading').hidden = true;
      $('#audit-error').hidden = false;
      $('#audit-error-message').textContent = 'Failed to connect to audit service';
    }
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

  /* ─── Boot ─── */
  init();

})();
