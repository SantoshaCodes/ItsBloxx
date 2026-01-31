/**
 * GET /api/page-html?site={site-id}&page={page-name}
 * Returns raw HTML from R2 without bridge injection.
 * Used by the editor to populate state.html on initial page load.
 */

interface Env {
  BLOXX_SITES: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const site = url.searchParams.get('site');
  const page = url.searchParams.get('page');

  if (!site || !page) {
    return Response.json({ error: 'Missing site or page parameter' }, { status: 400 });
  }

  try {
    const key = `${site}/drafts/${page}.html`;
    const object = await context.env.BLOXX_SITES.get(key);

    if (!object) {
      return Response.json({ error: 'Page not found' }, { status: 404 });
    }

    const html = await object.text();
    return Response.json({ html });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
};
