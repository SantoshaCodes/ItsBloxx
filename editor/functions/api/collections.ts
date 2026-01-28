/**
 * /api/collections — CRUD operations for collections and collection items
 *
 * Collections are stored in R2:
 * - Collection definitions: {site}/collections/{slug}.json
 * - Collection items: {site}/collections/{slug}/items/{itemSlug}.json
 * - Collection index: {site}/collections/{slug}/index.json (item list)
 */

import {
  type Collection,
  type CollectionItem,
  type CollectionSchema,
  type ItemStatus,
  COLLECTION_PRESETS,
  generateSlug,
  validateItemData,
  getItemTitle,
} from '../../lib/collections';

interface Env {
  BLOXX_SITES: R2Bucket;
}

// ─────────────────────────────────────────────────────────────────────────────
// COLLECTIONS CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/collections?site={site}
 * List all collections for a site
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const url = new URL(context.request.url);
  const site = url.searchParams.get('site');
  const collectionSlug = url.searchParams.get('collection');

  if (!site) {
    return Response.json({ ok: false, error: 'Missing site parameter' }, { status: 400 });
  }

  // If collection slug provided, return that collection with items
  if (collectionSlug) {
    return getCollectionWithItems(env, site, collectionSlug);
  }

  // List all collections
  const prefix = `${site}/collections/`;
  const list = await env.BLOXX_SITES.list({ prefix });

  const collections: Collection[] = [];
  const seen = new Set<string>();

  for (const obj of list.objects) {
    // Match collection definition files (not items)
    const match = obj.key.match(/\/collections\/([^/]+)\.json$/);
    if (match && !seen.has(match[1])) {
      seen.add(match[1]);
      const collectionObj = await env.BLOXX_SITES.get(obj.key);
      if (collectionObj) {
        try {
          const collection = await collectionObj.json() as Collection;
          collections.push(collection);
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }

  return Response.json({ ok: true, collections });
};

/**
 * Get a single collection with its items
 */
async function getCollectionWithItems(env: Env, site: string, slug: string) {
  const collectionKey = `${site}/collections/${slug}.json`;
  const collectionObj = await env.BLOXX_SITES.get(collectionKey);

  if (!collectionObj) {
    return Response.json({ ok: false, error: 'Collection not found' }, { status: 404 });
  }

  const collection = await collectionObj.json() as Collection;

  // Get items index
  const indexKey = `${site}/collections/${slug}/index.json`;
  const indexObj = await env.BLOXX_SITES.get(indexKey);

  let items: CollectionItem[] = [];
  if (indexObj) {
    try {
      items = await indexObj.json() as CollectionItem[];
    } catch {
      items = [];
    }
  }

  return Response.json({ ok: true, collection, items });
}

/**
 * POST /api/collections — Create a new collection
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const url = new URL(request.url);

  // Check if this is an item creation (has collection param)
  const collectionSlug = url.searchParams.get('collection');
  if (collectionSlug) {
    return createCollectionItem(env, request, collectionSlug);
  }

  // Create collection
  let body: {
    site: string;
    name: string;
    slug?: string;
    description?: string;
    schema?: CollectionSchema;
    preset?: string;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { site, name, description, preset } = body;

  if (!site || !name) {
    return Response.json({ ok: false, error: 'Missing site or name' }, { status: 400 });
  }

  const slug = body.slug || generateSlug(name);

  // Check if collection already exists
  const existingKey = `${site}/collections/${slug}.json`;
  const existing = await env.BLOXX_SITES.head(existingKey);
  if (existing) {
    return Response.json({ ok: false, error: 'Collection with this slug already exists' }, { status: 409 });
  }

  // Get schema from preset or provided schema
  let schema: CollectionSchema;
  if (preset && COLLECTION_PRESETS[preset]) {
    schema = COLLECTION_PRESETS[preset];
  } else if (body.schema) {
    schema = body.schema;
  } else {
    return Response.json({ ok: false, error: 'Missing schema or preset' }, { status: 400 });
  }

  const collection: Collection = {
    id: Date.now(), // Simple ID generation
    siteId: 0, // Would be set by Xano in production
    name,
    slug,
    description,
    schema,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Save collection definition
  await env.BLOXX_SITES.put(existingKey, JSON.stringify(collection, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });

  // Create empty items index
  const indexKey = `${site}/collections/${slug}/index.json`;
  await env.BLOXX_SITES.put(indexKey, '[]', {
    httpMetadata: { contentType: 'application/json' },
  });

  return Response.json({ ok: true, collection });
};

/**
 * Create a new collection item
 */
async function createCollectionItem(env: Env, request: Request, collectionSlug: string) {
  let body: {
    site: string;
    data: Record<string, any>;
    status?: ItemStatus;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { site, data, status = 'draft' } = body;

  if (!site || !data) {
    return Response.json({ ok: false, error: 'Missing site or data' }, { status: 400 });
  }

  // Get collection
  const collectionKey = `${site}/collections/${collectionSlug}.json`;
  const collectionObj = await env.BLOXX_SITES.get(collectionKey);

  if (!collectionObj) {
    return Response.json({ ok: false, error: 'Collection not found' }, { status: 404 });
  }

  const collection = await collectionObj.json() as Collection;

  // Validate data
  const validation = validateItemData(data, collection.schema);
  if (!validation.valid) {
    return Response.json({ ok: false, error: 'Validation failed', errors: validation.errors }, { status: 400 });
  }

  // Generate slug from slug source field
  const slugSourceField = collection.schema.fields.find(f => f.isSlugSource);
  const itemSlug = slugSourceField && data[slugSourceField.id]
    ? generateSlug(data[slugSourceField.id])
    : generateSlug(`item-${Date.now()}`);

  const item: CollectionItem = {
    id: Date.now(),
    collectionId: collection.id,
    slug: itemSlug,
    data,
    status,
    publishedAt: status === 'published' ? new Date().toISOString() : undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Save item
  const itemKey = `${site}/collections/${collectionSlug}/items/${itemSlug}.json`;
  await env.BLOXX_SITES.put(itemKey, JSON.stringify(item, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });

  // Update index
  const indexKey = `${site}/collections/${collectionSlug}/index.json`;
  const indexObj = await env.BLOXX_SITES.get(indexKey);
  let items: CollectionItem[] = [];
  if (indexObj) {
    try {
      items = await indexObj.json() as CollectionItem[];
    } catch {
      items = [];
    }
  }
  items.push(item);

  await env.BLOXX_SITES.put(indexKey, JSON.stringify(items, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });

  return Response.json({ ok: true, item });
}

/**
 * PUT /api/collections — Update collection or item
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const url = new URL(request.url);

  const collectionSlug = url.searchParams.get('collection');
  const itemSlug = url.searchParams.get('item');

  if (itemSlug && collectionSlug) {
    return updateCollectionItem(env, request, collectionSlug, itemSlug);
  }

  if (collectionSlug) {
    return updateCollection(env, request, collectionSlug);
  }

  return Response.json({ ok: false, error: 'Missing collection parameter' }, { status: 400 });
};

/**
 * Update a collection
 */
async function updateCollection(env: Env, request: Request, slug: string) {
  let body: {
    site: string;
    name?: string;
    description?: string;
    schema?: CollectionSchema;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { site } = body;

  if (!site) {
    return Response.json({ ok: false, error: 'Missing site' }, { status: 400 });
  }

  const collectionKey = `${site}/collections/${slug}.json`;
  const collectionObj = await env.BLOXX_SITES.get(collectionKey);

  if (!collectionObj) {
    return Response.json({ ok: false, error: 'Collection not found' }, { status: 404 });
  }

  const collection = await collectionObj.json() as Collection;

  // Update fields
  if (body.name) collection.name = body.name;
  if (body.description !== undefined) collection.description = body.description;
  if (body.schema) collection.schema = body.schema;
  collection.updatedAt = new Date().toISOString();

  // Save
  await env.BLOXX_SITES.put(collectionKey, JSON.stringify(collection, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });

  return Response.json({ ok: true, collection });
}

/**
 * Update a collection item
 */
async function updateCollectionItem(env: Env, request: Request, collectionSlug: string, itemSlug: string) {
  let body: {
    site: string;
    data?: Record<string, any>;
    status?: ItemStatus;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { site, data, status } = body;

  if (!site) {
    return Response.json({ ok: false, error: 'Missing site' }, { status: 400 });
  }

  // Get collection for validation
  const collectionKey = `${site}/collections/${collectionSlug}.json`;
  const collectionObj = await env.BLOXX_SITES.get(collectionKey);

  if (!collectionObj) {
    return Response.json({ ok: false, error: 'Collection not found' }, { status: 404 });
  }

  const collection = await collectionObj.json() as Collection;

  // Get item
  const itemKey = `${site}/collections/${collectionSlug}/items/${itemSlug}.json`;
  const itemObj = await env.BLOXX_SITES.get(itemKey);

  if (!itemObj) {
    return Response.json({ ok: false, error: 'Item not found' }, { status: 404 });
  }

  const item = await itemObj.json() as CollectionItem;

  // Validate data if provided
  if (data) {
    const validation = validateItemData(data, collection.schema);
    if (!validation.valid) {
      return Response.json({ ok: false, error: 'Validation failed', errors: validation.errors }, { status: 400 });
    }
    item.data = data;
  }

  // Update status
  if (status) {
    item.status = status;
    if (status === 'published' && !item.publishedAt) {
      item.publishedAt = new Date().toISOString();
    }
  }

  item.updatedAt = new Date().toISOString();

  // Save item
  await env.BLOXX_SITES.put(itemKey, JSON.stringify(item, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });

  // Update index
  await updateItemInIndex(env, site, collectionSlug, item);

  return Response.json({ ok: true, item });
}

/**
 * Update item in the index file
 */
async function updateItemInIndex(env: Env, site: string, collectionSlug: string, updatedItem: CollectionItem) {
  const indexKey = `${site}/collections/${collectionSlug}/index.json`;
  const indexObj = await env.BLOXX_SITES.get(indexKey);

  let items: CollectionItem[] = [];
  if (indexObj) {
    try {
      items = await indexObj.json() as CollectionItem[];
    } catch {
      items = [];
    }
  }

  // Find and update item
  const idx = items.findIndex(i => i.slug === updatedItem.slug);
  if (idx >= 0) {
    items[idx] = updatedItem;
  } else {
    items.push(updatedItem);
  }

  await env.BLOXX_SITES.put(indexKey, JSON.stringify(items, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });
}

/**
 * DELETE /api/collections — Delete collection or item
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const url = new URL(context.request.url);

  const site = url.searchParams.get('site');
  const collectionSlug = url.searchParams.get('collection');
  const itemSlug = url.searchParams.get('item');

  if (!site || !collectionSlug) {
    return Response.json({ ok: false, error: 'Missing site or collection parameter' }, { status: 400 });
  }

  if (itemSlug) {
    return deleteCollectionItem(env, site, collectionSlug, itemSlug);
  }

  return deleteCollection(env, site, collectionSlug);
};

/**
 * Delete a collection and all its items
 */
async function deleteCollection(env: Env, site: string, slug: string) {
  // Delete collection definition
  await env.BLOXX_SITES.delete(`${site}/collections/${slug}.json`);

  // Delete all items
  const prefix = `${site}/collections/${slug}/`;
  const list = await env.BLOXX_SITES.list({ prefix });

  for (const obj of list.objects) {
    await env.BLOXX_SITES.delete(obj.key);
  }

  return Response.json({ ok: true });
}

/**
 * Delete a collection item
 */
async function deleteCollectionItem(env: Env, site: string, collectionSlug: string, itemSlug: string) {
  // Delete item file
  await env.BLOXX_SITES.delete(`${site}/collections/${collectionSlug}/items/${itemSlug}.json`);

  // Update index
  const indexKey = `${site}/collections/${collectionSlug}/index.json`;
  const indexObj = await env.BLOXX_SITES.get(indexKey);

  if (indexObj) {
    try {
      let items = await indexObj.json() as CollectionItem[];
      items = items.filter(i => i.slug !== itemSlug);
      await env.BLOXX_SITES.put(indexKey, JSON.stringify(items, null, 2), {
        httpMetadata: { contentType: 'application/json' },
      });
    } catch {
      // Ignore index update errors
    }
  }

  return Response.json({ ok: true });
}
