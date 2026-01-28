/**
 * POST /api/schema-update — Live schema updates via Claude Haiku tool-use + registry
 *
 * Body: { sectionHtml, currentSchemas, componentType, businessContext? }
 * Returns: { ok, schemas: [...], schemaType }
 *
 * Uses Claude Haiku to extract business data from section HTML,
 * then uses the deterministic schema registry to generate JSON-LD.
 */

import {
  getRecommendedSchema,
  buildSchemaFromContext,
  type SchemaBusinessContext
} from '../../lib/schema-registry';

interface Env {
  ANTHROPIC_API_KEY: string;
}

interface SchemaUpdateRequest {
  sectionHtml: string;
  currentSchemas: any[];
  componentType?: string;
  pageUrl?: string;
  businessContext?: Partial<SchemaBusinessContext>;
}

interface ExtractedData {
  businessType: string;
  businessName: string;
  description: string;
  phone?: string;
  email?: string;
  address?: string;
  priceRange?: string;
  hours?: string;
  services?: string[];
  faqs?: { question: string; answer: string }[];
}

const EXTRACTION_TOOLS = [
  {
    name: 'extract_business_data',
    description: 'Extract business information from HTML content for Schema.org markup.',
    input_schema: {
      type: 'object' as const,
      properties: {
        businessType: {
          type: 'string' as const,
          description: 'Detected business type (e.g., "restaurant", "law firm", "yoga studio", "saas")'
        },
        businessName: {
          type: 'string' as const,
          description: 'Business or organization name'
        },
        description: {
          type: 'string' as const,
          description: 'Business description (150-160 chars for SEO)'
        },
        phone: { type: 'string' as const, description: 'Phone number if found' },
        email: { type: 'string' as const, description: 'Email if found' },
        address: { type: 'string' as const, description: 'Full address if found' },
        priceRange: {
          type: 'string' as const,
          enum: ['$', '$$', '$$$', '$$$$'],
          description: 'Price range indicator'
        },
        hours: { type: 'string' as const, description: 'Business hours' },
        services: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Services or products offered'
        },
        faqs: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              question: { type: 'string' as const },
              answer: { type: 'string' as const }
            },
            required: ['question', 'answer']
          },
          description: 'FAQ items from accordion/details elements'
        }
      },
      required: ['businessType', 'businessName', 'description']
    }
  }
];

const SYSTEM_PROMPT = `You are a Schema.org data extraction expert. Given HTML content, extract business information that can be used to generate structured data.

RULES:
1. Extract the business name from h1, logo text, or meta tags
2. Detect the business type from context (restaurant, law firm, yoga studio, etc.)
3. Write a concise description (150-160 chars) suitable for SEO
4. Extract contact info: phone, email, address if present
5. Extract services/products mentioned
6. Extract FAQ items from accordion or details elements
7. Only include data that is actually present in the HTML`;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context;

  if (!env.ANTHROPIC_API_KEY) {
    return Response.json({ ok: false, error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  let body: SchemaUpdateRequest;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { sectionHtml, currentSchemas, componentType, pageUrl, businessContext } = body;

  if (!sectionHtml) {
    return Response.json({ ok: false, error: 'Missing sectionHtml' }, { status: 400 });
  }

  try {
    // Call Claude to extract business data
    const userMessage = `Extract business data from this HTML section (${componentType || 'unknown'} component):\n\n${sectionHtml.substring(0, 6000)}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools: EXTRACTION_TOOLS,
        tool_choice: { type: 'tool', name: 'extract_business_data' },
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Claude API error ${res.status}: ${err}`);
    }

    const data: any = await res.json();

    // Find tool_use block
    const toolUse = data.content?.find((b: any) => b.type === 'tool_use');
    if (!toolUse || toolUse.name !== 'extract_business_data') {
      // No extraction — return current schemas unchanged
      return Response.json({ ok: true, schemas: currentSchemas || [] });
    }

    const extracted = toolUse.input as ExtractedData;

    // Merge with any provided business context
    const mergedContext: SchemaBusinessContext = {
      businessName: extracted.businessName || businessContext?.businessName || 'Business',
      businessType: extracted.businessType || businessContext?.businessType || 'local business',
      description: extracted.description || businessContext?.description || '',
      phone: extracted.phone || businessContext?.phone,
      email: extracted.email || businessContext?.email,
      address: extracted.address || businessContext?.address,
      priceRange: extracted.priceRange || businessContext?.priceRange,
      hours: extracted.hours || businessContext?.hours,
      services: extracted.services || businessContext?.services,
      siteUrl: pageUrl,
    };

    // Use registry to get recommended schema type
    const schemaType = getRecommendedSchema(mergedContext.businessType);

    // Build schema using registry (deterministic, $0)
    const primarySchema = buildSchemaFromContext(schemaType, mergedContext, pageUrl || '');

    // Build FAQ schema if FAQs were extracted
    const schemas: object[] = [primarySchema];

    if (extracted.faqs && extracted.faqs.length > 0) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: extracted.faqs.map(faq => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer
          }
        }))
      });
    }

    return Response.json({
      ok: true,
      schemas,
      schemaType,
      extractedData: extracted
    });
  } catch (err: any) {
    return Response.json({ ok: false, error: err.message || 'Schema update failed' }, { status: 500 });
  }
};
