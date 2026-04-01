// Cloudflare Worker — 爪爪 v8
// 编号自增 + 自动清理 + 多 bridge 路由 + 好友请求 + 信令 + 聊天降级 + 跨 Worker 朋友互聊
// 部署: wrangler deploy

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const HOUR = 3600000;
const DAY = 86400000;

// ─── 分片：每 8 人一个 DO ─────────────────────────────
function getShard(uid) { return Math.floor((parseInt(uid) || 0) / 8); }
function getRoom(env, uid) {
  const id = env.CHAT_ROOM.idFromName('shard-' + getShard(uid));
  return env.CHAT_ROOM.get(id);
}

// ─── 注册（编号自增）─────────────────────────────────
async function handleRegister(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: CORS });
  const url = new URL(request.url);
  const workerUrl = url.searchParams.get('url');
  const id = env.CHAT_ROOM.idFromName('shard-0');
  const room = env.CHAT_ROOM.get(id);
  const regReq = new Request('https://internal/register' + (workerUrl ? '?url=' + encodeURIComponent(workerUrl) : ''), { method: 'GET' });
  return room.fetch(regReq);
}

// ─── 注册 Worker URL ──────────────────────────────────
async function handleRegisterUrl(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const url = new URL(request.url);
  const uid = url.searchParams.get('uid');
  const workerUrl = url.searchParams.get('url');
  if (!uid || !workerUrl) return new Response(JSON.stringify({ error: 'uid and url required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
  await env.ZZ_STORE.put(`worker_url_${uid}`, workerUrl);
  return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// ─── 查找 Worker URL ──────────────────────────────────
async function handleLookup(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const url = new URL(request.url);
  const uid = url.searchParams.get('uid');
  if (!uid) return new Response(JSON.stringify({ error: 'uid required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
  const workerUrl = await env.ZZ_STORE.get(`worker_url_${uid}`);
  return new Response(JSON.stringify({ url: workerUrl || null }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
}

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

// ─── 数据备份 ─────────────────────────────────────────
async function handleBackup(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const url = new URL(request.url);
  const secret = url.searchParams.get('key');
  if (!secret || secret !== env.BACKUP_KEY) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
  const result = {};
  let cursor;
  let listed;
  // 导出所有 KV
  do {
    listed = await env.ZZ_STORE.list({ cursor });
    for (const key of listed.keys) {
      try {
        const val = await env.ZZ_STORE.get(key.name);
        if (val !== null) result[key.name] = val;
      } catch {}
    }
    cursor = listed.cursor;
  } while (!listed.list_complete);
  return new Response(JSON.stringify({ ts: Date.now(), count: Object.keys(result).length, data: result }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ─── 清理（每天跑一次）────────────────────────────────
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
        const uid = key.name.replace('user_', '');
        let shouldDelete = false;
        if (!user.lastActive && (now - user.created > HOUR)) shouldDelete = true;
        if (user.lastActive && (now - user.lastActive > DAY)) shouldDelete = true;
        if (shouldDelete) {
          await env.ZZ_STORE.delete(key.name);
          await env.ZZ_STORE.delete(`friend_${uid}`);
          await env.ZZ_STORE.delete(`signal_${uid}`);
          await env.ZZ_STORE.delete(`chat_${uid}`);
          await env.ZZ_STORE.delete(`worker_url_${uid}`);
          deleted++;
        }
      } catch {}
    }
    cursor = listed.cursor;
  } while (!listed.list_complete);
  return { checked, deleted };
}

// ─── 跨 Worker 转发 ───────────────────────────────────
async function fwdToWorker(workerUrl, data) {
  try {
    const resp = await fetch(workerUrl + '/fwd', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return resp.ok;
  } catch { return false; }
}

// ─── Durable Object ───────────────────────────────────
export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.bridges = {};
    this.phones = {};
    this.pendingMsg = {};
  }

  async fetch(request) {
    try {
    const url = new URL(request.url);

    // 重置编号计数器
    if (url.pathname.includes('/reset')) {
      await this.state.storage.put('counter', 0);
      return new Response(JSON.stringify({ ok: true, counter: 0 }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // 注册端点（编号自增 + 可选注册 Worker URL）
    if (url.pathname.includes('/register')) {
      let counter = (await this.state.storage.get('counter')) || 0;
      if (counter < 1888) counter = 1888; // 起始编号
      const nextId = counter + 1;
      if (nextId > 9998) {
        return new Response(JSON.stringify({ error: '注册已满', code: 'FULL' }), { status: 403, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
      await this.state.storage.put('counter', nextId);
      const uid = String(nextId);
      // 用户信息存 DO（SQLite，无写入限制）
      await this.state.storage.put(`user_${uid}`, { created: Date.now(), lastActive: 0 });
      // Worker URL 存 KV（跨分片可查）
      const workerUrl = url.searchParams.get('url');
      if (workerUrl) {
        await this.env.ZZ_STORE.put(`worker_url_${uid}`, workerUrl);
      }
      return new Response(JSON.stringify({ id: uid }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // 清理端点
    if (url.pathname.includes('/cleanup')) {
      const result = await handleCleanup(this.env);
      // 同时清理 DO 里的用户数据
      return new Response(JSON.stringify(result), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // 接收跨 Worker / 跨分片转发的消息
    if (url.pathname.includes('/fwd') && request.method === 'PUT') {
      const data = await request.json();
      const to = data.to;
      if (to) {
        if (this.phones[to]) {
          try { this.phones[to].send(JSON.stringify(data)); } catch {}
        } else if (!data.isImage && data.content) {
          const pendingKey = `msg_${to}`;
          const stored = await this.state.storage.get(pendingKey).catch(() => null);
          const msgs = stored || [];
          msgs.push({ from: data.from, content: data.content, ts: data.ts || Date.now(), msg_id: data.msg_id });
          if (msgs.length > 100) msgs.splice(0, msgs.length - 100);
          await this.state.storage.put(pendingKey, msgs);
        }
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    if (request.headers.get('Upgrade') === 'websocket') {
      const [client, server] = Object.values(new WebSocketPair());
      await this.handleSession(server, url.searchParams);
      return new Response(null, { status: 101, webSocket: client });
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const uid = url.searchParams.get('uid');
    if (uid) await touchUser(this.env, uid);

    if (request.method === 'GET') {
      if (uid && this.pendingMsg[uid]) {
        return new Response(JSON.stringify(this.pendingMsg[uid]), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ from:'', to:'', content:'', msg_id:'', ts:0, isImage:false }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    if (request.method === 'PUT') {
      const body = await request.json();
      const to = body.to;
      if (to && body.from && (body.from.startsWith('D') || body.from !== to)) this.pendingMsg[to] = body;
      if (body.from) await touchUser(this.env, body.from);
      if (to) await touchUser(this.env, to);
      const targetBridge = this.bridges['D' + to];
      if (targetBridge && body.content) {
        try { targetBridge.send(JSON.stringify(body)); } catch {}
      }
      if (to && this.phones[to]) try { this.phones[to].send(JSON.stringify(body)); } catch {}
      return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    return new Response('Not found', { status: 404 });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message, stack: e.stack }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
  }

  handleSession(ws, params) {
    ws.accept();
    const role = params.get('role');
    const uid = params.get('uid');

    if (role === 'bridge') {
      const bridgeKey = 'D' + (uid || '0');
      this.bridges[bridgeKey] = ws;
      if (uid) touchUser(this.env, uid);
    } else if (uid) {
      this.phones[uid] = ws;
      touchUser(this.env, uid);
      if (this.pendingMsg[uid] && this.pendingMsg[uid].content) {
        try { ws.send(JSON.stringify(this.pendingMsg[uid])); } catch {}
      }
      const pendingKey = `msg_${uid}`;
      this.state.storage.get(pendingKey).then(stored => {
        if (stored && stored.length) {
          for (const msg of stored) {
            try { ws.send(JSON.stringify(msg)); } catch {}
          }
          this.state.storage.delete(pendingKey);
        }
      }).catch(() => {});
    }

    ws.addEventListener('message', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (role === 'bridge') {
          const to = data.to;
          if (to) this.pendingMsg[to] = data;
          if (to && this.phones[to]) try { this.phones[to].send(JSON.stringify(data)); } catch {}
        } else {
          const to = data.to || '';
          if (data.from) touchUser(this.env, data.from);
          if (to) touchUser(this.env, to);

          // 朋友互聊
          if (to && !to.startsWith('D') && data.from !== to) {
            // 同 Worker 同分片：本地处理
            if (getShard(to) === getShard(uid || '0')) {
              if (this.phones[to]) {
                try { this.phones[to].send(JSON.stringify(data)); } catch {}
              } else if (!data.isImage && data.content) {
                const pendingKey = `msg_${to}`;
                this.state.storage.get(pendingKey).then(stored => {
                  const msgs = stored || [];
                  msgs.push({ from: data.from, content: data.content, ts: data.ts || Date.now(), msg_id: data.msg_id });
                  if (msgs.length > 100) msgs.splice(0, msgs.length - 100);
                  this.state.storage.put(pendingKey, msgs);
                }).catch(() => {});
              }
            } else {
              // 同 Worker 跨分片
              const targetRoom = getRoom(this.env, to);
              targetRoom.fetch(new Request('https://internal/fwd', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
              })).catch(() => {});
            }
            return;
          }

          // OC 聊天：走 bridge
          const targetBridge = this.bridges['D' + to];
          if (targetBridge) {
            try { targetBridge.send(JSON.stringify(data)); } catch {}
          } else {
            for (const bKey of Object.keys(this.bridges)) {
              try { this.bridges[bKey].send(JSON.stringify(data)); } catch {}
            }
          }
        }
      } catch {}
    });

    ws.addEventListener('close', () => {
      if (role === 'bridge') { delete this.bridges['D' + (uid || '0')]; }
      else if (uid) { delete this.phones[uid]; }
    });
    ws.addEventListener('error', () => {
      if (role === 'bridge') { delete this.bridges['D' + (uid || '0')]; }
      else if (uid) { delete this.phones[uid]; }
    });
  }
}

// 保留全局版给 cleanup 用（如果还有 KV 里的旧数据）
async function touchUser(env, uid) {
  if (!uid || uid.startsWith('D')) return;
  try {
    const raw = await env.ZZ_STORE.get(`user_${uid}`);
    if (raw) {
      const user = JSON.parse(raw);
      if (!user.lastActive) {
        user.lastActive = Date.now();
        await env.ZZ_STORE.put(`user_${uid}`, JSON.stringify(user));
      }
    }
  } catch {}
}

// ─── 入口 ─────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.includes('/register_url')) return handleRegisterUrl(request, env);
    if (url.pathname.includes('/register')) return handleRegister(request, env);
    if (url.pathname.includes('/lookup')) return handleLookup(request, env);
    if (url.pathname.includes('/backup')) return handleBackup(request, env);
    if (url.pathname.includes('/signal')) return handleSignaling(request, env);
    if (url.pathname.includes('/friend')) return handleFriend(request, env);
    if (url.pathname.includes('/chat')) return handleChat(request, env);
    // 按 uid 分片到不同 DO
    let uid = url.searchParams.get('uid');
    if (!uid) try { const body = await request.clone().json(); uid = body.to || body.from; } catch {}
    const room = getRoom(env, uid || '0');
    return room.fetch(request);
  },
  async scheduled(event, env) {
    const result = await handleCleanup(env);
    console.log(`[cleanup] checked=${result.checked} deleted=${result.deleted}`);
  }
};
