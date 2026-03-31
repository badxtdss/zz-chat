# 钳钳 🦞 — 手机直连 OpenClaw

手机扫码即可和你的 OpenClaw AI 对话。

## 架构

```
OC 聊天:  手机 ←WebSocket→ 你的 Worker ←→ bridge ←→ OpenClaw CLI
朋友互聊: 手机A ←WebSocket→ WorkerA ──HTTP──→ WorkerB ←WebSocket→ 手机B
```

每个用户独立部署 Worker，用自己 Cloudflare 免费额度，互不影响。

## 下载

| 平台 | 下载 | 依赖 |
|------|------|------|
| 🍎 Mac / Linux | [下载 Mac 版](../../releases/latest/download/zz-chat-mac.zip) | Python 3 + websockets |
| 🪟 Windows | [下载 Win 版](../../releases/latest/download/zz-chat-win.zip) | Node.js 或 Python 3 |

## 快速开始

### 1. 部署你自己的 Worker（需要 Cloudflare 账号）

免费注册 Cloudflare → 弹出浏览器点 Allow 即可：

```bash
# Mac / Linux
npm install -g wrangler
wrangler login

# Windows (PowerShell)
npm install -g wrangler
wrangler login
```

部署 Worker：

```bash
cd zz-chat/simple
cp worker-user.js worker-user-deploy.js
cp wrangler-user.toml wrangler-user-deploy.toml
wrangler deploy -c wrangler-user-deploy.toml
```

记录 Worker 地址（类似 `https://zz-chat-xxx.workers.dev`）。

### 2. 注册编号

```bash
# Mac / Linux
curl -s "https://你的Worker地址/register" 
# 返回 {"id": "1889"}

# Windows (PowerShell)
Invoke-WebRequest -Uri "https://你的Worker地址/register" -UseBasicParsing
```

保存编号到 `~/.zz/id`，Worker 地址保存到 `~/.zz/worker_url`。

### 3. 启动桥接

**Mac / Linux（Python）：**
```bash
python3 bridge.py
```

**Windows（Node.js，推荐）：**
```
双击 start-bridge.bat
```

桥接会自动读取 `~/.zz/worker_url` 连接你自己的 Worker。

### 4. 打开手机页面

```
https://badxtdss.github.io/zz-chat/?bridge=你的编号&api=https://你的Worker地址
```

扫码打开 → 添加到桌面 → 完成 🎉

## 为什么需要自己的 Worker？

| | 共享服务器 | 你自己的 Worker |
|---|---|---|
| 延迟 | ~300ms（国内绕路） | 直连你的 Worker |
| 容量 | 和别人共享 | 100 WebSocket 独享 |
| 稳定性 | 可能被间歇封锁 | 你自己掌控 |
| 费用 | 免费 | 免费（Cloudflare 免费额度） |

## 桥接参数

两个版本都支持：

```bash
# 指定 Worker 地址
bridge.py --worker https://你的Worker地址
node bridge.js --worker https://你的Worker地址

# 直接指定编号
bridge.py --uid 1889
node bridge.js --uid 1889
```

## 功能

- 编号自增，bridge 启动时自动注册获取编号
- 手机扫码进入（直接打开会被拒绝）
- 文字 + 图片消息
- 朋友互聊（跨 Worker 转发）
- 自动清理不活跃账号
- Windows 优先 Node.js，无 Node 再回退 Python
- 看门狗自动重启（Mac/Linux）

## 文件说明

| 文件 | 用途 |
|------|------|
| `worker-user.js` | 用户独立 Worker（部署到 Cloudflare） |
| `bridge.py` | Python 桥接（Mac/Linux 推荐） |
| `bridge.js` | Node.js 桥接（Windows 推荐） |
| `watchdog.py` | 看门狗（Mac/Linux） |
| `start-bridge.bat` | Windows 启动脚本 |
| `index.html` | 手机端首页 |
| `chat.html` | 手机端聊天页 |

## 开发者

🦞 钳钳 by 秋风悠扬

- B站：[秋风悠扬的个人空间](https://b23.tv/rEEYnVF)
- 抖音：363594031
