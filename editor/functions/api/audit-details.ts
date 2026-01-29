/**
 * /api/audit-details — Detailed HTML SEO analysis
 *
 * POST /api/audit-details
 * Body: { html: string }
 *
 * Ported from Python SEO Analyzer - provides detailed findings and fixes
 * for meta, headings, schema, semantic HTML, images, links, and content.
 */

interface Env {}

interface Finding {
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  issue: string;
  impact: string;
  fix: string;
  location?: string;
  currentCode?: string;
  timeEstimate?: string;
  fixType?: string;
  fixMethod?: 'client' | 'python' | 'llm' | 'component';
}

// ─── FIX MAPPING: issue text → { fixType, fixMethod } ───
const FIX_MAPPING: Record<string, { fixType: string; fixMethod: 'client' | 'python' | 'llm' }> = {
  // Client fixes (instant, free)
  'Missing viewport meta tag': { fixType: 'add_viewport', fixMethod: 'client' },
  'Missing charset declaration': { fixType: 'add_charset', fixMethod: 'client' },
  'Missing lang attribute': { fixType: 'add_lang', fixMethod: 'client' },
  'Missing canonical URL': { fixType: 'add_canonical', fixMethod: 'client' },
  'Missing <main> landmark': { fixType: 'add_main', fixMethod: 'client' },
  'Missing <header> element': { fixType: 'add_header', fixMethod: 'client' },
  'Missing <footer> element': { fixType: 'add_footer', fixMethod: 'client' },
  'Missing <nav> element': { fixType: 'wrap_nav', fixMethod: 'client' },
  'Missing skip navigation link': { fixType: 'add_skip_link', fixMethod: 'client' },
  'Images missing lazy loading': { fixType: 'add_lazy_loading', fixMethod: 'client' },
  // Python fixes (schema worker, $0)
  'No structured data (JSON-LD) found': { fixType: 'generate_schema_auto', fixMethod: 'python' },
  'Missing LocalBusiness schema': { fixType: 'generate_schema_localbusiness', fixMethod: 'python' },
  'Missing Article schema': { fixType: 'generate_schema_article', fixMethod: 'python' },
  'Missing FAQPage schema': { fixType: 'generate_schema_faq', fixMethod: 'python' },
  'Missing Product schema': { fixType: 'generate_schema_product', fixMethod: 'python' },
  'Missing Organization schema': { fixType: 'generate_schema_organization', fixMethod: 'python' },
  'Missing AboutPage schema': { fixType: 'generate_schema_aboutpage', fixMethod: 'python' },
  // LLM fixes (~$0.001/call)
  'Missing meta description': { fixType: 'generate_meta_description', fixMethod: 'llm' },
  'Missing page title': { fixType: 'generate_title', fixMethod: 'llm' },
  'Missing Open Graph tags': { fixType: 'generate_og_tags', fixMethod: 'llm' },
  'Content not wrapped in semantic sections': { fixType: 'improve_llm_readability', fixMethod: 'llm' },
};

function enrichFindings(fixes: Finding[]): Finding[] {
  return fixes.map(f => {
    // Direct match
    const mapping = FIX_MAPPING[f.issue];
    if (mapping) {
      f.fixType = mapping.fixType;
      f.fixMethod = mapping.fixMethod;
      return f;
    }
    // Partial match patterns
    if (/Multiple H1/.test(f.issue)) {
      f.fixType = 'fix_multiple_h1';
      f.fixMethod = 'client';
    } else if (/missing rel.*noopener/i.test(f.issue)) {
      f.fixType = 'add_noopener';
      f.fixMethod = 'client';
    } else if (/missing alt text/i.test(f.issue)) {
      f.fixType = 'generate_alt_text';
      f.fixMethod = 'llm';
    } else if (/Description too short/i.test(f.issue)) {
      f.fixType = 'generate_meta_description';
      f.fixMethod = 'llm';
    } else if (/Title too (?:short|long)/i.test(f.issue)) {
      f.fixType = 'generate_title';
      f.fixMethod = 'llm';
    } else if (/Missing.*schema/i.test(f.issue)) {
      f.fixType = 'generate_schema_auto';
      f.fixMethod = 'python';
    } else if (/not wrapped in semantic/i.test(f.issue)) {
      f.fixType = 'improve_llm_readability';
      f.fixMethod = 'llm';
    }
    return f;
  });
}

interface DetailedFindings {
  meta: MetaFindings;
  headings: HeadingFindings;
  schema: SchemaFindings;
  semantic: SemanticFindings;
  images: ImageFindings;
  links: LinkFindings;
  content: ContentFindings;
}

interface MetaFindings {
  hasTitle: boolean;
  title: string | null;
  titleLength: number;
  titleIssues: string[];
  hasDescription: boolean;
  description: string | null;
  descriptionLength: number;
  descriptionIssues: string[];
  hasOgTags: boolean;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  hasTwitterTags: boolean;
  hasCanonical: boolean;
  canonical: string | null;
  hasViewport: boolean;
  hasCharset: boolean;
  hasLang: boolean;
}

interface HeadingFindings {
  hasH1: boolean;
  h1Text: string | null;
  h1Count: number;
  hasSingleH1: boolean;
  h1Issues: string[];
  hasProperHierarchy: boolean;
  hierarchyIssues: string[];
  distribution: Record<string, number>;
  totalHeadings: number;
}

interface SchemaFindings {
  hasSchema: boolean;
  schemaCount: number;
  schemaTypes: string[];
  validationIssues: string[];
  opportunities: Array<{ type: string; reason: string; impact: string; priority: string }>;
  detectedContentTypes: string[];
}

interface SemanticFindings {
  hasMain: boolean;
  hasHeader: boolean;
  hasNav: boolean;
  hasFooter: boolean;
  hasArticle: boolean;
  hasSection: boolean;
  hasAside: boolean;
  ariaLabels: number;
  ariaLabelledby: number;
  roles: number;
  landmarkCount: number;
  hasSkipLink: boolean;
}

interface ImageFindings {
  totalImages: number;
  imagesWithAlt: number;
  imagesMissingAlt: number;
  imagesEmptyAlt: number;
  missingAltList: string[];
  decorativeImages: number;
  imagesWithoutLazy: number;
}

interface LinkFindings {
  totalLinks: number;
  internalLinks: number;
  externalLinks: number;
  linksWithGenericText: number;
  genericTextList: string[];
  linksNewTab: number;
  linksNoOpener: number;
}

