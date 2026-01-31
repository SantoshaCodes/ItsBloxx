/**
 * Shared page-build pipeline used by both site-create.ts and pages-create.ts
 *
 * For each section slot in a template:
 *   - If a matching Xano component exists → adapt it with Sonnet (fast, cheap)
 *   - Otherwise → generate with Opus (slow, expensive)
 * Then stitch sections into a full HTML document and judge the result.
 */

// ─── Types ───

export interface Env {
  BLOXX_SITES: R2Bucket;
  ANTHROPIC_API_KEY: string;
  XANO_API_BASE: string;
}

export interface TemplateDef {
  name: string;
  schemaType: string;
  description: string;
  sections: string[];
  seoTitleFormat: string;
  guidelines: string[];
}

interface XanoComponent {
  short_id: string;
  name: string;
  type: string;
  html: string;
  schema?: any;
  tags?: string[];
}

interface ComponentIndex {
  [type: string]: XanoComponent[];
}

interface BuildPageResult {
  ok: boolean;
  score?: number;
  etag?: string;
  error?: string;
  judgeIssues?: string[];
}

// ─── Template definitions ───

export const TEMPLATES: Record<string, TemplateDef> = {
  Homepage: {
    name: 'Homepage', schemaType: 'WebPage',
    description: 'Main landing page with hero, features, social proof, and CTA',
    sections: ['Navbar', 'Hero', 'Features', 'Stats', 'Testimonials', 'CTA', 'Footer'],
    seoTitleFormat: '{Brand} - {Tagline}',
    guidelines: ['Hero should communicate primary value prop in <5 seconds', 'Include social proof within first scroll', 'CTA should appear multiple times'],
  },
  LandingPage: {
    name: 'Landing Page', schemaType: 'WebPage',
    description: 'Focused landing page for campaigns with single CTA',
    sections: ['Navbar', 'Hero', 'Benefits', 'SocialProof', 'Testimonials', 'FAQ', 'CTA', 'Footer'],
    seoTitleFormat: '{Offer} - {Benefit} | {Brand}',
    guidelines: ['Single focused call-to-action', 'Remove navigation distractions', 'Lead with benefits not features'],
  },
  About: {
    name: 'About', schemaType: 'AboutPage',
    description: 'Company or personal about page with story, team, and values',
    sections: ['Navbar', 'Hero', 'Content', 'Team', 'Stats', 'CTA', 'Footer'],
    seoTitleFormat: 'About {Brand} - {Differentiator}',
    guidelines: ['Lead with unique story', 'Include founder or team photos', 'Use specific milestones'],
  },
  Services: {
    name: 'Services', schemaType: 'Service',
    description: 'Services overview with offerings, process, and pricing',
    sections: ['Navbar', 'Hero', 'Features', 'Process', 'Pricing', 'Testimonials', 'FAQ', 'CTA', 'Footer'],
    seoTitleFormat: '{Service Type} Services | {Brand}',
    guidelines: ['Each service should have clear deliverables', 'Include process visualization', 'Price transparency builds trust'],
  },
  Contact: {
    name: 'Contact', schemaType: 'ContactPage',
    description: 'Contact page with form, location, and alternative methods',
    sections: ['Navbar', 'Hero', 'ContactForm', 'ContactInfo', 'Footer'],
    seoTitleFormat: 'Contact {Brand}',
    guidelines: ['Form should be simple with minimal fields', 'Set response time expectations', 'Include multiple contact methods'],
  },
  BlogIndex: {
    name: 'Blog Index', schemaType: 'Blog',
    description: 'Blog listing page with featured posts and categories',
    sections: ['Navbar', 'Hero', 'FeaturedPost', 'BlogGrid', 'Pagination', 'Newsletter', 'Footer'],
    seoTitleFormat: '{Brand} Blog - {Topic Focus}',
    guidelines: ['Feature recent or popular posts prominently', 'Include category filtering', 'Show post metadata'],
  },
  BlogPost: {
    name: 'Blog Post', schemaType: 'BlogPosting',
    description: 'Individual blog post with article, author, and related content',
    sections: ['Navbar', 'ArticleHeader', 'ArticleBody', 'AuthorBio', 'RelatedPosts', 'Footer'],
    seoTitleFormat: '{Post Title} | {Brand} Blog',
    guidelines: ['Use proper heading hierarchy', 'Include featured image', 'Show estimated read time'],
  },
  Product: {
    name: 'Product Page', schemaType: 'Product',
    description: 'Single product page with gallery, details, reviews, and purchase',
    sections: ['Navbar', 'Breadcrumbs', 'ProductGallery', 'ProductInfo', 'AddToCart', 'ProductDescription', 'Reviews', 'RelatedProducts', 'Footer'],
    seoTitleFormat: '{Product Name} - {Category} | {Brand}',
    guidelines: ['High-quality images from multiple angles', 'Clear pricing and availability', 'Prominent add-to-cart button'],
  },
  Pricing: {
    name: 'Pricing', schemaType: 'ItemList',
    description: 'Pricing page with tiers, comparison, and FAQ',
    sections: ['Navbar', 'Hero', 'PricingCards', 'Comparison', 'FAQ', 'CTA', 'Footer'],
    seoTitleFormat: '{Brand} Pricing - Plans Starting at {Low Price}',
    guidelines: ['Highlight recommended plan', 'Show clear feature differentiation', 'Address pricing objections in FAQ'],
  },
  FAQ: {
    name: 'FAQ', schemaType: 'FAQPage',
    description: 'FAQ page with categories and search',
    sections: ['Navbar', 'Hero', 'FAQAccordion', 'ContactCTA', 'Footer'],
    seoTitleFormat: 'FAQ - {Brand} Help Center',
    guidelines: ['Use FAQPage schema for rich snippets', 'Group questions by category', 'Start answers with direct response'],
  },
  Privacy: {
    name: 'Privacy Policy', schemaType: 'WebPage',
    description: 'Privacy policy page',
    sections: ['Navbar', 'LegalHeader', 'PrivacyContent', 'Footer'],
    seoTitleFormat: 'Privacy Policy | {Brand}',
    guidelines: ['Include last updated date', 'Use clear headings', 'Explain data practices in plain language'],
  },
  Terms: {
    name: 'Terms of Service', schemaType: 'WebPage',
    description: 'Terms of service page',
    sections: ['Navbar', 'LegalHeader', 'TermsContent', 'Footer'],
    seoTitleFormat: 'Terms of Service | {Brand}',
    guidelines: ['Include effective date', 'Number sections for reference', 'Highlight important terms'],
  },
};

