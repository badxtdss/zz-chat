#!/bin/bash
# 爪爪桥接 v7 — 增加超时
DIR="$HOME/.zz"
API="https://zz-proxy.badxtdssr.workers.dev"
MY_ID="D$(cat "$DIR/id" 2>/dev/null || echo 0)"

echo ""
echo "  ┌────────────────────────────────────────┐"
echo "  │  🦞 爪爪桥接 v7                       │"
echo "  │  编号: $MY_ID                          │"
echo "  │  引擎: OpenClaw CLI                    │"
echo "  │  超时: 3 分钟                          │"
echo "  │  等待手机发消息…                       │"
echo "  └────────────────────────────────────────┘"
echo ""

LAST_TS=0

while true; do
  RESP=$(curl -s --max-time 8 "$API" 2>/dev/null)

  TS=$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('ts',0))" 2>/dev/null || echo "0")
  TO=$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('to',''))" 2>/dev/null || echo "")

  if [ "$TO" = "$MY_ID" ] && [ "$TS" -gt "$LAST_TS" ]; then
    LAST_TS="$TS"

    SENDER=$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('from',''))" 2>/dev/null || echo "")
    CONTENT=$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('content',''))" 2>/dev/null || echo "")
    IS_IMAGE=$(echo "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('isImage',False))" 2>/dev/null || echo "False")

    if [ "$IS_IMAGE" = "True" ]; then
      CONTENT="[图片]"
    fi

    echo "[收] #$SENDER: ${CONTENT:0:60}"
    echo "[处理中...]"

    # 调用 OpenClaw（增加超时到 180 秒）
    REPLY=$(gtimeout 180 openclaw agent --agent main --message "$CONTENT" 2>/dev/null | grep -v '^\[' | grep -v '^$' | grep -v '^─' | grep -v '^🦞' | grep -v 'plugins' | grep -v 'Registered' | grep -v 'loaded without' || echo "⏳ 超时")

    if [ -z "$REPLY" ]; then
      REPLY="(无回复)"
    fi
    if [ ${#REPLY} -gt 2000 ]; then
      REPLY="${REPLY:0:2000}..."
    fi

    echo "[回] → #$SENDER: ${REPLY:0:80}"

    TS_MS=$(date +%s)000
    ESCAPED_REPLY=$(echo "$REPLY" | python3 -c "import sys,json;print(json.dumps(sys.stdin.read().strip()))")
    curl -s -X PUT -H "Content-Type: application/json" \
      -d "{\"from\":\"$MY_ID\",\"to\":\"$SENDER\",\"content\":$ESCAPED_REPLY,\"ts\":$TS_MS}" \
      "$API" > /dev/null 2>&1

    echo "[完成]"
  fi
  sleep 1
done