interface ContentFindings {
  wordCount: number;
  paragraphCount: number;
  listCount: number;
  contentDepth: 'thin' | 'adequate' | 'comprehensive';
  estimatedReadTime: number;
  hasLists: boolean;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request } = context;

  let body: { html: string; pageName?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { html, pageName } = body;
  if (!html) {
    return Response.json({ ok: false, error: 'Missing html' }, { status: 400 });
  }

  try {
    // Run all checkers
    const meta = checkMeta(html);
    const headings = checkHeadings(html);
    const schema = checkSchema(html, pageName);
    const semantic = checkSemantic(html);
    const images = checkImages(html);
    const links = checkLinks(html);
    const content = checkContent(html);
    const llmReadability = checkLLMReadability(html);
    const componentRecs = getComponentRecommendations(html, content, schema);

    // Calculate component scores
    const scores = {
      meta: calculateMetaScore(meta),
      headings: calculateHeadingScore(headings),
      schema: calculateSchemaScore(schema),
      semantic: calculateSemanticScore(semantic),
      images: calculateImageScore(images),
      links: calculateLinkScore(links),
      content: calculateContentScore(content),
    };

    // Calculate overall (weighted)
    const weights = { meta: 0.20, headings: 0.12, schema: 0.15, semantic: 0.10, images: 0.10, links: 0.08, content: 0.25 };
    const overall = Object.entries(scores).reduce((sum, [key, score]) => {
      return sum + score * (weights[key as keyof typeof weights] || 0.1);
    }, 0);

    // Generate fixes and enrich with 3-tier fix mapping
    const fixes = enrichFindings([
      ...getMetaFixes(meta),
      ...getHeadingFixes(headings),
      ...getSchemaFixes(schema),
      ...getSemanticFixes(semantic),
      ...getImageFixes(images),
      ...getLinkFixes(links),
      ...getContentFixes(content),
      ...llmReadability.findings,
    ]);

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    fixes.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Group into top issues and quick wins
    const topIssues = fixes.filter(f => f.severity === 'critical' || f.severity === 'high').slice(0, 5);
    const quickWins = fixes.filter(f => f.timeEstimate && (f.timeEstimate.includes('2 min') || f.timeEstimate.includes('5 min'))).slice(0, 5);

    return Response.json({
      ok: true,
      summary: {
        overallScore: Math.round(overall),
        grade: getGrade(overall),
        status: overall >= 80 ? 'excellent' : overall >= 60 ? 'good' : overall >= 40 ? 'needs_improvement' : 'poor',
      },
      scores,
      scoreBreakdowns: {
        meta: getMetaBreakdown(meta),
        headings: getHeadingBreakdown(headings),
        schema: getSchemaBreakdown(schema),
        semantic: getSemanticBreakdown(semantic),
        images: getImageBreakdown(images),
        links: getLinkBreakdown(links),
        content: getContentBreakdown(content),
      },
      topIssues,
      quickWins,
      detailedFindings: { meta, headings, schema, semantic, images, links, content },
      allFixes: fixes,
      fixCount: fixes.length,
      componentRecommendations: componentRecs,
      llmReadabilityScore: llmReadability.score,
    });
  } catch (err: any) {
    console.error('Analysis error:', err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
};

function getGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 80) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

// ─── META CHECKER ───
function checkMeta(html: string): MetaFindings {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;

  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content="([^"]*)"/i) ||
                    html.match(/<meta[^>]*name=["']description["'][^>]*content='([^']*)'/i) ||
                    html.match(/<meta[^>]*content="([^"]*)"[^>]*name=["']description["']/i) ||
                    html.match(/<meta[^>]*content='([^']*)'[^>]*name=["']description["']/i);
  const description = descMatch ? descMatch[1] : null;

  const ogTitle = extractMeta(html, 'og:title', 'property');
  const ogDescription = extractMeta(html, 'og:description', 'property');
  const ogImage = extractMeta(html, 'og:image', 'property');

  const twitterCard = extractMeta(html, 'twitter:card', 'name');

  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
  const canonical = canonicalMatch ? canonicalMatch[1] : null;

  const viewportMatch = html.match(/<meta[^>]*name=["']viewport["']/i);
  const charsetMatch = html.match(/<meta[^>]*charset=/i);
  const langMatch = html.match(/<html[^>]*lang=["'][^"']+["']/i);

  const titleIssues: string[] = [];
  if (title) {
    if (title.length < 20) titleIssues.push('too_short');
    else if (title.length > 60) titleIssues.push('too_long');
    if (/^(home|homepage|welcome|untitled)$/i.test(title)) titleIssues.push('generic');
  }

  const descriptionIssues: string[] = [];
  if (description) {
    if (description.length < 50) descriptionIssues.push('too_short');
    else if (description.length > 160) descriptionIssues.push('too_long');
  }

  return {
    hasTitle: !!title,
    title,
    titleLength: title?.length || 0,
    titleIssues,
    hasDescription: !!description,
    description,
    descriptionLength: description?.length || 0,
    descriptionIssues,
    hasOgTags: !!(ogTitle || ogDescription || ogImage),
    ogTitle,
    ogDescription,
    ogImage,
    hasTwitterTags: !!twitterCard,
    hasCanonical: !!canonical,
    canonical,
    hasViewport: !!viewportMatch,
    hasCharset: !!charsetMatch,
    hasLang: !!langMatch,
  };
}

function extractMeta(html: string, name: string, attr: string): string | null {
  // Match double-quoted content first, then single-quoted, to avoid apostrophe issues
  for (const q of ['"', "'"]) {
    const esc = q === "'" ? "'" : '"';
    const r1 = new RegExp(`<meta[^>]*${attr}=["']${name}["'][^>]*content=${esc}([^${esc}]*)${esc}`, 'i');
    const m1 = html.match(r1);
    if (m1) return m1[1];
    const r2 = new RegExp(`<meta[^>]*content=${esc}([^${esc}]*)${esc}[^>]*${attr}=["']${name}["']`, 'i');
    const m2 = html.match(r2);
    if (m2) return m2[1];
  }
  return null;
}

function calculateMetaScore(f: MetaFindings): number {
  let score = 0;
  if (f.hasTitle) score += 15;
  if (f.hasTitle && f.titleIssues.length === 0) score += 10;
  if (f.hasDescription) score += 15;
  if (f.hasDescription && f.descriptionIssues.length === 0) score += 10;
  if (f.hasOgTags) score += 20;
  if (f.ogImage) score += 5;
  if (f.hasTwitterTags) score += 5;
  if (f.hasCanonical) score += 10;
  if (f.hasViewport) score += 10;
  return Math.min(100, score);
}

function getMetaFixes(f: MetaFindings): Finding[] {
  const fixes: Finding[] = [];

  if (!f.hasTitle) {
    fixes.push({
      category: 'meta',
      severity: 'critical',
      issue: 'Missing page title',
      impact: 'Title is critical for SEO and appears in search results and browser tabs',
      fix: '<title>Descriptive Page Title - Brand Name</title>',
      location: '<head>',
      timeEstimate: '2 minutes',
      fixType: 'generate_title',
      fixMethod: 'llm',
    });
  } else if (f.titleIssues.includes('too_short')) {
    fixes.push({
      category: 'meta',
      severity: 'medium',
      issue: `Title too short (${f.titleLength} chars)`,
      impact: 'Short titles miss SEO opportunities. Aim for 30-55 characters.',
      fix: `<title>${f.title} - Add More Keywords | Brand</title>`,
      currentCode: `<title>${f.title}</title>`,
      timeEstimate: '5 minutes',
      fixType: 'generate_title',
      fixMethod: 'llm',
    });
  } else if (f.titleIssues.includes('too_long')) {
    fixes.push({
      category: 'meta',
      severity: 'low',
      issue: `Title too long (${f.titleLength} chars)`,
      impact: 'Will be truncated in search results. Keep under 60 chars.',
      fix: `<title>${f.title?.substring(0, 55)}...</title>`,
      timeEstimate: '5 minutes',
      fixType: 'generate_title',
      fixMethod: 'llm',
    });
  }

  if (!f.hasDescription) {
    fixes.push({
      category: 'meta',
      severity: 'high',
      issue: 'Missing meta description',
      impact: 'Descriptions appear in search results and improve click-through rates',
      fix: '<meta name="description" content="Write a 120-155 character description summarizing this page.">',
      location: '<head>',
      timeEstimate: '5 minutes',
      fixType: 'generate_meta_description',
      fixMethod: 'llm',
    });
  } else if (f.descriptionIssues.includes('too_short')) {
    fixes.push({
      category: 'meta',
      severity: 'medium',
      issue: `Description too short (${f.descriptionLength} chars)`,
      impact: 'Expand to 120-155 characters to maximize search result space',
      fix: `Click 'Generate Fix' to create an optimized 120-155 character description`,
      timeEstimate: '5 minutes',
      fixType: 'generate_meta_description',
      fixMethod: 'llm',
    });
  }

  if (!f.hasOgTags) {
    fixes.push({
      category: 'meta',
      severity: 'high',
      issue: 'Missing Open Graph tags',
      impact: 'Content will look poor when shared on social media',
      fix: `<meta property="og:title" content="Page Title">
<meta property="og:description" content="Page description">
<meta property="og:image" content="https://example.com/image.jpg">
<meta property="og:type" content="website">`,
      location: '<head>',
      timeEstimate: '10 minutes',
      fixType: 'generate_og_tags',
      fixMethod: 'llm',
    });
  } else if (!f.ogImage) {
    fixes.push({
      category: 'meta',
      severity: 'medium',
      issue: 'Missing og:image',
      impact: 'Social shares will lack a preview image',
      fix: '<meta property="og:image" content="https://example.com/social-image.jpg">',
      timeEstimate: '5 minutes',
      fixType: 'generate_og_tags',
      fixMethod: 'llm',
    });
  }

  if (!f.hasCanonical) {
    fixes.push({
      category: 'meta',
      severity: 'medium',
      issue: 'Missing canonical URL',
      impact: 'Helps prevent duplicate content issues',
      fix: '<link rel="canonical" href="https://example.com/current-page">',
      location: '<head>',
      timeEstimate: '2 minutes',
      fixType: 'add_canonical',
      fixMethod: 'client',
    });
  }

  if (!f.hasViewport) {
    fixes.push({
      category: 'meta',
      severity: 'high',
      issue: 'Missing viewport meta tag',
      impact: 'Page may not be mobile-friendly',
      fix: '<meta name="viewport" content="width=device-width, initial-scale=1">',
      location: '<head>',
      timeEstimate: '2 minutes',
      fixType: 'add_viewport',
      fixMethod: 'client',
    });
  }

  if (!f.hasCharset) {
    fixes.push({
      category: 'meta',
      severity: 'high',
      issue: 'Missing charset declaration',
      impact: 'Browser may misinterpret characters. Always declare charset.',
      fix: '<meta charset="UTF-8">',
      location: '<head>',
      timeEstimate: '2 minutes',
      fixType: 'add_charset',
      fixMethod: 'client',
    });
  }

  if (!f.hasLang) {
    fixes.push({
      category: 'meta',
      severity: 'medium',
      issue: 'Missing lang attribute',
      impact: 'Screen readers and search engines use lang to identify page language',
      fix: '<html lang="en">',
      timeEstimate: '2 minutes',
      fixType: 'add_lang',
      fixMethod: 'client',
    });
  }

  return fixes;
}

// ─── HEADINGS CHECKER ───
function checkHeadings(html: string): HeadingFindings {
  const distribution: Record<string, number> = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
  const hierarchyIssues: string[] = [];
  let h1Text: string | null = null;
  const h1Issues: string[] = [];

  const headings: Array<{ level: number; text: string }> = [];

  for (let i = 1; i <= 6; i++) {
    const regex = new RegExp(`<h${i}[^>]*>([\\s\\S]*?)<\\/h${i}>`, 'gi');
    let match;
    while ((match = regex.exec(html)) !== null) {
      const text = match[1].replace(/<[^>]*>/g, '').trim();
      distribution[`h${i}`]++;
      headings.push({ level: i, text });

      if (i === 1 && !h1Text) {
        h1Text = text;
        if (text.length < 10) h1Issues.push('too_short');
        else if (text.length > 70) h1Issues.push('too_long');
        if (/^(home|homepage|welcome|untitled)$/i.test(text)) h1Issues.push('generic');
      }
    }
  }

  // Check hierarchy
  let prevLevel = 0;
  let hasProperHierarchy = true;
  for (const h of headings) {
    if (prevLevel > 0 && h.level > prevLevel + 1) {
      hierarchyIssues.push(`Skipped level: H${prevLevel} → H${h.level}`);
      hasProperHierarchy = false;
    }
    prevLevel = h.level;
  }

  if (headings.length > 0 && headings[0].level !== 1) {
    hierarchyIssues.push(`First heading is H${headings[0].level}, not H1`);
  }

  return {
    hasH1: distribution.h1 > 0,
    h1Text,
    h1Count: distribution.h1,
    hasSingleH1: distribution.h1 === 1,
    h1Issues,
    hasProperHierarchy,
    hierarchyIssues,
    distribution,
    totalHeadings: Object.values(distribution).reduce((a, b) => a + b, 0),
  };
}

function calculateHeadingScore(f: HeadingFindings): number {
  let score = 0;
  if (f.hasH1) score += 25;
  if (f.hasSingleH1) score += 15;
  if (f.hasH1 && f.h1Issues.length === 0) score += 10;
  if (f.hasProperHierarchy) score += 25;
  if (f.distribution.h2 >= 2) score += 15;
  else if (f.distribution.h2 === 1) score += 10;
  if (f.totalHeadings >= 3 && f.totalHeadings <= 15) score += 10;
  return Math.min(100, score);
}

function getHeadingFixes(f: HeadingFindings): Finding[] {
  const fixes: Finding[] = [];

  if (!f.hasH1) {
    fixes.push({
      category: 'headings',
      severity: 'critical',
      issue: 'Missing H1 heading',
      impact: 'Every page should have exactly one H1. Critical for SEO and accessibility.',
      fix: '<h1>Descriptive Page Title That Summarizes Main Topic</h1>',
      location: '<body>, before main content',
      timeEstimate: '2 minutes',
    });
  } else if (!f.hasSingleH1) {
    fixes.push({
      category: 'headings',
      severity: 'high',
      issue: `Multiple H1 tags (${f.h1Count} found)`,
      impact: 'Should have exactly one H1 per page. Convert extras to H2.',
      fix: `Keep one H1, change others to H2:\n<h1>${f.h1Text}</h1>\n<!-- Convert other H1s to H2 -->`,
      timeEstimate: '2 minutes',
      fixType: 'fix_multiple_h1',
      fixMethod: 'client',
    });
  }

  if (f.h1Issues.includes('generic')) {
    fixes.push({
      category: 'headings',
      severity: 'high',
      issue: `Generic H1: "${f.h1Text}"`,
      impact: 'Generic titles hurt SEO. Use descriptive text with keywords.',
      fix: '<h1>Specific, Descriptive Title About Your Main Topic</h1>',
      currentCode: `<h1>${f.h1Text}</h1>`,
      timeEstimate: '5 minutes',
    });
  }

  if (!f.hasProperHierarchy && f.hierarchyIssues.length > 0) {
    fixes.push({
      category: 'headings',
      severity: 'medium',
      issue: 'Heading hierarchy issues',
      impact: f.hierarchyIssues.join('; '),
      fix: 'Add missing heading levels or restructure existing headings',
      timeEstimate: '15 minutes',
    });
  }

  if (f.distribution.h2 === 0 && f.totalHeadings > 0) {
    fixes.push({
      category: 'headings',
      severity: 'medium',
      issue: 'No H2 headings',
      impact: 'Use H2s to break content into logical sections',
      fix: '<h2>Section Title</h2>',
      timeEstimate: '10 minutes',
    });
  }

  return fixes;
}

// ─── SCHEMA CHECKER ───
function checkSchema(html: string, pageName?: string): SchemaFindings {
  const schemaTypes: string[] = [];
  const validationIssues: string[] = [];
  const detectedContentTypes: string[] = [];
  const opportunities: Array<{ type: string; reason: string; impact: string; priority: string }> = [];

  // Extract JSON-LD
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let schemaCount = 0;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      schemaCount++;

      if (data['@graph']) {
        for (const item of data['@graph']) {
          if (item['@type']) schemaTypes.push(item['@type']);
        }
      } else if (data['@type']) {
        schemaTypes.push(data['@type']);
      }
    } catch (e) {
      validationIssues.push('Invalid JSON-LD syntax');
    }
  }

  // Detect content types
  const htmlLower = html.toLowerCase();

  if (/faq|frequently\s+asked/i.test(htmlLower) || /<(details|dt)[^>]*>/i.test(html)) {
    detectedContentTypes.push('faq');
  }
  if (/step\s+\d+|how\s+to\s+|instructions/i.test(htmlLower)) {
    detectedContentTypes.push('howto');
  }
  const hasEcommerce = /add\s+to\s+cart|buy\s+now|checkout|shopping\s+cart/i.test(htmlLower);
  const hasPricePattern = /\$\d+|€\d+|£\d+|price/i.test(htmlLower);
  const isMenuOrLocal = /menu|appetizer|entree|dessert|cuisine|reservation|hours|location|directions/i.test(htmlLower);
  if (hasEcommerce || (hasPricePattern && !isMenuOrLocal)) {
    detectedContentTypes.push('product');
  }
  if (/<article[^>]*>/i.test(html) || /<time[^>]*datetime/i.test(html)) {
    detectedContentTypes.push('article');
  }
  if (/youtube\.com|vimeo\.com|<video/i.test(htmlLower)) {
    detectedContentTypes.push('video');
  }
  if (/address|contact\s+us|hours|location|directions/i.test(htmlLower)) {
    detectedContentTypes.push('local_business');
  }

  // Detect about pages
  const aboutHtmlMatch = /about\s+us|our\s+story|our\s+team|our\s+mission|who\s+we\s+are|company\s+overview|meet\s+the\s+team/i.test(htmlLower);
  const aboutPageMatch = pageName ? /^(about|team|company|our-story|our-team|who-we-are)/i.test(pageName) : false;
  if (aboutHtmlMatch || aboutPageMatch) {
    detectedContentTypes.push('about');
    // About pages should not recommend Article schema
    const articleIdx = detectedContentTypes.indexOf('article');
    if (articleIdx !== -1) detectedContentTypes.splice(articleIdx, 1);
  }

  // Identify opportunities
  const existingTypes = schemaTypes.map(t => t.toLowerCase());

  const opportunityMap: Record<string, { type: string; reason: string; impact: string; priority: string }> = {
    faq: { type: 'FAQPage', reason: 'FAQ content detected', impact: 'Can earn FAQ rich snippets in search', priority: 'high' },
    howto: { type: 'HowTo', reason: 'Step-by-step content detected', impact: 'Can show steps in search results', priority: 'high' },
    product: { type: 'Product', reason: 'Product info detected', impact: 'Can show price/availability in search', priority: 'high' },
    article: { type: 'Article', reason: 'Article content detected', impact: 'Improves article appearance in search', priority: 'medium' },
    video: { type: 'VideoObject', reason: 'Video content detected', impact: 'Can show video thumbnail in search', priority: 'medium' },
    local_business: { type: 'LocalBusiness', reason: 'Local business info detected', impact: 'Can appear in local search and Maps', priority: 'high' },
    about: { type: 'AboutPage', reason: 'About page content detected', impact: 'Helps search engines understand your organization page', priority: 'medium' },
  };

  for (const contentType of detectedContentTypes) {
    const opp = opportunityMap[contentType];
    if (opp && !existingTypes.includes(opp.type.toLowerCase())) {
      opportunities.push(opp);
    }
  }

  if (schemaCount === 0) {
    opportunities.unshift({
      type: 'WebSite/Organization',
      reason: 'No structured data found',
      impact: 'Basic schema establishes site identity for search engines',
      priority: 'high',
    });
  }

  return {
    hasSchema: schemaCount > 0,
    schemaCount,
    schemaTypes,
    validationIssues,
    opportunities,
    detectedContentTypes,
  };
}

