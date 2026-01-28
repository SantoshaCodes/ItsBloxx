/**
 * Preview worker — serves HTML from R2 drafts with bridge script injected.
 * Route: /preview/{site}/{page}
 * Example: /preview/goforma/index → R2 key: goforma/drafts/index.html
 *
 * Also serves assets: /preview/{site}/_asset/css/theme.css → goforma/assets/css/theme.css
 */

interface Env {
  BLOXX_SITES: R2Bucket;
}

const BRIDGE_SCRIPT = `
<script id="bloxx-editor-bridge">
(function() {
  'use strict';

  let hoveredEl = null;
  let selectedEl = null;
  const EDITOR_ORIGIN = location.origin;

  // --- Hover highlight ---
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('section, [itemprop], h1, h2, h3, h4, h5, h6, p, a, img, .card, .btn, [class*="col-"]');
    if (!el || el === hoveredEl) return;
    if (hoveredEl) hoveredEl.removeAttribute('data-bloxx-hovered');
    hoveredEl = el;
    el.setAttribute('data-bloxx-hovered', 'true');
  });

  document.addEventListener('mouseout', (e) => {
    if (hoveredEl) {
      hoveredEl.removeAttribute('data-bloxx-hovered');
      hoveredEl = null;
    }
  });

  // --- Click select ---
  document.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.target.closest('section, [itemprop], h1, h2, h3, h4, h5, h6, p, a, img, .card, .btn, [class*="col-"]');
    if (!el) return;
    if (selectedEl) selectedEl.removeAttribute('data-bloxx-selected');
    selectedEl = el;
    el.setAttribute('data-bloxx-selected', 'true');

    // Compute a CSS selector path for the element
    const path = cssPath(el);

    // Report element properties to parent
    window.parent.postMessage({
      type: 'bloxx:element-selected',
      tag: el.tagName.toLowerCase(),
      selector: path,
      text: el.textContent?.substring(0, 200) || '',
      html: el.outerHTML.substring(0, 2000),
      classes: el.className || '',
      attributes: Object.fromEntries(
        Array.from(el.attributes).map(a => [a.name, a.value])
      ),
      rect: el.getBoundingClientRect(),
    }, EDITOR_ORIGIN);
  }, true);

  // --- Extract editable fields from a section ---
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
        if (text && text.length > 1) {
          fields.push({ tag, selector: path, label: tag.toUpperCase() + ': ' + text.substring(0, 30), text });
        }
      }
    });
    return fields.slice(0, 30); // cap at 30 fields
  }

  // --- Section reporting (on load) ---
  function reportSections() {
    const main = document.querySelector('main') || document.body;
    const sections = Array.from(main.querySelectorAll(':scope > section, :scope > header, :scope > footer'));
    const list = sections.map((s, i) => ({
      index: i,
      tag: s.tagName.toLowerCase(),
      id: s.id || '',
      ariaLabel: s.getAttribute('aria-label') || s.getAttribute('aria-labelledby') || '',
      heading: s.querySelector('h1,h2,h3')?.textContent?.trim()?.substring(0, 60) || '',
      classes: s.className || '',
      fields: extractFields(s),
    }));
    window.parent.postMessage({ type: 'bloxx:sections-list', sections: list }, EDITOR_ORIGIN);
  }
  // Report on load and on mutations
  reportSections();
  new MutationObserver(() => reportSections()).observe(document.body, { childList: true, subtree: true });

  // --- Receive commands from editor ---
  window.addEventListener('message', (e) => {
    if (e.origin !== EDITOR_ORIGIN) return;
    const msg = e.data;
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'bloxx:update-text': {
        const el = document.querySelector(msg.selector);
        if (el) {
          el.textContent = msg.value;
          notifyDirty();
        }
        break;
      }
      case 'bloxx:update-attribute': {
        const el = document.querySelector(msg.selector);
        if (el) {
          el.setAttribute(msg.attr, msg.value);
          notifyDirty();
        }
        break;
      }
      case 'bloxx:update-classes': {
        const el = document.querySelector(msg.selector);
        if (el) {
          el.className = msg.value;
          notifyDirty();
        }
        break;
      }
      case 'bloxx:update-html': {
        const el = document.querySelector(msg.selector);
        if (el) {
          el.innerHTML = msg.value;
          notifyDirty();
        }
        break;
      }
      case 'bloxx:delete-element': {
        const el = document.querySelector(msg.selector);
        if (el) {
          el.remove();
          notifyDirty();
        }
        break;
      }
      case 'bloxx:swap-sections': {
        const main = document.querySelector('main') || document.body;
        const sections = Array.from(main.querySelectorAll(':scope > section'));
        const a = sections[msg.indexA];
        const b = sections[msg.indexB];
        if (a && b) {
          const aNext = a.nextSibling;
          main.insertBefore(a, b);
          main.insertBefore(b, aNext);
          notifyDirty();
        }
        break;
      }
      case 'bloxx:get-html': {
        // Return the full page HTML (without bridge)
        const clone = document.documentElement.cloneNode(true);
        clone.querySelector('#bloxx-editor-bridge')?.remove();
        clone.querySelector('#bloxx-editor-styles')?.remove();
        clone.querySelectorAll('[data-bloxx-selected]').forEach(el => el.removeAttribute('data-bloxx-selected'));
        clone.querySelectorAll('[data-bloxx-hovered]').forEach(el => el.removeAttribute('data-bloxx-hovered'));
        window.parent.postMessage({
          type: 'bloxx:html-response',
          html: '<!DOCTYPE html>\\n' + clone.outerHTML,
        }, EDITOR_ORIGIN);
        break;
      }
      case 'bloxx:replace-element': {
        const el = document.querySelector(msg.selector);
        if (el) {
          const temp = document.createElement('div');
          temp.innerHTML = msg.html;
          const newEl = temp.firstElementChild;
          if (newEl) {
            el.replaceWith(newEl);
          } else {
            el.outerHTML = msg.html;
          }
          notifyDirty();
        }
        break;
      }
      case 'bloxx:move-element': {
        const el = document.querySelector(msg.selector);
        if (!el || !el.parentElement) break;
        const parent = el.parentElement;
        if (msg.direction === 'up' && el.previousElementSibling) {
          parent.insertBefore(el, el.previousElementSibling);
          notifyDirty();
        } else if (msg.direction === 'down' && el.nextElementSibling) {
          parent.insertBefore(el.nextElementSibling, el);
          notifyDirty();
        }
        break;
      }
      case 'bloxx:replace-section': {
        const main = document.querySelector('main') || document.body;
        const sections = Array.from(main.querySelectorAll(':scope > section'));
        if (msg.index >= 0 && msg.index < sections.length) {
          const temp = document.createElement('div');
          temp.innerHTML = msg.html;
          const newSection = temp.firstElementChild || temp;
          sections[msg.index].replaceWith(newSection);
          notifyDirty();
        }
        break;
      }
      case 'bloxx:append-section': {
        const main = document.querySelector('main') || document.body;
        const footer = main.querySelector(':scope > footer');
        const temp = document.createElement('div');
        temp.innerHTML = msg.html;
        const newSection = temp.firstElementChild || temp;
        if (footer) {
          main.insertBefore(newSection, footer);
        } else {
          main.appendChild(newSection);
        }
        notifyDirty();
        newSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      }
      case 'bloxx:delete-section': {
        const main = document.querySelector('main') || document.body;
        const sections = Array.from(main.querySelectorAll(':scope > section'));
        if (msg.index >= 0 && msg.index < sections.length) {
          sections[msg.index].remove();
          notifyDirty();
        }
        break;
      }
      case 'bloxx:get-section-html': {
        const main = document.querySelector('main') || document.body;
        const sections = Array.from(main.querySelectorAll(':scope > section, :scope > header, :scope > footer'));
        if (msg.index >= 0 && msg.index < sections.length) {
          window.parent.postMessage({
            type: 'bloxx:section-html-response',
            index: msg.index,
            html: sections[msg.index].outerHTML,
          }, EDITOR_ORIGIN);
        }
        break;
      }
      case 'bloxx:highlight-section': {
        const main = document.querySelector('main') || document.body;
        const sections = Array.from(main.querySelectorAll(':scope > section'));
        // Clear all
        sections.forEach(s => s.removeAttribute('data-bloxx-section-highlight'));
        if (msg.index >= 0 && msg.index < sections.length) {
          sections[msg.index].setAttribute('data-bloxx-section-highlight', 'true');
          sections[msg.index].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        break;
      }
      case 'bloxx:get-schemas': {
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        const schemas = [];
        scripts.forEach(s => {
          try { schemas.push(JSON.parse(s.textContent)); } catch {}
        });
        window.parent.postMessage({ type: 'bloxx:schemas-response', schemas }, EDITOR_ORIGIN);
        break;
      }
      case 'bloxx:update-schemas': {
        // Remove existing JSON-LD scripts
        document.querySelectorAll('script[type="application/ld+json"]').forEach(s => s.remove());
        // Inject new ones into <head>
        const head = document.head || document.documentElement;
        (msg.schemas || []).forEach(schema => {
          const script = document.createElement('script');
          script.type = 'application/ld+json';
          script.textContent = JSON.stringify(schema, null, 2);
          head.appendChild(script);
        });
        notifyDirty();
        break;
      }
    }
  });

  function notifyDirty() {
    window.parent.postMessage({ type: 'bloxx:dirty' }, EDITOR_ORIGIN);
  }

  // --- CSS path utility ---
  function cssPath(el) {
    if (el.id) return '#' + el.id;
    const parts = [];
    while (el && el.nodeType === 1) {
      let selector = el.tagName.toLowerCase();
      if (el.id) { parts.unshift('#' + el.id); break; }
      const parent = el.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
        if (siblings.length > 1) {
          selector += ':nth-of-type(' + (siblings.indexOf(el) + 1) + ')';
        }
      }
      parts.unshift(selector);
      el = parent;
    }
    return parts.join(' > ');
  }
})();
</script>
<style id="bloxx-editor-styles">
  [data-bloxx-hovered] {
    outline: 2px dashed rgba(99, 102, 241, 0.5) !important;
    outline-offset: 2px;
  }
  [data-bloxx-selected] {
    outline: 2px solid #6366f1 !important;
    outline-offset: 2px;
  }
  [data-bloxx-section-highlight] {
    outline: 3px solid #6366f1 !important;
    outline-offset: 4px;
    transition: outline 0.2s;
  }
  * { cursor: default !important; }
  a, button, [role="button"] { pointer-events: auto !important; }
</style>
`;

