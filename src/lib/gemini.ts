import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({});
const GENERATOR_MODEL = 'gemini-3-pro-preview';
const JUDGE_MODEL = 'gemini-3-flash-preview';

// Schema.org type mapping for each component type
const schemaTypeMap: Record<string, string> = {
  // Page components
  Hero: 'WebPage',
  HomePage: 'WebPage',
  LandingPage: 'WebPage',

  // Content components
  Article: 'Article',
  BlogPost: 'BlogPosting',
  FAQPage: 'FAQPage',
  HowTo: 'HowTo',

  // Commerce
  Product: 'Product',
  PricingCard: 'Offer',
  PricingGrid: 'ItemList',
  ProductCollection: 'ItemList',

  // Social proof
  Testimonial: 'Review',
  TestimonialCarousel: 'Review',
  ReviewList: 'Review',
  StatsGrid: 'WebPageElement',

  // Navigation
  Footer: 'WPFooter',
  Header: 'WPHeader',
  Navbar: 'SiteNavigationElement',
  BreadcrumbList: 'BreadcrumbList',

  // Events
  Event: 'Event',

  // Local/Contact
  Location: 'LocalBusiness',
  Form: 'ContactPage',

  // Features/CTA
  FeaturesGrid: 'ItemList',
  CTA: 'WebPageElement',
  LogoCloud: 'Organization',

  // People
  Person: 'Person',
  TeamGrid: 'ItemList',

  // Media
  Video: 'VideoObject',

  // Lists
  ItemList: 'ItemList',
  Service: 'Service',
  Organization: 'Organization',
};

export interface ComponentMeta {
  title: string;
  description: string;
  keywords: string[];
}

export interface EnrichedComponent {
  html: string;
  styles: Record<string, Record<string, string>>;
  schema: { '@context': string; '@type': string; [key: string]: any };
  data: Record<string, any>;
  meta: ComponentMeta;
}

export interface JudgeResult {
  score: number;
  passed: boolean;
  issues: string[];
  suggestions: string[];
}

const componentSchema = {
  type: Type.OBJECT,
  properties: {
    html: { type: Type.STRING, description: 'Semantic HTML with {{variable}} placeholders' },
    styles: { type: Type.STRING, description: 'CSS styles as JSON string' },
    schema: {
      type: Type.OBJECT,
      properties: {
        '@context': { type: Type.STRING },
        '@type': { type: Type.STRING },
        name: { type: Type.STRING },
        description: { type: Type.STRING }
      },
      required: ['@context', '@type']
    },
    data: { type: Type.STRING, description: 'Example data as JSON string' },
    meta: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'SEO title, 50-60 characters' },
        description: { type: Type.STRING, description: 'Meta description, 150-160 characters' },
        keywords: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: '5-8 relevant keywords'
        }
      },
      required: ['title', 'description', 'keywords']
    }
  },
  required: ['html', 'styles', 'schema', 'data', 'meta']
};

const judgeSchema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.NUMBER, description: 'Overall quality score 0-100' },
    passed: { type: Type.BOOLEAN, description: 'True if score >= 90' },
    issues: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'List of problems found'
    },
    suggestions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Improvements for next attempt'
    }
  },
  required: ['score', 'passed', 'issues', 'suggestions']
};

