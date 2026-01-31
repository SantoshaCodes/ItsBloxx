/**
 * POST /api/pages-create — Generate a new page from a template via buildPage pipeline, save to R2
 *
 * Body: { site: string, pageName: string, template: string, brandContext?: string, industry?: string }
 * Returns: { ok, pageName, score, etag, template }
 */

import { buildPage, TEMPLATES, type Env } from '../lib/build-page';

// ─── Industry defaults (tone, services, etc.) for industry-aware page generation ───
const INDUSTRY_DEFAULTS: Record<string, { tone: string; targetAudience: string; services: string[]; uniqueSellingPoints: string[]; primaryColor: string }> = {
  restaurant: { tone: 'friendly', targetAudience: 'Food lovers and families', services: ['Dine-In', 'Takeout', 'Catering', 'Private Events', 'Delivery'], uniqueSellingPoints: ['Fresh local ingredients', 'Award-winning chef', 'Cozy atmosphere'], primaryColor: '#b45309' },
  gym: { tone: 'friendly', targetAudience: 'Fitness enthusiasts of all levels', services: ['Weight Training', 'Cardio', 'Group Classes', 'Personal Training'], uniqueSellingPoints: ['24/7 access', 'State-of-the-art equipment', 'Expert trainers'], primaryColor: '#ef4444' },
  yoga: { tone: 'friendly', targetAudience: 'Health-conscious adults', services: ['Vinyasa Flow', 'Hatha Yoga', 'Yin Yoga', 'Hot Yoga', 'Meditation'], uniqueSellingPoints: ['First class free', 'Small class sizes', 'Certified instructors'], primaryColor: '#7c3aed' },
  lawfirm: { tone: 'professional', targetAudience: 'Business owners and professionals', services: ['Business Litigation', 'Real Estate Law', 'Estate Planning', 'Contract Review'], uniqueSellingPoints: ['Free consultation', 'Decades of experience'], primaryColor: '#1e3a5f' },
  accountant: { tone: 'professional', targetAudience: 'Small businesses and individuals', services: ['Tax Preparation', 'Bookkeeping', 'Financial Planning', 'Business Advisory'], uniqueSellingPoints: ['CPA certified', 'Year-round support'], primaryColor: '#16a34a' },
  realestate: { tone: 'professional', targetAudience: 'Home buyers, sellers, and investors', services: ['Buyer Representation', 'Seller Representation', 'Property Valuation'], uniqueSellingPoints: ['Local market expertise', 'Top-rated agent'], primaryColor: '#dc2626' },
  salon: { tone: 'friendly', targetAudience: 'Style-conscious individuals', services: ['Haircuts', 'Color', 'Styling', 'Treatments', 'Bridal'], uniqueSellingPoints: ['Award-winning stylists', 'Premium products'], primaryColor: '#db2777' },
  dentist: { tone: 'friendly', targetAudience: 'Families and individuals seeking dental care', services: ['General Dentistry', 'Cosmetic Dentistry', 'Orthodontics', 'Emergency Care'], uniqueSellingPoints: ['Same-day appointments', 'Modern technology'], primaryColor: '#0ea5e9' },
  saas: { tone: 'professional', targetAudience: 'Businesses and teams', services: ['Cloud Platform', 'API Access', 'Analytics Dashboard', 'Integrations'], uniqueSellingPoints: ['14-day free trial', '99.9% uptime'], primaryColor: '#6366f1' },
  agency: { tone: 'professional', targetAudience: 'Businesses seeking marketing services', services: ['Brand Strategy', 'Web Design', 'Digital Marketing', 'SEO'], uniqueSellingPoints: ['Data-driven approach', 'Award-winning team'], primaryColor: '#8b5cf6' },
  ecommerce: { tone: 'friendly', targetAudience: 'Online shoppers', services: ['Online Store', 'Free Shipping', 'Easy Returns'], uniqueSellingPoints: ['Free shipping over $50', '30-day returns'], primaryColor: '#059669' },
  coffeeshop: { tone: 'friendly', targetAudience: 'Coffee lovers and remote workers', services: ['Espresso Drinks', 'Pour Over', 'Pastries'], uniqueSellingPoints: ['Locally roasted beans', 'Free WiFi'], primaryColor: '#78350f' },
  photography: { tone: 'friendly', targetAudience: 'Couples, families, and businesses', services: ['Portraits', 'Weddings', 'Events', 'Product Photography'], uniqueSellingPoints: ['10+ years experience', 'Fast turnaround'], primaryColor: '#374151' },
  construction: { tone: 'professional', targetAudience: 'Homeowners and businesses', services: ['New Construction', 'Renovations', 'Commercial Build-Out'], uniqueSellingPoints: ['Licensed & bonded', '25+ years experience'], primaryColor: '#d97706' },
  plumber: { tone: 'professional', targetAudience: 'Homeowners and property managers', services: ['Emergency Repairs', 'Drain Cleaning', 'Water Heater Service'], uniqueSellingPoints: ['24/7 emergency service', 'Upfront pricing'], primaryColor: '#2563eb' },
  insurance: { tone: 'professional', targetAudience: 'Families and businesses', services: ['Auto Insurance', 'Home Insurance', 'Life Insurance', 'Business Insurance'], uniqueSellingPoints: ['Multiple carrier options', 'Free quotes'], primaryColor: '#0369a1' },
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context;

  if (!env.ANTHROPIC_API_KEY) {
    return Response.json({ ok: false, error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  let body: { site: string; pageName: string; template: string; brandContext?: string; industry?: string };
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { site, pageName, template: templateKey, brandContext, industry } = body;
  if (!site || !pageName || !templateKey) {
    return Response.json({ ok: false, error: 'Missing site, pageName, or template' }, { status: 400 });
  }

  const template = TEMPLATES[templateKey];
  if (!template) {
    return Response.json({ ok: false, error: `Unknown template: ${templateKey}` }, { status: 400 });
  }

  // Build effective brand context: merge industry defaults with user-provided context
  let effectiveBrandContext = brandContext || '';
  if (industry && INDUSTRY_DEFAULTS[industry]) {
    const ind = INDUSTRY_DEFAULTS[industry];
    const industryContext = [
      `Industry Tone: ${ind.tone}`,
      `Target Audience: ${ind.targetAudience}`,
      `Services: ${ind.services.join(', ')}`,
      `Unique Selling Points: ${ind.uniqueSellingPoints.join(', ')}`,
      `Primary Color: ${ind.primaryColor}`,
    ].join('\n');
    effectiveBrandContext = effectiveBrandContext
      ? `${industryContext}\n${effectiveBrandContext}`
      : industryContext;
  }

  // Check if page already exists
  const slug = pageName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const existingKey = `${site}/drafts/${slug}.html`;
  const existing = await env.BLOXX_SITES.head(existingKey);
  if (existing) {
    return Response.json({ ok: false, error: 'Page already exists' }, { status: 409 });
  }

  // Build page via shared pipeline
  const result = await buildPage(env, site, slug, templateKey, effectiveBrandContext);

  if (result.ok) {
    return Response.json({
      ok: true,
      pageName,
      etag: result.etag,
      score: result.score,
      template: templateKey,
    });
  }

  return Response.json({
    ok: false,
    error: result.error,
    score: result.score,
  }, { status: 422 });
};
