// Cloudflare Worker — 爪爪 v8
// 编号自增 + 自动清理 + 多 bridge 路由
// 部署: wrangler deploy

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const HOUR = 3600000;
const DAY = 86400000;

// ─── 注册（编号自增）─────────────────────────────────
async function handleRegister(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: CORS });

  const id = env.CHAT_ROOM.idFromName('openclaw');
  const room = env.CHAT_ROOM.get(id);
  return room.fetch(new Request('https://internal/register', { method: 'GET' }));
}

// ─── 清理 ─────────────────────────────────────────────
async function handleCleanup(env) {
  const now = Date.now();
  let cursor;
  let deleted = 0;
  let checked = 0;
  let listed;
  do {
    listed = await env.ZZ_STORE.list({ prefix: 'user_', cursor });
    for (const key of listed.keys) {
      checked++;
      try {
        const user = JSON.parse(await env.ZZ_STORE.get(key.name));
        let shouldDelete = false;
        if (!user.lastActive && (now - user.created > HOUR)) shouldDelete = true;
        if (user.lastActive && (now - user.lastActive > DAY)) shouldDelete = true;
        if (shouldDelete) {
          await env.ZZ_STORE.delete(key.name);
          deleted++;
        }
      } catch {}
    }
    cursor = listed.cursor;
  } while (!listed.list_complete);
  return { checked, deleted };
}

// ─── Durable Object ───────────────────────────────────
export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.bridges = {};
    this.pendingMsg = {};
  }

  async fetch(request) {
    const url = new URL(request.url);

    // 注册
    if (url.pathname === '/register') {
      const nextId = (await this.state.storage.get('counter') || 0) + 1;
      await this.state.storage.put('counter', nextId);
      const uid = String(nextId);
      await this.env.ZZ_STORE.put(`user_${uid}`, JSON.stringify({ created: Date.now(), lastActive: 0 }));
      return new Response(JSON.stringify({ id: uid }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // 清理
    if (url.pathname === '/cleanup') {
      const result = await handleCleanup(this.env);
      return new Response(JSON.stringify(result), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // WebSocket（bridge 用）
    if (request.headers.get('Upgrade') === 'websocket') {
      const [client, server] = Object.values(new WebSocketPair());
      await this.handleSession(server, url.searchParams);
      return new Response(null, { status: 101, webSocket: client });
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    // GET — 手机轮询消息
    if (request.method === 'GET') {
      const uid = url.searchParams.get('uid');
      if (uid && this.pendingMsg[uid]) {
        return new Response(JSON.stringify(this.pendingMsg[uid]), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ from:'', to:'', content:'', msg_id:'', ts:0, isImage:false }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // PUT — 发消息
    if (request.method === 'PUT') {
      const body = await request.json();
      const to = body.to;
      if (to) this.pendingMsg[to] = body;
      // 消息发给目标 bridge
      const targetBridge = this.bridges['D' + to];
      if (targetBridge && body.content) {
        try { targetBridge.send(JSON.stringify(body)); } catch {}
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    return new Response('Not found', { status: 404 });
  }

  handleSession(ws, params) {
    ws.accept();
    const uid = params.get('uid');

    // 只有 bridge 走 WebSocket
    this.bridges['D' + (uid || '0')] = ws;

    ws.addEventListener('message', (e) => {
      try {
        const data = JSON.parse(e.data);
        const to = data.to;
        if (to) this.pendingMsg[to] = data;
      } catch {}
    });

    ws.addEventListener('close', () => {
      delete this.bridges['D' + (uid || '0')];
    });
    ws.addEventListener('error', () => {
      delete this.bridges['D' + (uid || '0')];
    });
  }
}

// ─── 入口 ─────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.includes('/register')) return handleRegister(request, env);
    const id = env.CHAT_ROOM.idFromName('openclaw');
    const room = env.CHAT_ROOM.get(id);
    return room.fetch(request);
  },
  async scheduled(event, env) {
    const result = await handleCleanup(env);
    console.log(`[cleanup] checked=${result.checked} deleted=${result.deleted}`);
  }
};
