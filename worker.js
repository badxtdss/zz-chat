// Cloudflare Worker — 爪爪 v6
// 多 bridge 路由 + 好友请求 + 信令 + 聊天降级
// 部署: wrangler deploy

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ─── 好友请求 ─────────────────────────────────────────
async function handleFriend(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const url = new URL(request.url);
  const uid = url.searchParams.get('uid');
  if (!uid) return new Response(JSON.stringify({ error: 'uid required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
  const key = `friend_${uid}`;
  if (request.method === 'GET') { return new Response(await env.ZZ_STORE.get(key) || '[]', { headers: { ...CORS, 'Content-Type': 'application/json' } }); }
  if (request.method === 'DELETE') { await env.ZZ_STORE.put(key, '[]'); return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } }); }
  if (request.method === 'PUT') {
    const body = await request.json();
    const raw = await env.ZZ_STORE.get(key);
    const list = raw ? JSON.parse(raw) : [];
    if (!list.some(r => r.from === body.from)) { list.push(body); if (list.length > 50) list.splice(0, list.length - 50); await env.ZZ_STORE.put(key, JSON.stringify(list)); }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
  return new Response('Method not allowed', { status: 405, headers: CORS });
}

// ─── WebRTC 信令 ──────────────────────────────────────
async function handleSignaling(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const url = new URL(request.url);
  const uid = url.searchParams.get('uid');
  if (!uid) return new Response(JSON.stringify({ error: 'uid required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
  const key = `signal_${uid}`;
  if (request.method === 'GET') { return new Response(await env.ZZ_STORE.get(key) || '[]', { headers: { ...CORS, 'Content-Type': 'application/json' } }); }
  if (request.method === 'POST') { const body = await request.json(); const raw = await env.ZZ_STORE.get(key); const q = raw ? JSON.parse(raw) : []; q.push(body); if (q.length > 30) q.splice(0, q.length - 30); await env.ZZ_STORE.put(key, JSON.stringify(q)); return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } }); }
  if (request.method === 'DELETE') { await env.ZZ_STORE.put(key, '[]'); return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } }); }
  return new Response('Method not allowed', { status: 405, headers: CORS });
}

// ─── 聊天降级 ─────────────────────────────────────────
async function handleChat(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const url = new URL(request.url);
  const uid = url.searchParams.get('uid');
  if (!uid) return new Response(JSON.stringify({ error: 'uid required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
  const key = `chat_${uid}`;
  if (request.method === 'GET') { return new Response(await env.ZZ_STORE.get(key) || '[]', { headers: { ...CORS, 'Content-Type': 'application/json' } }); }
  if (request.method === 'PUT') { const body = await request.json(); const raw = await env.ZZ_STORE.get(key); const q = raw ? JSON.parse(raw) : []; q.push(body); if (q.length > 100) q.splice(0, q.length - 100); await env.ZZ_STORE.put(key, JSON.stringify(q)); return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } }); }
  if (request.method === 'DELETE') { await env.ZZ_STORE.put(key, '[]'); return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } }); }
  return new Response('Method not allowed', { status: 405, headers: CORS });
}

// ─── OpenClaw Durable Object ──────────────────────────
export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.bridges = {};    // { "D628": ws, "D47": ws, ... }
    this.phones = {};     // { "628": ws, "47": ws, ... }
    this.pendingMsg = {}; // { "628": {...}, "47": {...} } 最近消息
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.headers.get('Upgrade') === 'websocket') {
      const [client, server] = Object.values(new WebSocketPair());
      await this.handleSession(server, url.searchParams);
      return new Response(null, { status: 101, webSocket: client });
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    // REST：获取指定用户的最新消息
    const uid = url.searchParams.get('uid');
    if (request.method === 'GET') {
      if (uid && this.pendingMsg[uid]) {
        return new Response(JSON.stringify(this.pendingMsg[uid]), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ from:'', to:'', content:'', msg_id:'', ts:0, isImage:false }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    // REST：发送消息（手机或 bridge 用）
    if (request.method === 'PUT') {
      const body = await request.json();
      const to = body.to;
      if (to) this.pendingMsg[to] = body;
      // 消息发给目标用户的 bridge
      const targetBridge = this.bridges['D' + to];
      if (targetBridge && body.content) {
        try { targetBridge.send(JSON.stringify(body)); } catch {}
      }
      // bridge 的回复推给目标手机
      if (to && this.phones[to]) try { this.phones[to].send(JSON.stringify(body)); } catch {}
      return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    return new Response('Not found', { status: 404 });
  }

  handleSession(ws, params) {
    ws.accept();
    const role = params.get('role');
    const uid = params.get('uid'); // 用户编号，如 "628", "47"

    if (role === 'bridge') {
      // bridge 注册：带 ?role=bridge&uid=628
      const bridgeKey = 'D' + (uid || '0');
      this.bridges[bridgeKey] = ws;
      console.log(`[bridge] 注册: ${bridgeKey}`);
    } else {
      // phone 注册：带 ?role=phone&uid=628
      if (uid) {
        this.phones[uid] = ws;
        // 推送最近的待处理消息
        if (this.pendingMsg[uid] && this.pendingMsg[uid].content) {
          try { ws.send(JSON.stringify(this.pendingMsg[uid])); } catch {}
        }
      }
    }

    ws.addEventListener('message', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (role === 'bridge') {
          // bridge 发来的消息 → 推给目标手机
          const to = data.to;
          if (to) this.pendingMsg[to] = data;
          if (to && this.phones[to]) try { this.phones[to].send(JSON.stringify(data)); } catch {}
        } else {
          // 手机发来的消息 → 推给对应 bridge
          const to = data.to || '';
          // 找到目标用户的 bridge
          const targetBridge = this.bridges['D' + to];
          if (targetBridge) {
            try { targetBridge.send(JSON.stringify(data)); } catch {}
          } else {
            // 没有 bridge，尝试发给所有 bridge（OpenClaw 对话模式）
            for (const bKey of Object.keys(this.bridges)) {
              try { this.bridges[bKey].send(JSON.stringify(data)); } catch {}
            }
          }
        }
      } catch {}
    });

    ws.addEventListener('close', () => {
      if (role === 'bridge') {
        const bridgeKey = 'D' + (uid || '0');
        delete this.bridges[bridgeKey];
      } else if (uid) {
        delete this.phones[uid];
      }
    });

    ws.addEventListener('error', () => {
      if (role === 'bridge') {
        const bridgeKey = 'D' + (uid || '0');
        delete this.bridges[bridgeKey];
      } else if (uid) {
        delete this.phones[uid];
      }
    });
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
