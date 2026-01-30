#!/usr/bin/env npx tsx
/**
 * seed-templates.ts — Walk template HTML files, extract components by data-component-type, and seed to database.
 *
 * Usage:
 *   DRY_RUN=true npx tsx scripts/seed-templates.ts
 *   npx tsx scripts/seed-templates.ts
 *
 * Environment:
 *   DRY_RUN=true  — Log extracted data without writing (default: true)
 *   XANO_API_URL  — Xano API base URL
 *   XANO_API_KEY  — Xano API key
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';

const DRY_RUN = process.env.DRY_RUN !== 'false';
const XANO_API_URL = process.env.XANO_API_URL || '';
const XANO_API_KEY = process.env.XANO_API_KEY || '';

const TEMPLATES_DIR = join(import.meta.dirname || __dirname, '..', 'editor', 'public', 'templates');

const VERTICALS = [
  'gym', 'accountant', 'realestate', 'salon', 'dentist', 'saas',
  'agency', 'ecommerce', 'coffeeshop', 'photography', 'construction',
  'plumber', 'insurance',
] as const;

const CANONICAL_COMPONENT_TYPES = new Set([
  'nav', 'hero', 'features', 'stats', 'testimonials', 'team',
  'pricing', 'faq', 'cta', 'contact-form', 'contact-info', 'footer',
  'gallery', 'process', 'blog-grid', 'product-grid', 'story',
]);

const VERTICAL_SCHEMA_TYPES: Record<string, string> = {
  gym: 'HealthClub',
  accountant: 'AccountingService',
  realestate: 'RealEstateAgent',
  salon: 'BeautySalon',
  dentist: 'Dentist',
  saas: 'SoftwareApplication',
  agency: 'ProfessionalService',
  ecommerce: 'Store',
  coffeeshop: 'CafeOrCoffeeShop',
  photography: 'ProfessionalService',
  construction: 'GeneralContractor',
  plumber: 'Plumber',
  insurance: 'InsuranceAgency',
};

interface ExtractedComponent {
  vertical: string;
  page: string;
  componentType: string;
  html: string;
  stableId: string;
}

interface TemplatePage {
  vertical: string;
  page: string;
  filePath: string;
  components: ExtractedComponent[];
  fullHtml: string;
}

interface ValidationError {
  file: string;
  check: string;
  message: string;
}

/**
 * Generate a stable ID from vertical + page + component type
 */
function stableId(vertical: string, page: string, componentType: string): string {
  const input = `${vertical}/${page}/${componentType}`;
  return createHash('sha256').update(input).digest('hex').substring(0, 12);
}

/**
 * Extract sections by data-component-type from HTML string.
 * Uses a simple regex approach — sufficient for well-structured templates.
 */
function extractComponents(html: string, vertical: string, page: string): ExtractedComponent[] {
  const components: ExtractedComponent[] = [];
  const regex = /data-component-type=["']([^"']+)["']/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const componentType = match[1];
    components.push({
      vertical,
      page,
      componentType,
      html: '', // Full extraction would require DOM parsing; we record the type
      stableId: stableId(vertical, page, componentType),
    });
  }

  return components;
}

async function walkTemplates(): Promise<TemplatePage[]> {
  const pages: TemplatePage[] = [];

  for (const vertical of VERTICALS) {
    const verticalDir = join(TEMPLATES_DIR, vertical);
    let files: string[];
    try {
      files = await readdir(verticalDir);
    } catch {
      console.warn(`⚠ No directory found for vertical: ${vertical}`);
      continue;
    }

    const htmlFiles = files.filter(f => f.endsWith('.html')).sort();

    for (const file of htmlFiles) {
      const filePath = join(verticalDir, file);
      const fullHtml = await readFile(filePath, 'utf-8');
      const page = basename(file, '.html');
      const components = extractComponents(fullHtml, vertical, page);

      pages.push({
        vertical,
        page,
        filePath,
        components,
        fullHtml,
      });
    }
  }

  return pages;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function countOccurrences(html: string, tag: string): number {
  // Count opening tags like <nav, <footer (with attributes or >)
  const regex = new RegExp(`<${tag}[\\s>]`, 'gi');
  return (html.match(regex) || []).length;
}

function validateStructure(page: TemplatePage): ValidationError[] {
  const errors: ValidationError[] = [];
  const file = `${page.vertical}/${page.page}.html`;

  const navCount = countOccurrences(page.fullHtml, 'nav');
  if (navCount !== 1) {
    errors.push({ file, check: 'structure', message: `Expected 1 <nav>, found ${navCount}` });
  }

  const footerCount = countOccurrences(page.fullHtml, 'footer');
  if (footerCount !== 1) {
    errors.push({ file, check: 'structure', message: `Expected 1 <footer>, found ${footerCount}` });
  }

  return errors;
}

function validateComponentTypes(page: TemplatePage): ValidationError[] {
  const errors: ValidationError[] = [];
  const file = `${page.vertical}/${page.page}.html`;

  for (const c of page.components) {
    if (!CANONICAL_COMPONENT_TYPES.has(c.componentType)) {
      errors.push({
        file,
        check: 'orphaned-component',
        message: `Non-canonical component type: "${c.componentType}"`,
      });
    }
  }

  return errors;
}

function validateJsonLd(page: TemplatePage): ValidationError[] {
  const errors: ValidationError[] = [];
  const file = `${page.vertical}/${page.page}.html`;

  const jsonLdRegex = /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi;
  const blocks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = jsonLdRegex.exec(page.fullHtml)) !== null) {
    blocks.push(m[1]);
  }

  if (blocks.length === 0) {
    errors.push({ file, check: 'json-ld', message: 'Missing JSON-LD script tag' });
    return errors;
  }

  const expectedType = VERTICAL_SCHEMA_TYPES[page.vertical];
  let foundPrimaryType = false;

  for (const block of blocks) {
    try {
      const data = JSON.parse(block);
      if (data['@type'] === expectedType) {
        foundPrimaryType = true;
      }
    } catch (e) {
      errors.push({ file, check: 'json-ld', message: `Invalid JSON in ld+json block: ${(e as Error).message}` });
    }
  }

  if (!foundPrimaryType && expectedType) {
    errors.push({
      file,
      check: 'json-ld',
      message: `No JSON-LD block with @type="${expectedType}" (expected for vertical "${page.vertical}")`,
    });
  }

  return errors;
}

