/**
 * page-audit.ts — Page optimization scoring system
 *
 * Real-time audit of page content for SEO, accessibility, and content quality.
 * Returns a score 0-100 with detailed issues and passed checks.
 */

import { parseHTML } from 'linkedom';
import { requiresFAQ } from './page-types';

export interface AuditRule {
  id: string;
  weight: number;
  check: (data: PageAuditData) => AuditCheckResult;
}

export interface AuditCheckResult {
  passed: boolean;
  message: string;
  value?: number | string | boolean;
}

export interface PageAuditData {
  html: string;
  pageType: string;
  metaTitle?: string;
  metaDescription?: string;
}

export interface PageAuditResult {
  score: number;
  issues: AuditIssue[];
  passed: AuditPassed[];
  metrics: Record<string, number | string | boolean>;
}

export interface AuditIssue {
  ruleId: string;
  message: string;
  weight: number;
}

export interface AuditPassed {
  ruleId: string;
  message: string;
}

/**
 * Count words in text content
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Extract text content from HTML
 */
function extractTextContent(html: string): string {
  const { document } = parseHTML(html);
  // Remove script and style elements
  document.querySelectorAll('script, style, noscript').forEach((el: Element) => el.remove());
  return document.body?.textContent || '';
}

/**
 * Count images missing alt text
 */
function countMissingAltText(html: string): number {
  const { document } = parseHTML(html);
  const images = document.querySelectorAll('img');
  let missing = 0;
  for (const img of images) {
    const alt = img.getAttribute('alt');
    if (!alt || alt.trim() === '') {
      missing++;
    }
  }
  return missing;
}

/**
 * Count H1 headings
 */
function countH1Headings(html: string): number {
  const { document } = parseHTML(html);
  return document.querySelectorAll('h1').length;
}

/**
 * Check if JSON-LD schema exists
 */
function hasSchemaMarkup(html: string): boolean {
  const { document } = parseHTML(html);
  return document.querySelectorAll('script[type="application/ld+json"]').length > 0;
}

/**
 * Check if FAQ section exists (accordion or details elements)
 */
function hasFAQSection(html: string): boolean {
  const { document } = parseHTML(html);
  const hasDetails = document.querySelectorAll('details').length > 0;
  const hasAccordion = document.querySelectorAll('.accordion, .accordion-item').length > 0;
  const hasFAQSchema = html.includes('"@type":"FAQPage"') || html.includes('"@type": "FAQPage"');
  return hasDetails || hasAccordion || hasFAQSchema;
}

/**
 * Count internal links
 */
