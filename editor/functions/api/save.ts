/**
 * POST /api/save — Save edited page HTML to R2
 * Body: { site: string, page: string, html: string, etag?: string }
 * Returns: { ok: true, etag: string, enhanced: boolean } or { ok: false, error: string }
 *
 * On every save:
 * 1. Strip bridge artifacts from HTML
 * 2. Call Claude to auto-clean Bootstrap markup + regenerate Schema.org JSON-LD
 * 3. Write enhanced HTML to R2 with etag conflict detection
 * 4. Return new etag + enhanced HTML for the client to update its preview
 */

import { stripBridge } from '../../lib/html-editor';

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

const ENHANCE_PROMPT = `You are a web standards expert. You receive an HTML page and must return an IMPROVED version.

Do ALL of these on every save — output ONLY the full HTML document, no markdown fences:

1. SCHEMA.ORG — Rebuild <script type="application/ld+json"> blocks in <head>:
   • Always include a primary schema matching page content (WebPage, AboutPage, FAQPage, Product, BlogPosting, etc.)
   • Add BreadcrumbList if navigation exists
   • Add FAQPage if accordion/FAQ sections exist
   • Add Organization schema if company info is present
   • Each schema must have @context, @type, and relevant properties
   • Populate from actual page content (title, description, headings, images)

2. SEO META — Ensure these exist and are populated from content:
   • <title> (50-60 chars)
   • <meta name="description"> (150-160 chars)
   • <meta property="og:title">, og:description, og:type, og:image
   • <meta name="twitter:card">, twitter:title, twitter:description
   • <link rel="canonical">

3. SEMANTIC HTML — Fix any issues:
   • Heading hierarchy: h1 → h2 → h3 (never skip)
   • Sections should have aria-label or aria-labelledby
   • Images must have alt text
   • Use <main>, <header>, <footer>, <nav>, <section>, <article> correctly

4. BOOTSTRAP CLEANUP — Fix common issues:
   • Ensure responsive classes exist (col-md-*, col-lg-*)
   • Fix invalid class combinations
   • Ensure proper container > row > col nesting

5. ACCESSIBILITY:
   • Add missing aria-label on nav, sections
   • Ensure form inputs have labels
   • Ensure buttons have accessible names
   • Add role attributes where needed

CRITICAL: Preserve ALL content, layout, and visual appearance. Only improve markup quality.
Do NOT change text content, image URLs, colors, or layout structure.
Output the COMPLETE <!DOCTYPE html> document.`;

async function enhanceWithClaude(apiKey: string, html: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16384,
        messages: [{
          role: 'user',
          content: `${ENHANCE_PROMPT}\n\nHTML to enhance:\n\n${html}`,
        }],
      }),
    });

    if (!res.ok) return null;

    const data: any = await res.json();
    const text = data.content?.[0]?.text || '';

    // Strip any markdown fences Claude might add despite instructions
    const cleaned = text
      .replace(/^```html?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();

    // Basic sanity check: must contain <!DOCTYPE or <html
    if (cleaned.includes('<html') || cleaned.includes('<!DOCTYPE')) {
      return cleaned;
    }
    return null;
  } catch {
    return null;
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

  // Auto-enhance with Claude (markup + schema)
  let enhanced = false;
  if (env.ANTHROPIC_API_KEY) {
    const result = await enhanceWithClaude(env.ANTHROPIC_API_KEY, cleanHtml);
    if (result) {
      cleanHtml = result;
      enhanced = true;
    }
  }

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
    // Return enhanced HTML so client can update its preview
    ...(enhanced && { html: cleanHtml }),
  });
};
