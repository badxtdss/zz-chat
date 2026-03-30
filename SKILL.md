---
name: zz-chat
description: 爪爪 — 手机直连 OpenClaw 聊天。当用户提到"爪爪"、"创建爪爪"、"部署聊天机器人"、"zz-chat"时使用。
metadata: {"clawdbot":{"emoji":"🦞"}}
---

# 爪爪 🦞 — 手机直连 OpenClaw

## 执行流程（按顺序执行，每一步都做）

用户说"部署爪爪"或类似指令时，按以下步骤自动执行：

### 第一步：部署 Worker（用用户自己的 Cloudflare 账号）

确保 wrangler 已登录用户的 Cloudflare 账号：

```bash
wrangler auth whoami 2>&1 || wrangler login
```

创建 KV namespace 和 Durable Object：

```bash
cd ~/.openclaw/workspace/openchat/simple

# 创建 KV namespace（如果不存在）
wrangler kv namespace create ZZ_STORE 2>&1

# 从输出中获取 KV namespace ID，更新 wrangler.toml
```

部署 Worker：

```bash
export PATH="/usr/local/bin:$PATH"
wrangler deploy 2>&1
```

部署完成后记录 Worker 域名（如 `zz-proxy.<用户名>.workers.dev`），存入 `~/.zz/worker_url`：

```bash
WORKER_URL=$(wrangler deploy 2>&1 | grep -o 'https://[^ ]*workers.dev' | head -1)
echo "$WORKER_URL" > ~/.zz/worker_url
echo "Worker URL: $WORKER_URL"
```

### 第二步：部署桥接 + 看门狗

```bash
pkill -f "bridge.py" 2>/dev/null; pkill -f "watchdog.py" 2>/dev/null; sleep 1

BRIDGE_DIR=~/.openclaw/workspace/openchat/bridge
mkdir -p "$BRIDGE_DIR"
cp ~/.openclaw/skills/zz-chat/bridge.py "$BRIDGE_DIR/"
cp ~/.openclaw/skills/zz-chat/watchdog.py "$BRIDGE_DIR/"

# 使用用户自己的 Worker URL
WORKER_URL=$(cat ~/.zz/worker_url 2>/dev/null || echo "https://ai0000.cn/zz/")
nohup python3 -u "$BRIDGE_DIR/watchdog.py" >> "$BRIDGE_DIR/watchdog.log" 2>&1 &
sleep 5
```

或配置 launchd 开机自启（macOS）：

```bash
# 创建 plist，指向 watchdog.py（watchdog 会自动启动 bridge）
cat > ~/Library/LaunchAgents/com.zz-chat.bridge.plist << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.zz-chat.bridge</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/python3</string>
        <string>-u</string>
        <string>/Users/USERNAME/.openclaw/workspace/openchat/bridge/watchdog.py</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/Users/USERNAME/.local/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>all_proxy</key><string></string>
        <key>ALL_PROXY</key><string></string>
        <key>http_proxy</key><string></string>
        <key>HTTP_PROXY</key><string></string>
        <key>https_proxy</key><string></string>
        <key>HTTPS_PROXY</key><string></string>
    </dict>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key>
    <string>/Users/USERNAME/.openclaw/workspace/openchat/bridge/watchdog.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/USERNAME/.openclaw/workspace/openchat/bridge/watchdog.log</string>
    <key>WorkingDirectory</key>
    <string>/Users/USERNAME/.openclaw/workspace/openchat/bridge</string>
</dict>
</plist>
PLIST

# 替换 USERNAME 为实际用户名
sed -i "s/USERNAME/$(whoami)/g" ~/Library/LaunchAgents/com.zz-chat.bridge.plist
launchctl load ~/Library/LaunchAgents/com.zz-chat.bridge.plist
```

### 第三步：获取编号

桥接启动后会自动向服务器注册，读取编号：

```bash
ZZ_ID=$(cat ~/.zz/id 2>/dev/null)
echo "编号: $ZZ_ID"
```

### 第四步：打开首页 + 发送链接 + 截图二维码

把 `{ZZ_ID}` 替换为实际编号：

```bash
ZZ_ID=$(cat ~/.zz/id 2>/dev/null)
WORKER_URL=$(cat ~/.zz/worker_url 2>/dev/null || echo "https://ai0000.cn/zz/")
PAGE_URL="https://badxtdss.github.io/zz-chat/?bridge=${ZZ_ID}"
```

1. **打开电脑浏览器首页**：
```bash
open "$PAGE_URL"
```

2. **生成二维码 HTML 并截图**：
保存到 `/tmp/zz-qr.html`，用 canvas 打开并截图：

