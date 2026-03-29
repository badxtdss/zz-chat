@echo off
chcp 65001 >nul
title 🦞 爪爪桥接

echo.
echo   ┌────────────────────────────────────────┐
echo   │  🦞 爪爪桥接 Windows 启动器            │
echo   └────────────────────────────────────────┘
echo.

:: 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js
    echo 请先安装: https://nodejs.org/
    echo 下载 LTS 版本安装后重启此窗口
    pause
    exit /b 1
)

:: 检查 openclaw CLI
where openclaw >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 openclaw CLI
    echo 请先安装 OpenClaw
    pause
    exit /b 1
)

:: 安装依赖
if not exist "node_modules\ws" (
    echo [安装] 正在安装依赖...
    npm install ws
)

:: 启动桥接
echo [启动] 爪爪桥接...
node bridge.js
