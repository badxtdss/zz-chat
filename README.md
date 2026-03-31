# 爪爪 🦞 — 手机直连 OpenClaw
手机扫码即可和你的 OpenClaw AI 对话。
钱钱来啦！国内首个手机扫码直连“龙虾”，好友聊天无后台审核。“钳钳”正式放号！
没中间商，没云端，甚至连App都没有。创始号段限量 8888 个，手慢则无。
错过 5 位数 QQ，别再错过你的 AI 原始股！

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