```html
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>爪爪</title>
<style>
body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#e0e0e0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0}
h1{font-size:24px;margin-bottom:8px}
.id{font-size:48px;font-weight:bold;color:#4fc3f7;margin:12px 0}
.qr{background:#fff;padding:12px;border-radius:12px;margin:16px 0}
.hint{color:#8892b0;font-size:14px;text-align:center;max-width:300px;line-height:1.6}
</style></head>
<body>
<h1>🦞 爪爪</h1>
<div class="id">编号 {ZZ_ID}</div>
<div class="qr" id="qrBox"></div>
<div class="hint">手机扫码打开爪爪<br>消息通过你的 OpenClaw 处理</div>
<script>
const url = 'https://badxtdss.github.io/zz-chat/?bridge={ZZ_ID}';
const img = new Image();
img.src = 'https://quickchart.io/qr?text=' + encodeURIComponent(url) + '&size=200';
img.style.borderRadius = '8px';
document.getElementById('qrBox').appendChild(img);
</script>
</body>
</html>
```

用 canvas 工具打开二维码页面并截图，发送到 webchat 窗口。

3. **发送文字消息到 webchat**：

```
✅ 爪爪已部署完成！

🦞 你的编号: {ZZ_ID}
🔗 链接: {PAGE_URL}
📱 手机扫码或点击链接即可聊天

📱 添加到桌面（必做）:
1. 打开后点浏览器菜单 → 「访问电脑版」
2. 再点菜单 → 「添加到桌面」
   微信/QQ: 右上角 ··· → 「添加到桌面」
   Safari: 分享按钮 → 「添加到主屏幕」
3. 以后从桌面图标打开，体验最佳
```

## 架构

```
手机 ──→ 用户的 Worker ──→ bridge.py (用户电脑) ──→ openclaw agent CLI
         ↕ HTTP 轮询(每10秒)   ↕ WebSocket              ↕ 当前会话
         GET轮询收消息/PUT发消息  收消息→调CLI→拿回复      处理+回复

watchdog.py 监控 bridge.py（双层保护）
launchd 监控 watchdog.py（开机自启）
```

每个用户独立部署，用自己的 Cloudflare 额度，互不影响。

## 看门狗（watchdog.py）

看门狗守护 bridge 进程，双层保护：

```
launchd → watchdog.py → bridge.py
（系统级）  （进程级）    （实际桥接）
```

- **每 10 秒**检查 bridge 进程是否存活
- **每 30 秒**bridge 写心跳日志（`[心跳] 连接正常`）
- **90 秒无活动**→ 重启 bridge（防止进程在但 WebSocket 断开）
- bridge 挂了自动重启（最多 100 次）
- 零服务器压力（所有检测在本地完成）

## 消息路由规则

| 发送者 | 接收者 | 行为 |
|--------|--------|------|
| 手机(A) | 自己(A) | ❌ 不存 pendingMsg（防回显） |
| 手机(A) | 手机(B) | ✅ 存入 pendingMsg[B]，B 轮询收到 |
| Bridge(D) | 手机(A) | ✅ 存入 pendingMsg[A]，A 轮询收到 |
| 手机(A) | Bridge(D) | ✅ 转发给 WebSocket 连接的 bridge |

## 文件说明

| 文件 | 用途 |
|------|------|
| `bridge.py` | 桥接脚本（Python 3 + websockets），支持 `--worker` 和 `--uid` 参数 |
| `watchdog.py` | 看门狗，监控 bridge 进程和连接状态 |
| `bridge.js` | 桥接脚本（Node.js + ws）Windows 兼容 |
| `start-bridge.bat` | Windows 启动脚本 |
| `index.html` | 手机端首页（需扫码进入） |
| `chat.html` | 手机端 OpenClaw 对话页（HTTP 轮询） |
| `worker.js` | Cloudflare Worker（DO 分片 + 编号自增 + 桥接路由 + 自动清理） |
| `wrangler.toml` | Worker 配置文件 |
| SKILL.md | 本文件 |

## DO 分片

Worker 使用 Durable Object 按用户分片：
- 每 8 人一个 DO（`shard = uid // 8`）
- 注册走 shard-0（专用计数器）
- 用户间消息按接收方所在分片存储
- 可水平扩展至万人级

## 桥接参数

```bash
bridge.py --worker <URL>    # 指定 Worker 地址（默认读 ~/.zz/worker_url）
bridge.py --uid <ID>        # 直接指定编号（默认读 ~/.zz/id）
```

## 注意事项

- 只有扫码（带 `?bridge=` 参数）才能进入网页，直接打开会被拒绝
- 桥接需要电脑保持运行（不休眠）
- 每用户独立部署 Worker，用自己 Cloudflare 账号的免费额度（10 万请求/天）
- 消息通过 `openclaw agent` CLI 处理，走当前会话
- 注册后 1 小时未发消息自动清理，发过消息后 24 小时不活跃自动清理
- watchdog 日志：`~/.openclaw/workspace/openchat/bridge/watchdog.log`
- bridge 日志：`~/.openclaw/workspace/openchat/bridge/bridge.log`

## 开发者

🦞 爪爪 by 秋风悠扬

- B站：[秋风悠扬的个人空间](https://b23.tv/rEEYnVF)
- 抖音：363594031
