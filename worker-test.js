// 最小测试版 Worker — 只测 DO 是否正常
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export class ChatRoom {
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
    if (url.pathname.includes('/reset')) {
      await this.state.storage.put('counter', 0);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    if (request.headers.get('Upgrade') === 'websocket') {
      const [client, server] = Object.values(new WebSocketPair());
      server.accept();
      server.addEventListener('message', (e) => { server.send(e.data); });
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response('ok', { headers: CORS });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.includes('/register') || url.pathname.includes('/reset')) {
      const id = env.CHAT_ROOM.idFromName('shard-0');
      return env.CHAT_ROOM.get(id).fetch(request);
    }
    let uid = url.searchParams.get('uid');
    const id = env.CHAT_ROOM.idFromName('shard-' + (Math.floor((parseInt(uid)||0)/8)));
    return env.CHAT_ROOM.get(id).fetch(request);
  }
};