export const PAGE_SLUGS: Record<string, string> = {
  Homepage: 'index', About: 'about', Services: 'services', Contact: 'contact',
  FAQ: 'faq', Pricing: 'pricing', BlogIndex: 'blog', BlogPost: 'blog-post',
  Product: 'product', LandingPage: 'landing', Privacy: 'privacy', Terms: 'terms',
};

// ─── Section → Xano component type mapping ───

const SECTION_TO_XANO_TYPE: Record<string, string> = {
  Hero: 'Hero',
  Features: 'Features',
  CTA: 'CTA',
  ContactCTA: 'CTA',
  Footer: 'Footer',
  FAQ: 'FAQ',
  FAQAccordion: 'FAQ',
  Testimonials: 'Testimonial',
  SocialProof: 'Testimonial',
  Pricing: 'Pricing',
  PricingCards: 'Pricing',
  ContactForm: 'Form',
  ContactInfo: 'Form',
};

// ─── Utilities ───

export function extractJSON(text: string): any {
  let cleaned = text.replace(/^```json\s*/gim, '').replace(/^```\s*/gim, '').replace(/\s*```\s*$/gim, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    let jsonStr = cleaned.slice(start, end + 1);
    try { return JSON.parse(jsonStr); } catch {}
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(jsonStr);
  }
  throw new Error('Could not find JSON in response');
}

export async function callClaude(env: Env, model: string, maxTokens: number, messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }
  const data: any = await res.json();
  return data.content?.[0]?.text || '';
}

// ─── Infer component type (from components.ts) ───

function inferComponentType(c: any): string {
  const name = (c.name || '').toLowerCase();
  const html = (c.html || '').toLowerCase();

  if (/\b(faq|frequently\s*asked)\b/.test(name)) return 'FAQ';
  if (/\bhero\b/.test(name)) return 'Hero';
  if (/\b(feature|service)s?\b/.test(name)) return 'Features';
  if (/\bpricing\b/.test(name)) return 'Pricing';
  if (/\b(testimonial|review)s?\b/.test(name)) return 'Testimonial';
  if (/\bcta\b|call.to.action/.test(name)) return 'CTA';
  if (/\bfooter\b/.test(name)) return 'Footer';
  if (/\b(form|contact)\b/.test(name)) return 'Form';
  if (/\b(article|blog|post)\b/.test(name)) return 'Article';
  if (/\bproduct\b/.test(name)) return 'Product';

  if (/class="[^"]*faq/i.test(c.html || '') || html.includes('frequently')) return 'FAQ';
  if (/class="[^"]*hero/i.test(c.html || '')) return 'Hero';
  if (/class="[^"]*testimonial/i.test(c.html || '')) return 'Testimonial';
  if (/class="[^"]*pricing/i.test(c.html || '')) return 'Pricing';
  if (/class="[^"]*feature/i.test(c.html || '')) return 'Features';
  if (/class="[^"]*footer/i.test(c.html || '')) return 'Footer';
  if (/class="[^"]*cta/i.test(c.html || '')) return 'CTA';

  const schemaType = (c.schema?.['@type'] || '').toLowerCase();
  if (schemaType.includes('faq')) return 'FAQ';
  if (schemaType.includes('wpfooter')) return 'Footer';

  return '';
}

// ─── Fetch Xano components and build type→component[] index ───

async function fetchComponentIndex(env: Env): Promise<ComponentIndex> {
  const index: ComponentIndex = {};
  let page = 1;

  while (true) {
    const res = await fetch(`${env.XANO_API_BASE}/bloxx_components?per_page=50&page=${page}`);
    if (!res.ok) throw new Error(`Xano ${res.status}`);
    const raw: any = await res.json();
    const result = raw.result || raw;
    const items = Array.isArray(result) ? result : result.items || [];
    if (items.length === 0) break;

    for (const c of items) {
      const type = inferComponentType(c);
      if (!type) continue;
      if (!index[type]) index[type] = [];
      index[type].push({
        short_id: c.short_id || c.id,
        name: c.name,
        type,
        html: c.html,
        schema: c.schema,
        tags: c.tags || [],
      });
    }

    if (!result.nextPage) break;
    page++;
  }

  return index;
}

// ─── Adapt an existing Xano component's content to match brand context (Sonnet) ───

async function adaptComponent(env: Env, component: XanoComponent, sectionType: string, brandContext: string): Promise<string> {
  const prompt = `You are a senior frontend developer. You have an existing Bootstrap 5.3+ HTML component for a "${sectionType}" section.

Rewrite ONLY the text content (headings, paragraphs, button labels, alt text, aria-labels) to match the brand context below. Keep the HTML structure, Bootstrap classes, aria attributes, and schema.org markup completely intact.

=== BRAND CONTEXT ===
${brandContext}

=== EXISTING COMPONENT HTML ===
${component.html}

=== RULES ===
1. Do NOT change any HTML tags, class attributes, or structural markup
2. Do NOT add or remove elements
3. Do NOT change Bootstrap utility classes
4. Do NOT add inline styles or custom CSS classes
5. Update text content, alt attributes, and aria-label values to match the brand
6. Keep schema.org itemprop attributes intact
7. NO emojis, NO generic AI phrases, NO excessive exclamation marks
8. Use specific, human-sounding copy that matches the brand tone

Return ONLY the updated HTML string — no JSON wrapper, no code fences, just the raw HTML.`;

  const result = await callClaude(env, 'claude-sonnet-4-20250514', 4096, [
    { role: 'user', content: prompt },
  ]);

  // Strip code fences and inline styles
  let cleaned = result.replace(/^```html?\s*/gim, '').replace(/\s*```\s*$/gim, '').trim();
  cleaned = cleaned.replace(/\s+style\s*=\s*"[^"]*"/gi, '');
  return cleaned;
}

// ─── Generate a single section with Opus ───

interface AttemptHistory {
  attempt: number;
  score: number;
  issues: string[];
  suggestions: string[];
  previousHtml: string;
}

async function generateSection(
  env: Env,
  sectionType: string,
  template: TemplateDef,
  brandContext: string,
  history?: AttemptHistory[],
): Promise<string> {
  let historySection = '';
  if (history && history.length > 0) {
    historySection = '\n=== ATTEMPT HISTORY (learn from previous failures) ===\n';
    for (const h of history) {
      historySection += `\n--- Attempt ${h.attempt} (Score: ${h.score}/100) ---\n`;
      historySection += `Issues found:\n${h.issues.map((i, n) => `  ${n + 1}. ${i}`).join('\n')}\n`;
      historySection += `Suggestions:\n${h.suggestions.map((s, n) => `  ${n + 1}. ${s}`).join('\n')}\n`;
      historySection += `HTML produced (first 2000 chars):\n${h.previousHtml.substring(0, 2000)}\n`;
    }
    historySection += `\nYou MUST fix ALL issues listed above. Do NOT repeat the same mistakes. The judge is automated and will check the same criteria again.\n`;
  }

  const prompt = `You are a senior frontend developer. Generate a single production-ready "${sectionType}" section using Bootstrap 5.3+.
${historySection}
${brandContext ? `\n=== BRAND CONTEXT ===\n${brandContext}\n` : ''}

=== CONTEXT ===
This section is part of a ${template.name} page (${template.description}).
This will be placed inside a <body> tag alongside other sections. The page wrapper already includes JSON-LD schema with @context and @type.

=== REQUIREMENTS (scored by automated judge) ===

Bootstrap Compliance (30pts — highest weight, MOST COMMON FAILURE):
- ONLY Bootstrap 5.3 utility classes (bg-primary, bg-dark, bg-light, text-white, py-5, mb-3, etc.)
- ABSOLUTELY ZERO inline style="" attributes — this is the #1 reason pages fail the automated judge
  WRONG: <nav style="background-color: #ef4444;">
  RIGHT: <nav class="bg-dark"> or <nav class="bg-primary">
  WRONG: <div style="margin-top: 20px;">
  RIGHT: <div class="mt-4">
- ZERO custom CSS class names (no hero-section, no faq-wrapper, no custom BEM names)
- Use Bootstrap grid: container, row, col-md-*, col-lg-*
- For colors, use ONLY Bootstrap color classes: bg-primary, bg-dark, bg-light, bg-white, text-primary, text-dark, text-white, text-muted, etc.

Accessibility (20pts):
- Wrap in semantic HTML: <section>, <nav>, or <footer> as appropriate
- Add aria-labelledby pointing to the section's heading id
- Use proper heading hierarchy (h1 only in Hero, h2 for other section headings)
- Use "visually-hidden" class for screen reader text (NOT "sr-only")

Content Quality (15pts):
- NO emojis anywhere
- NO generic AI filler ("Welcome to our platform", "We're here to help")
- NO excessive exclamation marks
- USE specific numbers, realistic names, concrete details
- USE conversational, human-sounding copy matching the brand tone

Structure (10pts):
- Clean, well-nested HTML
- Unsplash images with descriptive alt text and loading="lazy"

Return ONLY the raw HTML for this single section — no JSON, no code fences, no wrapping document. Just the <section>, <nav>, or <footer> element.`;

  const result = await callClaude(env, 'claude-opus-4-5-20251101', 8192, [
    { role: 'user', content: prompt },
  ]);
  let cleaned = result.replace(/^```html?\s*/gim, '').replace(/\s*```\s*$/gim, '').trim();

  // Post-process: strip inline style="" attributes that Opus often adds despite instructions
  const styleCount = (cleaned.match(/\sstyle\s*=\s*"[^"]*"/gi) || []).length;
  if (styleCount > 0) {
    console.log(`[generateSection] "${sectionType}" had ${styleCount} inline style attributes — stripping them`);
    cleaned = cleaned.replace(/\s+style\s*=\s*"[^"]*"/gi, '');
  }

  // Post-process: strip custom/BEM classes from class attributes, keep only Bootstrap classes
  cleaned = cleaned.replace(/class="([^"]*)"/g, (match, classes) => {
    const tokens = classes.split(/\s+/).filter((cls: string) => {
      if (!cls) return false;
      // Keep Bootstrap classes: standard prefixes and known utilities
      if (/^(bg-|text-|btn-|col-|row|container|d-|flex-|justify-|align-|m[trblxy]?-|p[trblxy]?-|g[xy]?-|w-|h-|border|rounded|shadow|opacity-|overflow-|position-|top-|bottom-|start-|end-|float-|order-|gap-|fs-|fw-|fst-|lh-|font-|list-|nav|navbar|dropdown|accordion|card|modal|badge|alert|spinner|table|form|input|visually|display-|ratio-|vstack|hstack|sticky-|fixed-|clearfix|img-|figure|blockquote|lead|small|mark|initialism|placeholder|link-|icon-|bi-|bi$|active|disabled|show|hide|fade|collapse|collapsed|collapsing|offcanvas|tab-|carousel|breadcrumb|pagination|page-|progress|toast|popover|tooltip|stretched-link)/.test(cls)) return true;
      // Keep aria/data related class patterns
      if (/^(sr-only|visually-hidden)/.test(cls)) return true;
      // Keep simple word classes that Bootstrap uses (e.g. "container", "row", "lead", "small", "active")
      if (/^(container|row|lead|small|active|disabled|show|hide|fade|collapse|collapsed)$/.test(cls)) return true;
      // Strip anything with BEM-style double underscores/hyphens or component-specific names
      if (/__|--/.test(cls)) {
        console.log(`[generateSection] Stripped BEM class: ${cls}`);
        return false;
      }
      // Strip classes that look custom (contain section-type names)
      if (/^(hero|faq|cta|footer|nav|section|feature|pricing|testimonial|blog|contact|about|service|team|stat)-/i.test(cls)) {
        console.log(`[generateSection] Stripped custom class: ${cls}`);
        return false;
      }
      return true; // keep unknown classes (could be Bootstrap we didn't list)
    });
    return tokens.length > 0 ? `class="${tokens.join(' ')}"` : '';
  });

  console.log(`[generateSection] "${sectionType}" output: ${cleaned.length} chars, starts with: ${cleaned.substring(0, 120)}`);
  return cleaned;
}

// ─── Assemble sections into a full HTML document ───

function assembleDocument(sections: string[], template: TemplateDef, brandContext: string): string {
  const nameMatch = brandContext.match(/Business Name:\s*(.+)/i);
  const businessName = nameMatch ? nameMatch[1].trim() : 'Business';

  const taglineMatch = brandContext.match(/Tagline:\s*(.+)/i);
  const tagline = taglineMatch ? taglineMatch[1].trim() : '';

  const industryMatch = brandContext.match(/Industry:\s*(.+)/i);
  const industry = industryMatch ? industryMatch[1].trim() : '';

  const servicesMatch = brandContext.match(/Services:\s*(.+)/i);
  const services = servicesMatch ? servicesMatch[1].trim() : '';

  const title = template.seoTitleFormat
    .replace('{Brand}', businessName)
    .replace('{Tagline}', tagline)
    .replace(/\{[^}]+\}/g, businessName);

  // Build a proper meta description (150-160 chars target)
  const metaDesc = `${businessName}${industry ? ` — ${industry}` : ''}. ${template.description}${services ? `. ${services.split(',').slice(0, 3).join(', ')}` : ''}.`.substring(0, 160);

  const colorMatch = brandContext.match(/Primary Color:\s*(#[0-9a-fA-F]{3,8})/i);
  const primaryColor = colorMatch ? colorMatch[1] : '#0d6efd';

  // Build JSON-LD schema block (required by judge for @context/@type)
  const schema: any = {
    '@context': 'https://schema.org',
    '@type': template.schemaType,
    name: businessName,
    description: metaDesc,
  };
  if (tagline) schema.slogan = tagline;
  if (services) schema.knowsAbout = services.split(',').map((s: string) => s.trim()).slice(0, 5);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${metaDesc}">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
  <script type="application/ld+json">${JSON.stringify(schema)}<\/script>
</head>
<body>
<main>
${sections.join('\n')}
</main>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"><\/script>
</body>
</html>`;
}

// ─── Judge full page (Sonnet) ───

async function judgePage(env: Env, html: string, template: TemplateDef): Promise<{ score: number; passed: boolean; issues: string[]; suggestions: string[] }> {
  const prompt = `You are a senior code reviewer. Evaluate this ${template.name} page for production readiness.

PAGE TYPE: ${template.name}
EXPECTED SCHEMA TYPE: ${template.schemaType}
REQUIRED SECTIONS: ${template.sections.join(', ')}

IMPORTANT CONTEXT: This page is assembled from individually generated sections stitched into a <!DOCTYPE html> document. The <head> contains a JSON-LD <script type="application/ld+json"> block with @context and @type. Each section is wrapped in semantic HTML (<section>, <nav>, <footer>) with aria-labelledby attributes.

HTML (first 12000 chars):
${html.substring(0, 12000)}

=== SCORING (100 points) ===

Bootstrap 5.3 Compliance (30pts):
- Only Bootstrap utility classes used (bg-*, text-*, py-*, col-*, etc.)
- No custom CSS class names (no BEM, no component-specific names)
- No inline style="" attributes
- Responsive grid with col-md-*, col-lg-* breakpoints

Schema & Meta (25pts):
- JSON-LD block present in <head> with @context and @type
- <title> tag present and descriptive
- <meta name="description"> present and 100+ characters
- Schema @type matches expected: ${template.schemaType}

Accessibility (20pts):
- Semantic wrappers: <section>, <nav>, <footer>, <main>
- aria-labelledby on sections pointing to heading ids
- Proper heading hierarchy (single h1, h2 for sections)
- "visually-hidden" used (not "sr-only")

Content Quality (15pts):
- No emojis
- No generic AI phrases ("Welcome to our...", "We're passionate about...")
- Specific numbers, names, and details
- Human-sounding, brand-appropriate tone

Page Structure (10pts):
- <!DOCTYPE html> with <head> and <body>
- Bootstrap CSS and JS CDN links present
- Multiple distinct sections present

IMPORTANT SCORING NOTES:
- A <style> tag in <head> is acceptable — do NOT penalize it
- Inline style="" attributes on HTML elements (e.g. <div style="...">) ARE violations — deduct from Bootstrap Compliance
- Do NOT cap the score for any single violation. Score each category independently and sum them.
- Be generous — if the page is mostly well-structured with minor issues, score it in the 80-90 range

Pass threshold: 80/100

Return ONLY valid JSON:
{"score": 85, "passed": false, "issues": ["issue 1"], "suggestions": ["suggestion 1"]}`;

  const result = await callClaude(env, 'claude-sonnet-4-20250514', 1024, [
    { role: 'user', content: prompt },
  ]);
  console.log(`[judgePage] Raw Sonnet response (first 500 chars): ${result.substring(0, 500)}`);
  const parsed = extractJSON(result);
  console.log(`[judgePage] Parsed: score=${parsed.score} issues=${JSON.stringify(parsed.issues || []).substring(0, 300)}`);
  return parsed;
}

// ─── Pick best component candidate ───

function pickBest(candidates: XanoComponent[], brandContext: string): XanoComponent {
  // For now, return the first candidate. As components grow, this can
  // score by tag overlap, industry match, etc.
  return candidates[0];
}

// ─── Main entry point ───

export async function buildPage(
  env: Env,
  site: string,
  slug: string,
  templateKey: string,
  brandContext: string,
): Promise<BuildPageResult> {
  console.log(`[buildPage] START site=${site} slug=${slug} template=${templateKey}`);

  const template = TEMPLATES[templateKey] || {
    name: templateKey,
    schemaType: 'WebPage',
    description: `A ${templateKey} page for the business`,
    sections: ['Navbar', 'Hero', 'Content', 'CTA', 'Footer'],
    seoTitleFormat: `${templateKey} | {Brand}`,
    guidelines: ['Clear heading hierarchy', 'Include relevant content sections', 'End with a call to action'],
  };

  console.log(`[buildPage] Template sections: ${template.sections.join(', ')}`);

  // 1. Fetch component index from Xano
  let componentIndex: ComponentIndex = {};
  try {
    componentIndex = await fetchComponentIndex(env);
    const types = Object.keys(componentIndex);
    console.log(`[buildPage] Xano component index loaded: ${types.length} types (${types.join(', ')})`);
  } catch (err: any) {
    console.log(`[buildPage] Xano fetch failed, all sections will be generated: ${err.message}`);
  }

  // 2. Build sections: adapt matched components or generate with Opus
  const assembledSections: string[] = [];
  const unmatchedIndices: number[] = [];
  // Per-section attempt history for feedback loop
  const sectionHistory: Map<number, AttemptHistory[]> = new Map();

  for (let i = 0; i < template.sections.length; i++) {
    const section = template.sections[i];
    const xanoType = SECTION_TO_XANO_TYPE[section] || section;
    const candidates = componentIndex[xanoType] || [];

    // Filter candidates: skip components with template variables or non-Bootstrap classes
    const usable = candidates.filter(c => {
      if (!c.html) return false;
      // Skip components with Handlebars/template variables
      if (/\{\{[^}]+\}\}/.test(c.html)) {
        console.log(`[buildPage] Skipping component "${c.name}" — contains template variables`);
        return false;
      }
      // Skip components with heavy BEM/custom class usage
      const customClassCount = (c.html.match(/class="[^"]*[a-z]+-{1,2}[a-z]/gi) || []).length;
      if (customClassCount > 3) {
        console.log(`[buildPage] Skipping component "${c.name}" — ${customClassCount} custom/BEM classes`);
        return false;
      }
      return true;
    });

    if (usable.length > 0) {
      const best = pickBest(usable, brandContext);
      console.log(`[buildPage] Section "${section}" → ADAPT component "${best.name}" (type=${best.type})`);
      const adapted = await adaptComponent(env, best, section, brandContext);
      console.log(`[buildPage] Section "${section}" adapted OK (${adapted.length} chars)`);
      assembledSections.push(adapted);
    } else {
      if (candidates.length > 0) {
        console.log(`[buildPage] Section "${section}" → all ${candidates.length} Xano candidates skipped (template vars / custom classes)`);
      }
      console.log(`[buildPage] Section "${section}" → GENERATE with Opus`);
      const generated = await generateSection(env, section, template, brandContext);
      console.log(`[buildPage] Section "${section}" generated OK (${generated.length} chars)`);
      assembledSections.push(generated);
      unmatchedIndices.push(i);
      sectionHistory.set(i, []);
    }
  }

  // 3. Assemble into full document
  console.log(`[buildPage] Assembling ${assembledSections.length} sections into document`);
  let html = assembleDocument(assembledSections, template, brandContext);
  console.log(`[buildPage] Assembled HTML: ${html.length} chars`);

  // 4. Judge + retry loop with cumulative per-section history
  const MAX_RETRIES = 3;
  let lastScore = 0;
  let lastIssues: string[] = [];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    console.log(`[buildPage] Judge attempt ${attempt + 1}/${MAX_RETRIES + 1}`);
    const judgeResult = await judgePage(env, html, template);
    lastScore = judgeResult.score;
    lastIssues = judgeResult.issues || [];
    console.log(`[buildPage] Judge score: ${judgeResult.score} | issues: ${lastIssues.length} | passed: ${judgeResult.score >= 70}`);
    if (judgeResult.issues?.length) {
      console.log(`[buildPage] Issues: ${judgeResult.issues.join(' | ')}`);
    }

    if (judgeResult.score >= 80) {
      const key = `${site}/drafts/${slug}.html`;
      console.log(`[buildPage] PASSED on attempt ${attempt + 1} — saving to R2 at ${key}`);
      const putResult = await env.BLOXX_SITES.put(key, html, {
        httpMetadata: { contentType: 'text/html' },
      });
      console.log(`[buildPage] DONE site=${site} slug=${slug} score=${judgeResult.score}`);
      return { ok: true, score: judgeResult.score, etag: putResult.httpEtag };
    }

    if (attempt === MAX_RETRIES) break;

    // Record this attempt in each section's history so the generator
    // can see what it tried before, what scored, and what went wrong
    for (const idx of unmatchedIndices) {
      const history = sectionHistory.get(idx) || [];
      history.push({
        attempt: attempt + 1,
        score: judgeResult.score,
        issues: judgeResult.issues || [],
        suggestions: judgeResult.suggestions || [],
        previousHtml: assembledSections[idx],
      });
      sectionHistory.set(idx, history);
    }

    console.log(`[buildPage] Retrying ${unmatchedIndices.length} unmatched sections (attempt ${attempt + 2}) with ${(judgeResult.issues || []).length} issues from judge`);

    for (const idx of unmatchedIndices) {
      const section = template.sections[idx];
      const history = sectionHistory.get(idx) || [];
      console.log(`[buildPage] Re-generating "${section}" — attempt ${attempt + 2}, history depth: ${history.length}`);
      assembledSections[idx] = await generateSection(env, section, template, brandContext, history);
    }

    html = assembleDocument(assembledSections, template, brandContext);
  }

  console.log(`[buildPage] FAILED site=${site} slug=${slug} bestScore=${lastScore}`);
  return { ok: false, error: `Failed to reach score 80 after ${MAX_RETRIES + 1} attempts (best: ${lastScore})`, score: lastScore, judgeIssues: lastIssues };
}