function calculateSchemaScore(f: SchemaFindings): number {
  let score = 0;
  if (f.hasSchema) score += 40;
  else score += 10;
  if (f.schemaCount >= 2) score += 15;
  else if (f.schemaCount === 1) score += 10;
  if (f.validationIssues.length === 0) score += 15;
  const highPriorityMissed = f.opportunities.filter(o => o.priority === 'high').length;
  if (highPriorityMissed === 0) score += 20;
  else if (highPriorityMissed === 1) score += 10;
  return Math.min(100, score);
}

function getSchemaFixes(f: SchemaFindings): Finding[] {
  const fixes: Finding[] = [];

  if (!f.hasSchema) {
    fixes.push({
      category: 'schema',
      severity: 'high',
      issue: 'No structured data (JSON-LD) found',
      impact: 'Add schema to help search engines understand your content',
      fix: 'Auto-generate JSON-LD structured data',
      location: '<head>',
      timeEstimate: '2 minutes',
      fixType: 'generate_schema_auto',
      fixMethod: 'python',
    });
  }

  const schemaTypeToFixType: Record<string, string> = {
    'LocalBusiness': 'generate_schema_localbusiness',
    'Article': 'generate_schema_article',
    'FAQPage': 'generate_schema_faq',
    'Product': 'generate_schema_product',
    'WebSite/Organization': 'generate_schema_organization',
    'Organization': 'generate_schema_organization',
    'AboutPage': 'generate_schema_aboutpage',
  };

  for (const opp of f.opportunities.slice(0, 3)) {
    const ft = schemaTypeToFixType[opp.type] || 'generate_schema_auto';
    fixes.push({
      category: 'schema',
      severity: opp.priority === 'high' ? 'high' : 'medium',
      issue: `Missing ${opp.type} schema`,
      impact: `${opp.reason}. ${opp.impact}`,
      fix: `Auto-generate ${opp.type} schema`,
      timeEstimate: '2 minutes',
      fixType: ft,
      fixMethod: 'python',
    });
  }

  for (const issue of f.validationIssues) {
    fixes.push({
      category: 'schema',
      severity: 'high',
      issue: 'Invalid JSON-LD',
      impact: issue,
      fix: 'Fix JSON syntax errors in your structured data',
      timeEstimate: '10 minutes',
    });
  }

  return fixes;
}

