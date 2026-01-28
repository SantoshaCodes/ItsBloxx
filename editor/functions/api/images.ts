/**
 * POST /api/images — Upload an image to R2
 * Accepts multipart/form-data with fields: site, file
 * Returns: { ok: true, url: string, key: string }
 *
 * Stores at: {site}/assets/images/{timestamp}-{filename}
 * Serves via: /preview/{site}/_asset/images/{timestamp}-{filename}
 */

interface Env {
  BLOXX_SITES: R2Bucket;
}

const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/avif',
]);

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ ok: false, error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const site = formData.get('site') as string;
  const file = formData.get('file') as File | null;

  if (!site || !file) {
    return Response.json({ ok: false, error: 'Missing site or file' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return Response.json(
      { ok: false, error: `Unsupported type: ${file.type}. Allowed: ${[...ALLOWED_TYPES].join(', ')}` },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return Response.json(
      { ok: false, error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max: 10 MB` },
      { status: 400 }
    );
  }

  // Sanitize filename
  const safeName = file.name
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
  const timestamp = Date.now();
  const key = `${site}/assets/images/${timestamp}-${safeName}`;

  await env.BLOXX_SITES.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  const url = `/preview/${site}/_asset/images/${timestamp}-${safeName}`;

  return Response.json({ ok: true, url, key });
};

/**
 * GET /api/images?site={site} — List all uploaded images
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const site = url.searchParams.get('site');

  if (!site) {
    return Response.json({ error: 'Missing ?site= parameter' }, { status: 400 });
  }

  const prefix = `${site}/assets/images/`;
  const listed = await context.env.BLOXX_SITES.list({ prefix });

  const images = listed.objects.map((obj) => ({
    key: obj.key,
    url: `/preview/${site}/_asset/images/${obj.key.replace(prefix, '')}`,
    size: obj.size,
    uploaded: obj.uploaded.toISOString(),
  }));

  return Response.json({ images });
};
