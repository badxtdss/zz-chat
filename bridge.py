#!/usr/bin/env python3
"""爪爪桥接 v13 — msg_id 去重 + 读完即焚"""
import json, time, sys, os, subprocess

API = "https://ai0000.cn/zz/"
MY_ID = "D" + open(os.path.expanduser("~/.zz/id")).read().strip() if os.path.exists(os.path.expanduser("~/.zz/id")) else "D0"
QUEUE_DIR = os.path.expanduser("~/.openclaw/workspace/openchat/queue")
INBOX = os.path.join(QUEUE_DIR, "inbox.json")
OUTBOX = os.path.join(QUEUE_DIR, "outbox.json")

print(f"""
  ┌────────────────────────────────────────┐
  │  🦞 爪爪桥接 v13                      │
  │  编号: {MY_ID}                         │
  │  引擎: curl + 文件队列 → OpenClaw      │
  │  去重: msg_id + 读完即焚               │
  │  等待手机发消息…                       │
  └────────────────────────────────────────┘
""", flush=True)

last_processed_id = ""

def curl_get(url):
    try:
        r = subprocess.run(["curl", "-s", "--connect-timeout", "10", "--max-time", "15", url],
                          capture_output=True, text=True, timeout=20)
        return r.stdout.strip()
    except:
        return ""

def curl_put(url, data):
    try:
        r = subprocess.run(["curl", "-s", "--connect-timeout", "10", "--max-time", "15",
                           "-X", "PUT", "-H", "Content-Type: application/json",
                           "-d", json.dumps(data), url],
                          capture_output=True, text=True, timeout=20)
        return r.stdout.strip()
    except:
        return ""

def gen_msg_id():
    return "uuid-" + str(int(time.time() * 1000)) + "-" + os.urandom(4).hex()

while True:
    try:
        raw = curl_get(API)
        if not raw:
            time.sleep(2)
            continue

        data = json.loads(raw)
        msg_id = data.get("msg_id", "")
        to = data.get("to", "")

        # 跳过已处理的消息
        if msg_id and msg_id == last_processed_id:
            time.sleep(1)
            continue

        if to == MY_ID and data.get("content"):
            last_processed_id = msg_id
            sender = data.get("from", "")
            content = data.get("content", "")

            print(f"[收] #{sender}: {content[:60]} (id={msg_id})", flush=True)

            # 检查 inbox 是否为空
            try:
                with open(INBOX) as f:
                    inbox = json.load(f)
                if inbox.get("content"):
                    print(f"[跳过] inbox 未处理", flush=True)
                    continue
            except:
                pass

            # 写入 inbox
            with open(INBOX, "w") as f:
                json.dump({"from": sender, "content": content, "msg_id": msg_id, "ts": data.get("ts", 0)}, f)

            # 等待回复（最多 90 秒）
            reply = ""
            reply_msg_id = ""
            for i in range(90):
                time.sleep(1)
                try:
                    with open(OUTBOX) as f:
                        out = json.load(f)
                    if out.get("to") == sender and out.get("content"):
                        reply = out.get("content", "")
                        reply_msg_id = out.get("msg_id", gen_msg_id())
                        # ★ 读完即焚：先清空文件
                        with open(OUTBOX, "w") as f:
                            json.dump({"to": "", "content": "", "msg_id": "", "ts": 0}, f)
                        break
                except:
                    pass

            if not reply:
                reply = "⏳ 处理中，请稍候..."
                reply_msg_id = gen_msg_id()

            print(f"[回] → #{sender}: {reply[:80]} (id={reply_msg_id})", flush=True)
            # 清空文件后再发 PUT
            curl_put(API, {"msg_id": reply_msg_id, "from": MY_ID, "to": sender, "content": reply, "ts": int(time.time() * 1000)})

    except Exception as e:
        print(f"[错误] {e}", flush=True)

    time.sleep(1)