export const onRequest: PagesFunction<Env> = async (context) => {
  const { params, env } = context;
  const pathParts = (params.path as string[]) || [];

  // /preview/{site}/{page} or /preview/{site}/_asset/{...path}
  if (pathParts.length < 2) {
    return new Response('Not found. Use /preview/{site}/{page}', { status: 404 });
  }

  const site = pathParts[0];

  // Asset serving: /preview/{site}/_asset/css/theme.css
  if (pathParts[1] === '_asset') {
    const assetPath = pathParts.slice(2).join('/');
    const key = `${site}/assets/${assetPath}`;
    const obj = await env.BLOXX_SITES.get(key);
    if (!obj) return new Response('Asset not found', { status: 404 });
    const headers = new Headers();
    obj.httpMetadata?.contentType && headers.set('Content-Type', obj.httpMetadata.contentType);
    headers.set('Cache-Control', 'public, max-age=3600');
    return new Response(obj.body, { headers });
  }

  const page = pathParts.slice(1).join('/');
  const key = `${site}/drafts/${page}.html`;
  const obj = await env.BLOXX_SITES.get(key);

  if (!obj) {
    return new Response(`Page not found: ${key}`, { status: 404 });
  }

  let html = await obj.text();

  // Rewrite relative asset paths to go through our asset proxy
  html = html.replace(
    /(href|src)="(?!https?:\/\/|\/\/|#|mailto:|tel:)([^"]+)"/g,
    (match, attr, path) => {
      if (path.endsWith('.html')) return match; // keep page links as-is
      return `${attr}="/preview/${site}/_asset/${path}"`;
    }
  );

  // Inject bridge before </body>
  html = html.replace('</body>', BRIDGE_SCRIPT + '\n</body>');

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'ETag': obj.httpEtag,
      'Cache-Control': 'no-cache',
    },
  });
};
