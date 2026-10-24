const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const localtunnel = require('localtunnel');

const PORT = 3000;

// 检查指定端口是否已有服务在运行
function checkServerRunning(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/info`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// 获取公网隧道访问免密口令
async function getTunnelPassword() {
  try {
    const res = await fetch('https://loca.lt/mytunnelpassword');
    const text = await res.text();
    return text.trim();
  } catch (e) {
    return '（可在打开链接后查看提示）';
  }
}

// 自动生成给好友使用的免安装启动小脚本 (.bat)
function generateFriendLauncher(publicUrl, password) {
  const batContent = `@echo off
chcp 65001 >nul
title 浮出水面 (Surface) —— 双人实时在线猜词
echo ========================================================
echo       正在以独立软件窗口打开「浮出水面 (Surface)」游戏...
echo ========================================================
echo 联机服务器: ${publicUrl}
echo.
echo 提示：如页面提示输入 Password 密码，填入: ${password}
echo.

set URL=${publicUrl}

:: 优先使用系统内置的 Edge 独立应用模式启动（无地址栏、纯净桌游窗口）
if exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" (
    start "" "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%URL%" --window-size=1120,850
) else if exist "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" (
    start "" "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%URL%" --window-size=1120,850
) else (
    start "" "%URL%"
)
`;

  const outputPath = path.resolve(__dirname, '..', '[好友免安装版] 点我开始游戏.bat');
  fs.writeFileSync(outputPath, batContent, 'utf-8');
  return outputPath;
}

async function main() {
  console.log('\n================================================================');
  console.log('       浮出水面 (Surface) —— 公网跨网联机与启动助手');
  console.log('================================================================\n');

  // 1. 检查或启动本地游戏服务器
  const isRunning = await checkServerRunning(PORT);
  if (isRunning) {
    console.log(`[1/3] 检测到本地 Next.js 服务已在端口 ${PORT} 运行中...`);
  } else {
    console.log(`[1/3] 正在启动本地 Next.js 游戏引擎...`);
    const serverProc = spawn('npm.cmd', ['run', 'dev'], {
      stdio: 'ignore',
      detached: true,
      shell: true,
    });
    serverProc.unref();

    // 等待服务就绪
    let retries = 0;
    while (retries < 30) {
      await new Promise((r) => setTimeout(r, 1000));
      if (await checkServerRunning(PORT)) break;
      retries++;
      process.stdout.write('.');
    }
    console.log('\n   服务已就绪！');
  }

  // 2. 获取免密验证码并建立公网安全隧道
  console.log('[2/3] 正在建立高速公网隧道，让外网好友可以访问...');
  const tunnelPassword = await getTunnelPassword();

  try {
    const tunnel = await localtunnel({ port: PORT });

    // 3. 生成好友快捷小软件
    const launcherPath = generateFriendLauncher(tunnel.url, tunnelPassword);
    console.log('[3/3] 公网安全隧道建立成功！\n');

    console.log('****************************************************************');
    console.log(` 🌐 你的公网联机链接: \x1b[32m\x1b[1m${tunnel.url}\x1b[0m`);
    console.log(` 🔑 首次免密访问口令: \x1b[33m${tunnelPassword}\x1b[0m (打开如提示输入 Password 填入此项)`);
    console.log('****************************************************************\n');

    console.log('【两种方式分享给好友】：');
    console.log(`方式 1（最简单）：直接复制上方公网链接发给微信/QQ好友，朋友用手机或电脑点击即玩！`);
    console.log(`方式 2（免安装小软件）：将项目根目录下的文件发给好友：`);
    console.log(`       [好友免安装版] 点我开始游戏.bat`);
    console.log(`       好友在 Windows 电脑上双击，就会以独立应用窗口无边框启动游戏！\n`);

    console.log('提示：请保持当前黑框窗口在后台运行，关闭窗口即断开公网联机。\n');

    tunnel.on('close', () => {
      console.log('公网隧道已断开。');
      process.exit(0);
    });

    // 自动为房主打开本地游戏窗口
    try {
      const openCmd = process.platform === 'win32' ? 'start' : 'open';
      spawn(openCmd, [`http://localhost:${PORT}`], { shell: true });
    } catch (e) {}

  } catch (err) {
    console.error('建立公网隧道失败:', err.message);
    console.log('提示：您可以检查网络连接，或直接使用本地地址联机：http://localhost:3000');
  }
}

main();

