/**
 * /api/audit-fix — 3-tier fix generation for audit findings
 *
 * POST /api/audit-fix
 * Body: { fixType: string, category: string, html: string, context?: object }
 *
 * Tiers:
 *   - CLIENT fixes → 400 (handled browser-side, should not hit server)
 *   - PYTHON fixes → proxy to schema worker
 *   - LLM fixes → Claude Haiku 4.5
 */

interface Env {
  ANTHROPIC_API_KEY?: string;
  SCHEMA_WORKER_URL?: string;
}

interface FixRequest {
  fixType: string;
  category: string;
  html: string;
  context?: Record<string, any>;
}

interface FixResponse {
  ok: boolean;
  snippet?: string;
  location?: 'head' | 'body-start' | 'body-end' | 'replace';
  target?: string;
  preview?: boolean;
  detectedTypes?: string[];
  normalizedType?: string;
  error?: string;
}

// Client-side fixes — should never reach server
const CLIENT_FIXES = new Set([
  'add_viewport', 'add_charset', 'add_lang', 'add_canonical',
  'add_main', 'add_header', 'add_footer', 'wrap_nav',
  'fix_multiple_h1', 'add_noopener', 'add_lazy_loading', 'add_skip_link',
  'add_aria_labels', 'add_nav',
]);

// Python worker fixes — proxy to schema worker
const PYTHON_FIXES = new Set([
  'generate_schema_auto',
  'generate_schema_localbusiness',
  'generate_schema_article',
  'generate_schema_faq',
  'generate_schema_product',
  'generate_schema_organization',
  'generate_schema_aboutpage',
  'extract_business_data',
]);

