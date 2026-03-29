#!/bin/bash
# 爪爪桥接 v4 — Cloudflare Worker
DIR="$HOME/.zz"
API="https://zz-proxy.badxtdssr.workers.dev"
MY_ID="D$(cat "$DIR/id" 2>/dev/null || echo 0)"

echo ""
echo "  ┌────────────────────────────────────────┐"
echo "  │  🦞 爪爪桥接 v4                       │"
echo "  │  编号: $MY_ID                          │"
echo "  │  引擎: OpenClaw CLI                    │"
echo "  │  等待手机发消息…                       │"
echo "  └────────────────────────────────────────┘"
echo ""

LAST_TS=0

while true; do
  RESP=$(curl -s --max-time 8 "$API" 2>/dev/null)

  # 检查是否有新消息
  TS=$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('ts',0))" 2>/dev/null || echo "0")
  TO=$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('to',''))" 2>/dev/null || echo "")

  if [ "$TO" = "$MY_ID" ] && [ "$TS" -gt "$LAST_TS" ]; then
    LAST_TS="$TS"

    python3 -c "
import sys, json, subprocess, urllib.request

data = json.load(sys.stdin)
sender = data.get('from','')
content = data.get('content','')
is_image = data.get('isImage', False)

if is_image:
    content = '[图片]'

print(f'[收] #{sender}: {content[:60]}')

try:
    result = subprocess.run(
        ['openclaw', 'agent', '--agent', 'main', '--message', content],
        capture_output=True, text=True, timeout=120
    )
    lines = [l for l in result.stdout.strip().split('\n') if l.strip() and not l.startswith('[')]
    reply = '\n'.join(lines) if lines else '(无回复)'
    if len(reply) > 2000:
        reply = reply[:2000] + '...'
except subprocess.TimeoutExpired:
    reply = '⏳ 处理超时'
except Exception as e:
    reply = f'⚠️ 错误: {e}'

print(f'[回] → #{sender}: {reply[:80]}')

# 发送回复
import time
req = urllib.request.Request(
    '$API',
    data=json.dumps({'from': '$MY_ID', 'to': sender, 'content': reply, 'ts': int(time.time()*1000)}).encode(),
    headers={'Content-Type': 'application/json'}
)
try:
    urllib.request.urlopen(req, timeout=10)
except Exception as e:
    print(f'[错误] 回复发送失败: {e}')
" 2>/dev/null <<< "$RESP"
  fi
  sleep 1
done
