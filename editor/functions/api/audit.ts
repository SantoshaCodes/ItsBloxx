/**
 * /api/audit — Real-time page audit wrapper
 *
 * POST /api/audit
 * Body: { site: string, page: string, html: string }
 *
 * Flow:
 * 1. Write HTML to temporary R2 location
 * 2. Call Xano audit API with the temp URL
 * 3. Return audit results
 * 4. Clean up temp file (async)
 */

interface Env {
  BLOXX_SITES: R2Bucket;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  let body: { site: string; page: string; html: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { site, page, html } = body;
  if (!site || !page || !html) {
    return Response.json({ ok: false, error: 'Missing site, page, or html' }, { status: 400 });
  }

  // Generate a unique temp key
  const tempId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tempKey = `${site}/_audit-temp/${tempId}.html`;

  try {
    // Write HTML to temporary R2 location
    await env.BLOXX_SITES.put(tempKey, html, {
      httpMetadata: { contentType: 'text/html' },
    });

    // Build the public URL for this temp file
    // The temp file is served via our preview endpoint
    const requestUrl = new URL(request.url);
    const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
    const tempUrl = `${baseUrl}/api/audit-temp?site=${encodeURIComponent(site)}&id=${encodeURIComponent(tempId)}`;

    // Call Xano audit API
    const xanoUrl = `https://xyrm-sqqj-hx6t.n7c.xano.io/api:la4i98J3/auditv2?url=${encodeURIComponent(tempUrl)}`;
    const auditResponse = await fetch(xanoUrl);
    const auditData = await auditResponse.json();

    // Clean up temp file (don't await - do it async)
    context.waitUntil(env.BLOXX_SITES.delete(tempKey));

    // Return audit results
    return Response.json({
      ok: true,
      ...auditData,
    });
  } catch (err: any) {
    // Clean up on error too
    try {
      await env.BLOXX_SITES.delete(tempKey);
    } catch {}

    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
};