const PAGE_SPECIFIC_SCHEMA_TYPES: Record<string, string> = {
  about: 'AboutPage',
  contact: 'ContactPage',
  faq: 'FAQPage',
  blog: 'Blog',
};

const DUPLICATE_ALLOWED_TYPES = new Set(['Review', 'Product', 'ListItem', 'Offer']);

function parseJsonLdBlocks(html: string): Array<{ raw: string; data: unknown }> {
  const jsonLdRegex = /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi;
  const blocks: Array<{ raw: string; data: unknown }> = [];
  let m: RegExpExecArray | null;
  while ((m = jsonLdRegex.exec(html)) !== null) {
    try {
      blocks.push({ raw: m[1], data: JSON.parse(m[1]) });
    } catch {
      blocks.push({ raw: m[1], data: null });
    }
  }
  return blocks;
}

function validateBreadcrumbList(page: TemplatePage): ValidationError[] {
  const errors: ValidationError[] = [];
  const file = `${page.vertical}/${page.page}.html`;
  const blocks = parseJsonLdBlocks(page.fullHtml);

  const hasBreadcrumb = blocks.some(b => {
    if (!b.data || typeof b.data !== 'object') return false;
    const d = b.data as Record<string, unknown>;
    if (d['@type'] === 'BreadcrumbList') return true;
    // Also check nested breadcrumb inside WebPage
    if (d['@type'] === 'WebPage' && d['breadcrumb'] && typeof d['breadcrumb'] === 'object') {
      const bc = d['breadcrumb'] as Record<string, unknown>;
      if (bc['@type'] === 'BreadcrumbList') return true;
    }
    return false;
  });

  if (!hasBreadcrumb) {
    errors.push({ file, check: 'breadcrumb', message: 'Missing BreadcrumbList JSON-LD block' });
  }

  return errors;
}

function validatePageSpecificTypes(page: TemplatePage): ValidationError[] {
  const errors: ValidationError[] = [];
  const file = `${page.vertical}/${page.page}.html`;
  const expectedType = PAGE_SPECIFIC_SCHEMA_TYPES[page.page];
  if (!expectedType) return errors;

  const blocks = parseJsonLdBlocks(page.fullHtml);
  const found = blocks.some(b => {
    if (!b.data || typeof b.data !== 'object') return false;
    return (b.data as Record<string, unknown>)['@type'] === expectedType;
  });

  if (!found) {
    errors.push({
      file,
      check: 'page-specific-type',
      message: `Page "${page.page}" should have JSON-LD block with @type="${expectedType}"`,
    });
  }

  return errors;
}

function validateNoDuplicateJsonLd(page: TemplatePage): ValidationError[] {
  const errors: ValidationError[] = [];
  const file = `${page.vertical}/${page.page}.html`;
  const blocks = parseJsonLdBlocks(page.fullHtml);

  const typeCounts = new Map<string, number>();
  for (const b of blocks) {
    if (!b.data || typeof b.data !== 'object') continue;
    const t = (b.data as Record<string, unknown>)['@type'];
    if (typeof t === 'string' && !DUPLICATE_ALLOWED_TYPES.has(t)) {
      typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
    }
  }

  for (const [type, count] of typeCounts) {
    if (count > 1) {
      errors.push({
        file,
        check: 'duplicate-json-ld',
        message: `Duplicate top-level JSON-LD @type="${type}" appears ${count} times`,
      });
    }
  }

  return errors;
}

