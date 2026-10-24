@echo off
chcp 65001 >nul
title 浮出水面 (Surface) —— 双人实时在线猜词
echo ========================================================
echo       正在以独立软件窗口打开「浮出水面 (Surface)」游戏...
echo ========================================================
echo.

:: 默认地址（房主启动服务后，该地址会自动更新为最新的公网联机网址）
set URL=http://localhost:3000

if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="%URL%" --window-size=1120,850
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="%URL%" --window-size=1120,850
) else (
    start "" "%URL%"
)
