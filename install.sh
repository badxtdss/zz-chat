#!/bin/bash
# 爪爪 🦞 — 一键安装脚本
# 用法: curl -fsSL https://zz-chat.pages.dev/install.sh | bash
# 或:   bash install.sh [--worker URL] [--uid N]

set -e

REPO="badxtdss/zz-chat"
GITEE_REPO="badxtd/zz-chat"
INSTALL_DIR="$HOME/.zz-chat"
BRIDGE_PY_URL="https://raw.githubusercontent.com/$REPO/main/bridge.py"
WORKER_URL=""
UID_NUM=""

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --worker) WORKER_URL="$2"; shift 2 ;;
        --uid) UID_NUM="$2"; shift 2 ;;
        --gitee) USE_GITEE=1; shift ;;
        *) shift ;;
    esac
done

echo ""
echo -e "${BLUE}  ┌──────────────────────────────────────┐${NC}"
echo -e "${BLUE}  │  🦞 爪爪 — 手机直连 OpenClaw         │${NC}"
echo -e "${BLUE}  │  一键安装                             │${NC}"
echo -e "${BLUE}  └──────────────────────────────────────┘${NC}"
echo ""

# 检测系统
OS="$(uname -s)"
ARCH="$(uname -m)"
echo -e "${GREEN}[1/5]${NC} 检测系统: ${OS} ${ARCH}"

# 检测/安装 Python 3
echo -e "${GREEN}[2/5]${NC} 检测 Python..."
if command -v python3 &>/dev/null; then
    PYTHON="python3"
elif command -v python &>/dev/null; then
    PYTHON="python"
else
    echo -e "${YELLOW}  未检测到 Python，正在安装...${NC}"
    if [[ "$OS" == "Darwin" ]]; then
        if command -v brew &>/dev/null; then
            brew install python3
        else
            echo -e "${RED}  请先安装 Homebrew: https://brew.sh${NC}"
            echo "  然后运行: brew install python3"
            exit 1
        fi
    elif [[ -f /etc/debian_version ]]; then
        sudo apt-get update && sudo apt-get install -y python3 python3-pip
    elif [[ -f /etc/redhat-release ]]; then
        sudo yum install -y python3
    else
        echo -e "${RED}  无法自动安装 Python，请手动安装 Python 3.8+${NC}"
        exit 1
    fi
    PYTHON="python3"
fi
echo -e "  Python: $($PYTHON --version)"

# 安装 websockets
echo -e "${GREEN}[3/5]${NC} 检测 Python 依赖..."
$PYTHON -c "import websockets" 2>/dev/null || {
    echo -e "  安装 websockets..."
    $PYTHON -m pip install websockets certifi --quiet --user 2>/dev/null || \
    $PYTHON -m pip3 install websockets certifi --quiet --user 2>/dev/null || \
    $PYTHON -m pip install websockets certifi --quiet 2>/dev/null
}

# 创建安装目录
echo -e "${GREEN}[4/5]${NC} 下载桥接脚本..."
mkdir -p "$INSTALL_DIR"

# 下载 bridge.py — 先尝试 GitHub，失败则尝试 Gitee
DOWNLOAD_OK=0
if [[ "$USE_GITEE" == "1" ]] || [[ -n "$GITEE_REPO" ]]; then
    GITEE_URL="https://gitee.com/$GITEE_REPO/raw/main/bridge.py"
    if curl -fsSL "$GITEE_URL" -o "$INSTALL_DIR/bridge.py" 2>/dev/null; then
        DOWNLOAD_OK=1
        echo -e "  下载源: Gitee ✓"
    fi
fi

if [[ "$DOWNLOAD_OK" == "0" ]]; then
    if curl -fsSL "$BRIDGE_PY_URL" -o "$INSTALL_DIR/bridge.py" 2>/dev/null; then
        DOWNLOAD_OK=1
        echo -e "  下载源: GitHub ✓"
    else
        echo -e "${RED}  下载失败！请检查网络或使用 --gitee 参数${NC}"
        exit 1
    fi
fi

chmod +x "$INSTALL_DIR/bridge.py"

# 保存 worker URL
if [[ -n "$WORKER_URL" ]]; then
    mkdir -p "$HOME/.zz"
    echo "$WORKER_URL" > "$HOME/.zz/worker_url"
    echo -e "  Worker: $WORKER_URL"
fi

# 启动
echo -e "${GREEN}[5/5]${NC} 安装完成！"
echo ""
echo -e "${BLUE}  ┌──────────────────────────────────────┐${NC}"
echo -e "${BLUE}  │  ✅ 安装成功！                        │${NC}"
echo -e "${BLUE}  │                                      │${NC}"
echo -e "${BLUE}  │  启动命令:                           │${NC}"
echo -e "${BLUE}  │  $PYTHON $INSTALL_DIR/bridge.py${NC}"
if [[ -n "$WORKER_URL" ]]; then
echo -e "${BLUE}  │                                      │${NC}"
echo -e "${BLUE}  │  手机打开:                           │${NC}"
echo -e "${BLUE}  │  $WORKER_URL${NC}"
fi
echo -e "${BLUE}  │                                      │${NC}"
echo -e "${BLUE}  │  扫码即可开始聊天 🦞                 │${NC}"
echo -e "${BLUE}  └──────────────────────────────────────┘${NC}"
echo ""

# 询问是否立即启动
read -p "  是否立即启动? [Y/n] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
    echo "  启动中... (Ctrl+C 停止)"
    echo ""
    $PYTHON "$INSTALL_DIR/bridge.py"
fi
