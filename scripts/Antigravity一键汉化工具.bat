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
echo   [1] 注入深度汉化（推荐：含防官方后台静默升级覆盖）
echo   [2] 注入深度汉化（保留官方自动更新）
echo   [3] 恢复官方原版（从 app.asar.original.bak 无损还原）
echo   [4] 查看当前 Antigravity 安装与汉化状态
echo   [5] 运行本地汉化引擎自检测试 (Node E2E)
echo   [0] 退出
echo.
set "CHOICE="
set /p "CHOICE=请输入选项编号 [0-5] 并按回车: "

if "%CHOICE%"=="1" goto :ACTION_INSTALL_BLOCK
if "%CHOICE%"=="2" goto :ACTION_INSTALL_KEEP
if "%CHOICE%"=="3" goto :ACTION_RESTORE
if "%CHOICE%"=="4" goto :ACTION_STATUS
if "%CHOICE%"=="5" goto :ACTION_TEST
if "%CHOICE%"=="0" goto :END
echo.
echo [提示] 无效输入 "%CHOICE%"，请重新选择。
timeout /t 2 /nobreak >nul
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

if /i "%CUSTOM_DIR:~-8%"=="app.asar" (
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
timeout /t 2 /nobreak >nul
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
set "INSTALL_FLAGS="
goto :DO_INSTALL

:ACTION_INSTALL_KEEP
set "INSTALL_FLAGS=--keep-auto-update"
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
    pause
    goto :MENU
)
echo.
echo [完成] 深度汉化注入成功！
echo 提示：建议在 Antigravity 扩展商店确认已安装微软官方 "Chinese (Simplified) Language Pack"，以实现 VS Code 底座 + 内核 UI 双层完整中文。
call :ASK_LAUNCH
echo.
pause
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
    pause
    goto :MENU
)
call :ASK_LAUNCH
echo.
pause
goto :MENU

:ACTION_STATUS
echo.
call :RESOLVE_TARGET
%PY_CMD% "%ROOT_DIR%src\localize.py" status %EXTRA_ARGS%
echo.
pause
goto :MENU

:ACTION_TEST
echo.
node "%ROOT_DIR%tests\verify_e2e.js"
if errorlevel 1 (
    echo.
    echo [失败] 自检测试未通过，请排查错误输出。
) else (
    echo.
    echo [通过] 所有自动化自检项均已通过。
)
echo.
pause
goto :MENU

:EXIT_FAIL
echo.
pause
exit /b 1

:END
endlocal
exit /b 0
