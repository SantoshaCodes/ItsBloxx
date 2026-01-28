/**
 * /api/audit-temp — Serve temporary HTML for audit crawling
 *
 * GET /api/audit-temp?site={site}&id={tempId}
 *
 * This endpoint serves the temporary HTML file so Xano can crawl it.
 * The file is automatically cleaned up by the /api/audit endpoint.
 */

interface Env {
  BLOXX_SITES: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const url = new URL(context.request.url);

  const site = url.searchParams.get('site');
  const id = url.searchParams.get('id');

  if (!site || !id) {
    return new Response('Missing site or id parameter', { status: 400 });
  }

  // Security: validate the id format to prevent path traversal
  if (!/^[\d]+-[a-z0-9]+$/.test(id)) {
    return new Response('Invalid id format', { status: 400 });
  }

  const tempKey = `${site}/_audit-temp/${id}.html`;
  const obj = await env.BLOXX_SITES.get(tempKey);

  if (!obj) {
    return new Response('Temp file not found or expired', { status: 404 });
  }

  const html = await obj.text();

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
};
