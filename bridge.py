#!/usr/bin/env python3
"""爪爪桥接 v12 — curl 轮询，文件队列"""
import json, time, sys, os, subprocess

API = "https://ai0000.cn/zz/"
MY_ID = "D" + open(os.path.expanduser("~/.zz/id")).read().strip() if os.path.exists(os.path.expanduser("~/.zz/id")) else "D0"
QUEUE_DIR = os.path.expanduser("~/.openclaw/workspace/openchat/queue")
INBOX = os.path.join(QUEUE_DIR, "inbox.json")
OUTBOX = os.path.join(QUEUE_DIR, "outbox.json")

print(f"""
  ┌────────────────────────────────────────┐
  │  🦞 爪爪桥接 v12                      │
  │  编号: {MY_ID}                         │
  │  引擎: curl + 文件队列 → OpenClaw      │
  │  等待手机发消息…                       │
  └────────────────────────────────────────┘
""", flush=True)

last_ts = 0

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

while True:
    try:
        raw = curl_get(API)
        if not raw:
            time.sleep(2)
            continue
        
        data = json.loads(raw)
        ts = data.get("ts", 0)
        to = data.get("to", "")
        
        if to == MY_ID and ts > last_ts:
            last_ts = ts
            sender = data.get("from", "")
            content = data.get("content", "")
            
            print(f"[收] #{sender}: {content[:60]}", flush=True)
            
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
                json.dump({"from": sender, "content": content, "ts": ts}, f)
            
            # 等待回复（最多 90 秒）
            reply = ""
            for i in range(90):
                time.sleep(1)
                try:
                    with open(OUTBOX) as f:
                        out = json.load(f)
                    if out.get("to") == sender and out.get("content"):
                        reply = out.get("content", "")
                        # 清空 outbox
                        with open(OUTBOX, "w") as f:
                            json.dump({"to": "", "content": "", "ts": 0}, f)
                        break
                except:
                    pass
            
            if not reply:
                reply = "⏳ 处理中，请稍候..."
            
            print(f"[回] → #{sender}: {reply[:80]}", flush=True)
            msg_id = "uuid-" + str(int(time.time() * 1000)) + "-" + os.urandom(3).hex()
            curl_put(API, {"msg_id": msg_id, "from": MY_ID, "to": sender, "content": reply, "ts": int(time.time() * 1000)})
    
    except Exception as e:
        print(f"[错误] {e}", flush=True)
    
    time.sleep(1)
