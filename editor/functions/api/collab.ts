/**
 * GET /api/collab?site={site}&page={page} — WebSocket upgrade for real-time collaboration
 *
 * Proxies to a Durable Object (CollabRoom) that manages connected editors.
 * Each site/page combination gets its own room.
 *
 * Protocol (JSON over WebSocket):
 *   Client → Server:
 *     { type: "cursor", user, x, y }           — cursor position
 *     { type: "select", user, selector }        — element selection
 *     { type: "edit", user, selector, prop, value } — edit operation
 *
 *   Server → Client:
 *     { type: "cursor", user, x, y }            — remote cursor
 *     { type: "select", user, selector }         — remote selection
 *     { type: "edit", user, selector, prop, value } — remote edit
 *     { type: "users", users: string[] }         — connected users list
 *     { type: "bloxx:remote-save", site, page, etag } — save notification
 */

interface Env {
  COLLAB_ROOM: DurableObjectNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const site = url.searchParams.get('site');
  const page = url.searchParams.get('page');

  if (!site || !page) {
    return Response.json({ error: 'Missing ?site= or ?page= parameter' }, { status: 400 });
  }

  const roomId = context.env.COLLAB_ROOM.idFromName(`${site}/${page}`);
  const room = context.env.COLLAB_ROOM.get(roomId);

  // Forward the WebSocket upgrade request to the Durable Object
  return room.fetch(context.request);
};
