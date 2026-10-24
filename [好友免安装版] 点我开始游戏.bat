@echo off
chcp 65001 >nul
title 浮出水面 (Surface) —— 双人实时在线猜词
echo ========================================================
echo       正在以独立软件窗口打开「浮出水面 (Surface)」游戏...
echo ========================================================
echo 联机服务器: https://surface-game-mslkj2.loca.lt
echo.
echo 提示：如页面提示输入 Password 密码，填入: 35.200.44.224
echo （若与房主在同一WiFi或手机热点，可直接访问: http://100.65.54.103:3000 免密秒开）
echo.

set URL=https://surface-game-mslkj2.loca.lt

:: 优先使用系统内置的 Edge 独立应用模式启动（无地址栏、纯净桌游窗口）
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="%URL%" --window-size=1120,850
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="%URL%" --window-size=1120,850
) else (
    start "" "%URL%"
)
