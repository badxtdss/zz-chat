#!/usr/bin/env python3
"""爪爪桥接 v10 — 直接调 OpenRouter API + User-Agent"""
import json, time, sys, os, urllib.request, urllib.error

API = "https://ai0000.cn/zz/"
MY_ID = "D" + open(os.path.expanduser("~/.zz/id")).read().strip() if os.path.exists(os.path.expanduser("~/.zz/id")) else "D0"
OPENROUTER_KEY = os.environ.get("OPENROUTER_API_KEY", "")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

print(f"""
  ┌────────────────────────────────────────┐
  │  🦞 爪爪桥接 v8                       │
  │  编号: {MY_ID}                         │
  │  引擎: OpenRouter API                  │
  │  等待手机发消息…                       │
  └────────────────────────────────────────┘
""")

last_ts = 0

def ask_ai(content):
    """调 OpenRouter API（走代理）"""
    if not OPENROUTER_KEY:
        return "⚠️ 未配置 API Key"
    
    try:
        # 用 curl 代替 urllib（自动走系统代理）
        import subprocess
        payload = json.dumps({
            "model": "meta-llama/llama-3-8b-instruct",
            "messages": [
                {"role": "system", "content": "你是爪爪助手，简洁友好地回复。用中文回答。"},
                {"role": "user", "content": content}
            ],
            "max_tokens": 1000
        })
        result = subprocess.run(
            ["curl", "-s", "--max-time", "30",
             "-X", "POST", "https://openrouter.ai/api/v1/chat/completions",
             "-H", "Content-Type: application/json",
             "-H", f"Authorization: Bearer {OPENROUTER_KEY}",
             "-d", payload],
            capture_output=True, text=True, timeout=35
        )
        # 去掉前导空格/换行
        raw = result.stdout.strip()
        data = json.loads(raw)
        return data["choices"][0]["message"]["content"]
    except Exception as e:
        return f"⚠️ AI错误: {e}"

def send_reply(to, content):
    """发送回复到 Worker"""
    try:
        req = urllib.request.Request(
            API,
            data=json.dumps({
                "from": MY_ID,
                "to": to,
                "content": content,
                "ts": int(time.time() * 1000)
            }).encode(),
            headers={"Content-Type": "application/json", "User-Agent": UA},
            method="PUT"
        )
        urllib.request.urlopen(req, timeout=10)
    except Exception as e:
        print(f"[错误] 回复发送失败: {e}")

while True:
    try:
        req = urllib.request.Request(API, headers={"User-Agent": UA})
        resp = urllib.request.urlopen(req, timeout=10)
        data = json.loads(resp.read())
        
        ts = data.get("ts", 0)
        to = data.get("to", "")
        
        if to == MY_ID and ts > last_ts:
            last_ts = ts
            sender = data.get("from", "")
            content = data.get("content", "")
            is_image = data.get("isImage", False)
            
            if is_image:
                content = "[图片]"
            
            print(f"[收] #{sender}: {content[:60]}")
            sys.stdout.flush()
            
            reply = ask_ai(content)
            print(f"[回] → #{sender}: {reply[:80]}")
            sys.stdout.flush()
            
            send_reply(sender, reply)
    
    except Exception as e:
        print(f"[轮询错误] {e}")
    
    time.sleep(1)