// LLM prompts
const FIX_PROMPTS: Record<string, {
  system: string;
  userTemplate: (html: string, ctx?: Record<string, any>) => string;
  location: FixResponse['location'];
}> = {
  generate_meta_description: {
    system: 'You are an SEO expert. Generate a meta description tag for the given HTML page. Return ONLY the <meta> tag, nothing else. The description MUST be at least 120 characters. Never return a description shorter than 120 characters. Aim for 120-155 characters. Make it compelling and accurately summarize the page content.',
    userTemplate: (html) => {
      const existingMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
                            html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
      const existing = existingMatch ? existingMatch[1] : null;
      if (existing && existing.length < 120) {
        return `The current meta description is too short (${existing.length} chars): "${existing}"\n\nGenerate a REPLACEMENT meta description that is between 120 and 155 characters. Return ONLY the full <meta name="description" content="..."> tag.\n\nPage content:\n${html.substring(0, 8000)}`;
      }
      return `Generate a meta description for this page:\n\n${html.substring(0, 8000)}`;
    },
    location: 'head',
  },
  generate_title: {
    system: 'You are an SEO expert. Generate or improve the page title. Return ONLY the <title> tag, nothing else. Keep it under 60 characters, descriptive, and include relevant keywords.',
    userTemplate: (html) => `Generate an SEO-optimized title tag for this page:\n\n${html.substring(0, 8000)}`,
    location: 'head',
  },
  generate_og_tags: {
    system: 'You are a social media optimization expert. Generate Open Graph meta tags for the given HTML page. Return ONLY the meta tags (og:title, og:description, og:type, og:image if detectable), each on a new line. No other text.',
    userTemplate: (html) => `Generate Open Graph tags for this page:\n\n${html.substring(0, 8000)}`,
    location: 'head',
  },
  generate_alt_text: {
    system: 'You are an accessibility expert. Generate appropriate alt text for images on this page. Return a JSON object mapping image src URLs to their alt text. Format: {"src1": "alt1", "src2": "alt2"}. Only include images that are missing alt text.',
    userTemplate: (html) => `Generate alt text for images missing it on this page:\n\n${html.substring(0, 8000)}`,
    location: 'replace',
  },
  expand_content: {
    system: 'You are an SEO content expert. Generate 2-3 additional paragraphs of content relevant to the page topic. Return ONLY the HTML (wrapped in a <section> with an <h2> heading). The content must be informative, unique, and add value. Do not repeat existing content. Do not include any explanation or markdown.',
    userTemplate: (html) => `This page has thin content. Generate 2-3 additional paragraphs relevant to the page topic. Return only HTML wrapped in a <section> element with an appropriate <h2> heading.\n\nPage content:\n${html.substring(0, 8000)}`,
    location: 'body-end',
  },
  add_content_sections: {
    system: 'You are an SEO content expert. Generate structured content sections with H2 headings and paragraphs to improve page depth. Return ONLY the HTML (multiple <section> elements each with an <h2> and 1-2 paragraphs). Do not repeat existing content. Do not include any explanation or markdown.',
    userTemplate: (html) => `This page needs more structured content. Generate 2-3 content sections, each with an <h2> heading and 1-2 paragraphs. Return only the HTML.\n\nPage content:\n${html.substring(0, 8000)}`,
    location: 'body-end',
  },
  improve_llm_readability: {
    system: 'You are a semantic HTML expert. Restructure the given page content into proper semantic HTML sections. Wrap content in <article> and <section> elements with clear headings. Return ONLY a single <article> element containing <section> elements with proper heading hierarchy. Preserve all existing text content. Do not include any explanation or markdown.',
    userTemplate: (html) => {
      // Extract main content area for restructuring
      const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const content = mainMatch ? mainMatch[1] : bodyMatch ? bodyMatch[1] : html;
      return `Restructure this content into semantic HTML with <article> and <section> elements, each with proper headings. Preserve all text content.\n\n${content.substring(0, 8000)}`;
    },
    location: 'body-end',
  },
  add_cta: {
    system: 'You are a conversion optimization expert. Generate a compelling call-to-action section for the given page. Return ONLY HTML with a <section> containing an <h2>, a short paragraph, and a <a> styled as a button (with class="btn btn-primary"). Make the CTA specific to the page topic. Do not include any explanation or markdown.',
    userTemplate: (html) => `Generate a call-to-action section for this page. The CTA should be relevant to the content and encourage the visitor to take action (contact, book, buy, sign up, etc).\n\nPage content:\n${html.substring(0, 6000)}`,
    location: 'body-end',
  },
  improve_readability: {
    system: 'You are a content editor specializing in web readability. Rewrite the dense/long paragraphs to be clearer and more scannable. Break long paragraphs into shorter ones (2-3 sentences each). Shorten sentences over 25 words. Add subheadings (<h3>) between sections. Return ONLY the improved HTML content. Preserve all existing meaning and key information.',
    userTemplate: (html) => {
      const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const content = mainMatch ? mainMatch[1] : bodyMatch ? bodyMatch[1] : html;
      return `Improve the readability of this content. Break long paragraphs into shorter ones, shorten long sentences, and add subheadings where helpful. Return only the improved HTML.\n\n${content.substring(0, 8000)}`;
    },
    location: 'replace',
  },
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  let body: FixRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { fixType, html, context: ctx } = body;
  if (!fixType || !html) {
    return Response.json({ ok: false, error: 'Missing fixType or html' }, { status: 400 });
  }

  // ── Tier 1: Client fixes → reject with hint ──
  if (CLIENT_FIXES.has(fixType)) {
    return Response.json(
      { ok: false, error: 'Client-side fix — apply in browser', fixMethod: 'client' },
      { status: 400 }
    );
  }

  // ── Tier 2: Python fixes → proxy to schema worker ──
  if (PYTHON_FIXES.has(fixType)) {
    const workerUrl = env.SCHEMA_WORKER_URL;
    if (!workerUrl) {
      return Response.json({ ok: false, error: 'Schema worker not configured' }, { status: 500 });
    }

    try {
      let endpoint: string;
      let payload: Record<string, any>;

      if (fixType === 'extract_business_data') {
        endpoint = '/extract-business-data';
        payload = { html };
      } else {
        endpoint = '/generate-schema';
        // Map fixType to schemaType
        const schemaTypeMap: Record<string, string> = {
          'generate_schema_auto': 'auto',
          'generate_schema_localbusiness': 'LocalBusiness',
          'generate_schema_article': 'Article',
          'generate_schema_faq': 'FAQPage',
          'generate_schema_product': 'Product',
          'generate_schema_organization': 'Organization',
          'generate_schema_aboutpage': 'AboutPage',
        };
        const schemaType = schemaTypeMap[fixType] || 'auto';
        payload = {
          html,
          url: ctx?.url,
          schemaType,
          autoDetect: schemaType === 'auto',
        };
      }

      const response = await fetch(workerUrl + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data: any = await response.json();
      return Response.json(data, { status: response.ok ? 200 : response.status });
    } catch (err: any) {
      console.error('Schema worker error:', err);
      return Response.json({ ok: false, error: 'Schema worker request failed' }, { status: 502 });
    }
  }

  // ── Tier 2.5: Image generation fixes → proxy to /api/audit-image-gen ──
  const IMAGE_GEN_FIXES = new Set(['generate_hero_image', 'generate_og_image', 'replace_placeholder']);
  if (IMAGE_GEN_FIXES.has(fixType)) {
    try {
      // Step 1: Use Claude to generate an image prompt from the page content
      if (!env.ANTHROPIC_API_KEY) {
        return Response.json({ ok: false, error: 'API key not configured' }, { status: 500 });
      }
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
      const pageTitle = titleMatch?.[1] || h1Match?.[1]?.replace(/<[^>]*>/g, '') || 'business website';

      const promptRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          system: 'Generate a short, descriptive image generation prompt (1-2 sentences) for a professional business website. The image should be photorealistic, well-lit, and suitable for a hero section. Return ONLY the prompt text, nothing else.',
          messages: [{ role: 'user', content: `Generate an image prompt for a hero/banner image for this page: "${pageTitle}"\n\nPage purpose: ${fixType === 'generate_og_image' ? 'social media sharing preview' : 'hero section banner'}` }],
        }),
      });

      const promptData: any = await promptRes.json();
      const imagePrompt = promptData.content?.[0]?.text || `Professional business photo for ${pageTitle}`;

      // Step 2: Call image generation endpoint
      const imageGenUrl = new URL('/api/audit-image-gen', request.url).toString();
      const imageRes = await fetch(imageGenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imagePrompt,
          site: ctx?.site || 'default',
          purpose: fixType === 'generate_og_image' ? 'og' : fixType === 'generate_hero_image' ? 'hero' : 'content',
        }),
      });

      const imageData: any = await imageRes.json();
      if (!imageData.ok || !imageData.url) {
        return Response.json({ ok: false, error: imageData.error || 'Image generation failed' }, { status: 500 });
      }

      // Step 3: Return appropriate snippet
      let snippet: string;
      let location: FixResponse['location'];
      if (fixType === 'generate_og_image') {
        snippet = `<meta property="og:image" content="${imageData.url}">`;
        location = 'head';
      } else {
        snippet = `<img src="${imageData.url}" alt="${pageTitle}" class="img-fluid w-100" style="max-height:500px;object-fit:cover;" loading="eager">`;
        location = 'body-start';
      }

      return Response.json({
        ok: true,
        snippet,
        location,
        preview: true,
        imageUrl: imageData.url,
      });
    } catch (err: any) {
      console.error('Image gen fix error:', err);
      return Response.json({ ok: false, error: 'Image generation failed: ' + (err.message || 'Unknown error') }, { status: 500 });
    }
  }

  // ── Tier 3: LLM fixes → Claude Haiku ──
  const promptConfig = FIX_PROMPTS[fixType];
  if (!promptConfig) {
    return Response.json({ ok: false, error: `Unknown fix type: ${fixType}` }, { status: 400 });
  }

  if (!env.ANTHROPIC_API_KEY) {
    return Response.json({ ok: false, error: 'API key not configured' }, { status: 500 });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: promptConfig.system,
        messages: [{
          role: 'user',
          content: promptConfig.userTemplate(html, ctx),
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Claude API error:', err);
      return Response.json({ ok: false, error: 'LLM request failed' }, { status: 502 });
    }

    const data: any = await response.json();
    const textBlock = data.content?.find((b: any) => b.type === 'text');
    const snippet = textBlock?.text?.trim() || '';

    if (!snippet) {
      return Response.json({ ok: false, error: 'Empty response from LLM' }, { status: 502 });
    }

    // For alt text, parse JSON and return differently
    if (fixType === 'generate_alt_text') {
      try {
        const jsonMatch = snippet.match(/\{[\s\S]*\}/);
        const altMap = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
        return Response.json({
          ok: true,
          snippet: JSON.stringify(altMap),
          location: 'replace',
          target: 'img-alt',
        } satisfies FixResponse);
      } catch {
        return Response.json({ ok: false, error: 'Failed to parse alt text response' }, { status: 502 });
      }
    }

    return Response.json({
      ok: true,
      snippet,
      location: promptConfig.location,
    } satisfies FixResponse);

  } catch (err: any) {
    console.error('Audit fix error:', err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
};
