/**
 * POST /api/audit-image-gen — Generate images via Workers AI and upload to R2
 *
 * Body: { prompt: string, site: string, purpose: 'hero'|'og'|'content' }
 * Returns: { ok: true, url: string } or { ok: false, error: string }
 */

interface Env {
  AI: any;
  BLOXX_SITES: R2Bucket;
}

interface ImageGenRequest {
  prompt: string;
  site: string;
  purpose: 'hero' | 'og' | 'content';
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  let body: ImageGenRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { prompt, site, purpose } = body;
  if (!prompt || !site) {
    return Response.json({ ok: false, error: 'Missing prompt or site' }, { status: 400 });
  }

  if (!env.AI) {
    return Response.json({ ok: false, error: 'Workers AI not configured' }, { status: 500 });
  }

  try {
    const result = await env.AI.run('@cf/stabilityai/stable-diffusion-xl-base-1.0', {
      prompt,
    });

    // result is a ReadableStream of PNG bytes
    const imageBytes = new Uint8Array(await new Response(result).arrayBuffer());

    const timestamp = Date.now();
    const key = `${site}/generated/${purpose}-${timestamp}.png`;

    await env.BLOXX_SITES.put(key, imageBytes, {
      httpMetadata: { contentType: 'image/png' },
    });

    // Build public URL — R2 custom domain or fallback
    const url = `https://sites.bloxx.site/${key}`;

    return Response.json({ ok: true, url });
  } catch (err: any) {
    console.error('Image generation error:', err);
    return Response.json(
      { ok: false, error: 'Image generation failed: ' + (err.message || 'Unknown error') },
      { status: 500 }
    );
  }
};
