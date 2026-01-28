/**
 * POST /api/save — Save edited page HTML to R2
 * Body: { site: string, page: string, html: string, etag?: string }
 * Returns: { ok: true, etag: string, enhanced: boolean } or { ok: false, error: string }
 *
 * On every save:
 * 1. Strip bridge artifacts from HTML
 * 2. Call Claude Haiku with tool_use to extract data + enhance HTML
 * 3. Use schema registry to generate deterministic JSON-LD
 * 4. Write enhanced HTML to R2 with etag conflict detection
 * 5. Return new etag + enhanced HTML for the client to update its preview
 */

import { stripBridge } from '../../lib/html-editor';
import { ENHANCEMENT_TOOLS, ENHANCEMENT_SYSTEM_PROMPT, type EnhancePageInput, processLazyLoading } from '../../lib/schema-tools';
import {
  getRecommendedSchema,
  buildPageSchemas,
  type SchemaBusinessContext
} from '../../lib/schema-registry';
import { parseHTML } from 'linkedom';

interface Env {
  BLOXX_SITES: R2Bucket;
  ANTHROPIC_API_KEY?: string;
  COLLAB_ROOM?: DurableObjectNamespace;
}

interface SaveBody {
  site: string;
  page: string;
  html: string;
  etag?: string;
}

interface EnhanceResult {
  html: string;
  enhanced: boolean;
  schemaType?: string;
  changes?: string[];
}

/**
 * Inject JSON-LD schemas into the <head> of an HTML document.
 * Removes any existing JSON-LD scripts first.
 */
function injectSchemasIntoHead(html: string, schemas: object[]): string {
  const { document } = parseHTML(html);

  // Remove existing JSON-LD scripts
  const existing = document.querySelectorAll('script[type="application/ld+json"]');
  for (const el of existing) el.remove();

  // Inject new schemas
  const head = document.querySelector('head');
  if (head && schemas.length > 0) {
    for (const schema of schemas) {
      const script = document.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.textContent = JSON.stringify(schema, null, 2);
      head.appendChild(script);
    }
  }

  return document.toString();
}

/**
 * Update page <title> element
 */
function updateTitle(html: string, title: string): string {
  const { document } = parseHTML(html);
  const titleEl = document.querySelector('title');
  if (titleEl) titleEl.textContent = title;
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', title);
  return document.toString();
}

/**
 * Update meta description
 */
function updateMetaDescription(html: string, desc: string): string {
  const { document } = parseHTML(html);
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute('content', desc);
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', desc);
  return document.toString();
}

/**
 * Combined flow: HTML enhancement + schema generation using tool_use
 */
async function enhanceWithTools(
  apiKey: string,
  html: string,
  siteUrl: string,
  pageName: string
): Promise<EnhanceResult> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 16384,
        system: ENHANCEMENT_SYSTEM_PROMPT,
        tools: ENHANCEMENT_TOOLS,
        tool_choice: { type: 'tool', name: 'enhance_page' },
        messages: [{
          role: 'user',
          content: `Enhance this HTML and extract business data for Schema.org:\n\n${html}`
        }]
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Claude API error:', err);
      return { html, enhanced: false };
    }

    const data: any = await response.json();

    // Find tool_use block
    const toolUse = data.content?.find((c: any) => c.type === 'tool_use');
    if (!toolUse || toolUse.name !== 'enhance_page') {
      return { html, enhanced: false };
    }

    const input = toolUse.input as EnhancePageInput;

    // Get enhanced HTML from Claude
    let finalHtml = input.enhancedHtml;

    // Basic sanity check
    if (!finalHtml || (!finalHtml.includes('<html') && !finalHtml.includes('<!DOCTYPE'))) {
      return { html, enhanced: false };
    }

    // Use registry to generate schema (deterministic, $0)
    const schemaType = input.schemaType || getRecommendedSchema(input.detectedType);

    const context: SchemaBusinessContext = {
      businessName: input.businessName,
      businessType: input.detectedType,
      description: input.description,
      phone: input.phone,
      email: input.email,
      address: input.address,
      priceRange: input.priceRange,
      hours: input.hours,
      services: input.services,
      siteUrl,
    };

    const pageUrl = pageName === 'index' ? siteUrl : `${siteUrl}/${pageName}`;
    const schemas = buildPageSchemas(context, pageName, pageUrl, `${pageName}.html`);

    // Inject registry-generated schemas into Claude's enhanced HTML
    finalHtml = injectSchemasIntoHead(finalHtml, schemas.all);

    // Optionally update meta if Claude suggested better SEO
    if (input.seoTitle) {
      finalHtml = updateTitle(finalHtml, input.seoTitle);
    }
    if (input.seoDescription) {
      finalHtml = updateMetaDescription(finalHtml, input.seoDescription);
    }

    return {
      html: finalHtml,
      enhanced: true,
      schemaType,
      changes: input.changes || []
    };
  } catch (err) {
    console.error('Enhancement error:', err);
    return { html, enhanced: false };
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  let body: SaveBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { site, page, html, etag } = body;
  if (!site || !page || !html) {
    return Response.json({ ok: false, error: 'Missing site, page, or html' }, { status: 400 });
  }

  const key = `${site}/drafts/${page}.html`;

  // Conflict detection
  if (etag) {
    const existing = await env.BLOXX_SITES.head(key);
    if (existing && existing.httpEtag !== etag) {
      return Response.json(
        { ok: false, error: 'conflict', serverEtag: existing.httpEtag },
        { status: 409 }
      );
    }
  }

  // Strip bridge artifacts
  let cleanHtml = stripBridge(html);

  // Auto-enhance with Claude tool_use (markup + extract data) + registry (schema generation)
  let enhanced = false;
  let schemaType: string | undefined;
  let changes: string[] = [];

  if (env.ANTHROPIC_API_KEY) {
    // Build site URL from request
    const url = new URL(request.url);
    const siteUrl = `https://${site}.bloxx.site`;

    const result = await enhanceWithTools(env.ANTHROPIC_API_KEY, cleanHtml, siteUrl, page);
    if (result.enhanced) {
      cleanHtml = result.html;
      enhanced = true;
      schemaType = result.schemaType;
      changes = result.changes || [];
    }
  }

  // Apply lazy loading to images (hero/first section excluded)
  cleanHtml = processLazyLoading(cleanHtml);

  // Write to R2
  const putResult = await env.BLOXX_SITES.put(key, cleanHtml, {
    httpMetadata: { contentType: 'text/html' },
  });

  // Broadcast to collaborators (best-effort)
  try {
    if (env.COLLAB_ROOM) {
      const roomId = env.COLLAB_ROOM.idFromName(`${site}/${page}`);
      const room = env.COLLAB_ROOM.get(roomId);
      await room.fetch(new Request('https://internal/broadcast', {
        method: 'POST',
        body: JSON.stringify({ type: 'bloxx:remote-save', site, page, etag: putResult.httpEtag }),
      }));
    }
  } catch {}

  return Response.json({
    ok: true,
    etag: putResult.httpEtag,
    enhanced,
    schemaType,
    changes,
    // Return enhanced HTML so client can update its preview
    ...(enhanced && { html: cleanHtml }),
  });
};
