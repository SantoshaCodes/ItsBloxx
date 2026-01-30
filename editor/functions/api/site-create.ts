/**
 * POST /api/site-create — Bulk site generation: create multiple pages from an industry template
 *
 * Body: { industry, businessName, brandContext?, pages: string[] }
 * Returns: { ok, site, pages: [{pageName, score}], errors: [{pageName, error}] }
 */

interface Env {
  BLOXX_SITES: R2Bucket;
  ANTHROPIC_API_KEY: string;
}

// ─── Industry Templates ───
const INDUSTRY_TEMPLATES: Record<string, {
  label: string;
  icon: string;
  recommended: string[];
  templateSite?: string;
  templatePages?: string[];
  templateDefaultName?: string;
  defaults: { tagline: string; tone: string; targetAudience: string; services: string[]; uniqueSellingPoints: string[]; hours: string; priceRange: string; primaryColor: string };
}> = {
  restaurant: {
    label: 'Restaurant', icon: 'bi-cup-hot',
    recommended: ['Homepage', 'About', 'Services', 'Contact', 'FAQ'],
    templateSite: 'restaurant',
    templatePages: ['index', 'about', 'contact', 'faq', 'menu', 'reservations', 'services'],
    templateDefaultName: 'The Golden Fork',
    defaults: { tagline: 'Where great food meets great company.', tone: 'friendly', targetAudience: 'Food lovers and families', services: ['Dine-In', 'Takeout', 'Catering', 'Private Events', 'Delivery'], uniqueSellingPoints: ['Fresh local ingredients', 'Award-winning chef', 'Cozy atmosphere'], hours: 'Tue-Sun 11am-10pm', priceRange: '$$', primaryColor: '#b45309' },
  },
  gym: {
    label: 'Gym / Fitness', icon: 'bi-heart-pulse',
    recommended: ['Homepage', 'About', 'Services', 'Pricing', 'Contact'],
    defaults: { tagline: 'Transform your body, transform your life.', tone: 'friendly', targetAudience: 'Fitness enthusiasts of all levels', services: ['Weight Training', 'Cardio', 'Group Classes', 'Personal Training', 'Nutrition Coaching'], uniqueSellingPoints: ['24/7 access', 'State-of-the-art equipment', 'Expert trainers'], hours: 'Open 24/7', priceRange: '$$', primaryColor: '#ef4444' },
  },
  yoga: {
    label: 'Yoga Studio', icon: 'bi-flower1',
    recommended: ['Homepage', 'About', 'Services', 'Pricing', 'Contact'],
    templateSite: 'yoga',
    templatePages: ['index', 'about', 'contact', 'services'],
    templateDefaultName: 'Serenity Yoga Studio',
    defaults: { tagline: 'Find your balance.', tone: 'friendly', targetAudience: 'Health-conscious adults looking for stress relief and fitness', services: ['Vinyasa Flow', 'Hatha Yoga', 'Yin Yoga', 'Hot Yoga', 'Meditation', 'Private Sessions'], uniqueSellingPoints: ['First class free', 'Small class sizes', 'Certified instructors'], hours: 'Mon-Fri 6am-9pm, Sat-Sun 8am-6pm', priceRange: '$$', primaryColor: '#7c3aed' },
  },
  lawfirm: {
    label: 'Law Firm', icon: 'bi-briefcase',
    recommended: ['Homepage', 'About', 'Services', 'Contact', 'FAQ'],
    templateSite: 'lawfirm',
    templatePages: ['index', 'about', 'contact', 'services'],
    templateDefaultName: 'Sterling & Associates',
    defaults: { tagline: 'Experienced advocates for your legal needs.', tone: 'professional', targetAudience: 'Business owners and professionals', services: ['Business Litigation', 'Real Estate Law', 'Estate Planning', 'Contract Review'], uniqueSellingPoints: ['Free consultation', 'Decades of experience', 'Personalized attention'], hours: 'Mon-Fri 9am-6pm', priceRange: '$$$', primaryColor: '#1e3a5f' },
  },
  accountant: {
    label: 'Accountant', icon: 'bi-calculator',
    recommended: ['Homepage', 'About', 'Services', 'Contact', 'FAQ'],
    defaults: { tagline: 'Your financial success is our mission.', tone: 'professional', targetAudience: 'Small businesses and individuals needing tax and accounting services', services: ['Tax Preparation', 'Bookkeeping', 'Financial Planning', 'Business Advisory', 'Audit Support'], uniqueSellingPoints: ['CPA certified', 'Year-round support', 'IRS representation'], hours: 'Mon-Fri 9am-6pm', priceRange: '$$', primaryColor: '#16a34a' },
  },
  realestate: {
    label: 'Real Estate', icon: 'bi-house-door',
    recommended: ['Homepage', 'About', 'Services', 'Contact'],
    defaults: { tagline: 'Finding your perfect place.', tone: 'professional', targetAudience: 'Home buyers, sellers, and investors', services: ['Buyer Representation', 'Seller Representation', 'Property Valuation', 'Investment Properties'], uniqueSellingPoints: ['Local market expertise', 'Personalized service', 'Top-rated agent'], hours: 'Mon-Sat 9am-7pm, Sun 12pm-5pm', priceRange: '$$$', primaryColor: '#dc2626' },
  },
  salon: {
    label: 'Salon / Spa', icon: 'bi-scissors',
    recommended: ['Homepage', 'About', 'Services', 'Pricing', 'Contact'],
    defaults: { tagline: 'Where style meets confidence.', tone: 'friendly', targetAudience: 'Style-conscious individuals of all ages', services: ['Haircuts', 'Color', 'Styling', 'Treatments', 'Bridal'], uniqueSellingPoints: ['Award-winning stylists', 'Premium products', 'Relaxing atmosphere'], hours: 'Tue-Sat 9am-7pm', priceRange: '$$', primaryColor: '#db2777' },
  },
  dentist: {
    label: 'Dentist', icon: 'bi-emoji-smile',
    recommended: ['Homepage', 'About', 'Services', 'Contact', 'FAQ'],
    defaults: { tagline: 'Your smile is our priority.', tone: 'friendly', targetAudience: 'Families and individuals seeking quality dental care', services: ['General Dentistry', 'Cosmetic Dentistry', 'Orthodontics', 'Emergency Care'], uniqueSellingPoints: ['Same-day appointments', 'Modern technology', 'Insurance accepted'], hours: 'Mon-Fri 8am-6pm, Sat 9am-2pm', priceRange: '$$', primaryColor: '#0ea5e9' },
  },
  saas: {
    label: 'SaaS / Tech', icon: 'bi-laptop',
    recommended: ['Homepage', 'About', 'Pricing', 'Contact', 'FAQ', 'BlogIndex'],
    defaults: { tagline: 'Software that works as hard as you do.', tone: 'professional', targetAudience: 'Businesses and teams seeking productivity tools', services: ['Cloud Platform', 'API Access', 'Analytics Dashboard', 'Team Collaboration', 'Integrations'], uniqueSellingPoints: ['14-day free trial', '99.9% uptime', 'SOC 2 compliant'], hours: 'Support: Mon-Fri 9am-6pm', priceRange: '$$', primaryColor: '#6366f1' },
  },
  agency: {
    label: 'Agency', icon: 'bi-palette',
    recommended: ['Homepage', 'About', 'Services', 'Pricing', 'Contact'],
    defaults: { tagline: 'Creative solutions that drive results.', tone: 'professional', targetAudience: 'Businesses seeking marketing and design services', services: ['Brand Strategy', 'Web Design', 'Digital Marketing', 'Content Creation', 'SEO'], uniqueSellingPoints: ['Data-driven approach', 'Award-winning team', 'Transparent pricing'], hours: 'Mon-Fri 9am-6pm', priceRange: '$$$', primaryColor: '#8b5cf6' },
  },
  ecommerce: {
    label: 'E-commerce', icon: 'bi-bag',
    recommended: ['Homepage', 'Product', 'Pricing', 'Contact', 'FAQ'],
    defaults: { tagline: 'Quality products, delivered to your door.', tone: 'friendly', targetAudience: 'Online shoppers seeking quality and convenience', services: ['Online Store', 'Free Shipping', 'Easy Returns', 'Gift Wrapping', 'Wholesale'], uniqueSellingPoints: ['Free shipping over $50', '30-day returns', 'Secure checkout'], hours: 'Online 24/7, Support: Mon-Fri 9am-6pm', priceRange: '$$', primaryColor: '#059669' },
  },
  coffeeshop: {
    label: 'Coffee Shop', icon: 'bi-cup',
    recommended: ['Homepage', 'About', 'Contact'],
    defaults: { tagline: 'Where every cup tells a story.', tone: 'friendly', targetAudience: 'Coffee lovers, remote workers, and students', services: ['Espresso Drinks', 'Pour Over', 'Pastries', 'Light Breakfast', 'Catering'], uniqueSellingPoints: ['Locally roasted beans', 'Free WiFi', 'Cozy atmosphere'], hours: 'Mon-Fri 6am-7pm, Sat-Sun 7am-6pm', priceRange: '$', primaryColor: '#78350f' },
  },
  photography: {
    label: 'Photography', icon: 'bi-camera',
    recommended: ['Homepage', 'About', 'Services', 'Contact'],
    defaults: { tagline: 'Capturing moments that matter.', tone: 'friendly', targetAudience: 'Couples, families, and businesses seeking professional photography', services: ['Portraits', 'Weddings', 'Events', 'Product Photography', 'Headshots'], uniqueSellingPoints: ['10+ years experience', 'Fast turnaround', 'Online gallery delivery'], hours: 'By appointment', priceRange: '$$', primaryColor: '#374151' },
  },
  construction: {
    label: 'Construction', icon: 'bi-tools',
    recommended: ['Homepage', 'About', 'Services', 'Contact'],
    defaults: { tagline: 'Building your vision, one project at a time.', tone: 'professional', targetAudience: 'Homeowners and businesses planning renovations or new builds', services: ['New Construction', 'Renovations', 'Commercial Build-Out', 'Project Management', 'Design-Build'], uniqueSellingPoints: ['Licensed & bonded', '25+ years experience', 'On-time guarantee'], hours: 'Mon-Fri 7am-5pm', priceRange: '$$$', primaryColor: '#d97706' },
  },
  plumber: {
    label: 'Plumber', icon: 'bi-wrench',
    recommended: ['Homepage', 'About', 'Services', 'Contact', 'FAQ'],
    defaults: { tagline: 'Fast, reliable plumbing solutions.', tone: 'professional', targetAudience: 'Homeowners and property managers', services: ['Emergency Repairs', 'Drain Cleaning', 'Water Heater Service', 'Pipe Installation', 'Inspections'], uniqueSellingPoints: ['24/7 emergency service', 'Licensed & insured', 'Upfront pricing'], hours: 'Mon-Sat 7am-7pm, Emergency 24/7', priceRange: '$$', primaryColor: '#2563eb' },
  },
  insurance: {
    label: 'Insurance', icon: 'bi-shield-check',
    recommended: ['Homepage', 'About', 'Services', 'Contact', 'FAQ'],
    defaults: { tagline: 'Protection you can count on.', tone: 'professional', targetAudience: 'Families and businesses seeking comprehensive coverage', services: ['Auto Insurance', 'Home Insurance', 'Life Insurance', 'Business Insurance', 'Health Insurance'], uniqueSellingPoints: ['Multiple carrier options', 'Free quotes', 'Claims assistance'], hours: 'Mon-Fri 9am-6pm', priceRange: '$$', primaryColor: '#0369a1' },
  },
};

