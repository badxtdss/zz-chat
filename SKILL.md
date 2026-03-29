---
name: zz-chat
description: 爪爪 — 轻量即时聊天机器人。手机扫码即可和自己的 OpenClaw 对话，也支持好友间 P2P 聊天。当用户提到"爪爪"、"创建爪爪"、"部署聊天机器人"、"zz-chat"时使用。
metadata: {"clawdbot":{"emoji":"🦞"}}
---

# 爪爪 🦞 — 轻量聊天机器人

手机 ↔ OpenClaw 即时聊天 + 手机 ↔ 手机 P2P 聊天。扫码即用，无需安装 App。

## 用户说"帮我创建爪爪"时的完整流程

### 第一步：生成编号

```bash
ZZ_ID=$(shuf -i 100-999 -n 1)
mkdir -p ~/.zz
echo "$ZZ_ID" > ~/.zz/id
echo "你的爪爪编号: $ZZ_ID"
```

### 第二步：创建队列目录

```bash
mkdir -p ~/.openclaw/workspace/openchat/queue
echo '{"from":"","content":"","msg_id":"","ts":0}' > ~/.openclaw/workspace/openchat/queue/inbox.json
echo '{"to":"","content":"","msg_id":"","ts":0}' > ~/.openclaw/workspace/openchat/queue/outbox.json
```

### 第三步：启动桥接

桥接脚本位于本目录的 `bridge.py`。它持续轮询 Worker，把消息写入文件队列。

```bash
# 先清理旧进程
pkill -f "bridge.py" 2>/dev/null; sleep 1

# 启动桥接（后台运行）
SCRIPT_DIR="$(dirname "$0")"
BRIDGE_DIR=~/.openclaw/workspace/openchat/zz-bridge
mkdir -p "$BRIDGE_DIR"
cp "$SCRIPT_DIR/bridge.py" "$BRIDGE_DIR/bridge.py"
nohup python3 -u "$BRIDGE_DIR/bridge.py" >> "$BRIDGE_DIR/bridge.log" 2>&1 &
echo "桥接已启动，日志: $BRIDGE_DIR/bridge.log"
```

### 第四步：创建 cron 任务

用 cron 工具创建一个每 30 秒执行的任务：

```
job:
  name: "爪爪消息处理"
  schedule:
    kind: every
    everyMs: 30000
  sessionTarget: isolated
  payload:
    kind: agentTurn
    message: |
      读取 ~/.openclaw/workspace/openchat/queue/inbox.json，检查是否有新消息（from 不为空且 content 不为空）。如果有：
      1. 记下 msg_id 字段
      2. 立即清空 inbox.json（写入空内容防止重复处理）
      3. 用你的能力回复这条消息（记住：你是爪爪机器人，要热情友好）
      4. 把回复写入 ~/.openclaw/workspace/openchat/queue/outbox.json，格式：{"to":"发送者ID","content":"你的回复","msg_id":"reply-原始msg_id","ts":当前时间戳毫秒}
      如果没有新消息，直接回复 HEARTBEAT_OK。
  delivery:
    mode: none
```

### 第五步：部署前端页面

将 `index.html`、`chat.html` 和 `worker.js` 部署。

**前端（GitHub Pages）：**

```bash
SKILL_DIR="本skill目录路径"
REPO_DIR=~/zz-chat-pages
mkdir -p "$REPO_DIR"
cp "$SKILL_DIR/index.html" "$REPO_DIR/index.html"
cp "$SKILL_DIR/chat.html" "$REPO_DIR/chat.html"
cd "$REPO_DIR"
git init && git add -A && git commit -m "init"
gh repo create zz-chat --public --source=. --push
# 启用 GitHub Pages（Settings → Pages → Source: main branch）
echo "部署完成后访问: https://你的用户名.github.io/zz-chat/"
```

**Worker（Cloudflare）：**

```bash
cp "$SKILL_DIR/worker.js" ./worker.js
# 配置 wrangler.toml 后：
wrangler deploy
```

### 第六步：告诉用户

生成二维码链接并告诉用户：

```
✅ 爪爪创建成功！

🦞 你的编号: {ZZ_ID}
📱 手机访问: https://你的域名/?bridge={ZZ_ID}
   首页有二维码，扫码即可加你
💬 和 OpenClaw 对话: https://你的域名/chat.html?id={ZZ_ID}

桥接已在后台运行，cron 每 30 秒处理消息。
```

## 架构说明

### 消息流（OpenClaw 对话）

```
手机 (chat.html)
    ↕ WebSocket + HTTP 轮询降级
Worker (ai0000.cn/zz/)  ← Durable Object，双向转发
    ↕ WebSocket
bridge.py (本地)        ← 读 Worker → 写文件队列
    ↕ 文件读写
inbox.json / outbox.json
    ↕ cron 30秒
OpenClaw (isolated)     ← 处理消息，生成回复
```

### 好友系统（REST 即时互认）

```
A(628) 输入 47 → PUT /friend?uid=47（写入对方信箱）
B(47) 输入 628 → PUT /friend?uid=628
A 检查 47 信箱 → 发现自己的请求 → 互认！成为好友
B 检查 628 信箱 → 发现自己的请求 → 互认！成为好友
```

- 不轮询，点"发送请求"即时确认
- 好友请求只存 `{from, to, ts}` 格式
- 聊天消息走 `/chat` 端点，不污染好友信箱

### P2P 聊天（WebRTC）

```
成为好友后 → 自动建立 WebRTC P2P
UID 小的 = Impolite（发起者）→ createOffer
UID 大的 = Polite（监听者）→ listenForOffer
Offer → Answer → ICE → 连接成功
消息直接 手机A ⟺ 手机B，不经过服务器
```

P2P 不通时自动降级到 Worker `/chat` 端点轮询。

### Worker 端点

| 端点 | 用途 | 格式 |
|------|------|------|
| `/` | WebSocket + OpenClaw 聊天中转 | Durable Object |
| `/friend?uid=X` | 好友请求（追加队列） | `{from, to, ts}` |
| `/signal?uid=X` | WebRTC 信令（追加队列） | `{type: offer\|answer\|ice, ...}` |
| `/chat?uid=X` | 聊天降级消息（追加队列） | `{msg_id, from, to, content, ...}` |

所有端点支持 GET（读取）、PUT/POST（写入）、DELETE（清空）。

### 防重复机制（三重保障）

1. **msg_id UUID**: 每条消息带唯一标识
2. **读完即焚**: bridge 读完 outbox 立即清空，前端读完回复立即清空 Worker
3. **已处理清单**: bridge 内存 + 前端 localStorage

## 文件说明

| 文件 | 用途 |
|------|------|
| `bridge.py` | 桥接脚本（Python 3 + curl） |
| `index.html` | 首页 — 添加好友 + 好友列表 + P2P 聊天 |
| `chat.html` | OpenClaw 对话页（WebSocket + HTTP 轮询降级） |
| `worker.js` | Cloudflare Worker（消息中转 + 信令 + 好友请求） |
| SKILL.md | 本文件 |

## 依赖

- Python 3（macOS 自带）
- curl（系统自带）
- 一个静态托管服务（GitHub Pages）
- Cloudflare Worker + KV + Durable Objects
- OpenClaw cron 功能

## 注意事项

- 桥接需要电脑保持运行（不休眠）
- 消息 5 分钟 TTL，过期自动丢弃
- Worker 地址默认 `https://ai0000.cn/zz/`，可自建
- 好友请求一次确认，不轮询
- P2P 连接在 NAT 限制下可能失败，自动降级到 Worker 中转
