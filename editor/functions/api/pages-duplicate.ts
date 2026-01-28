/**
 * POST /api/pages/:id/duplicate — Duplicate a page
 *
 * Creates a copy of an existing page with a new slug and title.
 * Handles static vs editable component scope correctly.
 */

interface Env {
  BLOXX_SITES: R2Bucket;
}

interface DuplicateRequest {
  site: string;
  sourcePage: string;
  newTitle?: string;
  newSlug?: string;
}

/**
 * Generate a unique slug by appending -copy or -copy-N
 */
function generateUniqueSlug(baseSlug: string, existingSlugs: string[]): string {
  let candidate = `${baseSlug}-copy`;
  let counter = 1;

  while (existingSlugs.includes(candidate)) {
    counter++;
    candidate = `${baseSlug}-copy-${counter}`;
  }

  return candidate;
}

/**
 * Update page title in HTML
 */
function updatePageTitle(html: string, newTitle: string): string {
  // Update <title>
  html = html.replace(/<title>([^<]*)<\/title>/i, `<title>${newTitle}</title>`);

  // Update og:title
  html = html.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"/i,
    `<meta property="og:title" content="${newTitle}"`
  );

  // Update h1 if it matches the old title pattern
  // This is a bit fuzzy - we look for the first h1 and update if it looks like a page title
  const h1Match = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
  if (h1Match) {
    const oldH1 = h1Match[1];
    // Only update if h1 looks like a title (not too long, no special chars)
    if (oldH1.length < 100 && !oldH1.includes('\n')) {
      html = html.replace(h1Match[0], `<h1>${newTitle}</h1>`);
    }
  }

  return html;
}

/**
 * Update canonical URL in HTML
 */
function updateCanonicalUrl(html: string, newSlug: string, siteUrl: string): string {
  const newUrl = newSlug === 'index' ? siteUrl : `${siteUrl}/${newSlug}`;

  // Update canonical link
  html = html.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"/i,
    `<link rel="canonical" href="${newUrl}"`
  );

  // Update og:url
  html = html.replace(
    /<meta\s+property="og:url"\s+content="[^"]*"/i,
    `<meta property="og:url" content="${newUrl}"`
  );

  return html;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  let body: DuplicateRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { site, sourcePage, newTitle, newSlug } = body;

  if (!site || !sourcePage) {
    return Response.json({ ok: false, error: 'Missing site or sourcePage' }, { status: 400 });
  }

  // Get source page HTML
  const sourceKey = `${site}/drafts/${sourcePage}.html`;
  const sourceObject = await env.BLOXX_SITES.get(sourceKey);

  if (!sourceObject) {
    return Response.json({ ok: false, error: 'Source page not found' }, { status: 404 });
  }

  let html = await sourceObject.text();

  // List existing pages to generate unique slug
  const listResult = await env.BLOXX_SITES.list({ prefix: `${site}/drafts/` });
  const existingSlugs = listResult.objects
    .map(obj => {
      const match = obj.key.match(/\/drafts\/(.+)\.html$/);
      return match ? match[1] : null;
    })
    .filter((s): s is string => s !== null);

  // Generate new slug
  const finalSlug = newSlug || generateUniqueSlug(sourcePage, existingSlugs);

  // Generate new title
  const finalTitle = newTitle || `${extractTitle(html)} (Copy)`;

  // Update HTML content
  html = updatePageTitle(html, finalTitle);
  html = updateCanonicalUrl(html, finalSlug, `https://${site}.bloxx.site`);

  // Remove any duplicate indication from schema
  html = updateSchemaForDuplicate(html, finalTitle, finalSlug);

  // Save new page
  const newKey = `${site}/drafts/${finalSlug}.html`;
  const putResult = await env.BLOXX_SITES.put(newKey, html, {
    httpMetadata: { contentType: 'text/html' },
  });

  return Response.json({
    ok: true,
    page: {
      name: finalSlug,
      title: finalTitle,
      key: newKey,
      etag: putResult.httpEtag,
    },
  });
};

/**
 * Extract title from HTML
 */
function extractTitle(html: string): string {
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  if (titleMatch) {
    return titleMatch[1].trim();
  }

  const h1Match = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
  if (h1Match) {
    return h1Match[1].trim();
  }

  return 'Page';
}

/**
 * Update JSON-LD schema for duplicated page
 */
function updateSchemaForDuplicate(html: string, newTitle: string, newSlug: string): string {
  // Find and update JSON-LD blocks
  return html.replace(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi,
    (match, jsonContent) => {
      try {
        const schema = JSON.parse(jsonContent);

        // Update name/headline if present
        if (schema.name) {
          schema.name = newTitle;
        }
        if (schema.headline) {
          schema.headline = newTitle;
        }

        // Update URL if present
        if (schema.url && typeof schema.url === 'string') {
          const urlParts = schema.url.split('/');
          urlParts[urlParts.length - 1] = newSlug;
          schema.url = urlParts.join('/');
        }

        // Update dateModified
        schema.dateModified = new Date().toISOString().split('T')[0];

        return `<script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>`;
      } catch {
        // If JSON parsing fails, return original
        return match;
      }
    }
  );
}