// ─── SEMANTIC CHECKER ───
function checkSemantic(html: string): SemanticFindings {
  return {
    hasMain: /<main[^>]*>/i.test(html),
    hasHeader: /<header[^>]*>/i.test(html),
    hasNav: /<nav[^>]*>/i.test(html),
    hasFooter: /<footer[^>]*>/i.test(html),
    hasArticle: /<article[^>]*>/i.test(html),
    hasSection: /<section[^>]*>/i.test(html),
    hasAside: /<aside[^>]*>/i.test(html),
    ariaLabels: (html.match(/aria-label=/gi) || []).length,
    ariaLabelledby: (html.match(/aria-labelledby=/gi) || []).length,
    roles: (html.match(/role=/gi) || []).length,
    landmarkCount: (html.match(/<(main|header|nav|footer|article|section|aside)[^>]*>/gi) || []).length,
    hasSkipLink: /<a[^>]*href=["']#(main|content|main-content)[^"']*["']/i.test(html),
  };
}

function calculateSemanticScore(f: SemanticFindings): number {
  let score = 0;
  if (f.hasMain) score += 20;
  if (f.hasHeader) score += 15;
  if (f.hasNav) score += 15;
  if (f.hasFooter) score += 15;
  if (f.hasArticle || f.hasSection) score += 10;
  if (f.ariaLabels > 0) score += 15;
  if (f.roles > 0) score += 10;
  return Math.min(100, score);
}

