// Cloudflare Worker — 爪爪 v2
// WebSocket 长连接 + Durable Objects + REST 兼容
// 部署: wrangler deploy

export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.bridge = null;   // bridge WebSocket
    this.phone = null;    // 手机 WebSocket
  }

  async fetch(request) {
    const url = new URL(request.url);

    // WebSocket 升级
    if (request.headers.get('Upgrade') === 'websocket') {
      const [client, server] = Object.values(new WebSocketPair());
      await this.handleSession(server, url.searchParams);
      return new Response(null, { status: 101, webSocket: client });
    }

    // REST 降级（兼容旧版轮询）
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: cors });

    if (request.method === 'GET') {
      return new Response(JSON.stringify(this.pendingMsg || {
        from: '', to: '', content: '', msg_id: '', ts: 0, isImage: false
      }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    if (request.method === 'PUT') {
      const body = await request.json();
      this.pendingMsg = body;
      // 如果 bridge 在线，直接转发
      if (this.bridge) {
        try { this.bridge.send(JSON.stringify(body)); } catch {}
      }
      return new Response(JSON.stringify(body), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404 });
  }

  handleSession(ws, params) {
    ws.accept();
    const role = params.get('role');  // 'bridge' | 'phone'

    if (role === 'bridge') {
      this.bridge = ws;
      console.log('bridge connected');
    } else {
      this.phone = ws;
      console.log('phone connected');
    }

    ws.addEventListener('message', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (role === 'phone') {
          // 手机发消息 → 转发给 bridge
          if (this.bridge) {
            try { this.bridge.send(JSON.stringify(data)); } catch {}
          }
        } else if (role === 'bridge') {
          // bridge 回复 → 转发给手机
          this.pendingMsg = data;
          if (this.phone) {
            try { this.phone.send(JSON.stringify(data)); } catch {}
          }
        }
      } catch {}
    });

    ws.addEventListener('close', () => {
      if (role === 'bridge') this.bridge = null;
      else this.phone = null;
    });

    ws.addEventListener('error', () => {
      if (role === 'bridge') this.bridge = null;
      else this.phone = null;
    });
  }
}

// ─── 好友消息（REST 队列）──────────────────────────────
async function handleFriend(request, env) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: cors });

  const url = new URL(request.url);
  const uid = url.searchParams.get('uid');
  if (!uid)
    return new Response(JSON.stringify({ error: 'uid required' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
    });

  const key = `friend_${uid}`;

  if (request.method === 'GET') {
    const raw = await env.ZZ_STORE.get(key);
    return new Response(raw || '[]', {
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  if (request.method === 'PUT') {
    const body = await request.json();
    // 读取现有队列
    const raw = await env.ZZ_STORE.get(key);
    const queue = raw ? JSON.parse(raw) : [];
    queue.push(body);
    // 只保留最近 50 条
    if (queue.length > 50) queue.splice(0, queue.length - 50);
    await env.ZZ_STORE.put(key, JSON.stringify(queue));
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  return new Response('Method not allowed', { status: 405, headers: cors });
}

// ─── 入口 ─────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 好友消息走独立路由
    if (url.pathname.startsWith('/friend')) {
      return handleFriend(request, env);
    }

    // OpenClaw 对话 → Durable Object（支持 WebSocket + REST 降级）
    const id = env.CHAT_ROOM.idFromName('openclaw');
    const room = env.CHAT_ROOM.get(id);
    return room.fetch(request);
  }
};
