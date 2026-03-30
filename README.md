# 爪爪 🦞 — 手机直连 OpenClaw

手机扫码即可和你的 OpenClaw AI 对话。

## 下载

| 平台 | 下载 | 依赖 |
|------|------|------|
| 🍎 Mac / Linux | [下载 Mac 版](../../releases/latest/download/zz-chat-mac.zip) | Python 3 + websockets |
| 🪟 Windows | [下载 Win 版](../../releases/latest/download/zz-chat-win.zip) | Python 3 + websockets |

## 快速开始

### Mac / Linux
```bash
unzip zz-chat-mac.zip
cd zz-mac
python3 bridge.py
```

### Windows
解压后双击 `start-bridge.bat`（会自动检测 Python、安装依赖）

## 架构

```
手机 ──→ Worker (Cloudflare) ──→ bridge (你的电脑) ──→ OpenClaw
         ↕ HTTP 轮询             ↕ WebSocket             ↕ AI 处理
```

## 功能

- 编号自增，bridge 启动时自动注册获取编号
- 手机扫码进入（直接打开会被拒绝）
- 文字 + 图片消息
- 自动清理不活跃账号
- Windows 自动检测 Python、安装依赖、编码修复

## 开发者

🦞 爪爪 by 秋风悠扬

- B站：[秋风悠扬的个人空间](https://b23.tv/rEEYnVF)
- 抖音：363594031
