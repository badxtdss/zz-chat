const CORS = { 'Access-Control-Allow-Origin': '*' };

export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.includes('/register')) {
      const nextId = (await this.state.storage.get('counter') || 0) + 1;
      await this.state.storage.put('counter', nextId);
      return new Response(JSON.stringify({ id: String(nextId) }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    if (request.headers.get('Upgrade') === 'websocket') {
      const [client, server] = Object.values(new WebSocketPair());
      server.accept();
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response('ok', { headers: CORS });
  }
}

export default {
  async fetch(request, env) {
    const id = env.ROOM.idFromName('shard-0');
    return env.ROOM.get(id).fetch(request);
  }
};
