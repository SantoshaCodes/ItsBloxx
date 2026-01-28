/**
 * /api/collection-page — Render a collection item as a page
 *
 * GET /api/collection-page?site={site}&collection={collection}&item={itemSlug}
 *
 * This endpoint:
 * 1. Fetches the collection template (stored as {collection}-template.html)
 * 2. Fetches the collection item data
 * 3. Renders the template with item data (using {{field}} placeholders)
 * 4. Returns the rendered HTML
 */

import { parseHTML } from 'linkedom';

interface Env {
  BLOXX_SITES: R2Bucket;
}

interface CollectionItem {
  id: number;
  collectionId: number;
  slug: string;
  data: Record<string, any>;
  status: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface Collection {
  id: number;
  siteId: number;
  name: string;
  slug: string;
  description?: string;
  schema: {
    fields: Array<{
      id: string;
      name: string;
      type: string;
      required?: boolean;
      isSlugSource?: boolean;
    }>;
  };
}

/**
 * Replace template placeholders with item data
 * Supports: {{field}}, {{field.nested}}, and conditional {{#if field}}...{{/if}}
 */
function renderTemplate(html: string, item: CollectionItem, collection: Collection): string {
  const { document } = parseHTML(html);
  let result = html;

  // Simple field replacement: {{fieldName}}
  result = result.replace(/\{\{([^#/}]+)\}\}/g, (match, fieldPath) => {
    const path = fieldPath.trim().split('.');
    let value: any = item.data;

    // Handle special fields
    if (path[0] === '_slug') return item.slug;
    if (path[0] === '_createdAt') return new Date(item.createdAt).toLocaleDateString();
    if (path[0] === '_updatedAt') return new Date(item.updatedAt).toLocaleDateString();
    if (path[0] === '_publishedAt') return item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : '';
    if (path[0] === '_status') return item.status;
    if (path[0] === '_collection') return collection.name;

    // Navigate nested paths
    for (const key of path) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return ''; // Field not found
      }
    }

    // Handle different types
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });

  // Conditional blocks: {{#if field}}...{{/if}}
  result = result.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, fieldPath, content) => {
    const path = fieldPath.trim().split('.');
    let value: any = item.data;

    for (const key of path) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        value = null;
        break;
      }
    }