function getSemanticFixes(f: SemanticFindings): Finding[] {
  const fixes: Finding[] = [];

  if (!f.hasMain) {
    fixes.push({
      category: 'semantic',
      severity: 'high',
      issue: 'Missing <main> landmark',
      impact: 'Screen readers use <main> to skip to main content',
      fix: '<main>\n  <!-- Your main content here -->\n</main>',
      timeEstimate: '5 minutes',
      fixType: 'add_main',
      fixMethod: 'client',
    });
  }

  if (!f.hasHeader) {
    fixes.push({
      category: 'semantic',
      severity: 'medium',
      issue: 'Missing <header> element',
      impact: 'Use <header> for site/page header content',
      fix: '<header>\n  <!-- Logo, navigation, etc. -->\n</header>',
      timeEstimate: '5 minutes',
      fixType: 'add_header',
      fixMethod: 'client',
    });
  }

  if (!f.hasNav) {
    fixes.push({
      category: 'semantic',
      severity: 'medium',
      issue: 'Missing <nav> element',
      impact: 'Use <nav> for navigation links',
      fix: '<nav aria-label="Main navigation">\n  <!-- Navigation links -->\n</nav>',
      timeEstimate: '5 minutes',
      fixType: 'add_nav',
      fixMethod: 'client',
    });
  }

  if (!f.hasFooter) {
    fixes.push({
      category: 'semantic',
      severity: 'low',
      issue: 'Missing <footer> element',
      impact: 'Use <footer> for footer content',
      fix: '<footer>\n  <!-- Footer content -->\n</footer>',
      timeEstimate: '5 minutes',
      fixType: 'add_footer',
      fixMethod: 'client',
    });
  }

  if (!f.hasSkipLink && f.hasMain) {
    fixes.push({
      category: 'semantic',
      severity: 'medium',
      issue: 'Missing skip navigation link',
      impact: 'Skip links help keyboard users bypass navigation',
      fix: '<a href="#main" class="skip-link">Skip to content</a>',
      timeEstimate: '2 minutes',
      fixType: 'add_skip_link',
      fixMethod: 'client',
    });
  }

  if (f.ariaLabels === 0 && f.ariaLabelledby === 0) {
    fixes.push({
      category: 'semantic',
      severity: 'medium',
      issue: 'No ARIA labels found',
      impact: 'ARIA labels improve accessibility for screen readers',
      fix: 'Add aria-label or aria-labelledby to interactive elements and landmarks',
      timeEstimate: '15 minutes',
      fixType: 'add_aria_labels',
      fixMethod: 'client',
    });
  }

  return fixes;
}

