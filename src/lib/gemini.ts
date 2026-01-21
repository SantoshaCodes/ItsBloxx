import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({});
const MODEL_ID = 'gemini-3-pro-preview';

export interface EnrichedComponent {
  html: string;
  styles: Record<string, Record<string, string>>;
  schema: { '@context': string; '@type': string; [key: string]: any };
  data: Record<string, any>;
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
        name: { type: Type.STRING }
      },
      required: ['@context', '@type']
    },
    data: { type: Type.STRING, description: 'Example data as JSON string' }
  },
  required: ['html', 'styles', 'schema', 'data']
};

export async function enrichComponent(
  type: string,
  name: string,
  category: string,
  existingHtml?: string
): Promise<EnrichedComponent> {

  const prompt = `You are a senior frontend developer at a top digital agency. Generate a production-ready, agency-quality ${type} component.

COMPONENT: ${type}
NAME: ${name || type + ' Component'}
CATEGORY: ${category || 'atomic'}

=== HTML REQUIREMENTS (Critical for SEO & LLM Readability) ===
- 500-800 characters of semantic HTML
- Use proper semantic wrapper: <section>, <article>, <aside>, <nav>, or <footer>
- Include aria-labelledby pointing to a heading with unique id
- Proper heading hierarchy (h1 for heroes, h2 for sections, h3 for cards)
- Use {{camelCase}} template variables for dynamic content
- Include microdata attributes where appropriate (itemscope, itemtype, itemprop)
- Add descriptive class names following BEM methodology (.component__element--modifier)
- Include sr-only text for accessibility where needed

=== CSS REQUIREMENTS (Professional Quality) ===
Return as JSON string: {"selector": {"property": "value"}}
- 12-20 CSS rules minimum
- Mobile-first responsive design
- MUST include "@media (min-width: 768px)" breakpoint
- MUST include "@media (min-width: 1024px)" breakpoint for larger screens
- Include :hover and :focus states for interactive elements
- Use CSS custom properties pattern (reference --color-primary, --spacing-lg, etc.)
- Smooth transitions (0.2s-0.3s ease)
- Professional spacing, typography, and visual hierarchy
- Box shadows, border-radius for modern look

=== SCHEMA.ORG REQUIREMENTS (Critical for LLM Readability) ===
- @context: "https://schema.org"
- @type: Most appropriate schema type for ${type}
- Include all relevant properties (name, description, etc.)
- Add nested types where appropriate (e.g., author for Article)
- Include potentialAction where relevant

=== DATA (Example Values) ===
Return as JSON string with realistic, professional example content
- Use compelling marketing copy
- Include realistic placeholder text (not "Lorem ipsum")

Generate content that would score 95+ on SEO audits and be immediately usable in a professional website.`;

  const response = await ai.models.generateContent({
    model: MODEL_ID,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: componentSchema,
      temperature: 0.3,
    }
  });

  const parsed = JSON.parse(response.text!);
  return {
    html: parsed.html,
    styles: typeof parsed.styles === 'string' ? JSON.parse(parsed.styles) : parsed.styles,
    schema: parsed.schema,
    data: typeof parsed.data === 'string' ? JSON.parse(parsed.data) : parsed.data
  };
}