function countInternalLinks(html: string): number {
  const { document } = parseHTML(html);
  const links = document.querySelectorAll('a[href]');
  let internal = 0;
  for (const link of links) {
    const href = link.getAttribute('href') || '';
    // Internal links start with / or don't have protocol
    if (href.startsWith('/') || (!href.includes('://') && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:'))) {
      internal++;
    }
  }
  return internal;
}

/**
 * Check heading hierarchy (no skipped levels)
 */
function checkHeadingHierarchy(html: string): { valid: boolean; issues: string[] } {
  const { document } = parseHTML(html);
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const issues: string[] = [];
  let lastLevel = 0;

  for (const heading of headings) {
    const level = parseInt(heading.tagName.substring(1));
    if (lastLevel > 0 && level > lastLevel + 1) {
      issues.push(`Skipped heading level: h${lastLevel} to h${level}`);
    }
    lastLevel = level;
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Check for missing ARIA labels on interactive elements
 */
function countMissingAriaLabels(html: string): number {
  const { document } = parseHTML(html);
  let missing = 0;

  // Check nav elements
  const navs = document.querySelectorAll('nav');
  for (const nav of navs) {
    if (!nav.getAttribute('aria-label') && !nav.getAttribute('aria-labelledby')) {
      missing++;
    }
  }

  // Check form inputs without labels
  const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
  for (const input of inputs) {
    const id = input.getAttribute('id');
    const hasLabel = id && document.querySelector(`label[for="${id}"]`);
    const hasAriaLabel = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby');
    if (!hasLabel && !hasAriaLabel) {
      missing++;
    }
  }

  return missing;
}

/**
 * Audit rules configuration
 */
export const PAGE_AUDIT_RULES: AuditRule[] = [
  // Content metrics
  {
    id: 'wordCount',
    weight: 15,
    check: (data) => {
      const text = extractTextContent(data.html);
      const count = countWords(text);
      if (count < 300) {
        return { passed: false, message: `Add more content (${count}/300 words minimum)`, value: count };
      }
      if (count > 2500) {
        return { passed: false, message: `Consider splitting into multiple pages (${count} words)`, value: count };
      }
      return { passed: true, message: `Good word count (${count} words)`, value: count };
    }
  },

  // SEO metrics
  {
    id: 'missingAltText',
    weight: 20,
    check: (data) => {
      const count = countMissingAltText(data.html);
      if (count > 0) {
        return { passed: false, message: `${count} image(s) missing alt text`, value: count };
      }
      return { passed: true, message: 'All images have alt text', value: count };
    }
  },

  {
    id: 'metaTitle',
    weight: 15,
    check: (data) => {
      const length = data.metaTitle?.length || 0;
      if (!length) {
        return { passed: false, message: 'Missing meta title', value: length };
      }
      if (length < 30) {
        return { passed: false, message: `Meta title too short (${length}/30 chars)`, value: length };
      }
      if (length > 60) {
        return { passed: false, message: `Meta title too long (${length}/60 chars)`, value: length };
      }
      return { passed: true, message: 'Meta title length good', value: length };
    }
  },

  {
    id: 'metaDescription',
    weight: 15,
    check: (data) => {
      const length = data.metaDescription?.length || 0;
      if (!length) {
        return { passed: false, message: 'Missing meta description', value: length };
      }
      if (length < 120) {
        return { passed: false, message: `Meta description too short (${length}/120 chars)`, value: length };
      }
      if (length > 160) {
        return { passed: false, message: `Meta description may be truncated (${length}/160 chars)`, value: length };
      }
      return { passed: true, message: 'Meta description length good', value: length };
    }
  },

  {
    id: 'headingStructure',
    weight: 10,
    check: (data) => {
      const h1Count = countH1Headings(data.html);
      if (h1Count === 0) {
        return { passed: false, message: 'Missing H1 heading', value: h1Count };
      }
      if (h1Count > 1) {
        return { passed: false, message: `Multiple H1 headings found (${h1Count}) - should have exactly 1`, value: h1Count };
      }
      return { passed: true, message: 'Heading structure good', value: h1Count };
    }
  },

  {
    id: 'headingHierarchy',
    weight: 5,
    check: (data) => {
      const { valid, issues } = checkHeadingHierarchy(data.html);
      if (!valid) {
        return { passed: false, message: issues[0] || 'Heading hierarchy issues', value: issues.length };
      }
      return { passed: true, message: 'Heading hierarchy valid', value: 0 };
    }
  },

  // Schema
  {
    id: 'hasSchema',
    weight: 10,
    check: (data) => {
      const has = hasSchemaMarkup(data.html);
      if (!has) {
        return { passed: false, message: 'Add schema markup for better SEO', value: has };
      }
      return { passed: true, message: 'Schema markup present', value: has };
    }
  },

  // FAQ (conditional based on page type)
  {
    id: 'hasFAQ',
    weight: 10,
    check: (data) => {
      if (!requiresFAQ(data.pageType)) {
        // Rule doesn't apply to this page type - return passed with null message
        return { passed: true, message: '', value: false };
      }
      const has = hasFAQSection(data.html);
      if (!has) {
        return { passed: false, message: 'Consider adding FAQ section for this page type', value: has };
      }
      return { passed: true, message: 'FAQ section present', value: has };
    }
  },

  // Internal linking
  {
    id: 'internalLinks',
    weight: 5,
    check: (data) => {
      const count = countInternalLinks(data.html);
      if (count < 2) {
        return { passed: false, message: `Add more internal links (${count}/2 minimum)`, value: count };
      }
      return { passed: true, message: `Good internal linking (${count} links)`, value: count };
    }
  },

  // Accessibility
  {
    id: 'ariaLabels',
    weight: 5,
    check: (data) => {
      const missing = countMissingAriaLabels(data.html);
      if (missing > 0) {
        return { passed: false, message: `${missing} element(s) missing ARIA labels`, value: missing };
      }
      return { passed: true, message: 'ARIA labels present', value: missing };
    }
  },
];

/**
 * Calculate page audit score
 */
export function calculatePageScore(data: PageAuditData): PageAuditResult {
  let totalWeight = 0;
  let earnedWeight = 0;
  const issues: AuditIssue[] = [];
  const passed: AuditPassed[] = [];
  const metrics: Record<string, number | string | boolean> = {};

  for (const rule of PAGE_AUDIT_RULES) {
    const result = rule.check(data);

    // Skip rules that don't apply (empty message)
    if (result.message === '') continue;

    totalWeight += rule.weight;
    metrics[rule.id] = result.value ?? result.passed;

    if (result.passed) {
      earnedWeight += rule.weight;
      passed.push({ ruleId: rule.id, message: result.message });
    } else {
      issues.push({ ruleId: rule.id, message: result.message, weight: rule.weight });
    }
  }

  // Sort issues by weight (highest first)
  issues.sort((a, b) => b.weight - a.weight);

  const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 100;

  return { score, issues, passed, metrics };
}

/**
 * Quick audit that extracts meta from HTML
 */
export function auditPage(html: string, pageType: string = 'custom'): PageAuditResult {
  const { document } = parseHTML(html);

  const metaTitle = document.querySelector('title')?.textContent || '';
  const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';

  return calculatePageScore({
    html,
    pageType,
    metaTitle,
    metaDescription,
  });
}

/**
 * Get a letter grade from score
 */
export function getGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Get color for score (for UI)
 */
export function getScoreColor(score: number): string {
  if (score >= 90) return '#22c55e'; // green
  if (score >= 70) return '#eab308'; // yellow
  if (score >= 50) return '#f97316'; // orange
  return '#ef4444'; // red
}