function validateInternalLinks(page: TemplatePage, verticalFiles: Set<string>): ValidationError[] {
  const errors: ValidationError[] = [];
  const file = `${page.vertical}/${page.page}.html`;

  // Match href="something.html" (relative .html links only)
  const linkRegex = /href="([a-z0-9_-]+\.html)"/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(page.fullHtml)) !== null) {
    const target = m[1];
    if (!verticalFiles.has(target)) {
      errors.push({
        file,
        check: 'internal-link',
        message: `Broken internal link: "${target}" does not exist in ${page.vertical}/`,
      });
    }
  }

  return errors;
}

function runValidation(pages: TemplatePage[]): ValidationError[] {
  const errors: ValidationError[] = [];

  // Build per-vertical file sets for link checking
  const verticalFiles = new Map<string, Set<string>>();
  for (const page of pages) {
    if (!verticalFiles.has(page.vertical)) {
      verticalFiles.set(page.vertical, new Set());
    }
    verticalFiles.get(page.vertical)!.add(`${page.page}.html`);
  }

  for (const page of pages) {
    errors.push(...validateStructure(page));
    errors.push(...validateComponentTypes(page));
    errors.push(...validateJsonLd(page));
    errors.push(...validateBreadcrumbList(page));
    errors.push(...validatePageSpecificTypes(page));
    errors.push(...validateNoDuplicateJsonLd(page));
    errors.push(...validateInternalLinks(page, verticalFiles.get(page.vertical)!));
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Xano upsert
// ---------------------------------------------------------------------------

async function upsertToXano(pages: TemplatePage[]): Promise<void> {
  if (!XANO_API_URL || !XANO_API_KEY) {
    console.error('✗ XANO_API_URL and XANO_API_KEY are required for non-dry-run mode');
    process.exit(1);
  }

  for (const page of pages) {
    const payload = {
      vertical: page.vertical,
      page: page.page,
      html: page.fullHtml,
      components: page.components.map(c => ({
        type: c.componentType,
        stableId: c.stableId,
      })),
    };

    try {
      const res = await fetch(`${XANO_API_URL}/api:templates/upsert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${XANO_API_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.error(`✗ Failed to upsert ${page.vertical}/${page.page}: ${res.status} ${res.statusText}`);
      } else {
        console.log(`✓ Upserted ${page.vertical}/${page.page}`);
      }
    } catch (err) {
      console.error(`✗ Error upserting ${page.vertical}/${page.page}:`, err);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n🌱 Template Seed Script`);
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`   Templates: ${TEMPLATES_DIR}\n`);

  const pages = await walkTemplates();

  // Summary
  const verticalSummary: Record<string, string[]> = {};
  let totalComponents = 0;

  for (const page of pages) {
    if (!verticalSummary[page.vertical]) {
      verticalSummary[page.vertical] = [];
    }
    verticalSummary[page.vertical].push(page.page);
    totalComponents += page.components.length;
  }

  console.log(`📊 Summary:`);
  console.log(`   Verticals: ${Object.keys(verticalSummary).length}`);
  console.log(`   Pages: ${pages.length}`);
  console.log(`   Components: ${totalComponents}\n`);

  for (const [vertical, pageNames] of Object.entries(verticalSummary).sort()) {
    console.log(`   ${vertical.padEnd(14)} ${pageNames.length} pages: ${pageNames.join(', ')}`);
  }

  console.log('');

  // Component type coverage
  const componentTypes = new Set<string>();
  for (const page of pages) {
    for (const c of page.components) {
      componentTypes.add(c.componentType);
    }
  }
  console.log(`🧩 Component types found: ${[...componentTypes].sort().join(', ')}\n`);

  // Per-page detail
  if (process.argv.includes('--verbose') || process.argv.includes('-v')) {
    console.log(`📄 Page Details:\n`);
    for (const page of pages) {
      const types = page.components.map(c => c.componentType).join(', ');
      console.log(`   ${page.vertical}/${page.page}: [${types}]`);
    }
    console.log('');
  }

  // Validation (always runs in dry-run, optional with --validate in live mode)
  if (DRY_RUN || process.argv.includes('--validate')) {
    console.log(`🔍 Running validation checks...\n`);
    const errors = runValidation(pages);

    if (errors.length === 0) {
      console.log(`   ✅ All validation checks passed.\n`);
    } else {
      // Group by check type
      const byCheck = new Map<string, ValidationError[]>();
      for (const e of errors) {
        if (!byCheck.has(e.check)) byCheck.set(e.check, []);
        byCheck.get(e.check)!.push(e);
      }

      for (const [check, checkErrors] of byCheck) {
        console.log(`   ❌ ${check} (${checkErrors.length} errors):`);
        for (const e of checkErrors) {
          console.log(`      ${e.file}: ${e.message}`);
        }
        console.log('');
      }

      console.log(`   Total validation errors: ${errors.length}\n`);

      if (DRY_RUN) {
        process.exit(1);
      }
    }
  }

  if (!DRY_RUN) {
    console.log(`🚀 Upserting to Xano...\n`);
    await upsertToXano(pages);
    console.log(`\n✅ Done.`);
  } else {
    console.log(`ℹ  Dry run complete. Set DRY_RUN=false to upsert to Xano.\n`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
