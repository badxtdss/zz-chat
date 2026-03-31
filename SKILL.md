---
name: zz-chat
description: 爪爪/钳钳 — 手机直连 OpenClaw 聊天。触发词：钳钳、爪爪、钱钱、龙虾、聊天机器人、创建爪爪、安装钳钳、打开钳钳、zz-chat。
metadata: {"clawdbot":{"emoji":"🦞"}}
---

# 🦞 钳钳 — 手机直连 OpenClaw

## 架构

```
OC 聊天:  手机 ←WebSocket→ 用户的Worker ←→ bridge ←→ OpenClaw CLI
朋友互聊: 手机A ←WebSocket→ WorkerA ──HTTP──→ WorkerB ←WebSocket→ 手机B
注册发现:  Worker ──注册──→ 中心Worker（ai0000.cn）←──查询── Worker
```

每个用户独立部署 Worker，用自己 Cloudflare 额度，互不影响。

## 执行流程（按顺序执行，每一步都做）

用户说"部署钳钳"或类似指令时，先检测操作系统，然后按对应平台的命令执行。

### 第一步：部署 Worker（用用户自己的 Cloudflare 账号）

**先检测系统：**
- macOS/Linux → 用 bash 命令
- Windows → 用 PowerShell 命令

#### macOS / Linux

```bash
# 安装 wrangler
export PATH="/usr/local/bin:$PATH"
which wrangler 2>/dev/null || npm install -g wrangler 2>&1

# 检查登录（未登录会弹浏览器让用户点 Allow）
wrangler auth whoami 2>&1 || wrangler login 2>&1

# 复制用户版文件
cd ~/.openclaw/workspace/openchat/simple
cp worker-user.js worker-user-deploy.js
cp wrangler-user.toml wrangler-user-deploy.toml

# 改 Worker 名字（可选，默认 zz-chat-用户名）
sed -i '' "s/name = \"zz-proxy\"/name = \"zz-chat-$(whoami)\"/" wrangler-user-deploy.toml

# 部署
wrangler deploy -c wrangler-user-deploy.toml 2>&1

# 记录 Worker URL
WORKER_URL=$(wrangler deploy -c wrangler-user-deploy.toml 2>&1 | grep -o 'https://[^ ]*workers.dev' | head -1)
mkdir -p ~/.zz
echo "$WORKER_URL" > ~/.zz/worker_url
```

#### Windows (PowerShell)

```powershell
# 安装 wrangler
npm install -g wrangler 2>&1

# 检查登录（未登录会弹浏览器让用户点 Allow）
wrangler auth whoami 2>&1; if ($LASTEXITCODE -ne 0) { wrangler login 2>&1 }

# 复制用户版文件
Set-Location ~\.openclaw\workspace\openchat\simple
Copy-Item worker-user.js worker-user-deploy.js -Force
Copy-Item wrangler-user.toml wrangler-user-deploy.toml -Force

# 改 Worker 名字（可选，默认 zz-chat-计算机名）
(Get-Content wrangler-user-deploy.toml) -replace 'name = "zz-proxy"', "name = `"zz-chat-$env:USERNAME`"" | Set-Content wrangler-user-deploy.toml

# 部署
wrangler deploy -c wrangler-user-deploy.toml 2>&1

