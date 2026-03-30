@echo off
chcp 65001 >nul 2>&1
title 🦞 爪爪桥接

echo.
echo   ┌────────────────────────────────────────┐
echo   │  🦞 爪爪桥接 Windows 启动器            │
echo   └────────────────────────────────────────┘
echo.

:: ── 自动检测 Python ──────────────────────────────
set "PYTHON="
where python >nul 2>&1 && set "PYTHON=python"
if not defined PYTHON where python3 >nul 2>&1 && set "PYTHON=python3"
if not defined PYTHON where py >nul 2>&1 && set "PYTHON=py -3"
if not defined PYTHON if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PYTHON=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if not defined PYTHON if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" set "PYTHON=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
if not defined PYTHON if exist "%LOCALAPPDATA%\Programs\Python\Python310\python.exe" set "PYTHON=%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
if not defined PYTHON if exist "%LOCALAPPDATA%\Programs\Python\Launcher\py.exe" set "PYTHON=py -3"

if not defined PYTHON (
    echo [错误] 未找到 Python，请先安装:
    echo https://www.python.org/downloads/
    echo 安装时勾选 "Add Python to PATH"
    pause
    exit /b 1
)

echo [OK] Python: %PYTHON%
%PYTHON% --version

:: ── 安装依赖 ──────────────────────────────────────
echo [检查] websockets 依赖...
%PYTHON% -c "import websockets" >nul 2>&1
if %errorlevel% neq 0 (
    echo [安装] 正在安装 websockets...
    %PYTHON% -m pip install websockets
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败，请手动运行:
        echo   %PYTHON% -m pip install websockets
        pause
        exit /b 1
    )
)

:: ── 启动桥接（内置 5 秒自动重连）─────────────────
echo.
echo [启动] 爪爪桥接...
echo [提示] 关闭此窗口即可停止桥接
echo.

:loop
%PYTHON% -u bridge.py
echo [重连] 5 秒后重启...
timeout /t 5 >nul
goto loop