// ─── Template definitions (same as pages-create.ts) ───
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

const PAGE_SLUGS: Record<string, string> = {
  Homepage: 'index', About: 'about', Services: 'services', Contact: 'contact',
  FAQ: 'faq', Pricing: 'pricing', BlogIndex: 'blog', BlogPost: 'blog-post',
  Product: 'product', LandingPage: 'landing', Privacy: 'privacy', Terms: 'terms',
};

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 60);
}

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

async function generatePage(env: Env, site: string, pageName: string, templateKey: string, brandContext: string): Promise<{ ok: boolean; score?: number; error?: string }> {
  const template = TEMPLATES[templateKey];
  if (!template) return { ok: false, error: `Unknown template: ${templateKey}` };

  const slug = PAGE_SLUGS[templateKey] || pageName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const key = `${site}/drafts/${slug}.html`;

  const MAX_RETRIES = 3;
  let lastScore = 0;
  let feedback: any = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const genText = await callClaude(env, 'claude-opus-4-5-20251101', 16384, [
        { role: 'user', content: buildGeneratePrompt(template, brandContext, feedback) },
      ]);
      const generated = extractJSON(genText);

      const judgeText = await callClaude(env, 'claude-sonnet-4-20250514', 1024, [
        { role: 'user', content: buildJudgePrompt(generated.html, generated.schema, generated.meta, template) },
      ]);
      const judgeResult = extractJSON(judgeText);
      lastScore = judgeResult.score;

      if (judgeResult.score >= 90) {
        await env.BLOXX_SITES.put(key, generated.html, {
          httpMetadata: { contentType: 'text/html' },
        });
        return { ok: true, score: judgeResult.score };
      }

      feedback = {
        score: judgeResult.score,
        issues: judgeResult.issues || [],
        suggestions: judgeResult.suggestions || [],
      };
    } catch (err: any) {
      if (attempt === MAX_RETRIES) {
        return { ok: false, error: err.message, score: lastScore };
      }
    }
  }

  return { ok: false, error: `Failed to reach score 90 after ${MAX_RETRIES + 1} attempts (best: ${lastScore})`, score: lastScore };
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context;

  if (!env.ANTHROPIC_API_KEY) {
    return Response.json({ ok: false, error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  let body: { industry: string; businessName: string; brandContext?: string; pages: string[] };
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { industry, businessName, brandContext, pages } = body;
  if (!industry || !businessName || !pages || !pages.length) {
    return Response.json({ ok: false, error: 'Missing industry, businessName, or pages' }, { status: 400 });
  }

  const industryConfig = INDUSTRY_TEMPLATES[industry];
  if (!industryConfig) {
    return Response.json({ ok: false, error: `Unknown industry: ${industry}` }, { status: 400 });
  }

  // Generate site ID from business name
  const site = slugify(businessName);
  if (!site) {
    return Response.json({ ok: false, error: 'Invalid business name' }, { status: 400 });
  }

  // Build brand context from industry defaults + user input
  const d = industryConfig.defaults;
  const fullBrandContext = [
    `Business Name: ${businessName}`,
    `Industry: ${industryConfig.label}`,
    `Tagline: ${d.tagline}`,
    `Tone: ${d.tone}`,
    `Target Audience: ${d.targetAudience}`,
    `Services: ${d.services.join(', ')}`,
    `Unique Selling Points: ${d.uniqueSellingPoints.join(', ')}`,
    `Hours: ${d.hours}`,
    `Price Range: ${d.priceRange}`,
    `Primary Color: ${d.primaryColor}`,
    brandContext ? `Additional Context: ${brandContext}` : '',
  ].filter(Boolean).join('\n');

  const results: { pageName: string; score: number }[] = [];
  const errors: { pageName: string; error: string }[] = [];

  // ─── Resolve each page: use pre-built template when available, AI-generate otherwise ───
  const templateBase = industryConfig.templateSite
    ? `https://${new URL(context.request.url).host}/templates/${industryConfig.templateSite}`
    : null;
  const defaultName = industryConfig.templateDefaultName || '';

  for (const pageName of pages) {
    const slug = PAGE_SLUGS[pageName] || pageName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const hasTemplate = templateBase && industryConfig.templatePages?.includes(slug);

    if (hasTemplate) {
      // ── Template path: fetch pre-built HTML, replace business name, put to R2 ──
      try {
        const tplRes = await fetch(`${templateBase}/${slug}.html`);
        if (!tplRes.ok) throw new Error(`Template fetch failed: ${tplRes.status}`);
        let html = await tplRes.text();
        html = html.replaceAll(defaultName, businessName);
        await env.BLOXX_SITES.put(`${site}/drafts/${slug}.html`, html, {
          httpMetadata: { contentType: 'text/html' },
        });
        results.push({ pageName, score: 100 });
      } catch (err: any) {
        errors.push({ pageName, error: err.message });
      }
    } else {
      // ── AI generation path ──
      const result = await generatePage(env, site, pageName, pageName, fullBrandContext);
      if (result.ok) {
        results.push({ pageName, score: result.score || 0 });
      } else {
        errors.push({ pageName, error: result.error || 'Unknown error' });
      }
    }
  }

  return Response.json({
    ok: true,
    site,
    pages: results,
    errors,
  });
};
