/**
 * GET /api/pages?site={site-id} — List all pages for a site from R2
 * Returns: { pages: [{ name, key, size, lastModified }] }
 */

interface Env {
  BLOXX_SITES: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const site = url.searchParams.get('site');

  if (!site) {
    return Response.json({ error: 'Missing ?site= parameter' }, { status: 400 });
  }

  const prefix = `${site}/drafts/`;
  const listed = await context.env.BLOXX_SITES.list({ prefix });

  const pages = listed.objects.map((obj) => ({
    name: obj.key.replace(prefix, '').replace('.html', ''),
    key: obj.key,
    size: obj.size,
    lastModified: obj.uploaded.toISOString(),
    etag: obj.httpEtag,
  }));

  return Response.json({ pages });
};
