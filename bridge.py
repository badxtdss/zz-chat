#!/usr/bin/env python3
"""爪爪桥接 v15 — WebSocket + openclaw agent CLI 直连"""
import asyncio, json, os, subprocess, time

# 先清除 SOCKS 代理，再 import websockets
os.environ.pop('all_proxy', None)
os.environ.pop('ALL_PROXY', None)

import websockets

API = os.environ.get("ZZ_API", "https://ai0000.cn/zz/")

# 读取用户编号
ID_FILE = os.path.expanduser("~/.zz/id")
if os.path.exists(ID_FILE):
    MY_ID = open(ID_FILE).read().strip()
else:
    MY_ID = str(int(time.time()) % 900 + 100)
    os.makedirs(os.path.dirname(ID_FILE), exist_ok=True)
    with open(ID_FILE, "w") as f:
        f.write(MY_ID)
    print(f"[初始化] 生成编号: {MY_ID}", flush=True)

BRIDGE_ID = "D" + MY_ID
SESSION_ID = "zz-" + MY_ID
WS_URL = API.replace("https://", "wss://").replace("http://", "ws://") + f"?role=bridge&uid={MY_ID}"

last_processed_id = ""


def call_openclaw(message):
    """调用 openclaw agent CLI 获取回复"""
    try:
        result = subprocess.run(
            ["openclaw", "agent", "-m", message, "--session-id", SESSION_ID, "--json", "--timeout", "120"],
            capture_output=True, text=True, timeout=130
        )
        # 解析 JSON（过滤 stderr 的 plugin 日志）
        try:
            # 找到 JSON 开始的位置
            stdout = result.stdout
            json_start = stdout.find('{')
            if json_start < 0:
                return None
            data = json.loads(stdout[json_start:])
            payloads = data.get("result", {}).get("payloads", [])
            if payloads:
                return payloads[0].get("text")
            return None
        except (json.JSONDecodeError, IndexError, KeyError):
            return None
    except subprocess.TimeoutExpired:
        print("[CLI 超时]", flush=True)
        return None
    except Exception as e:
        print(f"[CLI 异常] {e}", flush=True)
        return None


async def handle_message(data):
    """处理收到的消息，调 CLI 拿回复，发回去"""
    global last_processed_id
    msg_id = data.get("msg_id", "")
    to = data.get("to", "")
    content = data.get("content", "")

    if not content:
        return
    if msg_id and msg_id == last_processed_id:
        return
    # 只处理发给自己的消息
    if to and to != MY_ID and to != BRIDGE_ID:
        return

    last_processed_id = msg_id
    sender = data.get("from", "")
    print(f"[收] #{sender}: {content[:80]}", flush=True)

    # 在线程池调 CLI（避免阻塞）
    reply = await asyncio.get_event_loop().run_in_executor(None, call_openclaw, content)

    if not reply:
        print(f"[跳过] CLI 无回复", flush=True)
        return

    print(f"[回] → #{sender}: {reply[:80]}", flush=True)
    return {"msg_id": f"reply-{msg_id}", "from": BRIDGE_ID, "to": sender, "content": reply, "ts": int(time.time() * 1000)}


async def main():
    print(f"""
  ┌────────────────────────────────────────┐
  │  🦞 爪爪桥接 v15                      │
  │  编号: {MY_ID:<10s} (bridge: {BRIDGE_ID})  │
  │  引擎: WebSocket + openclaw agent      │
  └────────────────────────────────────────┘
""", flush=True)

    while True:
        try:
            async with websockets.connect(WS_URL, ping_interval=20, ping_timeout=10, proxy=None) as ws:
                print(f"[已连接] {WS_URL}", flush=True)
                async for raw in ws:
                    try:
                        data = json.loads(raw)
                        reply_msg = await handle_message(data)
                        if reply_msg:
                            await ws.send(json.dumps(reply_msg))
                    except json.JSONDecodeError:
                        pass
                    except Exception as e:
                        print(f"[处理错误] {e}", flush=True)
        except Exception as e:
            print(f"[断开] {e}，5秒后重连...", flush=True)
            await asyncio.sleep(5)


if __name__ == "__main__":
    asyncio.run(main())
