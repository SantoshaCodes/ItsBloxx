/**
 * POST /api/pages-create — Generate a new page from a template via Opus+judge pipeline, save to R2
 *
 * Body: { site: string, pageName: string, template: string, brandContext?: string }
 * Returns: { ok, pageName, enhanced, score }
 */

interface Env {
  BLOXX_SITES: R2Bucket;
  ANTHROPIC_API_KEY: string;
  XANO_API_BASE: string;
}

// ─── Template definitions (inlined subset from src/lib/template-definitions.ts) ───
const TEMPLATES: Record<string, { name: string; schemaType: string; description: string; sections: string[]; seoTitleFormat: string; guidelines: string[] }> = {
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

function extractJSON(text: string): any {
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

async function callClaude(env: Env, model: string, maxTokens: number, messages: { role: string; content: string }[]): Promise<string> {
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

function buildGeneratePrompt(template: typeof TEMPLATES[string], brandContext: string, feedback?: any): string {
  const feedbackSection = feedback
    ? `\n=== PREVIOUS ATTEMPT FEEDBACK (FIX THESE) ===\nScore: ${feedback.score}/100\nISSUES:\n${feedback.issues.map((i: string, n: number) => `${n + 1}. ${i}`).join('\n')}\nSUGGESTIONS:\n${feedback.suggestions.map((s: string, n: number) => `${n + 1}. ${s}`).join('\n')}\n`
    : '';

  return `You are a senior frontend developer. Generate a complete, production-ready ${template.name} page using Bootstrap 5.3+.
${feedbackSection}
${brandContext ? `\n=== BRAND CONTEXT ===\n${brandContext}\n` : ''}

=== PAGE TEMPLATE: ${template.name} ===
Schema.org Type: ${template.schemaType}
Description: ${template.description}
Required Sections: ${template.sections.join(', ')}
SEO Title Format: ${template.seoTitleFormat}

Content Guidelines:
${template.guidelines.map((g, i) => `${i + 1}. ${g}`).join('\n')}

=== BOOTSTRAP 5.3+ STRICT REQUIREMENTS ===
1. ZERO CUSTOM CSS CLASSES — ONLY Bootstrap utility classes (no BEM, no custom naming)
2. ZERO INLINE STYLES — all styling via Bootstrap utilities
3. Use Bootstrap grid: container, row, col-*
4. Responsive breakpoints: col-sm-*, col-md-*, col-lg-*
5. Use "visually-hidden" for screen reader text (NOT "sr-only")
6. Semantic HTML: <main>, <section>, <article>, <header>, <nav>, <footer>
7. aria-labelledby on sections pointing to heading ids
8. Schema.org microdata: itemscope, itemtype, itemprop
9. Unsplash images with descriptive alt text, loading="lazy"/"eager"
10. Include complete <!DOCTYPE html> document with <head> and <body>

=== ANTI-LLM CONTENT ===
- NO emojis, NO generic AI phrases, NO excessive exclamation marks
- USE specific numbers, names, dates
- USE conversational, human-sounding copy
- USE {{templateVariables}} for dynamic content

=== OUTPUT FORMAT ===
Return ONLY valid JSON:
{
  "html": "<!DOCTYPE html><html>...<main>...</main>...</html>",
  "schema": {"@context": "https://schema.org", "@type": "${template.schemaType}", ...},
  "meta": {"title": "...", "description": "...", "keywords": [...]},
  "sections": [${template.sections.map(s => `"${s}"`).join(', ')}]
}`;
}

function buildJudgePrompt(html: string, schema: any, meta: any, template: typeof TEMPLATES[string]): string {
  return `You are a senior code reviewer. Evaluate this ${template.name} page for production readiness.

PAGE TYPE: ${template.name}
EXPECTED SCHEMA TYPE: ${template.schemaType}
REQUIRED SECTIONS: ${template.sections.join(', ')}

HTML (first 12000 chars):
${html.substring(0, 12000)}

Schema: ${JSON.stringify(schema, null, 2)}
Meta: ${JSON.stringify(meta, null, 2)}

=== SCORING (100 points) ===
Bootstrap 5.3 Compliance (30pts): Only Bootstrap utilities, no custom/BEM classes, no inline styles, responsive
Schema/Meta Quality (25pts): Correct @type, @context, name, description, meta title/description lengths
Accessibility (20pts): Semantic HTML, aria-labelledby, heading hierarchy, visually-hidden
Anti-LLM Content (15pts): No emojis, no generic phrases, human-sounding copy
Page Structure (10pts): All required sections present, proper document structure

AUTOMATIC FAILURES (cap at 50): custom CSS classes, inline styles, missing @context/@type, no aria-labelledby, missing required sections

Pass threshold: 90/100

Return ONLY valid JSON:
{"score": 85, "passed": false, "issues": ["issue 1"], "suggestions": ["suggestion 1"]}`;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context;

  if (!env.ANTHROPIC_API_KEY) {
    return Response.json({ ok: false, error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  let body: { site: string; pageName: string; template: string; brandContext?: string };
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { site, pageName, template: templateKey, brandContext } = body;
  if (!site || !pageName || !templateKey) {
    return Response.json({ ok: false, error: 'Missing site, pageName, or template' }, { status: 400 });
  }

  const template = TEMPLATES[templateKey];
  if (!template) {
    return Response.json({ ok: false, error: `Unknown template: ${templateKey}` }, { status: 400 });
  }

  // Check if page already exists
  const existingKey = `${site}/drafts/${pageName}.html`;
  const existing = await env.BLOXX_SITES.head(existingKey);
  if (existing) {
    return Response.json({ ok: false, error: 'Page already exists' }, { status: 409 });
  }

  const MAX_RETRIES = 3;
  let lastScore = 0;
  let feedback: any = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Step 1: Generate with Opus
      const genText = await callClaude(env, 'claude-opus-4-5-20251101', 16384, [
        { role: 'user', content: buildGeneratePrompt(template, brandContext || '', feedback) },
      ]);
      const generated = extractJSON(genText);

      // Step 2: Judge with Sonnet
      const judgeText = await callClaude(env, 'claude-sonnet-4-20250514', 1024, [
        { role: 'user', content: buildJudgePrompt(generated.html, generated.schema, generated.meta, template) },
      ]);
      const judgeResult = extractJSON(judgeText);
      lastScore = judgeResult.score;

      if (judgeResult.score >= 90) {
        // Save to R2
        const putResult = await env.BLOXX_SITES.put(existingKey, generated.html, {
          httpMetadata: { contentType: 'text/html' },
        });

        return Response.json({
          ok: true,
          pageName,
          etag: putResult.httpEtag,
          score: judgeResult.score,
          template: templateKey,
        });
      }

      feedback = {
        score: judgeResult.score,
        issues: judgeResult.issues || [],
        suggestions: judgeResult.suggestions || [],
      };
    } catch (err: any) {
      if (attempt === MAX_RETRIES) {
        return Response.json({ ok: false, error: err.message, score: lastScore }, { status: 500 });
      }
    }
  }

  return Response.json({
    ok: false,
    error: `Failed to reach score 90 after ${MAX_RETRIES + 1} attempts (best: ${lastScore})`,
    score: lastScore,
  }, { status: 422 });
};
