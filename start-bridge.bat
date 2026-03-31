@echo off
chcp 65001 >nul 2>&1
title 钳钳桥接

echo.
echo   ┌────────────────────────────────────────┐
echo   │  🦞 钳钳桥接 Windows 启动器            │
echo   └────────────────────────────────────────┘
echo.

:: ── 优先用 Node.js（不需要 Python）──────────────
where node >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Node.js 已安装
    node --version

    :: 检查 ws 模块
    node -e "require('ws')" >nul 2>&1
    if %errorlevel% neq 0 (
        echo [安装] 正在安装 ws...
        npm install -g ws
    )

    echo.
    echo [启动] 钳钳桥接 (Node.js)...
    echo [提示] 关闭此窗口即可停止桥接
    echo.

    :loop_node
    node "%~dp0bridge.js"
    echo [重连] 5秒后重启...
    timeout /t 5 >nul
    goto loop_node
)

:: ── 回退到 Python ──────────────────────────────
set "PYTHON="
where python >nul 2>&1 && set "PYTHON=python"
if not defined PYTHON where python3 >nul 2>&1 && set "PYTHON=python3"
if not defined PYTHON where py >nul 2>&1 && set "PYTHON=py -3"
if not defined PYTHON if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PYTHON=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if not defined PYTHON if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" set "PYTHON=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
if not defined PYTHON if exist "%LOCALAPPDATA%\Programs\Python\Python310\python.exe" set "PYTHON=%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
if not defined PYTHON if exist "%LOCALAPPDATA%\Programs\Python\Launcher\py.exe" set "PYTHON=py -3"

if not defined PYTHON (
    echo [错误] 未找到 Node.js 或 Python
    echo 请安装其中之一:
    echo   Node.js: https://nodejs.org/
    echo   Python:  https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [OK] Python: %PYTHON%
%PYTHON% --version

echo [检查] websockets 依赖...
%PYTHON% -c "import websockets" >nul 2>&1
if %errorlevel% neq 0 (
    echo [安装] 正在安装 websockets...
    %PYTHON% -m pip install websockets
)

echo.
echo [启动] 钳钳桥接 (Python)...
echo [提示] 关闭此窗口即可停止桥接
echo.

:loop_py
%PYTHON% -u "%~dp0bridge.py"
echo [重连] 5秒后重启...
timeout /t 5 >nul
goto loop_py
