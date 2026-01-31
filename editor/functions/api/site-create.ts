/**
 * POST /api/site-create — Bulk site generation: create multiple pages from an industry template
 *
 * Body: { industry, businessName, brandContext?, pages: string[] }
 * Returns: { ok, site, pages: [{pageName, score}], errors: [{pageName, error}] }
 */

import { buildPage, TEMPLATES, PAGE_SLUGS, type Env } from '../lib/build-page';

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
    recommended: ['Homepage', 'About', 'Services', 'Pricing', 'Contact', 'Blog'],
    templateSite: 'gym',
    templatePages: ['index', 'about', 'services', 'contact', 'blog', 'pricing'],
    templateDefaultName: 'IronForge Fitness',
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
    recommended: ['Homepage', 'About', 'Services', 'Contact', 'FAQ', 'Blog'],
    templateSite: 'accountant',
    templatePages: ['index', 'about', 'services', 'contact', 'blog', 'faq'],
    templateDefaultName: 'Summit Financial Group',
    defaults: { tagline: 'Your financial success is our mission.', tone: 'professional', targetAudience: 'Small businesses and individuals needing tax and accounting services', services: ['Tax Preparation', 'Bookkeeping', 'Financial Planning', 'Business Advisory', 'Audit Support'], uniqueSellingPoints: ['CPA certified', 'Year-round support', 'IRS representation'], hours: 'Mon-Fri 9am-6pm', priceRange: '$$', primaryColor: '#16a34a' },
  },
  realestate: {
    label: 'Real Estate', icon: 'bi-house-door',
    recommended: ['Homepage', 'About', 'Services', 'Contact', 'Blog'],
    templateSite: 'realestate',
    templatePages: ['index', 'about', 'services', 'contact', 'blog'],
    templateDefaultName: 'Keystone Realty',
    defaults: { tagline: 'Finding your perfect place.', tone: 'professional', targetAudience: 'Home buyers, sellers, and investors', services: ['Buyer Representation', 'Seller Representation', 'Property Valuation', 'Investment Properties'], uniqueSellingPoints: ['Local market expertise', 'Personalized service', 'Top-rated agent'], hours: 'Mon-Sat 9am-7pm, Sun 12pm-5pm', priceRange: '$$$', primaryColor: '#dc2626' },
  },
  salon: {
    label: 'Salon / Spa', icon: 'bi-scissors',
    recommended: ['Homepage', 'About', 'Services', 'Pricing', 'Contact', 'Blog'],
    templateSite: 'salon',
    templatePages: ['index', 'about', 'services', 'contact', 'blog', 'pricing'],
    templateDefaultName: 'Luxe Beauty Studio',
    defaults: { tagline: 'Where style meets confidence.', tone: 'friendly', targetAudience: 'Style-conscious individuals of all ages', services: ['Haircuts', 'Color', 'Styling', 'Treatments', 'Bridal'], uniqueSellingPoints: ['Award-winning stylists', 'Premium products', 'Relaxing atmosphere'], hours: 'Tue-Sat 9am-7pm', priceRange: '$$', primaryColor: '#db2777' },
  },
  dentist: {
    label: 'Dentist', icon: 'bi-emoji-smile',
    recommended: ['Homepage', 'About', 'Services', 'Contact', 'FAQ', 'Blog'],
    templateSite: 'dentist',
    templatePages: ['index', 'about', 'services', 'contact', 'blog', 'faq'],
    templateDefaultName: 'Bright Smile Dental',
    defaults: { tagline: 'Your smile is our priority.', tone: 'friendly', targetAudience: 'Families and individuals seeking quality dental care', services: ['General Dentistry', 'Cosmetic Dentistry', 'Orthodontics', 'Emergency Care'], uniqueSellingPoints: ['Same-day appointments', 'Modern technology', 'Insurance accepted'], hours: 'Mon-Fri 8am-6pm, Sat 9am-2pm', priceRange: '$$', primaryColor: '#0ea5e9' },
  },
  saas: {
    label: 'SaaS / Tech', icon: 'bi-laptop',
    recommended: ['Homepage', 'About', 'Pricing', 'Contact', 'FAQ', 'Blog', 'BlogIndex'],
    templateSite: 'saas',
    templatePages: ['index', 'about', 'services', 'contact', 'blog', 'pricing', 'faq', 'blog-index'],
    templateDefaultName: 'CloudSync',
    defaults: { tagline: 'Software that works as hard as you do.', tone: 'professional', targetAudience: 'Businesses and teams seeking productivity tools', services: ['Cloud Platform', 'API Access', 'Analytics Dashboard', 'Team Collaboration', 'Integrations'], uniqueSellingPoints: ['14-day free trial', '99.9% uptime', 'SOC 2 compliant'], hours: 'Support: Mon-Fri 9am-6pm', priceRange: '$$', primaryColor: '#6366f1' },
  },
  agency: {
    label: 'Agency', icon: 'bi-palette',
    recommended: ['Homepage', 'About', 'Services', 'Pricing', 'Contact', 'Blog'],
    templateSite: 'agency',
    templatePages: ['index', 'about', 'services', 'contact', 'blog', 'pricing'],
    templateDefaultName: 'Spark Creative Agency',
    defaults: { tagline: 'Creative solutions that drive results.', tone: 'professional', targetAudience: 'Businesses seeking marketing and design services', services: ['Brand Strategy', 'Web Design', 'Digital Marketing', 'Content Creation', 'SEO'], uniqueSellingPoints: ['Data-driven approach', 'Award-winning team', 'Transparent pricing'], hours: 'Mon-Fri 9am-6pm', priceRange: '$$$', primaryColor: '#8b5cf6' },
  },
  ecommerce: {
    label: 'E-commerce', icon: 'bi-bag',
    recommended: ['Homepage', 'About', 'Services', 'Product', 'Contact', 'FAQ', 'Blog'],
    templateSite: 'ecommerce',
    templatePages: ['index', 'about', 'services', 'contact', 'blog', 'product', 'faq'],
    templateDefaultName: 'Ember & Oak',
    defaults: { tagline: 'Quality products, delivered to your door.', tone: 'friendly', targetAudience: 'Online shoppers seeking quality and convenience', services: ['Online Store', 'Free Shipping', 'Easy Returns', 'Gift Wrapping', 'Wholesale'], uniqueSellingPoints: ['Free shipping over $50', '30-day returns', 'Secure checkout'], hours: 'Online 24/7, Support: Mon-Fri 9am-6pm', priceRange: '$$', primaryColor: '#059669' },
  },
  coffeeshop: {
    label: 'Coffee Shop', icon: 'bi-cup',
    recommended: ['Homepage', 'About', 'Services', 'Contact', 'Blog'],
    templateSite: 'coffeeshop',
    templatePages: ['index', 'about', 'services', 'contact', 'blog'],
    templateDefaultName: 'The Daily Grind',
    defaults: { tagline: 'Where every cup tells a story.', tone: 'friendly', targetAudience: 'Coffee lovers, remote workers, and students', services: ['Espresso Drinks', 'Pour Over', 'Pastries', 'Light Breakfast', 'Catering'], uniqueSellingPoints: ['Locally roasted beans', 'Free WiFi', 'Cozy atmosphere'], hours: 'Mon-Fri 6am-7pm, Sat-Sun 7am-6pm', priceRange: '$', primaryColor: '#78350f' },
  },
  photography: {
    label: 'Photography', icon: 'bi-camera',
    recommended: ['Homepage', 'About', 'Services', 'Contact', 'Blog'],
    templateSite: 'photography',
    templatePages: ['index', 'about', 'services', 'contact', 'blog'],
    templateDefaultName: 'Frame & Focus',
    defaults: { tagline: 'Capturing moments that matter.', tone: 'friendly', targetAudience: 'Couples, families, and businesses seeking professional photography', services: ['Portraits', 'Weddings', 'Events', 'Product Photography', 'Headshots'], uniqueSellingPoints: ['10+ years experience', 'Fast turnaround', 'Online gallery delivery'], hours: 'By appointment', priceRange: '$$', primaryColor: '#374151' },
  },
  construction: {
    label: 'Construction', icon: 'bi-tools',
    recommended: ['Homepage', 'About', 'Services', 'Contact', 'Blog'],
    templateSite: 'construction',
    templatePages: ['index', 'about', 'services', 'contact', 'blog'],
    templateDefaultName: 'Summit Builders',
    defaults: { tagline: 'Building your vision, one project at a time.', tone: 'professional', targetAudience: 'Homeowners and businesses planning renovations or new builds', services: ['New Construction', 'Renovations', 'Commercial Build-Out', 'Project Management', 'Design-Build'], uniqueSellingPoints: ['Licensed & bonded', '25+ years experience', 'On-time guarantee'], hours: 'Mon-Fri 7am-5pm', priceRange: '$$$', primaryColor: '#d97706' },
  },
  plumber: {
    label: 'Plumber', icon: 'bi-wrench',
    recommended: ['Homepage', 'About', 'Services', 'Contact', 'FAQ', 'Blog'],
    templateSite: 'plumber',
    templatePages: ['index', 'about', 'services', 'contact', 'blog', 'faq'],
    templateDefaultName: 'FlowRight Plumbing',
    defaults: { tagline: 'Fast, reliable plumbing solutions.', tone: 'professional', targetAudience: 'Homeowners and property managers', services: ['Emergency Repairs', 'Drain Cleaning', 'Water Heater Service', 'Pipe Installation', 'Inspections'], uniqueSellingPoints: ['24/7 emergency service', 'Licensed & insured', 'Upfront pricing'], hours: 'Mon-Sat 7am-7pm, Emergency 24/7', priceRange: '$$', primaryColor: '#2563eb' },
  },
  insurance: {
    label: 'Insurance', icon: 'bi-shield-check',
    recommended: ['Homepage', 'About', 'Services', 'Contact', 'FAQ', 'Blog'],
    templateSite: 'insurance',
    templatePages: ['index', 'about', 'services', 'contact', 'blog', 'faq'],
    templateDefaultName: 'Shield Insurance Group',
    defaults: { tagline: 'Protection you can count on.', tone: 'professional', targetAudience: 'Families and businesses seeking comprehensive coverage', services: ['Auto Insurance', 'Home Insurance', 'Life Insurance', 'Business Insurance', 'Health Insurance'], uniqueSellingPoints: ['Multiple carrier options', 'Free quotes', 'Claims assistance'], hours: 'Mon-Fri 9am-6pm', priceRange: '$$', primaryColor: '#0369a1' },
  },
};

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 60);
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
      // ── Template path: fetch from Xano (primary) or static file (fallback) ──
      try {
        let html: string | null = null;
        let source = 'static';

        // Primary: fetch from Xano template_pages
        try {
          const xanoRes = await fetch(
            `${env.XANO_API_BASE}/template_pages?vertical=${encodeURIComponent(industry)}&page=${encodeURIComponent(slug)}`
          );
          if (xanoRes.ok) {
            const records = (await xanoRes.json()) as { html: string }[];
            if (records.length > 0) {
              html = records[0].html;
              source = 'xano';
            }
          }
        } catch { /* fall through to static */ }

        // Fallback: static file
        if (!html) {
          const staticRes = await fetch(`${templateBase}/${slug}.html`);
          if (!staticRes.ok) throw new Error(`Template fetch failed: ${staticRes.status}`);
          html = await staticRes.text();
        }

        console.log(`[template] ${industry}/${slug} source=${source}`);
        html = html.replaceAll(defaultName, businessName);
        await env.BLOXX_SITES.put(`${site}/drafts/${slug}.html`, html, {
          httpMetadata: { contentType: 'text/html' },
        });
        results.push({ pageName, score: 100 });
      } catch (err: any) {
        errors.push({ pageName, error: err.message });
      }
    } else {
      // ── AI generation path via shared buildPage pipeline ──
      const result = await buildPage(env, site, slug, pageName, fullBrandContext);
      if (result.ok) {
        results.push({ pageName, score: result.score || 0 });
      } else {
        errors.push({ pageName, error: result.error || 'Unknown error', score: result.score, judgeIssues: result.judgeIssues });
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
