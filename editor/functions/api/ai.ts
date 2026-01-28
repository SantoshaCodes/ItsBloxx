/**
 * POST /api/ai — Claude-powered editing endpoint
 *
 * Actions:
 *   { action: "edit-section",   site, page, sectionIndex, prompt }
 *     → Rewrites a section's HTML based on the user's prompt
 *
 *   { action: "generate-section", site, page, prompt }
 *     → Generates a new section to insert
 *
 *   { action: "improve-seo",   site, page, html }
 *     → Analyzes and improves SEO: meta, schema, headings, alt text
 *
 *   { action: "edit-component", site, page, selector, prompt, html }
 *     → Edits a specific component/element based on prompt
 *
 * All responses return Bootstrap 5 HTML with proper schema.org markup.
 */

interface Env {
  BLOXX_SITES: R2Bucket;
  ANTHROPIC_API_KEY: string;
}

interface AIRequest {
  action: string;
  site?: string;
  page?: string;
  sectionIndex?: number;
  selector?: string;
  prompt?: string;
  html?: string;
}

const SYSTEM_PROMPT = `You are Bloxx, an expert web developer that outputs Bootstrap 5.3+ HTML.

RULES:
1. Output ONLY raw HTML — no markdown fences, no explanations, no preamble.
2. Use Bootstrap 5.3 utility classes exclusively. Never write custom CSS.
3. Use semantic HTML: <section>, <article>, <header>, <footer>, <main>, <nav>.
4. Add ARIA attributes: aria-label, aria-labelledby, role where appropriate.
5. Add Schema.org microdata inline: itemscope, itemtype, itemprop.
6. All images must have descriptive alt text and loading="lazy" (except hero).
7. Use Bootstrap Icons (<i class="bi bi-*"></i>) for icons.
8. Make everything responsive: use col-sm-*, col-md-*, col-lg-* breakpoints.
9. Maintain heading hierarchy: h1 → h2 → h3 (never skip levels).
10. Use Unsplash URLs for placeholder images: https://images.unsplash.com/photo-ID?w=WIDTH&h=HEIGHT&fit=crop
11. For links and buttons, use descriptive text (not "click here").
12. Use CSS custom property var(--bloxx-primary) for the brand color.
13. Output complete, self-contained HTML sections — no partial fragments.`;

async function callClaude(env: Env, messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data: any = await res.json();
  return data.content?.[0]?.text || '';
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context;

  if (!env.ANTHROPIC_API_KEY) {
    return Response.json({ ok: false, error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  let body: AIRequest;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { action, site, page, sectionIndex, selector, prompt, html } = body;

  try {
    switch (action) {
      case 'edit-section': {
        if (!site || !page || sectionIndex === undefined || !prompt) {
          return Response.json({ ok: false, error: 'Missing site, page, sectionIndex, or prompt' }, { status: 400 });
        }
        // Fetch current page HTML
        const key = `${site}/drafts/${page}.html`;
        const obj = await env.BLOXX_SITES.get(key);
        if (!obj) return Response.json({ ok: false, error: 'Page not found' }, { status: 404 });
        const pageHtml = await obj.text();

        // Extract the section
        const sectionRegex = /<section[\s\S]*?<\/section>/gi;
        const sections = pageHtml.match(sectionRegex) || [];
        const currentSection = sections[sectionIndex];
        if (!currentSection) {
          return Response.json({ ok: false, error: `Section ${sectionIndex} not found` }, { status: 404 });
        }

        const result = await callClaude(env, [{
          role: 'user',
          content: `Here is the current HTML section:\n\n${currentSection}\n\nUser request: "${prompt}"\n\nRewrite this section following the user's request. Output ONLY the complete <section>...</section> HTML. Maintain all Schema.org microdata and ARIA attributes. Use Bootstrap 5.3 classes only.`,
        }]);

        return Response.json({ ok: true, html: result.trim() });
      }

      case 'generate-section': {
        if (!prompt) {
          return Response.json({ ok: false, error: 'Missing prompt' }, { status: 400 });
        }

        let contextHtml = '';
        if (site && page) {
          const key = `${site}/drafts/${page}.html`;
          const obj = await env.BLOXX_SITES.get(key);
          if (obj) {
            const text = await obj.text();
            // Extract just the page title and existing section headings for context
            const titleMatch = text.match(/<title[^>]*>(.*?)<\/title>/);
            const headings = Array.from(text.matchAll(/<h[12][^>]*>(.*?)<\/h[12]>/gi))
              .map(m => m[1]).join(', ');
            contextHtml = `\nPage context — Title: "${titleMatch?.[1] || ''}", Existing sections: ${headings}`;
          }
        }

        const result = await callClaude(env, [{
          role: 'user',
          content: `Generate a new HTML section for: "${prompt}"${contextHtml}\n\nOutput a complete <section>...</section> with:\n- Responsive Bootstrap 5.3 layout\n- Schema.org microdata where relevant\n- ARIA attributes\n- Proper heading (h2)\n- Placeholder images from Unsplash\n- var(--bloxx-primary) for brand color`,
        }]);

        return Response.json({ ok: true, html: result.trim() });
      }

      case 'improve-seo': {
        const targetHtml = html || '';
        if (!targetHtml && (!site || !page)) {
          return Response.json({ ok: false, error: 'Provide html or site+page' }, { status: 400 });
        }

        let pageHtml = targetHtml;
        if (!pageHtml && site && page) {
          const key = `${site}/drafts/${page}.html`;
          const obj = await env.BLOXX_SITES.get(key);
          if (!obj) return Response.json({ ok: false, error: 'Page not found' }, { status: 404 });
          pageHtml = await obj.text();
        }

        const result = await callClaude(env, [{
          role: 'user',
          content: `Analyze and improve this HTML page's SEO. Return the FULL improved HTML document.

Improvements to make:
1. Add/improve <title> tag (50-60 chars, include primary keyword)
2. Add/improve meta description (150-160 chars, compelling, include CTA)
3. Add/improve meta keywords
4. Add Open Graph tags (og:title, og:description, og:type, og:image)
5. Add Twitter Card tags
6. Ensure proper heading hierarchy (h1 → h2 → h3, no skips)
7. Add alt text to any images missing it
8. Add Schema.org JSON-LD in <head> appropriate to the page content
9. Add aria-label and aria-labelledby to sections
10. Ensure canonical URL is set

HTML to improve:\n\n${pageHtml.substring(0, 15000)}`,
        }]);

        return Response.json({ ok: true, html: result.trim() });
      }

      case 'edit-component': {
        if (!prompt || !html) {
          return Response.json({ ok: false, error: 'Missing prompt or html' }, { status: 400 });
        }

        const result = await callClaude(env, [{
          role: 'user',
          content: `Here is an HTML component:\n\n${html}\n\nUser request: "${prompt}"\n\nEdit this component following the user's request. Output ONLY the updated HTML element. Keep the same tag type and maintain all Schema.org and ARIA attributes. Use Bootstrap 5.3 classes only.`,
        }]);

        return Response.json({ ok: true, html: result.trim() });
      }

      default:
        return Response.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return Response.json({ ok: false, error: err.message || 'AI generation failed' }, { status: 500 });
  }
};
