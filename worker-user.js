// Cloudflare Worker — 爪爪用户版 v1
// 每个用户独立部署，用自己的 Cloudflare 额度
// 部署: wrangler deploy

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// 中心 Worker 地址（注册 + 查好友 URL）
const CENTRAL = 'https://ai0000.cn/zz/';

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
    const url = new URL(request.url);

    // 注册：从中心 Worker 获取全局唯一 UID
    if (url.pathname.includes('/register')) {
      const myUrl = url.origin;
      try {
        const resp = await fetch(CENTRAL + 'register?url=' + encodeURIComponent(myUrl));
        const data = await resp.json();
        if (data.id) {
          await this.state.storage.put('my_uid', data.id);
          return new Response(JSON.stringify({ id: data.id }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
        }
      } catch {}
      return new Response(JSON.stringify({ error: 'register failed' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // 获取我的 UID
    if (url.pathname.includes('/my_uid')) {
      const uid = await this.state.storage.get('my_uid');
      return new Response(JSON.stringify({ id: uid || null }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // 接收跨 Worker 转发的消息
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

    // 好友列表（本地存储）
    if (url.pathname.includes('/friends')) {
      if (request.method === 'GET') {
        const friends = await this.state.storage.get('friends') || {};
        return new Response(JSON.stringify(friends), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
      if (request.method === 'PUT') {
        const body = await request.json();
        const friends = await this.state.storage.get('friends') || {};
        friends[body.uid] = { name: body.name || '', url: body.url || '', added: Date.now() };
        await this.state.storage.put('friends', friends);
        return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
      return new Response('Method not allowed', { status: 405, headers: CORS });
    }

    if (request.headers.get('Upgrade') === 'websocket') {
      const [client, server] = Object.values(new WebSocketPair());
      await this.handleSession(server, url.searchParams);
      return new Response(null, { status: 101, webSocket: client });
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const uid = url.searchParams.get('uid');

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
      const targetBridge = this.bridges['D' + to];
      if (targetBridge && body.content) {
        try { targetBridge.send(JSON.stringify(body)); } catch {}
      }
      if (to && this.phones[to]) try { this.phones[to].send(JSON.stringify(body)); } catch {}
      return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    return new Response('Not found', { status: 404 });
  }

  handleSession(ws, params) {
    ws.accept();
    const role = params.get('role');
    const uid = params.get('uid');

    if (role === 'bridge') {
      const bridgeKey = 'D' + (uid || '0');
      this.bridges[bridgeKey] = ws;
    } else if (uid) {
      this.phones[uid] = ws;
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

          // 朋友互聊：查好友 Worker URL，跨 Worker 转发
          if (to && !to.startsWith('D') && data.from !== to) {
            this.state.storage.get('friends').then(friends => {
              const friend = friends && friends[to];
              if (friend && friend.url) {
                fwdToWorker(friend.url, data);
              } else {
                // 查中心 Worker
                fetch(CENTRAL + 'lookup?uid=' + to).then(r => r.json()).then(info => {
                  if (info.url) {
                    fwdToWorker(info.url, data);
                    // 缓存好友 URL
                    const f = friends || {};
                    f[to] = f[to] || {};
                    f[to].url = info.url;
                    this.state.storage.put('friends', f);
                  }
                }).catch(() => {});
              }
            }).catch(() => {});
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const id = env.CHAT_ROOM.idFromName('main');
    const room = env.CHAT_ROOM.get(id);
    return room.fetch(request);
  }
};
