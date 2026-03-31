// 爪爪镜像服务器 v1
// 被封时临时开的备用服务器，从 GitHub 拉备份数据启动
// 启动: node mirror.js
// 数据源: https://raw.githubusercontent.com/badxtdss/zz-chat/main/zz-backup.json

const http = require('http');
const https = require('https');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const BACKUP_URL = 'https://raw.githubusercontent.com/badxtdss/zz-chat/main/zz-backup.json';
const SYNC_INTERVAL = 60 * 60 * 1000; // 1 小时同步一次

let kv = {};           // 内存 KV（从备份加载）
let phones = {};       // 在线手机
let bridges = {};      // 在线 bridge
let pendingMsg = {};   // 待发消息

// ─── 从 GitHub 拉备份数据 ─────────────────────────
async function syncBackup() {
  return new Promise((resolve) => {
    https.get(BACKUP_URL, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          const backup = JSON.parse(data);
          kv = {};
          for (const [k, v] of Object.entries(backup.data)) {
            kv[k] = v;
          }
          console.log(`[sync] 已加载 ${backup.count} 条数据, 时间: ${new Date(backup.ts).toISOString()}`);
          resolve(true);
        } catch (e) {
          console.error('[sync] 解析失败:', e.message);
          resolve(false);
        }
      });
    }).on('error', (e) => {
      console.error('[sync] 下载失败:', e.message);
      resolve(false);
    });
  });
}

// ─── HTTP 处理 ─────────────────────────────────────
function handleHTTP(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // 注册
  if (url.pathname.includes('/register')) {
    const id = String((parseInt(kv._counter || '0') + 1));
    kv._counter = id;
    kv[`user_${id}`] = JSON.stringify({ created: Date.now(), lastActive: 0 });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id }));
    return;
  }

  // 查好友
  if (url.pathname.includes('/friend')) {
    const uid = url.searchParams.get('uid');
    if (!uid) { res.writeHead(400); res.end('uid required'); return; }
    const key = `friend_${uid}`;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(kv[key] || '[]');
    return;
  }

  // 查 Worker URL
  if (url.pathname.includes('/lookup')) {
    const uid = url.searchParams.get('uid');
    if (!uid) { res.writeHead(400); res.end('uid required'); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ url: kv[`worker_url_${uid}`] || null }));
    return;
  }

  // OC 聊天轮询
  if (url.pathname.includes('/chat')) {
    const uid = url.searchParams.get('uid');
    if (!uid) { res.writeHead(400); res.end('uid required'); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (req.method === 'GET') {
      res.end(pendingMsg[uid] ? JSON.stringify(pendingMsg[uid]) : '{"from":"","to":"","content":"","msg_id":"","ts":0,"isImage":false}');
    } else if (req.method === 'PUT') {
      let body = '';
      req.on('data', (c) => body += c);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const to = data.to;
          if (to && data.from && (data.from.startsWith('D') || data.from !== to)) pendingMsg[to] = data;
          if (to && phones[to]) try { phones[to].send(JSON.stringify(data)); } catch {}
        } catch {}
        res.end(JSON.stringify({ ok: true }));
      });
    }
    return;
  }

  // 状态检查
  if (url.pathname.includes('/status')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      online_phones: Object.keys(phones).length,
      online_bridges: Object.keys(bridges).length,
      kv_keys: Object.keys(kv).length,
      last_sync: kv._lastSync || null,
    }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
}

// ─── HTTP 服务器 ───────────────────────────────────
const httpServer = http.createServer(handleHTTP);

// ─── WebSocket 处理 ────────────────────────────────
const wss = new WebSocket.Server({ server: httpServer });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const role = url.searchParams.get('role');
  const uid = url.searchParams.get('uid');

  if (role === 'bridge') {
    bridges['D' + (uid || '0')] = ws;
    console.log(`[ws] bridge D${uid} connected`);
  } else if (uid) {
    phones[uid] = ws;
    console.log(`[ws] phone ${uid} connected`);
    if (pendingMsg[uid] && pendingMsg[uid].content) {
      try { ws.send(JSON.stringify(pendingMsg[uid])); } catch {}
    }
  }

  ws.on('message', (e) => {
    try {
      const data = JSON.parse(e.data);
      if (role === 'bridge') {
        const to = data.to;
        if (to) pendingMsg[to] = data;
        if (to && phones[to]) try { phones[to].send(JSON.stringify(data)); } catch {}
      } else {
        const to = data.to || '';
        if (to && !to.startsWith('D') && data.from !== to) {
          // 朋友互聊：镜像只处理本地连接
          if (phones[to]) try { phones[to].send(JSON.stringify(data)); } catch {}
          return;
        }
        // OC 聊天
        const targetBridge = bridges['D' + to];
        if (targetBridge) {
          try { targetBridge.send(JSON.stringify(data)); } catch {}
        } else {
          for (const bKey of Object.keys(bridges)) {
            try { bridges[bKey].send(JSON.stringify(data)); } catch {}
          }
        }
      }
    } catch {}
  });

  ws.on('close', () => {
    if (role === 'bridge') delete bridges['D' + (uid || '0')];
    else if (uid) delete phones[uid];
  });
});

// ─── 启动 ─────────────────────────────────────────
async function start() {
  console.log('[镜像] 首次同步...');
  await syncBackup();
  kv._lastSync = Date.now();

  httpServer.listen(PORT, () => {
    console.log(`[镜像] 监听 :${PORT}`);
  });

  // 每小时同步
  setInterval(async () => {
    await syncBackup();
    kv._lastSync = Date.now();
  }, SYNC_INTERVAL);
}

start();