    // Truthy check
    if (value && (Array.isArray(value) ? value.length > 0 : true)) {
      return content;
    }
    return '';
  });

  // Loop blocks: {{#each items}}...{{/each}}
  result = result.replace(/\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, fieldPath, template) => {
    const path = fieldPath.trim().split('.');
    let value: any = item.data;

    for (const key of path) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        value = null;
        break;
      }
    }

    if (!Array.isArray(value)) return '';

    return value.map((itemValue: any, index: number) => {
      let itemResult = template;
      // Replace {{this}} with the current item
      if (typeof itemValue === 'object') {
        Object.keys(itemValue).forEach(key => {
          itemResult = itemResult.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(itemValue[key] || ''));
        });
        itemResult = itemResult.replace(/\{\{this\}\}/g, JSON.stringify(itemValue));
      } else {
        itemResult = itemResult.replace(/\{\{this\}\}/g, String(itemValue));
      }
      itemResult = itemResult.replace(/\{\{@index\}\}/g, String(index));
      return itemResult;
    }).join('');
  });

  // Update page title and meta
  const titleField = collection.schema.fields.find(f => f.id === 'title' || f.id === 'name');
  if (titleField && item.data[titleField.id]) {
    result = result.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(item.data[titleField.id])}</title>`);
  }

  const descField = collection.schema.fields.find(f => f.id === 'description' || f.id === 'excerpt');
  if (descField && item.data[descField.id]) {
    const desc = item.data[descField.id].substring(0, 160);
    result = result.replace(
      /<meta\s+name="description"\s+content="[^"]*"/,
      `<meta name="description" content="${escapeHtml(desc)}"`
    );
  }

  return result;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * GET /api/collection-page
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const url = new URL(context.request.url);

  const site = url.searchParams.get('site');
  const collectionSlug = url.searchParams.get('collection');
  const itemSlug = url.searchParams.get('item');

  if (!site || !collectionSlug || !itemSlug) {
    return Response.json({ ok: false, error: 'Missing site, collection, or item parameter' }, { status: 400 });
  }

  try {
    // Fetch collection definition
    const collectionKey = `${site}/collections/${collectionSlug}.json`;
    const collectionObj = await env.BLOXX_SITES.get(collectionKey);
    if (!collectionObj) {
      return Response.json({ ok: false, error: 'Collection not found' }, { status: 404 });
    }
    const collection = await collectionObj.json() as Collection;

    // Fetch item
    const itemKey = `${site}/collections/${collectionSlug}/items/${itemSlug}.json`;
    const itemObj = await env.BLOXX_SITES.get(itemKey);
    if (!itemObj) {
      return Response.json({ ok: false, error: 'Item not found' }, { status: 404 });
    }
    const item = await itemObj.json() as CollectionItem;

    // Check if item is published (optional - for live sites)
    const requirePublished = url.searchParams.get('published') === 'true';
    if (requirePublished && item.status !== 'published') {
      return Response.json({ ok: false, error: 'Item not published' }, { status: 404 });
    }

    // Fetch template
    const templateKey = `${site}/drafts/${collectionSlug}-template.html`;
    let templateObj = await env.BLOXX_SITES.get(templateKey);

    // Fallback: try collection-specific template in collections folder
    if (!templateObj) {
      const altTemplateKey = `${site}/collections/${collectionSlug}/template.html`;
      templateObj = await env.BLOXX_SITES.get(altTemplateKey);
    }

    // Fallback: use a default template
    if (!templateObj) {
      // Generate a simple default template
      const defaultTemplate = generateDefaultTemplate(collection, site);
      return new Response(renderTemplate(defaultTemplate, item, collection), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    const template = await templateObj.text();
    const rendered = renderTemplate(template, item, collection);

    return new Response(rendered, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60'
      }
    });
  } catch (err: any) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
};

/**
 * Generate a default template for a collection
 */
function generateDefaultTemplate(collection: Collection, site: string): string {
  const fields = collection.schema.fields;
  const titleField = fields.find(f => f.id === 'title' || f.id === 'name')?.id || 'title';
  const imageField = fields.find(f => f.type === 'image')?.id;
  const contentField = fields.find(f => f.type === 'richtext' || f.id === 'content' || f.id === 'body')?.id;

  let fieldsHtml = '';
  fields.forEach(field => {
    if (field.id === titleField || field.id === imageField || field.id === contentField) return;
    if (field.type === 'image') {
      fieldsHtml += `
        {{#if ${field.id}}}
        <figure class="my-4">
          <img src="{{${field.id}}}" alt="${field.name}" class="img-fluid rounded">
        </figure>
        {{/if}}`;
    } else if (field.type === 'array') {
      fieldsHtml += `
        {{#if ${field.id}}}
        <div class="mb-3">
          <strong>${field.name}:</strong>
          <ul>
            {{#each ${field.id}}}<li>{{this}}</li>{{/each}}
          </ul>
        </div>
        {{/if}}`;
    } else {
      fieldsHtml += `
        {{#if ${field.id}}}
        <p><strong>${field.name}:</strong> {{${field.id}}}</p>
        {{/if}}`;
    }
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{${titleField}}} | ${site}</title>
  <meta name="description" content="{{description}}">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body>
  <main class="container py-5">
    <article class="mx-auto" style="max-width: 800px;">
      ${imageField ? `
      {{#if ${imageField}}}
      <img src="{{${imageField}}}" alt="{{${titleField}}}" class="img-fluid rounded mb-4 w-100" style="max-height: 400px; object-fit: cover;">
      {{/if}}` : ''}

      <h1 class="mb-3">{{${titleField}}}</h1>

      <div class="text-muted mb-4">
        <small>Published {{_publishedAt}} &bull; {{_collection}}</small>
      </div>

      ${contentField ? `
      <div class="content">
        {{${contentField}}}
      </div>` : ''}

      ${fieldsHtml}

      <hr class="my-5">
      <a href="/${collectionSlug}" class="btn btn-outline-primary">&larr; Back to ${collection.name}</a>
    </article>
  </main>
</body>
</html>`;
}

/**
 * POST /api/collection-page — Save a collection template
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  let body: { site: string; collection: string; html: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { site, collection, html } = body;
  if (!site || !collection || !html) {
    return Response.json({ ok: false, error: 'Missing site, collection, or html' }, { status: 400 });
  }

  // Save template
  const templateKey = `${site}/drafts/${collection}-template.html`;
  await env.BLOXX_SITES.put(templateKey, html, {
    httpMetadata: { contentType: 'text/html' }
  });

  return Response.json({ ok: true });
};