// ─── IMAGES CHECKER ───
function checkImages(html: string): ImageFindings {
  const imgRegex = /<img[^>]*>/gi;
  const images = html.match(imgRegex) || [];

  let imagesWithAlt = 0;
  let imagesEmptyAlt = 0;
  let imagesWithoutLazy = 0;
  const missingAltList: string[] = [];

  for (let idx = 0; idx < images.length; idx++) {
    const img = images[idx];
    const altMatch = img.match(/alt=["']([^"']*)["']/i);
    if (altMatch) {
      if (altMatch[1].trim() === '') {
        imagesEmptyAlt++;
      } else {
        imagesWithAlt++;
      }
    } else {
      const srcMatch = img.match(/src=["']([^"']*)["']/i);
      missingAltList.push(srcMatch ? srcMatch[1].substring(0, 50) : 'unknown');
    }

    // Skip first image (above-fold) — matches client fix behavior
    if (idx > 0 && !/loading=["']lazy["']/i.test(img)) {
      imagesWithoutLazy++;
    }
  }

  return {
    totalImages: images.length,
    imagesWithAlt,
    imagesMissingAlt: images.length - imagesWithAlt - imagesEmptyAlt,
    imagesEmptyAlt,
    missingAltList: missingAltList.slice(0, 5),
    decorativeImages: imagesEmptyAlt,
    imagesWithoutLazy,
  };
}

function calculateImageScore(f: ImageFindings): number {
  if (f.totalImages === 0) return 100;
  let score = 0;
  // Alt text: 70 points
  const withAltRatio = (f.imagesWithAlt + f.imagesEmptyAlt) / f.totalImages;
  score += Math.round(withAltRatio * 70);
  // Lazy loading: 30 points (skip first image which should be eager)
  const lazyEligible = Math.max(0, f.totalImages - 1);
  if (lazyEligible === 0) {
    score += 30;
  } else {
    const lazyRatio = Math.max(0, lazyEligible - f.imagesWithoutLazy) / lazyEligible;
    score += Math.round(lazyRatio * 30);
  }
  return Math.min(100, score);
}

function getImageFixes(f: ImageFindings): Finding[] {
  const fixes: Finding[] = [];

  if (f.imagesWithoutLazy > 0 && f.totalImages > 1) {
    fixes.push({
      category: 'images',
      severity: 'medium',
      issue: 'Images missing lazy loading',
      impact: `${f.imagesWithoutLazy} image(s) load eagerly, slowing initial page load`,
      fix: 'Add loading="lazy" to offscreen images',
      timeEstimate: '2 minutes',
      fixType: 'add_lazy_loading',
      fixMethod: 'client',
    });
  }

  if (f.imagesMissingAlt > 0) {
    fixes.push({
      category: 'images',
      severity: 'high',
      issue: `${f.imagesMissingAlt} image(s) missing alt text`,
      impact: 'Alt text is critical for accessibility and SEO',
      fix: f.missingAltList.length > 0
        ? `Add alt text to images:\n${f.missingAltList.map(src => `<img src="${src}" alt="Descriptive text">`).join('\n')}`
        : 'Add alt="" for decorative images or descriptive alt text for meaningful images',
      timeEstimate: `${f.imagesMissingAlt * 2} minutes`,
      fixType: 'generate_alt_text',
      fixMethod: 'llm',
    });
  }

  return fixes;
}

// ─── LINKS CHECKER ───
function checkLinks(html: string): LinkFindings {
  const linkRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  let totalLinks = 0;
  let internalLinks = 0;
  let externalLinks = 0;
  let linksWithGenericText = 0;
  let linksNewTab = 0;
  let linksNoOpener = 0;
  const genericTextList: string[] = [];

  const genericTexts = ['click here', 'read more', 'learn more', 'here', 'link', 'this'];

  while ((match = linkRegex.exec(html)) !== null) {
    totalLinks++;
    const href = match[1];
    const text = match[2].replace(/<[^>]*>/g, '').trim().toLowerCase();
    const fullTag = match[0];

    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
      externalLinks++;
    } else if (!href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
      internalLinks++;
    }

    if (genericTexts.includes(text)) {
      linksWithGenericText++;
      genericTextList.push(text);
    }

    if (/target=["']_blank["']/i.test(fullTag)) {
      linksNewTab++;
      if (/rel=["'][^"']*noopener[^"']*["']/i.test(fullTag)) {
        linksNoOpener++;
      }
    }
  }

  return {
    totalLinks,
    internalLinks,
    externalLinks,
    linksWithGenericText,
    genericTextList: genericTextList.slice(0, 5),
    linksNewTab,
    linksNoOpener,
  };
}

function calculateLinkScore(f: LinkFindings): number {
  let score = 20; // Base
  if (f.internalLinks >= 3) score += 30;
  else if (f.internalLinks >= 1) score += 15;
  if (f.externalLinks >= 2) score += 15;
  else if (f.externalLinks >= 1) score += 10;
  if (f.linksWithGenericText === 0) score += 20;
  else if (f.linksWithGenericText <= 2) score += 10;
  if (f.linksNewTab === f.linksNoOpener) score += 5;
  if (f.totalLinks >= 5) score += 10;
  return Math.min(100, score);
}

function getLinkFixes(f: LinkFindings): Finding[] {
  const fixes: Finding[] = [];

  if (f.linksWithGenericText > 0) {
    fixes.push({
      category: 'links',
      severity: 'medium',
      issue: `${f.linksWithGenericText} link(s) with generic text`,
      impact: 'Generic link text ("click here") hurts SEO and accessibility',
      fix: `Replace generic text with descriptive text:\n${f.genericTextList.map(t => `"${t}" → "View our pricing plans"`).join('\n')}`,
      timeEstimate: '10 minutes',
    });
  }

  if (f.linksNewTab > f.linksNoOpener) {
    fixes.push({
      category: 'links',
      severity: 'medium',
      issue: `${f.linksNewTab - f.linksNoOpener} external link(s) missing rel="noopener"`,
      impact: 'Security: external links with target="_blank" should have rel="noopener"',
      fix: '<a href="..." target="_blank" rel="noopener">Link</a>',
      timeEstimate: '5 minutes',
      fixType: 'add_noopener',
      fixMethod: 'client',
    });
  }

  if (f.internalLinks === 0) {
    fixes.push({
      category: 'links',
      severity: 'low',
      issue: 'No internal links found',
      impact: 'Internal links help search engines discover content and improve navigation',
      fix: 'Add links to other pages on your site',
      timeEstimate: '15 minutes',
    });
  }

  return fixes;
}

// ─── CONTENT CHECKER ───
function checkContent(html: string): ContentFindings {
  // Remove scripts, styles, and tags
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = text.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  const paragraphCount = (html.match(/<p[^>]*>/gi) || []).length;
  const listCount = (html.match(/<(ul|ol)[^>]*>/gi) || []).length;

  let contentDepth: 'thin' | 'adequate' | 'comprehensive';
  if (wordCount < 200) contentDepth = 'thin';
  else if (wordCount < 500) contentDepth = 'adequate';
  else contentDepth = 'comprehensive';

  const estimatedReadTime = Math.ceil(wordCount / 200);

  return {
    wordCount,
    paragraphCount,
    listCount,
    contentDepth,
    estimatedReadTime,
    hasLists: listCount > 0,
  };
}

function calculateContentScore(f: ContentFindings): number {
  let score = 0;
  if (f.wordCount >= 300) score += 25;
  else if (f.wordCount >= 100) score += 10;
  if (f.wordCount >= 500) score += 15;
  if (f.paragraphCount >= 5) score += 20;
  else if (f.paragraphCount >= 3) score += 15;
  else if (f.paragraphCount >= 1) score += 5;
  if (f.hasLists) score += 15;
  if (f.contentDepth === 'comprehensive') score += 25;
  else if (f.contentDepth === 'adequate') score += 10;
  return Math.min(100, score);
}

function getContentFixes(f: ContentFindings): Finding[] {
  const fixes: Finding[] = [];

  if (f.wordCount < 300) {
    fixes.push({
      category: 'content',
      severity: 'medium',
      issue: `Thin content (${f.wordCount} words)`,
      impact: 'Pages with more content tend to rank better. Aim for 300+ words.',
      fix: "Click 'Generate Fix' to add 2-3 relevant paragraphs to your page",
      timeEstimate: '2 minutes',
      fixType: 'expand_content',
      fixMethod: 'llm',
    });
  }

  if (f.paragraphCount < 3) {
    fixes.push({
      category: 'content',
      severity: 'low',
      issue: `Few paragraphs (${f.paragraphCount})`,
      impact: 'Break content into structured sections for better readability and SEO',
      fix: "Click 'Generate Fix' to add structured content sections with headings",
      timeEstimate: '2 minutes',
      fixType: 'add_content_sections',
      fixMethod: 'llm',
    });
  }

  if (!f.hasLists) {
    fixes.push({
      category: 'content',
      severity: 'low',
      issue: 'No lists found',
      impact: 'Lists improve scannability and can earn featured snippets',
      fix: 'Add <ul> or <ol> lists to organize information',
      timeEstimate: '10 minutes',
    });
  }

  return fixes;
}

// ─── LLM READABILITY CHECKER ───
function checkLLMReadability(html: string): { score: number; findings: Finding[] } {
  const findings: Finding[] = [];
  let score = 0;

  const hasArticle = /<article[^>]*>/i.test(html);
  const hasSection = /<section[^>]*>/i.test(html);
  const sectionCount = (html.match(/<section[^>]*>/gi) || []).length;

  if (hasArticle) score += 20;
  if (hasSection) score += 15;
  if (sectionCount >= 3) score += 10;

  const schemaCount = (html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>/gi) || []).length;
  if (schemaCount >= 2) score += 20;
  else if (schemaCount === 1) score += 10;

  const textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const ratio = textContent.length / (html.length || 1);
  if (ratio > 0.3) score += 15;
  else if (ratio > 0.15) score += 8;

  const headings: number[] = [];
  const hRegex = /<h([1-6])[^>]*>/gi;
  let m;
  while ((m = hRegex.exec(html)) !== null) headings.push(parseInt(m[1]));
  let cleanHierarchy = true;
  for (let i = 1; i < headings.length; i++) {
    if (headings[i] > headings[i - 1] + 1) { cleanHierarchy = false; break; }
  }
  if (cleanHierarchy && headings.length >= 3) score += 20;
  else if (cleanHierarchy) score += 10;

  score = Math.min(100, score);

  if (!hasArticle && !hasSection) {
    findings.push({
      category: 'llm-readability',
      severity: 'medium',
      issue: 'Content not wrapped in semantic sections',
      impact: 'LLMs and search engines better understand content structured with <article> and <section> elements',
      fix: "Click 'Generate Fix' to restructure content into semantic sections with proper headings",
      timeEstimate: '2 minutes',
      fixType: 'improve_llm_readability',
      fixMethod: 'llm',
    });
  }

  if (ratio <= 0.15) {
    findings.push({
      category: 'llm-readability',
      severity: 'low',
      issue: 'Low content-to-markup ratio',
      impact: 'High markup density makes it harder for LLMs to extract meaningful content',
      fix: 'Add more text content or reduce unnecessary markup',
      timeEstimate: '15 minutes',
    });
  }

  return { score, findings };
}

// ─── COMPONENT RECOMMENDATIONS ───
function getComponentRecommendations(html: string, content: ContentFindings, schema: SchemaFindings): Finding[] {
  const findings: Finding[] = [];
  const htmlLower = html.toLowerCase();

  const hasFaqContent = /faq|frequently\s+asked/i.test(htmlLower) || /<details[^>]*>/i.test(html);
  const hasFaqSchema = schema.schemaTypes.some(t => t.toLowerCase().includes('faq'));
  if (!hasFaqContent && !hasFaqSchema) {
    findings.push({
      category: 'score-booster',
      severity: 'info',
      issue: 'No FAQ section found',
      impact: 'Adding an FAQ section boosts schema, content depth, and heading scores (+5-15 points)',
      fix: 'Add an FAQ section with common questions about your business or service',
      timeEstimate: '5 minutes',
      fixType: 'add_component_faq',
      fixMethod: 'component' as any,
    });
  }

  if (content.wordCount < 500) {
    const hasTestimonials = /testimonial|review|what\s+(our\s+)?(clients?|customers?)\s+say/i.test(htmlLower);
    if (!hasTestimonials) {
      findings.push({
        category: 'score-booster',
        severity: 'info',
        issue: 'No testimonials or social proof section',
        impact: 'Adding testimonials increases content depth and builds trust (+5-10 points)',
        fix: 'Add a testimonials or reviews section to build credibility',
        timeEstimate: '5 minutes',
        fixType: 'add_component_testimonial',
        fixMethod: 'component' as any,
      });
    }
  }

  if (!content.hasLists && content.wordCount < 600) {
    findings.push({
      category: 'score-booster',
      severity: 'info',
      issue: 'No features or benefits list',
      impact: 'Adding a features section with lists improves content scannability and SEO (+5-10 points)',
      fix: 'Add a features, benefits, or pricing section with structured lists',
      timeEstimate: '5 minutes',
      fixType: 'add_component_features',
      fixMethod: 'component' as any,
    });
  }

  return findings;
}

// ─── SCORE BREAKDOWNS (what's earned / what's missing per category) ───

interface BreakdownItem {
  label: string;
  points: number;
  earned: boolean;
  detail?: string;
}

function getMetaBreakdown(f: MetaFindings): { description: string; items: BreakdownItem[] } {
  return {
    description: 'Page metadata for search engines and social sharing',
    items: [
      { label: 'Has title tag', points: 15, earned: f.hasTitle, detail: f.hasTitle ? `"${f.title}"` : undefined },
      { label: 'Title well-formed', points: 10, earned: f.hasTitle && f.titleIssues.length === 0, detail: f.titleIssues.length > 0 ? f.titleIssues.join(', ') : undefined },
      { label: 'Has meta description', points: 15, earned: f.hasDescription, detail: f.hasDescription ? `${f.descriptionLength} chars` : undefined },
      { label: 'Description well-formed', points: 10, earned: f.hasDescription && f.descriptionIssues.length === 0, detail: f.descriptionIssues.length > 0 ? f.descriptionIssues.join(', ') : undefined },
      { label: 'Open Graph tags', points: 20, earned: f.hasOgTags },
      { label: 'OG image', points: 5, earned: !!f.ogImage },
      { label: 'Twitter card tags', points: 5, earned: f.hasTwitterTags },
      { label: 'Canonical URL', points: 10, earned: f.hasCanonical },
      { label: 'Viewport meta', points: 10, earned: f.hasViewport },
    ],
  };
}

function getHeadingBreakdown(f: HeadingFindings): { description: string; items: BreakdownItem[] } {
  return {
    description: 'Heading structure for accessibility and SEO',
    items: [
      { label: 'Has H1', points: 25, earned: f.hasH1, detail: f.hasH1 ? `"${f.h1Text}"` : undefined },
      { label: 'Single H1', points: 15, earned: f.hasSingleH1, detail: !f.hasSingleH1 && f.h1Count > 1 ? `${f.h1Count} found` : undefined },
      { label: 'H1 well-formed', points: 10, earned: f.hasH1 && f.h1Issues.length === 0, detail: f.h1Issues.length > 0 ? f.h1Issues.join(', ') : undefined },
      { label: 'Proper hierarchy', points: 25, earned: f.hasProperHierarchy, detail: f.hierarchyIssues.length > 0 ? f.hierarchyIssues[0] : undefined },
      { label: '2+ H2 subheadings', points: 15, earned: f.distribution.h2 >= 2, detail: `${f.distribution.h2} H2s found` },
      { label: '3-15 total headings', points: 10, earned: f.totalHeadings >= 3 && f.totalHeadings <= 15, detail: `${f.totalHeadings} total` },
    ],
  };
}

function getSchemaBreakdown(f: SchemaFindings): { description: string; items: BreakdownItem[] } {
  const highMissed = f.opportunities.filter(o => o.priority === 'high').length;
  return {
    description: 'Structured data (JSON-LD) for rich search results',
    items: [
      { label: 'Has schema markup', points: 40, earned: f.hasSchema, detail: f.hasSchema ? f.schemaTypes.join(', ') : undefined },
      { label: '2+ schema types', points: 15, earned: f.schemaCount >= 2, detail: `${f.schemaCount} found` },
      { label: 'Valid JSON-LD', points: 15, earned: f.validationIssues.length === 0, detail: f.validationIssues.length > 0 ? f.validationIssues[0] : undefined },
      { label: 'No high-priority gaps', points: 20, earned: highMissed === 0, detail: highMissed > 0 ? `${highMissed} missing: ${f.opportunities.filter(o => o.priority === 'high').map(o => o.type).join(', ')}` : undefined },
    ],
  };
}

function getSemanticBreakdown(f: SemanticFindings): { description: string; items: BreakdownItem[] } {
  return {
    description: 'HTML5 semantic structure and accessibility',
    items: [
      { label: '<main> landmark', points: 20, earned: f.hasMain },
      { label: '<header> element', points: 15, earned: f.hasHeader },
      { label: '<nav> element', points: 15, earned: f.hasNav },
      { label: '<footer> element', points: 15, earned: f.hasFooter },
      { label: '<article> or <section>', points: 10, earned: f.hasArticle || f.hasSection },
      { label: 'ARIA labels', points: 15, earned: f.ariaLabels > 0, detail: `${f.ariaLabels} found` },
      { label: 'ARIA roles', points: 10, earned: f.roles > 0, detail: `${f.roles} found` },
    ],
  };
}

function getImageBreakdown(f: ImageFindings): { description: string; items: BreakdownItem[] } {
  if (f.totalImages === 0) {
    return { description: 'Image accessibility and performance', items: [{ label: 'No images on page', points: 100, earned: true }] };
  }
  const altPercent = Math.round(((f.imagesWithAlt + f.imagesEmptyAlt) / f.totalImages) * 100);
  const lazyEligible = Math.max(0, f.totalImages - 1);
  const lazyDone = lazyEligible > 0 ? lazyEligible - f.imagesWithoutLazy : 0;
  return {
    description: 'Image accessibility and performance',
    items: [
      { label: 'All images have alt text', points: 70, earned: f.imagesMissingAlt === 0, detail: `${f.imagesWithAlt + f.imagesEmptyAlt}/${f.totalImages} (${altPercent}%)` },
      { label: 'Lazy loading on below-fold images', points: 30, earned: f.imagesWithoutLazy === 0, detail: lazyEligible > 0 ? `${lazyDone}/${lazyEligible} lazy` : 'only 1 image (above fold)' },
    ],
  };
}

function getLinkBreakdown(f: LinkFindings): { description: string; items: BreakdownItem[] } {
  return {
    description: 'Internal/external linking and link quality',
    items: [
      { label: 'Base score', points: 20, earned: true },
      { label: '3+ internal links', points: 30, earned: f.internalLinks >= 3, detail: `${f.internalLinks} found` },
      { label: '2+ external links', points: 15, earned: f.externalLinks >= 2, detail: `${f.externalLinks} found` },
      { label: 'No generic link text', points: 20, earned: f.linksWithGenericText === 0, detail: f.linksWithGenericText > 0 ? `${f.linksWithGenericText} generic (${f.genericTextList.slice(0, 3).map(t => '"' + t + '"').join(', ')})` : undefined },
      { label: 'External links have noopener', points: 5, earned: f.linksNewTab === f.linksNoOpener },
      { label: '5+ total links', points: 10, earned: f.totalLinks >= 5, detail: `${f.totalLinks} total` },
    ],
  };
}

function getContentBreakdown(f: ContentFindings): { description: string; items: BreakdownItem[] } {
  return {
    description: 'Content depth and structure for SEO',
    items: [
      { label: '300+ words', points: 25, earned: f.wordCount >= 300, detail: `${f.wordCount} words` },
      { label: '500+ words', points: 15, earned: f.wordCount >= 500, detail: f.wordCount < 500 ? `need ${500 - f.wordCount} more` : undefined },
      { label: '5+ paragraphs', points: 20, earned: f.paragraphCount >= 5, detail: `${f.paragraphCount} found` },
      { label: 'Has lists', points: 15, earned: f.hasLists, detail: f.hasLists ? `${f.listCount} list(s)` : undefined },
      { label: 'Comprehensive depth', points: 25, earned: f.contentDepth === 'comprehensive', detail: f.contentDepth },
    ],
  };
}
