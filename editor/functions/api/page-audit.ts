/**
 * GET /api/pages/:page/audit — Audit a page for SEO and accessibility
 *
 * Analyzes the page content and returns a score with detailed issues and passed checks.
 */

import { auditPage, getGrade, getScoreColor } from '../../lib/page-audit';

interface Env {
  BLOXX_SITES: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const url = new URL(context.request.url);

  const site = url.searchParams.get('site');
  const page = url.searchParams.get('page');
  const pageType = url.searchParams.get('pageType') || 'custom';

  if (!site || !page) {
    return Response.json({ ok: false, error: 'Missing site or page parameter' }, { status: 400 });
  }

  // Get page HTML from R2
  const key = `${site}/drafts/${page}.html`;
  const object = await env.BLOXX_SITES.get(key);

  if (!object) {
    return Response.json({ ok: false, error: 'Page not found' }, { status: 404 });
  }

  const html = await object.text();

  // Run audit
  const result = auditPage(html, pageType);

  // Add grade and color for UI
  return Response.json({
    ok: true,
    ...result,
    grade: getGrade(result.score),
    color: getScoreColor(result.score),
  });
};

/**
 * POST /api/pages/audit — Audit provided HTML content (without saving)
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: { html: string; pageType?: string };

  try {
    body = await context.request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.html) {
    return Response.json({ ok: false, error: 'Missing html in request body' }, { status: 400 });
  }

  const pageType = body.pageType || 'custom';
  const result = auditPage(body.html, pageType);

  return Response.json({
    ok: true,
    ...result,
    grade: getGrade(result.score),
    color: getScoreColor(result.score),
  });
};
