/**
 * html-editor.ts — Utilities for cleaning and transforming HTML
 *
 * Strips bridge script injection, cleans editor artifacts,
 * and prepares HTML for saving to R2.
 */
import { parseHTML } from 'linkedom';

/** The bridge script ID injected by the preview worker */
const BRIDGE_SCRIPT_ID = 'bloxx-editor-bridge';
const BRIDGE_STYLE_ID = 'bloxx-editor-styles';

/**
 * Remove all editor-injected elements (bridge script, hover styles, selection overlays)
 * Returns clean HTML suitable for storage/deployment.
 */
export function stripBridge(html: string): string {
  const { document } = parseHTML(html);

  // Remove bridge script
  document.getElementById(BRIDGE_SCRIPT_ID)?.remove();
  document.getElementById(BRIDGE_STYLE_ID)?.remove();

  // Remove any data-bloxx-* attributes added by the editor
  const allElements = document.querySelectorAll('[data-bloxx-selected]');
  for (const el of allElements) {
    el.removeAttribute('data-bloxx-selected');
  }
  const hovered = document.querySelectorAll('[data-bloxx-hovered]');
  for (const el of hovered) {
    el.removeAttribute('data-bloxx-hovered');
  }

  return document.toString();
}

/**
 * Update a specific element's text content by its data-bloxx-id or CSS selector.
 */
export function updateElementText(html: string, selector: string, newText: string): string {
  const { document } = parseHTML(html);
  const el = document.querySelector(selector);
  if (el) el.textContent = newText;
  return document.toString();
}

/**
 * Update an element's attribute (e.g., src, href, alt).
 */
export function updateElementAttribute(html: string, selector: string, attr: string, value: string): string {
  const { document } = parseHTML(html);
  const el = document.querySelector(selector);
  if (el) el.setAttribute(attr, value);
  return document.toString();
}

/**
 * Swap two sibling sections by their indices (0-based among <section> elements).
 */
export function swapSections(html: string, indexA: number, indexB: number): string {
  const { document } = parseHTML(html);
  const main = document.querySelector('main') || document.body;
  const sections = Array.from(main.querySelectorAll(':scope > section'));

  if (indexA < 0 || indexB < 0 || indexA >= sections.length || indexB >= sections.length) {
    return html; // out of bounds, no-op
  }

  const a = sections[indexA];
  const b = sections[indexB];

  // Swap by inserting before each other's original next sibling
  const aNext = a.nextSibling;
  const bNext = b.nextSibling;
  if (aNext === b) {
    main.insertBefore(b, a);
  } else if (bNext === a) {
    main.insertBefore(a, b);
  } else {
    main.insertBefore(a, bNext);
    main.insertBefore(b, aNext);
  }

  return document.toString();
}

/**
 * Delete a section by index.
 */
export function deleteSection(html: string, index: number): string {
  const { document } = parseHTML(html);
  const main = document.querySelector('main') || document.body;
  const sections = Array.from(main.querySelectorAll(':scope > section'));
  if (index >= 0 && index < sections.length) {
    sections[index].remove();
  }
  return document.toString();
}

/**
 * Update the page <title> and og:title meta.
 */
export function updatePageTitle(html: string, title: string): string {
  const { document } = parseHTML(html);
  const titleEl = document.querySelector('title');
  if (titleEl) titleEl.textContent = title;
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', title);
  return document.toString();
}

/**
 * Update the meta description and og:description.
 */
export function updatePageDescription(html: string, desc: string): string {
  const { document } = parseHTML(html);
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute('content', desc);
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', desc);
  return document.toString();
}

/**
 * Replace the full innerHTML of a section at a given index.
 */
export function replaceSectionHTML(html: string, sectionIndex: number, newInnerHTML: string): string {
  const { document } = parseHTML(html);
  const main = document.querySelector('main') || document.body;
  const sections = Array.from(main.querySelectorAll(':scope > section'));
  if (sectionIndex >= 0 && sectionIndex < sections.length) {
    sections[sectionIndex].innerHTML = newInnerHTML;
  }
  return document.toString();
}
