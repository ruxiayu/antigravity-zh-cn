@echo off
chcp 65001 >nul
setlocal
title Antigravity 深度中文汉化工具 (Open-Source Patcher)

for %%I in ("%~dp0..") do set "ROOT_DIR=%%~fI\"

call :CHECK_ENV
if errorlevel 1 goto :EXIT_FAIL

:MENU
cls
echo ========================================================================
echo                  Antigravity 深度中文汉化工具 (开源独立版)
echo ========================================================================
echo.
echo   工作目录: %ROOT_DIR%
echo.
echo   [1] 注入深度汉化（推荐：全版本自适应 + 支持右上角「更新可用」直接升级）
echo   [2] 注入深度汉化（仅手动确认后下载官方更新 · 点右上角再下载安装）
echo   [3] 恢复官方原版（从 app.asar.original.bak 无损还原）
echo   [4] 查看当前 Antigravity 安装与汉化状态
echo   [5] 运行本地汉化引擎自检测试 (Node E2E)
echo   [6] 检查 GitHub 最新汉化包更新
echo   [0] 退出
echo.
set "CHOICE="
set /p "CHOICE=请输入选项编号 [0-6] 并按回车: " || goto :END

if "%CHOICE%"=="1" goto :ACTION_INSTALL_BLOCK
if "%CHOICE%"=="2" goto :ACTION_INSTALL_KEEP
if "%CHOICE%"=="3" goto :ACTION_RESTORE
if "%CHOICE%"=="4" goto :ACTION_STATUS
if "%CHOICE%"=="5" goto :ACTION_TEST
if "%CHOICE%"=="6" goto :ACTION_CHECK_UPDATE
if "%CHOICE%"=="0" goto :END
echo.
echo [提示] 无效输入 "%CHOICE%"，请重新选择。
ping -n 3 127.0.0.1 >nul
goto :MENU

:CHECK_ENV
set "PY_CMD="
where python >nul 2>&1
if not errorlevel 1 (
    python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 8) else 1)" >nul 2>&1
    if not errorlevel 1 set "PY_CMD=python"
)
if not defined PY_CMD (
    where py >nul 2>&1
    if not errorlevel 1 (
        py -3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 8) else 1)" >nul 2>&1
        if not errorlevel 1 set "PY_CMD=py -3"
    )
)
if not defined PY_CMD (
    echo [错误] 未检测到可用的 Python 3.8+ 环境。
    echo 请安装 Python 3 并勾选 "Add Python to PATH" 后重试，或直接使用免环境版 Antigravity-zh-cn-win-x64.exe。
    exit /b 1
)
exit /b 0

:RESOLVE_TARGET
set "EXTRA_ARGS="
set "AGY_EXE="
for /f "usebackq delims=" %%E in (`%PY_CMD% "%ROOT_DIR%src\localize.py" --print-exe 2^>nul`) do set "AGY_EXE=%%E"
if defined AGY_EXE exit /b 0

echo.
echo [提示] 未在注册表或默认安装目录自动检测到 Antigravity。
set "CUSTOM_DIR="
set /p "CUSTOM_DIR=请输入 Antigravity 安装目录或 app.asar 路径（直接回车跳过）: "
if defined CUSTOM_DIR set "CUSTOM_DIR=%CUSTOM_DIR:"=%"
if not defined CUSTOM_DIR exit /b 0
if "%CUSTOM_DIR:~-1%"=="\" set "CUSTOM_DIR=%CUSTOM_DIR:~0,-1%"
if not defined CUSTOM_DIR exit /b 0

if /i "%CUSTOM_DIR:~-5%"==".asar" (
    set "EXTRA_ARGS=--asar "%CUSTOM_DIR%""
    for /f "usebackq delims=" %%E in (`%PY_CMD% "%ROOT_DIR%src\localize.py" --asar "%CUSTOM_DIR%" --print-exe 2^>nul`) do set "AGY_EXE=%%E"
) else (
    set "EXTRA_ARGS=--app-dir "%CUSTOM_DIR%""
    for /f "usebackq delims=" %%E in (`%PY_CMD% "%ROOT_DIR%src\localize.py" --app-dir "%CUSTOM_DIR%" --print-exe 2^>nul`) do set "AGY_EXE=%%E"
)
exit /b 0

