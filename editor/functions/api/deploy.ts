/**
 * POST /api/deploy — Copy all drafts → live for a site
 * Body: { site: string }
 * Returns: { ok: true, deployed: string[] }
 *
 * Copies every file from {site}/drafts/ to {site}/live/
 */

interface Env {
  BLOXX_SITES: R2Bucket;
}

interface DeployBody {
  site: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context;

  let body: DeployBody;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { site } = body;
  if (!site) {
    return Response.json({ ok: false, error: 'Missing site' }, { status: 400 });
  }

  const prefix = `${site}/drafts/`;
  const listed = await env.BLOXX_SITES.list({ prefix });
  const deployed: string[] = [];

  for (const obj of listed.objects) {
    const draftObj = await env.BLOXX_SITES.get(obj.key);
    if (!draftObj) continue;

    const livePath = obj.key.replace('/drafts/', '/live/');
    await env.BLOXX_SITES.put(livePath, draftObj.body, {
      httpMetadata: draftObj.httpMetadata,
    });
    deployed.push(livePath);
  }

  return Response.json({ ok: true, deployed });
};
