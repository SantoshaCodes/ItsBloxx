/**
 * schema-editor.ts — Extract content from HTML, rebuild JSON-LD schemas
 *
 * Parses the HTML document, finds all JSON-LD scripts, and regenerates
 * them based on current page content (headings, images, meta tags, etc.)
 */
import { parseHTML } from 'linkedom';

export interface SchemaBlock {
  '@context': string;
  '@type': string;
  [key: string]: unknown;
}

/** Extract all existing JSON-LD blocks from an HTML string */
export function extractSchemas(html: string): SchemaBlock[] {
  const { document } = parseHTML(html);
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  const schemas: SchemaBlock[] = [];
  for (const script of scripts) {
    try {
      schemas.push(JSON.parse(script.textContent || ''));
    } catch { /* skip malformed */ }
  }
  return schemas;
}

/** Infer the primary schema @type from the page content */
export function inferPageType(html: string): string {
  const lower = html.toLowerCase();
  if (lower.includes('itemprop="blogpost"') || lower.includes('itemtype="https://schema.org/blogposting"'))
    return 'BlogPosting';
  if (lower.includes('itemtype="https://schema.org/product"'))
    return 'Product';
  if (lower.includes('itemtype="https://schema.org/faqpage"'))
    return 'FAQPage';
  if (lower.includes('itemtype="https://schema.org/restaurant"'))
    return 'Restaurant';
  if (lower.includes('itemtype="https://schema.org/aboutpage"'))
    return 'AboutPage';
  if (lower.includes('itemtype="https://schema.org/contactpage"'))
    return 'ContactPage';
  return 'WebPage';
}

/** Extract structured content from DOM for schema population */
function extractContent(document: Document) {
  const title = document.querySelector('title')?.textContent || '';
  const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
  const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';

  const h1 = document.querySelector('h1')?.textContent?.trim() || title;

  // Collect FAQ items
  const faqItems: { question: string; answer: string }[] = [];
  const details = document.querySelectorAll('details');
  for (const d of details) {
    const q = d.querySelector('summary')?.textContent?.trim() || '';
    const a = d.textContent?.replace(q, '').trim() || '';
    if (q) faqItems.push({ question: q, answer: a });
  }
  // Also look for accordion-style FAQ
  const accordionBtns = document.querySelectorAll('.accordion-button');
  for (const btn of accordionBtns) {
    const q = btn.textContent?.trim() || '';
    const body = btn.closest('.accordion-item')?.querySelector('.accordion-body');
    const a = body?.textContent?.trim() || '';
    if (q) faqItems.push({ question: q, answer: a });
  }

  // Collect breadcrumbs
  const breadcrumbs: { name: string; url: string }[] = [];
  const bcItems = document.querySelectorAll('[itemtype*="BreadcrumbList"] [itemprop="itemListElement"]');
  for (const item of bcItems) {
    breadcrumbs.push({
      name: item.querySelector('[itemprop="name"]')?.textContent?.trim() || '',
      url: item.querySelector('[itemprop="item"]')?.getAttribute('href') || '',
    });
  }

  return { title, description, canonical, ogImage, h1, faqItems, breadcrumbs };
}

/** Build a WebPage schema from current document content */
function buildWebPageSchema(document: Document): SchemaBlock {
  const { title, description, canonical, ogImage, h1 } = extractContent(document);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: h1 || title,
    description,
    ...(canonical && { url: canonical }),
    ...(ogImage && { image: ogImage }),
  };
}

/** Build a FAQPage schema from accordion/details elements */
function buildFAQSchema(document: Document): SchemaBlock | null {
  const { faqItems } = extractContent(document);
  if (faqItems.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };
}

/** Build a BreadcrumbList schema */
function buildBreadcrumbSchema(document: Document): SchemaBlock | null {
  const { breadcrumbs } = extractContent(document);
  if (breadcrumbs.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((bc, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: bc.name,
      item: bc.url,
    })),
  };
}

/**
 * Regenerate all JSON-LD schemas in an HTML document based on current content.
 * Replaces existing <script type="application/ld+json"> blocks.
 * Returns the updated HTML string.
 */
export function regenerateSchemas(html: string): string {
  const { document } = parseHTML(html);

  // Remove existing JSON-LD scripts
  const existing = document.querySelectorAll('script[type="application/ld+json"]');
  for (const el of existing) el.remove();

  // Build new schemas
  const schemas: SchemaBlock[] = [];

  // Always add WebPage (or inferred type)
  const pageType = inferPageType(html);
  const webPage = buildWebPageSchema(document);
  webPage['@type'] = pageType;
  schemas.push(webPage);

  // Conditionally add FAQ
  const faq = buildFAQSchema(document);
  if (faq) schemas.push(faq);

  // Conditionally add Breadcrumbs
  const bc = buildBreadcrumbSchema(document);
  if (bc) schemas.push(bc);

  // Inject into <head>
  const head = document.querySelector('head');
  if (head) {
    for (const schema of schemas) {
      const script = document.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.textContent = JSON.stringify(schema, null, 2);
      head.appendChild(script);
    }
  }

  return document.toString();
}
