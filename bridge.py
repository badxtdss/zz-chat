#!/usr/bin/env python3
"""爪爪桥接 v14 — WebSocket 长连接 + 读完即焚"""
import asyncio, json, os, time, websockets

API = os.environ.get("ZZ_API", "https://ai0000.cn/zz/")
MY_ID = "D" + open(os.path.expanduser("~/.zz/id")).read().strip() if os.path.exists(os.path.expanduser("~/.zz/id")) else "D0"
QUEUE_DIR = os.environ.get("ZZ_QUEUE_DIR", os.path.expanduser("~/.openclaw/workspace/openchat/queue"))
INBOX = os.path.join(QUEUE_DIR, "inbox.json")
OUTBOX = os.path.join(QUEUE_DIR, "outbox.json")

# WebSocket URL: 从 REST URL 推导
WS_URL = API.replace("https://", "wss://").replace("http://", "ws://") + "?role=bridge"

last_processed_id = ""

def gen_msg_id():
    return "uuid-" + str(int(time.time() * 1000)) + "-" + os.urandom(4).hex()

async def check_outbox(ws):
    """检查 outbox，有回复就通过 WebSocket 发送"""
    try:
        with open(OUTBOX) as f:
            out = json.load(f)
        if out.get("to") and out.get("content"):
            reply = out["content"]
            reply_msg_id = out.get("msg_id", gen_msg_id())
            to = out["to"]
            # 读完即焚
            with open(OUTBOX, "w") as f:
                json.dump({"to": "", "content": "", "msg_id": "", "ts": 0}, f)
            # 通过 WebSocket 发送回复
            msg = {"msg_id": reply_msg_id, "from": MY_ID, "to": to, "content": reply, "ts": int(time.time() * 1000)}
            await ws.send(json.dumps(msg))
            print(f"[回] → #{to}: {reply[:80]} (id={reply_msg_id})", flush=True)
    except Exception:
        pass

async def handle_message(data):
    """处理收到的消息，写入 inbox"""
    global last_processed_id
    msg_id = data.get("msg_id", "")
    to = data.get("to", "")
    content = data.get("content", "")

    if not to or not content:
        return
    if msg_id and msg_id == last_processed_id:
        return
    if to != MY_ID:
        return

    last_processed_id = msg_id
    sender = data.get("from", "")
    print(f"[收] #{sender}: {content[:60]} (id={msg_id})", flush=True)

    # 检查 inbox 是否为空
    try:
        with open(INBOX) as f:
            inbox = json.load(f)
        if inbox.get("content"):
            print(f"[跳过] inbox 未处理", flush=True)
            return
    except Exception:
        pass

    # 写入 inbox
    with open(INBOX, "w") as f:
        json.dump({"from": sender, "content": content, "msg_id": msg_id, "ts": data.get("ts", 0)}, f)

async def main():
    print(f"""
  ┌────────────────────────────────────────┐
  │  🦞 爪爪桥接 v14                      │
  │  编号: {MY_ID}                         │
  │  引擎: WebSocket 长连接                │
  │  去重: msg_id + 读完即焚               │
  └────────────────────────────────────────┘
""", flush=True)

    while True:
        try:
            async with websockets.connect(WS_URL, ping_interval=20, ping_timeout=10) as ws:
                print(f"[已连接] {WS_URL}", flush=True)

                # 定时检查 outbox 的任务
                async def poll_outbox():
                    while True:
                        await asyncio.sleep(1)
                        await check_outbox(ws)

                outbox_task = asyncio.create_task(poll_outbox())

                try:
                    async for raw in ws:
                        try:
                            data = json.loads(raw)
                            await handle_message(data)
                        except json.JSONDecodeError:
                            pass
                        except Exception as e:
                            print(f"[处理错误] {e}", flush=True)
                finally:
                    outbox_task.cancel()

        except Exception as e:
            print(f"[断开] {e}，5秒后重连...", flush=True)
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(main())