export async function enrichComponent(
  type: string,
  name: string,
  category: string
): Promise<EnrichedComponent> {
  const schemaType = schemaTypeMap[type] || 'WebPageElement';

  const prompt = `You are a senior frontend developer at a top digital agency. Generate a production-ready, agency-quality ${type} component.

COMPONENT: ${type}
NAME: ${name || type + ' Component'}
CATEGORY: ${category || 'atomic'}
SCHEMA.ORG TYPE: ${schemaType}

=== HTML REQUIREMENTS (Critical for SEO & LLM Readability) ===
- 500-1000 characters of semantic HTML
- Use proper semantic wrapper: <section>, <article>, <aside>, <nav>, or <footer>
- Include aria-labelledby pointing to a heading with unique id
- Proper heading hierarchy (h1 for heroes, h2 for sections, h3 for cards)
- Use {{camelCase}} template variables for ALL dynamic content
- Include microdata attributes: itemscope, itemtype="https://schema.org/${schemaType}", itemprop
- Add descriptive class names following BEM methodology (.component__element--modifier)
- Include sr-only text for accessibility where needed

=== CSS REQUIREMENTS (Professional Quality) ===
Return as JSON string: {"selector": {"property": "value"}}
- 15-25 CSS rules minimum
- Mobile-first responsive design
- MUST include "@media (min-width: 768px)" breakpoint
- MUST include "@media (min-width: 1024px)" breakpoint
- Include :hover and :focus states for ALL interactive elements
- Use CSS custom properties (--color-primary, --spacing-lg, etc.)
- Smooth transitions (0.2s-0.3s ease)
- Professional spacing, typography, and visual hierarchy
- Box shadows, border-radius for modern look

=== SCHEMA.ORG REQUIREMENTS (Critical for LLM Readability) ===
- @context: "https://schema.org"
- @type: "${schemaType}"
- Include name and description properties
- Add nested types where appropriate
- Include potentialAction for interactive components

=== META REQUIREMENTS (Page-Level SEO) ===
Generate meta object with:
- title: 50-60 characters, include primary keyword, compelling
- description: 150-160 characters, include call-to-action
- keywords: array of 5-8 relevant terms

=== DATA (Example Values) ===
Return as JSON string with realistic, professional example content
- Use compelling marketing copy that sells
- Include specific numbers/stats where relevant
- NO placeholder text like "Lorem ipsum"

Generate content that would score 95+ on SEO audits and be immediately usable in a professional website.`;

  const response = await ai.models.generateContent({
    model: GENERATOR_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: componentSchema,
      temperature: 0.4,
    }
  });

  const parsed = JSON.parse(response.text!);
  return {
    html: parsed.html,
    styles: typeof parsed.styles === 'string' ? JSON.parse(parsed.styles) : parsed.styles,
    schema: parsed.schema,
    data: typeof parsed.data === 'string' ? JSON.parse(parsed.data) : parsed.data,
    meta: parsed.meta
  };
}

export async function judgeComponent(
  component: EnrichedComponent,
  componentType: string
): Promise<JudgeResult> {
  const expectedSchemaType = schemaTypeMap[componentType] || 'WebPageElement';

  const prompt = `You are a senior frontend code reviewer and SEO expert. Evaluate this ${componentType} component for production readiness.

COMPONENT TYPE: ${componentType}
EXPECTED SCHEMA TYPE: ${expectedSchemaType}

=== HTML ===
${component.html}

=== STYLES (CSS) ===
${JSON.stringify(component.styles, null, 2)}

=== SCHEMA.ORG ===
${JSON.stringify(component.schema, null, 2)}

=== DATA ===
${JSON.stringify(component.data, null, 2)}

=== META ===
${JSON.stringify(component.meta, null, 2)}

=== EVALUATION CRITERIA ===

**HTML Quality (25 points)**
- Semantic wrapper element (section/article/aside/nav/footer)
- aria-labelledby with matching heading id
- Proper heading hierarchy
- BEM class naming
- itemscope/itemtype/itemprop microdata
- {{camelCase}} template variables

**CSS Quality (25 points)**
- 15+ CSS rules
- @media (min-width: 768px) breakpoint
- @media (min-width: 1024px) breakpoint
- :hover and :focus states
- CSS custom properties used
- Transitions on interactive elements
- Professional visual design

**Schema.org Quality (25 points)**
- Correct @type (should be ${expectedSchemaType})
- @context is https://schema.org
- name property present
- description property present
- Appropriate nested types

**Meta/SEO Quality (25 points)**
- title is 50-60 characters
- description is 150-160 characters
- 5-8 keywords
- Compelling, keyword-rich copy in data

Score each section 0-25, total 0-100. Pass threshold is 90.
Be strict but fair. Deduct points for each missing requirement.`;

  const response = await ai.models.generateContent({
    model: JUDGE_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: judgeSchema,
      temperature: 0.1,
    }
  });

  const result = JSON.parse(response.text!);
  return {
    score: result.score,
    passed: result.score >= 90,
    issues: result.issues || [],
    suggestions: result.suggestions || []
  };
}
