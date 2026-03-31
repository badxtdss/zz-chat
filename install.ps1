# 爪爪 🦞 — Windows 一键安装脚本
# 用法: powershell -c "irm https://zz-chat.pages.dev/install.ps1 | iex"

$ErrorActionPreference = "Stop"

$REPO = "badxtdss/zz-chat"
$BRIDGE_URL = "https://raw.githubusercontent.com/$REPO/main/bridge.py"
$INSTALL_DIR = "$HOME\.zz-chat"

Write-Host ""
Write-Host "  ┌──────────────────────────────────────┐" -ForegroundColor Blue
Write-Host "  │  🦞 爪爪 — 手机直连 OpenClaw         │" -ForegroundColor Blue
Write-Host "  │  Windows 一键安装                     │" -ForegroundColor Blue
Write-Host "  └──────────────────────────────────────┘" -ForegroundColor Blue
Write-Host ""

# [1/5] 检测系统
Write-Host "[1/5] 检测系统..." -ForegroundColor Green
Write-Host "  Windows $([Environment]::OSVersion.Version)"

# [2/5] 检测 Python
Write-Host "[2/5] 检测 Python..." -ForegroundColor Green
$PYTHON = $null
foreach ($cmd in @("python", "python3", "py -3")) {
    $exe = ($cmd -split " ")[0]
    if (Get-Command $exe -ErrorAction SilentlyContinue) {
        $PYTHON = $cmd
        break
    }
}

if (-not $PYTHON) {
    # 检查常见安装路径
    $commonPaths = @(
        "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python310\python.exe"
    )
    foreach ($p in $commonPaths) {
        if (Test-Path $p) {
            $PYTHON = "`"$p`""
            break
        }
    }
}

if (-not $PYTHON) {
    Write-Host "  未找到 Python，正在自动安装..." -ForegroundColor Yellow
    
    # 尝试用 winget 安装
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host "  使用 winget 安装 Python..." -ForegroundColor Yellow
        winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements
    } else {
        Write-Host ""
        Write-Host "  ❌ 请手动安装 Python:" -ForegroundColor Red
        Write-Host "  https://www.python.org/downloads/" 
        Write-Host "  安装时勾选 'Add Python to PATH'"
        Write-Host ""
        Read-Host "  按回车退出"
        exit 1
    }
    
    # 刷新 PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    $PYTHON = "python"
}

Write-Host "  Python: " -NoNewline
& $PYTHON --version

# [3/5] 安装依赖
Write-Host "[3/5] 安装 Python 依赖..." -ForegroundColor Green
& $PYTHON -m pip install websockets certifi --quiet --user 2>$null

# [4/5] 下载桥接脚本
Write-Host "[4/5] 下载桥接脚本..." -ForegroundColor Green
New-Item -ItemType Directory -Force -Path $INSTALL_DIR | Out-Null
Invoke-WebRequest -Uri $BRIDGE_URL -OutFile "$INSTALL_DIR\bridge.py"
Write-Host "  ✓ $INSTALL_DIR\bridge.py"

# [5/5] 完成
Write-Host "[5/5] 安装完成！" -ForegroundColor Green
Write-Host ""
Write-Host "  ┌──────────────────────────────────────┐" -ForegroundColor Blue
Write-Host "  │  ✅ 安装成功！                        │" -ForegroundColor Blue
Write-Host "  │                                      │" -ForegroundColor Blue
Write-Host "  │  启动命令:                           │" -ForegroundColor Blue
Write-Host "  │  python $INSTALL_DIR\bridge.py       │" -ForegroundColor Blue
Write-Host "  │                                      │" -ForegroundColor Blue
Write-Host "  │  扫码即可开始聊天 🦞                 │" -ForegroundColor Blue
Write-Host "  └──────────────────────────────────────┘" -ForegroundColor Blue
Write-Host ""

$reply = Read-Host "  是否立即启动? [Y/n]"
if ($reply -eq "" -or $reply -match "^[Yy]") {
    Write-Host "  启动中... (Ctrl+C 停止)"
    Write-Host ""
    & $PYTHON "$INSTALL_DIR\bridge.py"
}