# 记录 Worker URL
$WORKER_URL = (wrangler deploy -c wrangler-user-deploy.toml 2>&1 | Select-String 'https://\S+workers\.dev' | Select-Object -First 1).Matches.Value
New-Item -ItemType Directory -Force -Path ~\.zz
$WORKER_URL | Out-File ~\.zz\worker_url -Encoding ascii
```

### 第二步：注册获取全局 UID

#### macOS / Linux

```bash
WORKER_URL=$(cat ~/.zz/worker_url)
ZZ_ID=$(curl -s "$WORKER_URL/register" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "$ZZ_ID" > ~/.zz/id
echo "编号: $ZZ_ID"
```

#### Windows (PowerShell)

```powershell
$WORKER_URL = (Get-Content ~\.zz\worker_url -Raw).Trim()
$resp = Invoke-WebRequest -Uri "$WORKER_URL/register" -UseBasicParsing
$ZZ_ID = ($resp.Content | ConvertFrom-Json).id
$ZZ_ID | Out-File ~\.zz\id -Encoding ascii
Write-Host "编号: $ZZ_ID"
```

### 第三步：启动桥接

**先确认 `~/.zz/worker_url` 已写入，否则 bridge 会连到中心服务器。**

#### macOS

杀掉旧进程，启动 watchdog（自动拉起 bridge.py）：

```bash
pkill -f "bridge.py" 2>/dev/null; pkill -f "watchdog.py" 2>/dev/null; sleep 1
BRIDGE_DIR=~/.openclaw/workspace/openchat/bridge
mkdir -p "$BRIDGE_DIR"
cp ~/.openclaw/skills/zz-chat/bridge.py "$BRIDGE_DIR/"
cp ~/.openclaw/skills/zz-chat/watchdog.py "$BRIDGE_DIR/"
nohup python3 -u "$BRIDGE_DIR/watchdog.py" >> "$BRIDGE_DIR/watchdog.log" 2>&1 &
sleep 5
# 确认 bridge 连到了自己的 Worker（不是中心 Worker）
grep "已连接" "$BRIDGE_DIR/bridge.log" | tail -1
```

或配置 launchd 开机自启：

```bash
cat > ~/Library/LaunchAgents/com.zz-chat.bridge.plist << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>com.zz-chat.bridge</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/python3</string><string>-u</string>
        <string>/Users/$(whoami)/.openclaw/workspace/openchat/bridge/watchdog.py</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key><string>/Users/$(whoami)/.local/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>all_proxy</key><string></string><key>ALL_PROXY</key><string></string>
        <key>http_proxy</key><string></string><key>HTTP_PROXY</key><string></string>
        <key>https_proxy</key><string></string><key>HTTPS_PROXY</key><string></string>
    </dict>
    <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>/Users/$(whoami)/.openclaw/workspace/openchat/bridge/watchdog.log</string>
    <key>StandardErrorPath</key><string>/Users/$(whoami)/.openclaw/workspace/openchat/bridge/watchdog.log</string>
    <key>WorkingDirectory</key><string>/Users/$(whoami)/.openclaw/workspace/openchat/bridge</string>
</dict>
</plist>
PLIST
launchctl load ~/Library/LaunchAgents/com.zz-chat.bridge.plist
sleep 5
ps aux | grep -E "(bridge|watchdog)" | grep -v grep
```

#### Windows

**先确认 `~\.zz\worker_url` 已写入，否则 bridge 会连到中心服务器。**

用 Node.js 版桥接（不需要 Python）：

```powershell
# 安装 ws 依赖
npm install -g ws 2>&1

# 创建启动脚本
Set-Location ~\.openclaw\workspace\openchat\bridge
@"
@echo off
chcp 65001 >nul 2>&1
title 钳钳桥接
echo [启动] 钳钳桥接...
:loop
node bridge.js
echo [重连] 5秒后重启...
timeout /t 5 >nul
goto loop
"@ | Out-File start-bridge.bat -Encoding ascii

# 启动
start-bridge.bat

# 确认 bridge 连到了自己的 Worker（看窗口输出）
# 应显示 [已连接] wss://你的Worker地址/?role=bridge&uid=xxx
# 不应显示 [已连接] wss://ai0000.cn/zz/?role=bridge&uid=xxx
```

开机自启（创建快捷方式到启动文件夹）：

```powershell
# 按 Win+R 输入 shell:startup 打开启动文件夹
# 把 start-bridge.bat 的快捷方式拖进去
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\钳钳桥接.lnk")
$Shortcut.TargetPath = "~\.openclaw\workspace\openchat\bridge\start-bridge.bat"
$Shortcut.WorkingDirectory = "~\.openclaw\workspace\openchat\bridge"
$Shortcut.Save()
Write-Host "已创建开机自启快捷方式"
```

### 第四步：生成链接 + 发送二维码

#### macOS / Linux

```bash
ZZ_ID=$(cat ~/.zz/id)
WORKER_URL=$(cat ~/.zz/worker_url)
PAGE_URL="https://badxtdss.github.io/zz-chat/?bridge=${ZZ_ID}&api=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$WORKER_URL', safe=''))")"
```

#### Windows (PowerShell)

```powershell
$ZZ_ID = (Get-Content ~\.zz\id -Raw).Trim()
$WORKER_URL = (Get-Content ~\.zz\worker_url -Raw).Trim()
$ENCODED = [System.Web.HttpUtility]::UrlEncode($WORKER_URL)
$PAGE_URL = "https://badxtdss.github.io/zz-chat/?bridge=$ZZ_ID&api=$ENCODED"
Write-Host "链接: $PAGE_URL"
```

**通用：** 用 canvas 截图二维码发给用户

保存 HTML 到 `/tmp/zz-qr.html`（Mac）或 `%TEMP%\zz-qr.html`（Windows）：

```html
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>钳钳</title>
<style>
body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#e0e0e0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0}
h1{font-size:24px;margin-bottom:8px}
.id{font-size:48px;font-weight:bold;color:#4fc3f7;margin:12px 0}
.qr{background:#fff;padding:12px;border-radius:12px;margin:16px 0}
.hint{color:#8892b0;font-size:14px;text-align:center;max-width:300px;line-height:1.6}
</style></head>
<body>
<h1>🦞 钳钳</h1>
<div class="id">编号 {ZZ_ID}</div>
<div class="qr" id="qrBox"></div>
<div class="hint">手机扫码打开钳钳<br>消息通过你的 OpenClaw 处理</div>
<script>
const url = '{PAGE_URL}';
const img = new Image();
img.src = 'https://quickchart.io/qr?text=' + encodeURIComponent(url) + '&size=200';
img.style.borderRadius = '8px';
document.getElementById('qrBox').appendChild(img);
</script>
</body>
</html>
```

用 canvas 截图后发图 + 文字消息：

```
✅ 钳钳已部署完成！

🦞 你的编号: {ZZ_ID}
🔗 链接: {PAGE_URL}

📱 添加到桌面（必做）:
1. 打开后点浏览器菜单 → 「访问电脑版」
2. 再点菜单 → 「添加到桌面」
   微信/QQ: 右上角 ··· → 「添加到桌面」
   Safari: 分享按钮 → 「添加到主屏幕」
3. 以后从桌面图标打开，体验最佳
```

## 消息路由

| 聊天类型 | 路径 | Worker |
|---|---|---|
| OC（OpenClaw） | 手机→Worker→bridge→CLI | 用户自己的 Worker |
| 朋友互聊（在线） | 手机A→WorkerA→WorkerB→手机B | 两个用户的 Worker |
| 朋友互聊（离线文字） | WorkerB 存 DO 持久存储，上线补发 | 接收方的 Worker |
| 注册 | Worker→中心Worker（ai0000.cn） | 中心 Worker |

## 文件说明

| 文件 | 用途 | 平台 |
|------|------|------|
| `worker.js` | 中心 Worker（ai0000.cn 用） | Cloudflare |
| `worker-user.js` | 用户独立 Worker | Cloudflare |
| `wrangler.toml` | 中心 Worker 配置 | 通用 |
| `wrangler-user.toml` | 用户 Worker 配置模板 | 通用 |
| `bridge.py` | Python 桥接（`--worker`、`--uid`） | Mac/Linux |
| `bridge.js` | Node.js 桥接（`--worker`、`--uid`） | 全平台（Windows 推荐） |
| `watchdog.py` | 看门狗，监控 bridge | Mac/Linux |
| `start-bridge.bat` | Windows 启动脚本 | Windows |
| `index.html` | 手机端首页 | 浏览器 |
| `chat.html` | 手机端 OC 聊天页 | 浏览器 |

## 桥接参数

两个版本都支持：

```bash
# Python 版
bridge.py --worker <URL> --uid <ID>

# Node.js 版
node bridge.js --worker <URL> --uid <ID>
```

## 看门狗（仅 macOS/Linux）

```
launchd/systemd → watchdog.py → bridge.py
（系统级）      （进程级）    （实际桥接）
```

- 每 10 秒检查 bridge 进程是否存活
- 每 30 秒 bridge 写心跳日志
- 90 秒无活动 → 重启 bridge
- Windows 用 start-bridge.bat 的循环替代

## 注意事项

- 只有扫码（带 `?bridge=` + `?api=` 参数）才能进入网页
- 桥接需要电脑保持运行（不休眠）
- 每用户独立 Worker，免费额度：100 WebSocket 并发 + 10 万请求/天
- 消息通过 `openclaw agent` CLI 处理
- 注册后 1 小时未发消息自动清理，发过消息后 24 小时不活跃自动清理
- watchdog 日志：`~/.openclaw/workspace/openchat/bridge/watchdog.log`（仅 Mac/Linux）
- bridge 日志：`~/.openclaw/workspace/openchat/bridge/bridge.log`

## 开发者

🦞 钳钳 by 秋风悠扬

- B站：[秋风悠扬的个人空间](https://b23.tv/rEEYnVF)
- 抖音：363594031
