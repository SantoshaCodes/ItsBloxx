import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({});
const MODEL_ID = 'gemini-3-pro-preview';

export interface EnrichedComponent {
  html: string;
  styles: Record<string, Record<string, string>>;
  schema: { '@context': string; '@type': string; [key: string]: any };
  data: Record<string, any>;
}

export interface Variant {
  name: string;
  description: string;
  html: string;
  styles: Record<string, Record<string, string>>;
  use_case: string;
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

const variantSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    description: { type: Type.STRING },
    html: { type: Type.STRING },
    styles: { type: Type.STRING, description: 'CSS styles as JSON string' },
    use_case: { type: Type.STRING }
  },
  required: ['name', 'description', 'html', 'styles', 'use_case']
};

export async function enrichComponent(
  type: string,
  currentHtml: string,
  requiredFields: Record<string, string>,
  useCases: string[]
): Promise<EnrichedComponent> {
  const fields = Object.keys(requiredFields).join(', ');

  const response = await ai.models.generateContent({
    model: MODEL_ID,
    contents: `Generate a production-ready ${type} component.

HTML REQUIREMENTS (MANDATORY):
- 400-600 characters
- Use semantic elements: <section>, <article>, <header>, <nav>, or <footer> as the wrapper
- Include heading: <h1>, <h2>, or <h3> with id attribute
- MUST have ARIA: aria-labelledby pointing to heading id, or aria-label on container
- Use {{camelCase}} variables for: ${fields}

STYLES REQUIREMENTS (MANDATORY):
- JSON string format: {"selector": {"property": "value"}}
- 10-15 CSS rules minimum
- MUST include responsive breakpoint: "@media (min-width: 768px)": {...}
- Include hover/focus states where appropriate

SCHEMA REQUIREMENTS:
- @context: "https://schema.org"
- @type: appropriate type for ${type}

DATA: JSON string with example values for: ${fields}

Use case: ${useCases[0] || 'General purpose'}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: componentSchema,
      temperature: 0.2,
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

export async function generateVariant(
  type: string,
  variantName: string,
  baseFields: Record<string, string>
): Promise<Variant> {
  const fields = Object.keys(baseFields).join(', ');

  const response = await ai.models.generateContent({
    model: MODEL_ID,
    contents: `Generate a ${variantName} variant of ${type}.

- name: ${type}_${variantName}
- html:
  - Use semantic wrapper (<section>, <article>) with class="${type.toLowerCase()} ${type.toLowerCase()}--${variantName.toLowerCase()}"
  - Include heading with id attribute
  - MUST have aria-labelledby pointing to heading id
  - Variables: ${fields}
- styles: JSON string with 8-12 rules, MUST include "@media (min-width: 768px)" breakpoint
- use_case: When to use this variant`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: variantSchema,
      temperature: 0.3,
    }
  });

  const parsed = JSON.parse(response.text!);
  return {
    name: parsed.name,
    description: parsed.description,
    html: parsed.html,
    styles: typeof parsed.styles === 'string' ? JSON.parse(parsed.styles) : parsed.styles,
    use_case: parsed.use_case
  };
}
