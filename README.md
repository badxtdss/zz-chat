---
name: zz-chat
description: 爪爪 — 手机直连 OpenClaw 聊天。当用户提到"爪爪"、"创建爪爪"、"部署聊天机器人"、"zz-chat"时使用。
metadata: {"clawdbot":{"emoji":"🦞"}}
---

# 爪爪 🦞 — 手机直连 OpenClaw

## 启动流程（三步）

### 第一步：生成编号 + 显示二维码

用 canvas 打开一个桌面窗口，内容如下：

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
<div class="id" id="myId">--</div>
<div class="qr" id="qrBox"></div>
<div class="hint">手机扫码打开爪爪<br>添加好友后即可聊天<br>消息通过你的 OpenClaw 处理</div>
<script>
// 生成 3 位随机编号
const id = String(Math.floor(Math.random()*900)+100);
document.getElementById('myId').textContent = '编号 ' + id;
// 生成二维码（指向 GitHub Pages + bridge 参数）
const url = 'https://badxtdss.github.io/zz-chat/?bridge=' + id;
const img = new Image();
img.src = 'https://quickchart.io/qr?text=' + encodeURIComponent(url) + '&size=200';
img.style.borderRadius = '8px';
document.getElementById('qrBox').appendChild(img);
// 返回编号供后续步骤使用
console.log('ZZ_ID=' + id);
</script>
</body>
</html>
```

将上面的 HTML 保存到临时文件，用 canvas 打开。

**从 canvas 的 console 日志中提取编号（ZZ_ID）。**

### 第二步：保存编号 + 启动桥接

```bash
# 保存编号
mkdir -p ~/.zz
echo "{ZZ_ID}" > ~/.zz/id

# 停掉旧桥接
pkill -f "bridge.py" 2>/dev/null; sleep 1

# 启动桥接
BRIDGE_DIR=~/.openclaw/workspace/openchat/bridge
mkdir -p "$BRIDGE_DIR"
# bridge.py 从 SKILL 目录复制
nohup python3 -u "$BRIDGE_DIR/bridge.py" >> "$BRIDGE_DIR/bridge.log" 2>&1 &
echo "桥接已启动，编号: {ZZ_ID}"
```

**bridge.py 已包含在本 SKILL 目录中。** 它会：
- 读取 `~/.zz/id` 获取编号
- WebSocket 连接到 Worker
- 收到消息 → 调用 `openclaw agent -m "消息" --session-id zz-{ID} --json`
- 拿到回复 → 发回 Worker

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
