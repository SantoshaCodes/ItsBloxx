/**
 * /api/components — Xano-backed component library + create pipeline
 *
 * GET  /api/components?type=Hero        → List components from Xano
 * GET  /api/components?action=render&uid=abc → Render a component by short_id
 * POST /api/components                  → Create new component via enrich+judge pipeline
 */

interface Env {
  XANO_API_BASE: string;
  ANTHROPIC_API_KEY: string;
}

// Schema.org type mapping (from src/lib/gemini.ts)
const schemaTypeMap: Record<string, string> = {
  Hero: 'WebPage',
  Features: 'ItemList',
  Pricing: 'ItemList',
  CTA: 'WebPageElement',
  Testimonial: 'Review',
  FAQ: 'FAQPage',
  Footer: 'WPFooter',
  Form: 'ContactPage',
  Article: 'Article',
  Product: 'Product',
};

function extractJSON(text: string): any {
  let cleaned = text
    .replace(/^```json\s*/gim, '')
    .replace(/^```\s*/gim, '')
    .replace(/\s*```\s*$/gim, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      let jsonStr = cleaned.slice(start, end + 1);
      try {
        return JSON.parse(jsonStr);
      } catch {
        jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
        return JSON.parse(jsonStr);
      }
    }
    throw new Error('Could not find JSON in response');
  }
}

async function callClaude(
  env: Env,
  model: string,
  maxTokens: number,
  messages: { role: string; content: string }[]
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }
  const data: any = await res.json();
  return data.content?.[0]?.text || '';
}

// ─── Enrichment prompt (replicates src/lib/gemini.ts enrichComponent) ───
function buildEnrichPrompt(type: string, name: string, category: string, prompt: string, feedback?: any): string {
  const schemaType = schemaTypeMap[type] || 'WebPageElement';
  const feedbackSection = feedback
    ? `\n=== PREVIOUS ATTEMPT FEEDBACK (FIX THESE) ===\nScore: ${feedback.score}/100\nISSUES:\n${feedback.issues.map((i: string, n: number) => `${n + 1}. ${i}`).join('\n')}\nSUGGESTIONS:\n${feedback.suggestions.map((s: string, n: number) => `${n + 1}. ${s}`).join('\n')}\n`
    : '';

  return `You are a senior frontend developer. Generate a production-ready ${type} component using Bootstrap 5.
${feedbackSection}
COMPONENT: ${type}
NAME: ${name}
CATEGORY: ${category}
SCHEMA.ORG TYPE: ${schemaType}
USER REQUEST: ${prompt}

=== BOOTSTRAP 5.3+ STRICT REQUIREMENTS ===
1. ZERO CUSTOM CSS CLASSES — ONLY Bootstrap utility classes
2. ZERO INLINE STYLES — every visual property via Bootstrap utility
3. Semantic wrapper: <section>, <article>, <nav>, <footer>
4. aria-labelledby pointing to heading id
5. Schema.org microdata: itemscope, itemtype="https://schema.org/${schemaType}", itemprop
6. Use "visually-hidden" NOT "sr-only"
7. Responsive: col-sm-*, col-md-*, col-lg-*
8. Unsplash images with descriptive alt text

=== ANTI-LLM CONTENT REQUIREMENTS ===
- NO emojis anywhere
- NO generic phrases ("Welcome to our platform", "We're here to help")
- NO overly enthusiastic language or exclamation marks
- USE specific numbers, names, and details
- USE realistic, conversational copy

=== OUTPUT FORMAT ===
Return ONLY valid JSON:
{
  "html": "<section class=\\"py-5 bg-dark\\">...</section>",
  "schema": {"@context": "https://schema.org", "@type": "${schemaType}", ...},
  "data": {"variableName": "realistic example value"},
  "meta": {"title": "...", "description": "...", "keywords": [...]}
}`;
}

// ─── Judge prompt (replicates src/lib/gemini.ts judgeComponent) ───
function buildJudgePrompt(html: string, schema: any, data: any, meta: any, type: string): string {
  const expectedSchemaType = schemaTypeMap[type] || 'WebPageElement';
  return `You are a senior code reviewer. Evaluate this ${type} component for production readiness.

COMPONENT TYPE: ${type}
EXPECTED SCHEMA TYPE: ${expectedSchemaType}

HTML:
${html}

Schema:
${JSON.stringify(schema, null, 2)}

Data:
${JSON.stringify(data, null, 2)}

Meta:
${JSON.stringify(meta, null, 2)}

=== SCORING (100 points total) ===
Bootstrap 5.3 Compliance (30pts): Only Bootstrap utilities, no custom/BEM classes, no inline styles, responsive breakpoints
Schema/Meta Quality (25pts): Correct @type (${expectedSchemaType}), @context, name, description, nested types, meta title 50-60 chars, description 150-160 chars
Accessibility (20pts): Semantic wrapper, aria-labelledby, heading hierarchy, microdata, visually-hidden (not sr-only)
Anti-LLM Content (15pts): No emojis, no generic AI phrases, human-sounding copy, specific data
Structure (10pts): Clean HTML, proper nesting, template variables

AUTOMATIC FAILURES (cap at 50):
- Any custom CSS class or inline style
- Missing schema @context or @type
- No aria-labelledby on section

Pass threshold: 90/100

Return ONLY valid JSON:
{"score": 85, "passed": false, "issues": ["issue 1"], "suggestions": ["suggestion 1"]}`;
}

// ─── GET handler ───
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const url = new URL(context.request.url);
  const action = url.searchParams.get('action');

  // GET /api/components?action=render&uid=abc123
  if (action === 'render') {
    const uid = url.searchParams.get('uid');
    if (!uid) return Response.json({ ok: false, error: 'Missing uid' }, { status: 400 });
    try {
      const res = await fetch(`${env.XANO_API_BASE}/component/render?uid=${encodeURIComponent(uid)}&format=html`);
      if (!res.ok) throw new Error(`Xano ${res.status}`);
      const data: any = await res.json();
      return Response.json({ ok: true, html: data.html || data });
    } catch (err: any) {
      return Response.json({ ok: false, error: err.message }, { status: 502 });
    }
  }

  // GET /api/components?type=Hero
  const type = url.searchParams.get('type');
  try {
    let xanoUrl = `${env.XANO_API_BASE}/bloxx_components?per_page=50`;
    const res = await fetch(xanoUrl);
    if (!res.ok) throw new Error(`Xano ${res.status}`);
    const raw: any = await res.json();
    let components = Array.isArray(raw) ? raw : raw.result?.items || raw.items || raw.data || [];

    if (type && type !== 'all') {
      components = components.filter((c: any) => c.type?.toLowerCase() === type.toLowerCase());
    }

    return Response.json({
      components: components.map((c: any) => ({
        short_id: c.short_id || c.id,
        name: c.name,
        type: c.type,
        html: c.html,
        schema: c.schema,
        tags: c.tags || [],
      })),
    });
  } catch (err: any) {
    return Response.json({ ok: false, error: err.message }, { status: 502 });
  }
};

// ─── POST handler: create via enrich+judge pipeline ───
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context;
  if (!env.ANTHROPIC_API_KEY) {
    return Response.json({ ok: false, error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  let body: { name: string; type: string; category: string; prompt: string };
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, type, category, prompt } = body;
  if (!name || !type || !prompt) {
    return Response.json({ ok: false, error: 'Missing name, type, or prompt' }, { status: 400 });
  }

  const MAX_RETRIES = 3;
  let lastScore = 0;
  let feedback: any = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Step 1: Enrich with Opus
      const enrichPrompt = buildEnrichPrompt(type, name, category || type, prompt, feedback);
      const enrichText = await callClaude(env, 'claude-opus-4-5-20251101', 16384, [
        { role: 'user', content: enrichPrompt },
      ]);
      const enriched = extractJSON(enrichText);

      // Step 2: Judge with Sonnet
      const judgeText = await callClaude(env, 'claude-sonnet-4-20250514', 1024, [
        { role: 'user', content: buildJudgePrompt(enriched.html, enriched.schema, enriched.data, enriched.meta, type) },
      ]);
      const judgeResult = extractJSON(judgeText);
      lastScore = judgeResult.score;

      // Step 3: Pass?
      if (judgeResult.score >= 90) {
        // Step 4: Save to Xano
        let shortId: string | undefined;
        try {
          const xanoRes = await fetch(`${env.XANO_API_BASE}/component/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              type,
              category: category || type,
              html: enriched.html,
              styles: {},
              data: enriched.data,
              schema: enriched.schema,
              visibility: 'public',
              tags: ['editor-generated'],
            }),
          });
          if (xanoRes.ok) {
            const xanoData: any = await xanoRes.json();
            shortId = xanoData.short_id || xanoData.id;
          }
        } catch {
          // Xano save failed but we still have the HTML
        }

        return Response.json({
          ok: true,
          html: enriched.html,
          short_id: shortId,
          score: judgeResult.score,
        });
      }

      // Failed — set feedback for retry
      feedback = {
        score: judgeResult.score,
        issues: judgeResult.issues || [],
        suggestions: judgeResult.suggestions || [],
      };
    } catch (err: any) {
      if (attempt === MAX_RETRIES) {
        return Response.json({ ok: false, error: err.message, score: lastScore }, { status: 500 });
      }
    }
  }

  return Response.json({
    ok: false,
    error: `Failed to reach score 90 after ${MAX_RETRIES + 1} attempts (best: ${lastScore})`,
    score: lastScore,
  }, { status: 422 });
};
