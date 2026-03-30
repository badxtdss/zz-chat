---
name: zz-chat
description: 爪爪 — 手机直连 OpenClaw 聊天。当用户提到"爪爪"、"创建爪爪"、"部署聊天机器人"、"zz-chat"时使用。
metadata: {"clawdbot":{"emoji":"🦞"}}
---

# 爪爪 🦞 — 手机直连 OpenClaw

## 启动流程（两步）

### 第一步：部署桥接

复制 bridge.py 到桥接目录并启动：

**macOS / Linux：**

```bash
# 停掉旧桥接
pkill -f "bridge.py" 2>/dev/null; sleep 1

# 部署桥接
BRIDGE_DIR=~/.openclaw/workspace/openchat/bridge
mkdir -p "$BRIDGE_DIR"
cp bridge.py "$BRIDGE_DIR/"
nohup python3 -u "$BRIDGE_DIR/bridge.py" >> "$BRIDGE_DIR/bridge.log" 2>&1 &
sleep 3

# 读取编号（首次运行会自动向服务器注册）
ZZ_ID=$(cat ~/.zz/id 2>/dev/null)
echo "桥接已启动，编号: $ZZ_ID"
```

**Windows 10：**

1. 安装 [Node.js](https://nodejs.org/)（LTS 版本）
2. 双击 `start-bridge.bat` 启动桥接
3. 首次运行会自动安装依赖（ws）并向服务器注册获取编号
4. 编号保存在 `C:\Users\用户名\.zz\id`

> bridge.py（Python）和 bridge.js（Node.js）功能一样，选你系统能用的。

**bridge 首次启动时会自动：**
- 向 Worker `/register` 请求编号
- 将编号保存到 `~/.zz/id`
- 后续启动直接读取本地编号，不再注册

### 第二步：显示二维码

读取 `~/.zz/id` 中的编号，然后用 canvas 展示 QR 码。将下面的 HTML 保存到临时文件，用 canvas 打开（把 `{ZZ_ID}` 替换为实际编号）：

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
<div class="id" id="myId">编号 {ZZ_ID}</div>
<div class="qr" id="qrBox"></div>
<div class="hint">手机扫码打开爪爪<br>添加好友后即可聊天<br>消息通过你的 OpenClaw 处理</div>
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

### 第三步：告诉用户

```
✅ 爪爪已启动！

🦞 你的编号: {ZZ_ID}
📱 手机扫码或访问: https://badxtdss.github.io/zz-chat/?bridge={ZZ_ID}

桥接正在运行，手机发的消息会直达你的 OpenClaw。
```

## 架构

```
手机 ──→ Worker (ai0000.cn/zz/) ──→ bridge.py (你电脑) ──→ openclaw agent CLI
         ↕ WebSocket               ↕ WebSocket              ↕ 当前会话
         按编号路由 bridge          收消息→调CLI→拿回复      处理+回复
```

## 文件说明

| 文件 | 用途 |
|------|------|
| `bridge.py` | 桥接脚本（Python 3 + websockets） |
| `bridge.js` | 桥接脚本（Node.js + ws）Windows 兼容 |
| `start-bridge.bat` | Windows 启动脚本 |
| `index.html` | 手机端首页（添加好友 + P2P 聊天） |
| `chat.html` | 手机端 OpenClaw 对话页 |
| `worker.js` | Cloudflare Worker（多 bridge 路由） |
| SKILL.md | 本文件 |

## 使用说明

### 扫码连接

1. 让朋友打开爪爪首页：`https://badxtdss.github.io/zz-chat/`
2. 首页显示二维码，手机扫码即可进入
3. 点「➕ 添加朋友」，输入对方编号，互认后即可聊天
4. 点「🤖 OpenClaw 聊天机器人」可直接和你的 OpenClaw 对话

### 好友聊天

- 输入对方编号 → 发送好友请求
- 对方也输入你的编号 → 自动互认成为好友
- 点好友进入聊天，消息走 WebRTC P2P 直连
- P2P 不通时自动降级为服务器中转

### 和 OpenClaw 对话

- 点「🤖 OpenClaw 聊天机器人」进入对话页
- 发消息给你的 OpenClaw，由 bridge 调用 `openclaw agent` 处理
- 支持文字和图片

## 开发者

🦞 爪爪 by 秋风悠扬

- B站：[秋风悠扬的个人空间](https://b23.tv/rEEYnVF)
- 抖音：363594031

## 注意事项

- 桥接需要电脑保持运行（不休眠）
- Worker 地址默认 `https://ai0000.cn/zz/`，可自建
- 每个用户有独立的 bridge，互不干扰
- 消息通过 `openclaw agent` CLI 处理，走当前会话
