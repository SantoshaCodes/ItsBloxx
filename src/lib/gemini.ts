import Anthropic from '@anthropic-ai/sdk';
import { getBootstrapReference, BOOTSTRAP_REFERENCE } from './bootstrap-reference';
import { getTemplateByName, PageTemplate } from './template-definitions';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const GENERATOR_MODEL = 'claude-opus-4-5-20251101';
const JUDGE_MODEL = 'claude-sonnet-4-20250514';
const TEMPLATE_GENERATOR_MAX_TOKENS = 16384;

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
  FAQ: 'FAQPage',
  HowTo: 'HowTo',

  // Commerce
  Product: 'Product',
  PricingCard: 'Offer',
  PricingGrid: 'ItemList',
  Pricing: 'ItemList',
  ProductCollection: 'ItemList',

  // Social proof
  Testimonial: 'Review',
  TestimonialCarousel: 'Review',
  Testimonials: 'Review',
  ReviewList: 'Review',
  StatsGrid: 'WebPageElement',
  Stats: 'WebPageElement',

  // Navigation
  Footer: 'WPFooter',
  Header: 'WPHeader',
  Navbar: 'SiteNavigationElement',
  Navigation: 'SiteNavigationElement',
  BreadcrumbList: 'BreadcrumbList',

  // Events
  Event: 'Event',

  // Local/Contact
  Location: 'LocalBusiness',
  Contact: 'ContactPage',
  Form: 'ContactPage',

  // Features/CTA
  FeaturesGrid: 'ItemList',
  Features: 'ItemList',
  CTA: 'WebPageElement',
  CallToAction: 'WebPageElement',
  LogoCloud: 'Organization',

  // People
  Person: 'Person',
  TeamGrid: 'ItemList',
  Team: 'ItemList',

  // Media
  Video: 'VideoObject',
  Gallery: 'ImageGallery',

  // Lists
  ItemList: 'ItemList',
  Service: 'Service',
  Services: 'ItemList',
  Organization: 'Organization',

  // UI Components
  Card: 'WebPageElement',
  ProfileCard: 'Person',
  Timeline: 'ItemList',
  ComparisonTable: 'ItemList',
  Newsletter: 'ContactPage',
  Pagination: 'WebPageElement',
  EmptyState: 'WebPageElement',
  Alert: 'WebPageElement',
  Modal: 'WebPageElement',
  Toast: 'WebPageElement',
  Tabs: 'WebPageElement',
  Accordion: 'WebPageElement',
  LoadingSkeleton: 'WebPageElement',

  // Form Components
  FormContainer: 'WebPageElement',
  FormSection: 'WebPageElement',
  FormActions: 'WebPageElement',
  MultiStepForm: 'WebPageElement',
  InputText: 'WebPageElement',
  InputEmail: 'WebPageElement',
  InputPassword: 'WebPageElement',
  InputNumber: 'WebPageElement',
  InputDate: 'WebPageElement',
  InputDateRange: 'WebPageElement',
  Textarea: 'WebPageElement',
  SelectDropdown: 'WebPageElement',
  MultiSelect: 'WebPageElement',
  CheckboxGroup: 'WebPageElement',
  RadioGroup: 'WebPageElement',
  ToggleSwitch: 'WebPageElement',
  Slider: 'WebPageElement',
  FileUpload: 'WebPageElement',
  ImageUpload: 'WebPageElement',
  TagInput: 'WebPageElement',
  SearchInput: 'WebPageElement',

  // Authentication Components
  LoginForm: 'WebPageElement',
  SignupForm: 'WebPageElement',
  ForgotPassword: 'WebPageElement',
  ResetPassword: 'WebPageElement',
  OAuthButtons: 'WebPageElement',
  AuthModal: 'WebPageElement',

  // Dashboard/Settings Components
  SettingsPanel: 'WebPageElement',
  ProfileForm: 'Person',
  AvatarUpload: 'WebPageElement',
  DataTable: 'ItemList',
  ActivityFeed: 'ItemList',

  // Player Two Wanted Specific
  SquadCard: 'Person',
  ProfileHeader: 'Person',
  CompatibilityScore: 'Rating',
  GamingPreferences: 'ItemList',
  MatchCTA: 'WebPageElement',
};

