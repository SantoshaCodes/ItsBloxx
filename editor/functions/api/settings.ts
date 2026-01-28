/**
 * GET/PUT /api/settings — Manage global site settings
 *
 * Settings are stored in R2 as JSON files: {site}/settings.json
 */

import {
  getDefaultSettings,
  validateSettings,
  generateBrandingCSS,
  generateAnalyticsScripts,
} from '../../lib/global-settings';

interface Env {
  BLOXX_SITES: R2Bucket;
}

/**
 * GET /api/settings?site={site}
 * Returns global settings for a site
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const url = new URL(context.request.url);
  const site = url.searchParams.get('site');

  if (!site) {
    return Response.json({ ok: false, error: 'Missing site parameter' }, { status: 400 });
  }

  const key = `${site}/settings.json`;
  const object = await env.BLOXX_SITES.get(key);

  if (!object) {
    // Return defaults if no settings exist
    const defaults = getDefaultSettings();
    return Response.json({
      ok: true,
      settings: defaults,
      isDefault: true,
    });
  }

  try {
    const settings = await object.json();
    return Response.json({
      ok: true,
      settings,
      isDefault: false,
      etag: object.httpEtag,
    });
  } catch {
    return Response.json({ ok: false, error: 'Invalid settings file' }, { status: 500 });
  }
};

/**
 * PUT /api/settings
 * Update global settings for a site
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  let body: { site: string; settings: Record<string, any>; etag?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { site, settings, etag } = body;

  if (!site || !settings) {
    return Response.json({ ok: false, error: 'Missing site or settings' }, { status: 400 });
  }

  // Validate settings
  const validation = validateSettings(settings);
  if (!validation.valid) {
    return Response.json({
      ok: false,
      error: 'Validation failed',
      errors: validation.errors,
    }, { status: 400 });
  }

  const key = `${site}/settings.json`;

  // Conflict detection
  if (etag) {
    const existing = await env.BLOXX_SITES.head(key);
    if (existing && existing.httpEtag !== etag) {
      return Response.json(
        { ok: false, error: 'conflict', serverEtag: existing.httpEtag },
        { status: 409 }
      );
    }
  }

  // Add metadata
  const settingsWithMeta = {
    ...settings,
    _updatedAt: new Date().toISOString(),
  };

  // Save settings
  const putResult = await env.BLOXX_SITES.put(key, JSON.stringify(settingsWithMeta, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });

  // Generate derived files (CSS, analytics snippets)
  await generateDerivedFiles(env, site, settings);

  return Response.json({
    ok: true,
    etag: putResult.httpEtag,
  });
};

/**
 * Generate derived files from settings (branding CSS, analytics snippets)
 */
async function generateDerivedFiles(env: Env, site: string, settings: Record<string, any>) {
  // Generate branding CSS
  if (settings.branding) {
    const css = generateBrandingCSS(settings.branding);
    await env.BLOXX_SITES.put(`${site}/assets/branding.css`, css, {
      httpMetadata: { contentType: 'text/css' },
    });
  }

  // Generate analytics snippet file
  if (settings.analytics) {
    const scripts = generateAnalyticsScripts(settings.analytics);

    // Head scripts
    if (scripts.head) {
      await env.BLOXX_SITES.put(`${site}/assets/analytics-head.html`, scripts.head, {
        httpMetadata: { contentType: 'text/html' },
      });
    }

    // Body scripts
    if (scripts.body) {
      await env.BLOXX_SITES.put(`${site}/assets/analytics-body.html`, scripts.body, {
        httpMetadata: { contentType: 'text/html' },
      });
    }
  }
}

/**
 * POST /api/settings/inject
 * Inject settings into HTML (branding CSS, analytics)
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  let body: { site: string; html: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { site, html } = body;

  if (!site || !html) {
    return Response.json({ ok: false, error: 'Missing site or html' }, { status: 400 });
  }

  // Get settings
  const settingsKey = `${site}/settings.json`;
  const settingsObject = await env.BLOXX_SITES.get(settingsKey);

  if (!settingsObject) {
    // No settings, return HTML unchanged
    return Response.json({ ok: true, html });
  }

  const settings = await settingsObject.json() as Record<string, any>;

  // Inject into HTML
  let injectedHtml = html;

  // Inject branding CSS link if exists
  if (settings.branding) {
    const cssLink = `<link rel="stylesheet" href="/preview/${site}/_asset/branding.css">`;
    injectedHtml = injectedHtml.replace('</head>', `${cssLink}\n</head>`);
  }

  // Inject analytics
  if (settings.analytics) {
    const scripts = generateAnalyticsScripts(settings.analytics);

    if (scripts.head) {
      injectedHtml = injectedHtml.replace('</head>', `${scripts.head}\n</head>`);
    }

    if (scripts.body) {
      // Split body scripts into start and end
      const bodyStartMatch = settings.analytics.customScripts?.bodyStart;
      const gtmNoScript = scripts.body.includes('noscript') ? scripts.body : '';

      if (bodyStartMatch || gtmNoScript) {
        injectedHtml = injectedHtml.replace('<body', `<body>\n${gtmNoScript || ''}`);
      }

      // Body end scripts (before </body>)
      const bodyEndScripts = settings.analytics.customScripts?.bodyEnd;
      if (bodyEndScripts) {
        injectedHtml = injectedHtml.replace('</body>', `${bodyEndScripts}\n</body>`);
      }
    }
  }

  // Inject favicon if set
  if (settings.seo?.favicon) {
    const faviconLink = `<link rel="icon" href="${settings.seo.favicon}">`;
    if (!injectedHtml.includes('rel="icon"')) {
      injectedHtml = injectedHtml.replace('</head>', `${faviconLink}\n</head>`);
    }
  }

  return Response.json({ ok: true, html: injectedHtml });
};
