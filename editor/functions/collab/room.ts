/**
 * CollabRoom — Durable Object for real-time collaboration
 *
 * Each site/page pair gets its own room. Connected WebSocket clients
 * receive broadcasts of cursor movements, selections, and edits.
 */

interface User {
  ws: WebSocket;
  name: string;
  color: string;
}

const COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4',
];

export class CollabRoom {
  private state: DurableObjectState;
  private users: Map<WebSocket, User> = new Map();
  private nextColorIdx = 0;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Internal broadcast endpoint (called from save.ts)
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      const data = await request.text();
      this.broadcast(data, null);
      return new Response('ok');
    }

    // WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    const userName = new URL(request.url).searchParams.get('user') || `User ${this.users.size + 1}`;
    const color = COLORS[this.nextColorIdx % COLORS.length];
    this.nextColorIdx++;

    const user: User = { ws: server, name: userName, color };

    server.accept();
    this.users.set(server, user);

    // Send current users list to new joiner
    server.send(JSON.stringify({
      type: 'users',
      users: Array.from(this.users.values()).map(u => ({ name: u.name, color: u.color })),
    }));

    // Notify all about new user
    this.broadcastUsers();

    server.addEventListener('message', (event) => {
      const data = typeof event.data === 'string' ? event.data : '';
      try {
        const msg = JSON.parse(data);
        // Attach user info and broadcast to others
        msg.user = userName;
        msg.color = color;
        this.broadcast(JSON.stringify(msg), server);
      } catch { /* ignore malformed */ }
    });

    server.addEventListener('close', () => {
      this.users.delete(server);
      this.broadcastUsers();
    });

    server.addEventListener('error', () => {
      this.users.delete(server);
      this.broadcastUsers();
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  private broadcast(message: string, exclude: WebSocket | null) {
    for (const [ws] of this.users) {
      if (ws === exclude) continue;
      try {
        ws.send(message);
      } catch {
        this.users.delete(ws);
      }
    }
  }

  private broadcastUsers() {
    const userList = Array.from(this.users.values()).map(u => ({ name: u.name, color: u.color }));
    this.broadcast(JSON.stringify({ type: 'users', users: userList }), null);
  }
}
