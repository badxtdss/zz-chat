// Cloudflare Worker — 爪爪 v5
// WebSocket OpenClaw + 好友请求(追加) + 信令队列(追加) + 聊天降级
// 部署: wrangler deploy

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ─── 好友请求（追加队列）────────────────────────────────
async function handleFriend(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const url = new URL(request.url);
  const uid = url.searchParams.get('uid');
  if (!uid) return new Response(JSON.stringify({ error: 'uid required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
  const key = `friend_${uid}`;

  if (request.method === 'GET') {
    const raw = await env.ZZ_STORE.get(key);
    return new Response(raw || '[]', { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
  if (request.method === 'DELETE') {
    await env.ZZ_STORE.put(key, '[]');
    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
  if (request.method === 'PUT') {
    const body = await request.json();
    const raw = await env.ZZ_STORE.get(key);
    const list = raw ? JSON.parse(raw) : [];
    if (!list.some(r => r.from === body.from)) {
      list.push(body);
      if (list.length > 50) list.splice(0, list.length - 50);
      await env.ZZ_STORE.put(key, JSON.stringify(list));
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
  return new Response('Method not allowed', { status: 405, headers: CORS });
}

// ─── WebRTC 信令（追加队列，不覆盖）────────────────────
async function handleSignaling(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const url = new URL(request.url);
  const uid = url.searchParams.get('uid');
  if (!uid) return new Response(JSON.stringify({ error: 'uid required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
  const key = `signal_${uid}`;

  // GET: 返回所有待处理信令
  if (request.method === 'GET') {
    const raw = await env.ZZ_STORE.get(key);
    return new Response(raw || '[]', { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  // POST: 追加信令（不覆盖）
  if (request.method === 'POST') {
    const body = await request.json();
    const raw = await env.ZZ_STORE.get(key);
    const queue = raw ? JSON.parse(raw) : [];
    queue.push(body);
    if (queue.length > 30) queue.splice(0, queue.length - 30);
    await env.ZZ_STORE.put(key, JSON.stringify(queue));
    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  // DELETE: 清空信令队列
  if (request.method === 'DELETE') {
    await env.ZZ_STORE.put(key, '[]');
    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  return new Response('Method not allowed', { status: 405, headers: CORS });
}

// ─── 聊天降级（P2P 不通时用）──────────────────────────
async function handleChat(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const url = new URL(request.url);
  const uid = url.searchParams.get('uid');
  if (!uid) return new Response(JSON.stringify({ error: 'uid required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
  const key = `chat_${uid}`;

  if (request.method === 'GET') {
    const raw = await env.ZZ_STORE.get(key);
    return new Response(raw || '[]', { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
  if (request.method === 'PUT') {
    const body = await request.json();
    const raw = await env.ZZ_STORE.get(key);
    const queue = raw ? JSON.parse(raw) : [];
    queue.push(body);
    if (queue.length > 100) queue.splice(0, queue.length - 100);
    await env.ZZ_STORE.put(key, JSON.stringify(queue));
    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
  if (request.method === 'DELETE') {
    await env.ZZ_STORE.put(key, '[]');
    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
  return new Response('Method not allowed', { status: 405, headers: CORS });
}

// ─── OpenClaw Durable Object ──────────────────────────
export class ChatRoom {
  constructor(state, env) { this.state = state; this.env = env; this.bridge = null; this.phone = null; this.pendingMsg = null; }
  async fetch(request) {
    const url = new URL(request.url);
    if (request.headers.get('Upgrade') === 'websocket') {
      const [client, server] = Object.values(new WebSocketPair());
      await this.handleSession(server, url.searchParams);
      return new Response(null, { status: 101, webSocket: client });
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method === 'GET') {
      return new Response(JSON.stringify(this.pendingMsg || { from:'', to:'', content:'', msg_id:'', ts:0, isImage:false }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    if (request.method === 'PUT') {
      const body = await request.json();
      this.pendingMsg = body;
      if (this.bridge) try { this.bridge.send(JSON.stringify(body)); } catch {}
      return new Response(JSON.stringify(body), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    return new Response('Not found', { status: 404 });
  }
  handleSession(ws, params) {
    ws.accept();
    const role = params.get('role');
    if (role === 'bridge') { this.bridge = ws; if (this.pendingMsg && this.pendingMsg.content) try { ws.send(JSON.stringify(this.pendingMsg)); } catch {} }
    else { this.phone = ws; }
    ws.addEventListener('message', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (role === 'phone') { if (this.bridge) try { this.bridge.send(JSON.stringify(data)); } catch {} }
        else { this.pendingMsg = data; if (this.phone) try { this.phone.send(JSON.stringify(data)); } catch {} }
      } catch {}
    });
    ws.addEventListener('close', () => { if (role === 'bridge') this.bridge = null; else this.phone = null; });
    ws.addEventListener('error', () => { if (role === 'bridge') this.bridge = null; else this.phone = null; });
  }
}

// ─── 入口 ─────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.includes('/signal')) return handleSignaling(request, env);
    if (url.pathname.includes('/friend')) return handleFriend(request, env);
    if (url.pathname.includes('/chat')) return handleChat(request, env);
    const id = env.CHAT_ROOM.idFromName('openclaw');
    const room = env.CHAT_ROOM.get(id);
    return room.fetch(request);
  }
};