:KILL_PROCESSES
echo [1/2] 正在检查并关闭运行中的 Antigravity 进程...
taskkill /F /IM Antigravity.exe >nul 2>&1
taskkill /F /IM language_server_windows_x64.exe >nul 2>&1
ping -n 3 127.0.0.1 >nul
exit /b 0

:ASK_LAUNCH
if not defined AGY_EXE goto :EOF
if not exist "%AGY_EXE%" goto :EOF
echo.
set "LAUNCH=Y"
set /p "LAUNCH=是否立即独立启动 Antigravity？[Y/n]: "
if /i "%LAUNCH%"=="n" goto :EOF
set "ELECTRON_NO_ATTACH_CONSOLE=1"
explorer.exe "%AGY_EXE%"
echo [已启动] %AGY_EXE%
goto :EOF

:ACTION_INSTALL_BLOCK
set "INSTALL_FLAGS=--keep-auto-update"
goto :DO_INSTALL

:ACTION_INSTALL_KEEP
set "INSTALL_FLAGS=--block-auto-update"
goto :DO_INSTALL

:DO_INSTALL
echo.
call :RESOLVE_TARGET
call :KILL_PROCESSES
echo [2/2] 正在执行汉化补丁构建与注入...
%PY_CMD% "%ROOT_DIR%src\localize.py" install %EXTRA_ARGS% %INSTALL_FLAGS%
if errorlevel 1 (
    echo.
    echo [失败] 汉化注入未完成，请检查上方错误信息。
    call :WAIT_KEY
    goto :MENU
)
echo.
echo [完成] 深度汉化注入成功！
echo 提示：建议在 Antigravity 扩展商店确认已安装微软官方 "Chinese (Simplified) Language Pack"，以实现 VS Code 底座 + 内核 UI 双层完整中文。
call :ASK_LAUNCH
echo.
call :WAIT_KEY
goto :MENU

:ACTION_RESTORE
echo.
call :RESOLVE_TARGET
call :KILL_PROCESSES
echo [2/2] 正在恢复官方原版 app.asar...
%PY_CMD% "%ROOT_DIR%src\localize.py" restore %EXTRA_ARGS%
if errorlevel 1 (
    echo.
    echo [失败] 还原未完成，请检查上方错误信息。
    call :WAIT_KEY
    goto :MENU
)
call :ASK_LAUNCH
echo.
call :WAIT_KEY
goto :MENU

:ACTION_STATUS
echo.
call :RESOLVE_TARGET
%PY_CMD% "%ROOT_DIR%src\localize.py" status %EXTRA_ARGS%
echo.
call :WAIT_KEY
goto :MENU

:ACTION_TEST
echo.
where node >nul 2>&1
if errorlevel 1 (
    echo [提示] 未检测到 Node.js，仅开发 E2E 自检需要 Node.js；日常汉化与还原无需安装。
    echo.
    call :WAIT_KEY
    goto :MENU
)
node "%ROOT_DIR%tests\verify_e2e.js"
if errorlevel 1 (
    echo.
    echo [失败] 自检测试未通过，请排查错误输出。
) else (
    echo.
    echo [通过] 所有自动化自检项均已通过。
)
echo.
call :WAIT_KEY
goto :MENU

:ACTION_CHECK_UPDATE
echo.
%PY_CMD% "%ROOT_DIR%src\localize.py" check-update
echo.
call :WAIT_KEY
goto :MENU

:WAIT_KEY
set "_WAIT="
set /p "_WAIT=请按回车键返回主菜单... "
exit /b 0

:EXIT_FAIL
echo.
set "_WAIT="
set /p "_WAIT=请按回车键退出... "
exit /b 1

:END
endlocal
exit /b 0
