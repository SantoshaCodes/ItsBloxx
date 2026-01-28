/**
 * /api/analytics — Link tracking and orphan page detection
 *
 * Endpoints:
 * - GET /api/analytics?site={site}&type=links — Get internal link report
 * - GET /api/analytics?site={site}&type=orphan — Get orphan pages (no incoming links)
 * - POST /api/analytics — Rebuild link index for a site
 */

import { parseHTML } from 'linkedom';

interface Env {
  BLOXX_SITES: R2Bucket;
}

interface PageLink {
  sourcePageSlug: string;
  targetPageSlug: string;
  linkText: string;
  href: string;
}

interface LinkReport {
  totalPages: number;
  totalLinks: number;
  pages: {
    slug: string;
    incomingLinks: number;
    outgoingLinks: number;
  }[];
}

interface OrphanReport {
  orphanPages: {
    slug: string;
    title: string;
    lastModified: string;
  }[];
  totalPages: number;
}

/**
 * Extract internal links from HTML
 */
function extractInternalLinks(html: string, currentPageSlug: string): PageLink[] {
  const { document } = parseHTML(html);
  const links: PageLink[] = [];
  const anchors = document.querySelectorAll('a[href]');

  for (const anchor of anchors) {
    const href = anchor.getAttribute('href') || '';
    const text = anchor.textContent?.trim() || '';

    // Skip external links, anchors, mailto, tel
    if (
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('javascript:')
    ) {
      continue;
    }

    // Normalize the href to get target page slug
    let targetSlug = href
      .replace(/^\//, '') // Remove leading slash
      .replace(/\.html$/, '') // Remove .html extension
      .replace(/\/$/, '') // Remove trailing slash
      .split('?')[0] // Remove query string
      .split('#')[0]; // Remove hash

    // Handle root/index
    if (!targetSlug || targetSlug === '/') {
      targetSlug = 'index';
    }

    // Skip self-links
    if (targetSlug === currentPageSlug) {
      continue;
    }

    links.push({
      sourcePageSlug: currentPageSlug,
      targetPageSlug: targetSlug,
      linkText: text.substring(0, 100), // Truncate long text
      href,
    });
  }

  return links;
}

/**
 * Extract page title from HTML
 */
function extractTitle(html: string): string {
  const { document } = parseHTML(html);
  return document.querySelector('title')?.textContent?.trim() || 'Untitled';
}

/**
 * Build link index for entire site
 */
async function buildLinkIndex(env: Env, site: string): Promise<{
  links: PageLink[];
  pages: Map<string, { title: string; lastModified: string }>;
}> {
  const links: PageLink[] = [];
  const pages = new Map<string, { title: string; lastModified: string }>();

  // List all draft pages
  const prefix = `${site}/drafts/`;
  const list = await env.BLOXX_SITES.list({ prefix });

  for (const obj of list.objects) {
    const match = obj.key.match(/\/drafts\/(.+)\.html$/);
    if (!match) continue;

    const slug = match[1];
    const pageObj = await env.BLOXX_SITES.get(obj.key);
    if (!pageObj) continue;

    const html = await pageObj.text();
    const title = extractTitle(html);
    const pageLinks = extractInternalLinks(html, slug);

    pages.set(slug, {
      title,
      lastModified: obj.uploaded?.toISOString() || new Date().toISOString(),
    });

    links.push(...pageLinks);
  }

  return { links, pages };
}

/**
 * Generate link report
 */
function generateLinkReport(
  links: PageLink[],
  pages: Map<string, { title: string; lastModified: string }>
): LinkReport {
  const incomingCount = new Map<string, number>();
  const outgoingCount = new Map<string, number>();

  // Initialize all pages with 0
  for (const slug of pages.keys()) {
    incomingCount.set(slug, 0);
    outgoingCount.set(slug, 0);
  }

  // Count links
  for (const link of links) {
    // Outgoing from source
    outgoingCount.set(
      link.sourcePageSlug,
      (outgoingCount.get(link.sourcePageSlug) || 0) + 1
    );

    // Incoming to target (only if target exists)
    if (pages.has(link.targetPageSlug)) {
      incomingCount.set(
        link.targetPageSlug,
        (incomingCount.get(link.targetPageSlug) || 0) + 1
      );
    }
  }

  const pageStats = Array.from(pages.keys()).map(slug => ({
    slug,
    incomingLinks: incomingCount.get(slug) || 0,
    outgoingLinks: outgoingCount.get(slug) || 0,
  }));

  // Sort by incoming links (ascending - least linked first)
  pageStats.sort((a, b) => a.incomingLinks - b.incomingLinks);

  return {
    totalPages: pages.size,
    totalLinks: links.length,
    pages: pageStats,
  };
}

/**
 * Find orphan pages (no incoming links, excluding index)
 */
function findOrphanPages(
  links: PageLink[],
  pages: Map<string, { title: string; lastModified: string }>
): OrphanReport {
  const incomingCount = new Map<string, number>();

  // Initialize all pages with 0
  for (const slug of pages.keys()) {
    incomingCount.set(slug, 0);
  }

  // Count incoming links
  for (const link of links) {
    if (pages.has(link.targetPageSlug)) {
      incomingCount.set(
        link.targetPageSlug,
        (incomingCount.get(link.targetPageSlug) || 0) + 1
      );
    }
  }

  // Find pages with 0 incoming links (excluding index/homepage)
  const orphans: OrphanReport['orphanPages'] = [];

  for (const [slug, count] of incomingCount.entries()) {
    // Skip index page - it's the entry point
    if (slug === 'index' || slug === 'home' || slug === 'homepage') {
      continue;
    }

    if (count === 0) {
      const pageInfo = pages.get(slug);
      orphans.push({
        slug,
        title: pageInfo?.title || slug,
        lastModified: pageInfo?.lastModified || '',
      });
    }
  }

  // Sort by last modified (oldest first)
  orphans.sort((a, b) => a.lastModified.localeCompare(b.lastModified));

  return {
    orphanPages: orphans,
    totalPages: pages.size,
  };
}

/**
 * GET /api/analytics — Get link report or orphan pages
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const url = new URL(context.request.url);

  const site = url.searchParams.get('site');
  const type = url.searchParams.get('type') || 'links';

  if (!site) {
    return Response.json({ ok: false, error: 'Missing site parameter' }, { status: 400 });
  }

  try {
    const { links, pages } = await buildLinkIndex(env, site);

    if (type === 'orphan' || type === 'orphan-pages') {
      const report = findOrphanPages(links, pages);
      return Response.json({ ok: true, ...report });
    }

    // Default: link report
    const report = generateLinkReport(links, pages);
    return Response.json({ ok: true, ...report });
  } catch (err: any) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
};

/**
 * POST /api/analytics — Rebuild and cache link index
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  let body: { site: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { site } = body;
  if (!site) {
    return Response.json({ ok: false, error: 'Missing site' }, { status: 400 });
  }

  try {
    const { links, pages } = await buildLinkIndex(env, site);

    // Cache the link index in R2 for faster subsequent queries
    const indexData = {
      links,
      pages: Object.fromEntries(pages),
      builtAt: new Date().toISOString(),
    };

    await env.BLOXX_SITES.put(
      `${site}/analytics/link-index.json`,
      JSON.stringify(indexData, null, 2),
      { httpMetadata: { contentType: 'application/json' } }
    );

    const linkReport = generateLinkReport(links, pages);
    const orphanReport = findOrphanPages(links, pages);

    return Response.json({
      ok: true,
      indexed: true,
      links: linkReport,
      orphans: orphanReport,
    });
  } catch (err: any) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
};