export interface ComponentMeta {
  title: string;
  description: string;
  keywords: string[];
}

export interface EnrichedComponent {
  html: string;
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

// Extract JSON from response that might have extra text or markdown
function extractJSON(text: string): any {
  // Strip markdown code blocks if present
  let cleaned = text
    .replace(/^```json\s*/gim, '')
    .replace(/^```\s*/gim, '')
    .replace(/\s*```\s*$/gim, '')
    .trim();

  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch {
    // Find first { and last } to extract JSON object
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      let jsonStr = cleaned.slice(start, end + 1);

      // Try parsing as-is first
      try {
        return JSON.parse(jsonStr);
      } catch {
        // Fix common JSON issues
        jsonStr = jsonStr
          // Remove trailing commas before } or ]
          .replace(/,(\s*[}\]])/g, '$1')
          // Fix unescaped newlines in strings (common issue)
          .replace(/:\s*"([^"]*)\n([^"]*)"/g, (match, p1, p2) => {
            return `: "${p1}\\n${p2}"`;
          });

        try {
          return JSON.parse(jsonStr);
        } catch (e: any) {
          throw new Error(`JSON parse failed: ${e.message}. Raw length: ${text.length}`);
        }
      }
    }
    throw new Error(`Could not find JSON in response. Raw: ${text.slice(0, 200)}...`);
  }
}

export interface PreviousFeedback {
  score: number;
  issues: string[];
  suggestions: string[];
}

export async function enrichComponent(
  type: string,
  name: string,
  category: string,
  previousFeedback?: PreviousFeedback
): Promise<EnrichedComponent> {
  const schemaType = schemaTypeMap[type] || 'WebPageElement';

  // Build feedback section if this is a retry
  const feedbackSection = previousFeedback ? `
=== PREVIOUS ATTEMPT FEEDBACK (CRITICAL - FIX THESE ISSUES) ===
Your previous attempt scored ${previousFeedback.score}/100. You MUST fix these issues:

ISSUES TO FIX:
${previousFeedback.issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

SUGGESTIONS:
${previousFeedback.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

DO NOT repeat these mistakes. Address each issue explicitly.
` : '';

  // Form component context - detect by name patterns since Xano types are limited
  const formKeywords = ['input', 'email', 'password', 'textarea', 'select', 'checkbox', 'radio', 'toggle', 'slider',
    'upload', 'form', 'login', 'signup', 'forgot', 'reset', 'oauth', 'profile'];
  const nameLower = name.toLowerCase();
  const isFormComponent = formKeywords.some(kw => nameLower.includes(kw));

  const formComponentContext = isFormComponent ? `
=== FORM COMPONENT REQUIREMENTS ===
This is a FORM component. Follow these additional requirements:

BOOTSTRAP 5 FORM CLASSES:
- Use form-control for inputs, textareas, selects
- Use form-label for labels (always include labels for accessibility)
- Use form-text for help text below inputs
- Use form-check, form-check-input, form-check-label for checkboxes/radios
- Use form-select for dropdowns
- Use form-floating for floating labels (optional)
- Use input-group for input addons (icons, buttons)
- Use is-valid, is-invalid for validation states
- Use invalid-feedback, valid-feedback for validation messages
- Use form-control-lg or form-control-sm for sizing

DATA ATTRIBUTES FOR INTERACTIVITY:
Include data attributes that a JS layer can interpret:
- data-validate="true" on form elements that need validation
- data-rules="required|email|min:3|max:100" for validation rules
- data-error="Custom error message" for custom validation messages
- data-submit="ajax" for AJAX form submission
- data-success="redirect:/path" or "toast:Success message" for success handling
- data-loading="Submitting..." for loading state text

TEMPLATE VARIABLES FOR FORM DATA:
- {{fieldName}} for input values/defaults
- {{fieldLabel}} for labels
- {{fieldPlaceholder}} for placeholder text
- {{fieldError}} for error message display
- {{fieldHelp}} for help text
- {{options}} for select/radio/checkbox options (in data object as array)

ACCESSIBILITY FOR FORMS:
- Always pair inputs with <label for="id">
- Use aria-describedby for help text and errors
- Use aria-invalid="true" for invalid state
- Use aria-required="true" for required fields
- Include autocomplete attributes where appropriate
- Ensure proper focus order

VALIDATION STATES:
Include both valid and invalid state styling in the component HTML structure.
The JS layer will toggle is-valid/is-invalid classes based on validation.

EXAMPLE STRUCTURE for an input:
<div class="mb-3">
  <label for="{{fieldId}}" class="form-label">{{fieldLabel}}</label>
  <input type="text" class="form-control" id="{{fieldId}}" name="{{fieldName}}"
         value="{{fieldValue}}" placeholder="{{fieldPlaceholder}}"
         data-rules="{{validationRules}}" data-error="{{errorMessage}}"
         aria-describedby="{{fieldId}}-help" autocomplete="{{autocomplete}}">
  <div id="{{fieldId}}-help" class="form-text">{{fieldHelp}}</div>
  <div class="invalid-feedback">{{fieldError}}</div>
</div>
` : '';

  // Player Two Wanted brand context for P2W components
  const isP2W = name.startsWith('P2W');
  const p2wBrandContext = isP2W ? `
=== PLAYER TWO WANTED BRAND CONTEXT ===
This is for "Player Two Wanted" - a satirical dating site for gamers who want to team up with fellow gamers to find dates together.

BRAND IDENTITY:
- Tagline: "Because even your K/D ratio is better than your dating ratio."
- Tone: Self-deprecating, ironic, dry humor. Not cringe, not childish.
- Target: Single gamer men who've accepted reality and figured a co-op approach might work better.

COLOR PALETTE (use these Bootstrap overrides):
- Primary: Deep purple (#6366f1) - use bg-primary, text-primary
- Background: Near-black (#0f172a) - use bg-dark
- Text: Light gray (#e2e8f0) - use text-light, text-white-50
- Accent: Electric cyan (#22d3ee) - use for highlights sparingly

CONTENT STYLE:
- Use specific numbers: "12,847 squads" not "thousands"
- Use real-sounding names: "Marcus, 28, Diamond 2"
- Use self-aware humor: "we're as surprised as you"
- Use gaming vernacular: K/D, ranked, squad, solo queue
- NO emojis, NO exclamation marks, NO generic phrases

IMAGERY:
- Gaming setups, battlestations, dark rooms with RGB lighting
- Candid shots of people gaming
- Dark, moody aesthetic
` : '';

  // Get Bootstrap 5 reference with component-specific patterns
  const bootstrapRef = getBootstrapReference(type, name);

  const prompt = `You are a senior frontend developer. Generate a production-ready ${type} component using Bootstrap 5.
${feedbackSection}
${p2wBrandContext}
${formComponentContext}

COMPONENT: ${type}
NAME: ${name || type + ' Component'}
CATEGORY: ${category || 'atomic'}
SCHEMA.ORG TYPE: ${schemaType}

${bootstrapRef}

=== BOOTSTRAP 5.3+ STRICT REQUIREMENTS (CRITICAL) ===

**ABSOLUTE RULES - VIOLATIONS WILL FAIL:**

1. ZERO CUSTOM CSS CLASSES
   - NO BEM classes (hero__container, features-grid__item, footer__link)
   - NO custom class names of any kind
   - ONLY Bootstrap utility classes are allowed
   - If you write a class that doesn't exist in Bootstrap 5.3, you FAIL

2. ZERO INLINE STYLES
   - NO style="" attributes anywhere in the HTML
   - Every visual property must use a Bootstrap utility class
   - For theming, use CSS variables via bloxx-theme.css (loaded separately)

3. USE THESE BOOTSTRAP UTILITIES:
   Grid: container, container-fluid, row, col, col-sm-*, col-md-*, col-lg-*, col-xl-*, g-*
   Spacing: p-0 to p-5, m-0 to m-5, py-*, px-*, my-*, mx-*, gap-*
   Typography: fs-1 to fs-6, fw-light/normal/medium/semibold/bold, text-start/center/end, lh-1/sm/base/lg
   Colors: bg-primary/secondary/success/danger/warning/info/light/dark/body/white/transparent
   Text: text-primary/secondary/success/danger/warning/info/light/dark/muted/white/body
   Display: d-none/inline/block/flex/grid, d-sm-*/d-md-*/d-lg-* (responsive)
   Flexbox: flex-row/column, justify-content-start/center/end/between/around/evenly
   Align: align-items-start/center/end/baseline/stretch, align-self-*
   Sizing: w-25/50/75/100/auto, h-25/50/75/100/auto, mw-100, mh-100, min-vh-100
   Position: position-relative/absolute/fixed/sticky, top-0/50/100, start-0/50/100, translate-middle
   Borders: border, border-0 to border-5, border-primary/secondary/etc, rounded, rounded-0 to rounded-5, rounded-circle, rounded-pill
   Shadows: shadow-none, shadow-sm, shadow, shadow-lg
   Cards: card, card-body, card-header, card-footer, card-title, card-subtitle, card-text, card-img-top
   Buttons: btn, btn-primary/secondary/success/etc, btn-outline-*, btn-sm/lg, btn-link
   Lists: list-group, list-group-item, list-unstyled, list-inline
   Badges: badge, bg-primary/secondary/etc, rounded-pill
   Forms: form-control, form-label, form-text, form-select, form-check, form-check-input
   Opacity: opacity-0/25/50/75/100
   Overflow: overflow-auto/hidden/visible/scroll

4. THEME COLORS (use Bootstrap's color system):
   - Primary actions: bg-primary, btn-primary, text-primary
   - Dark sections: bg-dark, text-white, text-white-50
   - Light sections: bg-light, bg-body, text-dark
   - Muted text: text-muted, text-body-secondary, text-body-tertiary
   - Borders: border-secondary, border-light, border-dark

5. ACCESSIBILITY (Bootstrap 5.3):
   - Use "visually-hidden" NOT "sr-only" (sr-only is Bootstrap 4)
   - Use aria-labelledby on sections pointing to heading id
   - All images need alt text
   - Form inputs need associated labels

=== ANTI-LLM CONTENT REQUIREMENTS (Critical) ===
DO NOT generate content that looks AI-generated:
- NO emojis anywhere in the HTML
- NO generic phrases like "Welcome to our platform" or "We're here to help"
- NO overly enthusiastic language or exclamation marks
- NO rainbow/gradient color schemes that scream "AI made this"
- NO generic stock photo descriptions - be specific
- USE specific numbers, names, and details that feel real
- USE dry humor, sarcasm, or wit appropriate to the brand
- USE realistic, conversational copy that sounds human-written
- PREFER muted, sophisticated color palettes (dark modes, earth tones, etc.)

=== IMAGE REQUIREMENTS ===
- All images must use Unsplash URLs with specific, relevant queries
- Format: https://images.unsplash.com/photo-{ID}?w={width}&h={height}&fit=crop
- Include descriptive alt text that aids SEO
- Use loading="lazy" for below-fold images
- Use loading="eager" for hero/above-fold images
- Specify width and height attributes for CLS optimization

=== HTML/ACCESSIBILITY REQUIREMENTS ===
- Semantic wrapper: <section>, <article>, <aside>, <nav>, <header>, <footer>
- Include aria-labelledby pointing to heading with unique id
- Proper heading hierarchy (h1 for page title, h2 for sections, h3 for cards)
- Use {{camelCase}} template variables for dynamic content
- Include microdata: itemscope, itemtype="https://schema.org/${schemaType}", itemprop
- Add visually-hidden text where needed: <span class="visually-hidden">text</span>
- Focus states are handled by Bootstrap automatically

=== SCHEMA.ORG REQUIREMENTS ===
- @context: "https://schema.org"
- @type: "${schemaType}"
- Include name, description, and relevant properties
- Add nested types (Person, Rating, Organization, etc.)
- Include potentialAction for interactive elements

=== META REQUIREMENTS ===
- title: 50-60 chars, keyword-rich, compelling
- description: 150-160 chars, includes CTA
- keywords: 5-8 relevant terms

=== OUTPUT FORMAT ===
Return ONLY valid JSON:
{
  "html": "<section class=\\"py-5 bg-dark\\">...Bootstrap classes inline...</section>",
  "schema": {"@context": "https://schema.org", "@type": "${schemaType}", ...},
  "data": {"variableName": "realistic example value"},
  "meta": {"title": "...", "description": "...", "keywords": [...]}
}

NO emojis. NO generic AI copy. Make it feel human-crafted.`;

  const response = await anthropic.messages.create({
    model: GENERATOR_MODEL,
    max_tokens: 16384,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = extractJSON(text);
  return {
    html: parsed.html,
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

  const prompt = `You are a senior code reviewer and UX expert. Evaluate this ${componentType} component for production readiness.

COMPONENT TYPE: ${componentType}
EXPECTED SCHEMA TYPE: ${expectedSchemaType}

=== CURRENT SUBMISSION ===

HTML:
${component.html}

Schema:
${JSON.stringify(component.schema, null, 2)}

Data:
${JSON.stringify(component.data, null, 2)}

Meta:
${JSON.stringify(component.meta, null, 2)}

=== EVALUATION CRITERIA ===

**Bootstrap 5.3+ Strict Compliance (35 points)** [CRITICAL - Most Important]
- ONLY Bootstrap utility classes allowed (d-flex, p-4, text-primary, bg-light, etc.)
- Responsive grid with col-sm/md/lg/xl breakpoints
- Proper spacing scale (p-1 through p-5, m-1 through m-5, gap-*)
- Cards, buttons, forms, typography use Bootstrap patterns
- Uses CSS custom properties (--bloxx-* or --bs-*) for theming
- DEDUCT 15 POINTS for ANY custom/BEM class (hero__container, features-grid__item, etc.)
- DEDUCT 15 POINTS for ANY inline style="" attribute
- DEDUCT 5 points per missing responsive breakpoint

**Anti-LLM Content Quality (20 points)**
- NO emojis present (instant -10 if found)
- NO generic AI phrases ("Welcome to", "We're passionate about", etc.)
- Copy feels human-written, specific, and on-brand
- Realistic data with specific numbers and names
- Color scheme is sophisticated, not "AI rainbow"
- DEDUCT 5 points per generic/AI-sounding phrase

**HTML/Accessibility Quality (25 points)**
- Semantic wrapper element (section, article, nav, aside)
- aria-labelledby with matching heading id
- Proper heading hierarchy (h1 > h2 > h3)
- Schema.org microdata attributes (itemscope, itemtype, itemprop)
- {{camelCase}} template variables for dynamic content
- "visually-hidden" class for screen reader text (NOT "sr-only" which is Bootstrap 4)
- DEDUCT 10 POINTS for using "sr-only" instead of "visually-hidden"

**Schema/Meta Quality (20 points)**
- Correct @type for component (should be ${expectedSchemaType})
- @context is https://schema.org
- name and description present
- Nested types where appropriate
- Meta title 50-60 chars
- Meta description 150-160 chars
- 5-8 keywords

=== SCORING GUIDANCE ===

Target progression:
- Attempt 1: 70-80 (learning the requirements)
- Attempt 2: 80-88 (fixing major issues)
- Attempt 3: 88-94 (polish and refinement)
- Attempt 4: 95-100 (production ready)

Pass threshold: 90/100

=== AUTOMATIC FAILURES (Score capped at 50 max) ===
- ANY custom CSS class (BEM naming like hero__title, card__content) = CAP AT 50
- ANY inline style="" attribute = CAP AT 50
- Schema @context missing or not "https://schema.org" = CAP AT 50
- Schema @type missing = CAP AT 50
- No aria-labelledby on main section = CAP AT 50
- Missing meta title or description = CAP AT 50

=== BOOTSTRAP 5.3+ CLASS VALIDATION ===
VALID classes start with: d-, p-, m-, gap-, text-, bg-, border-, rounded-, shadow-, fs-, fw-, lh-,
w-, h-, position-, top-, bottom-, start-, end-, z-, opacity-, overflow-, col-, row, container,
g-, gy-, gx-, flex-, align-, justify-, order-, card, btn, form-, input-, nav-, list-, table-,
badge, alert, modal, dropdown, accordion, carousel, visually-hidden, ratio, vstack, hstack

INVALID (auto-fail): Any class with __, --, or custom naming like hero-section, features-grid, footer-link

Return ONLY valid JSON:
{"score": 85, "passed": false, "issues": ["specific issue 1", "specific issue 2"], "suggestions": ["actionable suggestion 1", "actionable suggestion 2"], "sectionScores": {"bootstrap": 22, "antiLlm": 18, "accessibility": 23, "schemaMeta": 22}}`;

  const response = await anthropic.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const result = extractJSON(text);
  return {
    score: result.score,
    passed: result.score >= 90,
    issues: result.issues || [],
    suggestions: result.suggestions || []
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE TEMPLATE GENERATION
// ═══════════════════════════════════════════════════════════════════════════

export interface GeneratedTemplate {
  html: string;
  schema: { '@context': string; '@type': string; [key: string]: any };
  meta: {
    title: string;
    description: string;
    keywords: string[];
  };
  data: Record<string, any>;
  sections: string[];
}

export async function generateTemplate(
  templateType: string,
  brandContext?: string,
  previousFeedback?: PreviousFeedback
): Promise<GeneratedTemplate> {
  const template = getTemplateByName(templateType);

  if (!template) {
    throw new Error(`Unknown template type: ${templateType}`);
  }

  // Build feedback section if this is a retry
  const feedbackSection = previousFeedback ? `
=== PREVIOUS ATTEMPT FEEDBACK (CRITICAL - FIX THESE ISSUES) ===
Your previous attempt scored ${previousFeedback.score}/100. You MUST fix these issues:

ISSUES TO FIX:
${previousFeedback.issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

SUGGESTIONS:
${previousFeedback.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

DO NOT repeat these mistakes. Address each issue explicitly.
` : '';

  // Build brand context section
  const brandSection = brandContext ? `
=== BRAND CONTEXT ===
${brandContext}
` : '';

  // Build required sections list
  const requiredSectionsList = template.sections.required
    .sort((a, b) => a.order - b.order)
    .map(s => `- ${s.componentType}: ${s.description}`)
    .join('\n');

  // Build optional sections list
  const optionalSectionsList = template.sections.optional
    .sort((a, b) => a.order - b.order)
    .map(s => `- ${s.componentType}: ${s.description}`)
    .join('\n');

  // Build content guidelines
  const contentGuidelinesList = template.contentGuidelines
    .map((g, i) => `${i + 1}. ${g}`)
    .join('\n');

  const prompt = `You are a senior frontend developer. Generate a complete, production-ready ${template.type} page using Bootstrap 5.3+.
${feedbackSection}
${brandSection}

=== PAGE TEMPLATE: ${template.name} ===
Type: ${template.type}
Schema.org Type: ${template.schemaType}
Description: ${template.description}

=== REQUIRED SECTIONS (must include all) ===
${requiredSectionsList}

=== OPTIONAL SECTIONS (include 2-3 as appropriate) ===
${optionalSectionsList}

=== LAYOUT CONSTRAINTS ===
- Max sections: ${template.layoutConstraints.maxSections}
- Recommended section count: ${template.layoutConstraints.recommendedSectionCount}
- Hero required: ${template.layoutConstraints.heroRequired}
- Footer required: ${template.layoutConstraints.footerRequired}
- Navbar required: ${template.layoutConstraints.navbarRequired}

=== SEO REQUIREMENTS ===
- Title format: ${template.seoRequirements.titleFormat}
- Title length: ${template.seoRequirements.titleMinLength}-${template.seoRequirements.titleMaxLength} chars
- Description length: ${template.seoRequirements.descriptionMinLength}-${template.seoRequirements.descriptionMaxLength} chars
- Keywords: ${template.seoRequirements.recommendedKeywordCount} terms
- Required meta tags: ${template.seoRequirements.requiredMetaTags.join(', ')}

=== CONTENT GUIDELINES ===
${contentGuidelinesList}

${BOOTSTRAP_REFERENCE}

=== CRITICAL PAGE STRUCTURE REQUIREMENTS ===

1. HTML STRUCTURE:
   - Wrap everything in a <main> element
   - Use semantic section elements (<section>, <article>, <header>, <nav>, <footer>)
   - Each <section> must have aria-labelledby pointing to its heading's id
   - Use exactly ONE <h1> for the page title
   - Use h2 for section headings, h3 for subsections
   - Never skip heading levels (h1 → h2 → h3, NOT h1 → h3)

2. BOOTSTRAP 5.3+ STRICT COMPLIANCE:
   - ZERO custom CSS classes (no BEM, no custom naming)
   - ZERO inline styles (all styling via Bootstrap utilities)
   - Use Bootstrap grid: container, row, col-*
   - Use responsive breakpoints: col-sm-*, col-md-*, col-lg-*
   - Use Bootstrap spacing: p-*, m-*, gap-*
   - Use "visually-hidden" for screen reader text (NOT "sr-only")

3. SCHEMA.ORG REQUIREMENTS:
   - @context: "https://schema.org"
   - @type: "${template.schemaType}"
   - Include name, description, and relevant properties
   - Add microdata to HTML: itemscope, itemtype, itemprop

4. ANTI-LLM CONTENT:
   - NO emojis anywhere
   - NO generic AI phrases ("Welcome to", "We're passionate about")
   - NO excessive exclamation marks
   - USE specific numbers, names, dates
   - USE conversational, human-sounding copy
   - USE {{templateVariables}} for dynamic content

5. IMAGES:
   - Use Unsplash URLs: https://images.unsplash.com/photo-{ID}?w={width}&h={height}&fit=crop
   - Include descriptive alt text
   - Use loading="lazy" for below-fold images
   - Use loading="eager" for hero images
   - Include width/height attributes

=== OUTPUT FORMAT ===
Return ONLY valid JSON:
{
  "html": "<!DOCTYPE html>...<main>...</main>...",
  "schema": {"@context": "https://schema.org", "@type": "${template.schemaType}", "name": "...", "description": "...", ...},
  "meta": {"title": "...", "description": "...", "keywords": ["...", "...", "..."]},
  "data": {"variableName": "example value", ...},
  "sections": ["Navbar", "Hero", "Features", "CTA", "Footer"]
}

Generate a complete, professional ${template.type} page. NO emojis. NO generic AI copy. Make it feel human-crafted.`;

  const response = await anthropic.messages.create({
    model: GENERATOR_MODEL,
    max_tokens: TEMPLATE_GENERATOR_MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = extractJSON(text);

  return {
    html: parsed.html,
    schema: parsed.schema,
    meta: parsed.meta,
    data: typeof parsed.data === 'string' ? JSON.parse(parsed.data) : parsed.data,
    sections: parsed.sections || [],
  };
}
