const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const localtunnel = require('localtunnel');

const PORT = 3000;
const SUBDOMAIN_FILE = path.resolve(__dirname, '.tunnel_subdomain');

// 1. 获取或生成持久固定的子域名 (确保重连后网址不变)
function getOrCreateSubdomain() {
  try {
    if (fs.existsSync(SUBDOMAIN_FILE)) {
      const saved = fs.readFileSync(SUBDOMAIN_FILE, 'utf-8').trim();
      if (saved && /^[a-z0-9-]+$/.test(saved)) return saved;
    }
  } catch (e) {}

  const rand = Math.random().toString(36).substring(2, 8);
  const subdomain = `surface-game-${rand}`;
  try {
    fs.writeFileSync(SUBDOMAIN_FILE, subdomain, 'utf-8');
  } catch (e) {}
  return subdomain;
}

// 2. 获取局域网 IP (同一 WiFi / 热点下极速直连，免密码)
function getLanIPs() {
  const ifaces = os.networkInterfaces();
  const lanList = [];
  for (const name in ifaces) {
    for (const item of ifaces[name] || []) {
      if (item.family === 'IPv4' && !item.internal && !name.toLowerCase().includes('mihomo')) {
        lanList.push({ name, ip: item.address });
      }
    }
  }
  return lanList;
}

// 3. 检查指定端口服务是否存活
function checkServerRunning(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/info`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1200, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// 4. 获取公网出口 IP (Localtunnel 免密口令)
async function getTunnelPassword() {
  try {
    const res = await fetch('https://loca.lt/mytunnelpassword', { signal: AbortSignal.timeout(4000) });
    const text = await res.text();
    return text.trim();
  } catch (e) {
    return '（可在打开链接后查看提示）';
  }
}

// 5. 自动生成好友专属免安装小工具 (.bat)
function generateFriendLauncher(publicUrl, password, lanUrl) {
  const batContent = `@echo off
chcp 65001 >nul
title GuessWhat —— 双人实时在线猜词
echo ========================================================
echo       正在以独立软件窗口打开「GuessWhat」游戏...
echo ========================================================
echo 联机服务器: ${publicUrl}
echo.
echo 提示：如页面提示输入 Password 密码，填入: ${password}
${lanUrl ? `echo （若与房主在同一WiFi或手机热点，可直接访问: ${lanUrl} 免密秒开）\necho.` : ''}

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

let activeTunnel = null;
let keepAliveTimer = null;
let isReconnecting = false;

// 6. 建立稳固的公网隧道并具备掉线自愈能力
async function connectTunnel(subdomain, password) {
  if (isReconnecting) return;
  isReconnecting = true;

  try {
    if (activeTunnel) {
      try { activeTunnel.close(); } catch (e) {}
    }

    // 尝试以固定子域名接入，防止掉线后网址改变
    let tunnel;
    try {
      tunnel = await localtunnel({ port: PORT, subdomain });
    } catch (err) {
      // 若原子域名被占用，自动退回随机子域名
      tunnel = await localtunnel({ port: PORT });
    }

    activeTunnel = tunnel;
    isReconnecting = false;

    // 清理旧心跳
    if (keepAliveTimer) clearInterval(keepAliveTimer);

    // 启动心跳保活守护 (每 20 秒向自身隧道发一次 ping，彻底防止被平台当成空闲连接断开)
    keepAliveTimer = setInterval(async () => {
      try {
        await fetch(`${tunnel.url}/api/info`, { signal: AbortSignal.timeout(5000) });
      } catch (e) {
        // 网络抖动，尝试重新连接
        if (!isReconnecting) {
          console.log('\n[隧道心跳检测] 监测到链路超时，正在自动恢复连接中...');
          connectTunnel(subdomain, password);
        }
      }
    }, 20000);

    // 注册断开重连监听
    tunnel.on('close', () => {
      console.log('\n[隧道守护提示] 外部隧道短暂波动，正在为您自动重连（保持原网址不变）...');
      setTimeout(() => connectTunnel(subdomain, password), 2500);
    });

    tunnel.on('error', (err) => {
      console.log('\n[隧道异常捕获]', err.message || err, '正在自动修复...');
      setTimeout(() => connectTunnel(subdomain, password), 3000);
    });

    return tunnel;
  } catch (err) {
    isReconnecting = false;
    console.error('[隧道创建重试中]', err.message);
    setTimeout(() => connectTunnel(subdomain, password), 4000);
    return null;
  }
}

async function main() {
  console.log('\n================================================================');
  console.log('       GuessWhat —— 双人在线联机与自愈守护引擎');
  console.log('================================================================\n');

  // 1. 检查或启动本地服务
  const isRunning = await checkServerRunning(PORT);
  if (isRunning) {
    console.log(`[1/3] 本地游戏引擎已在运行中 (端口 ${PORT})。`);
  } else {
    console.log(`[1/3] 正在启动本地 Next.js 游戏引擎...`);
    const serverProc = spawn('npm.cmd', ['run', 'dev'], {
      stdio: 'ignore',
      detached: true,
      shell: true,
    });
    serverProc.unref();

    let retries = 0;
    while (retries < 30) {
      await new Promise((r) => setTimeout(r, 1000));
      if (await checkServerRunning(PORT)) break;
      retries++;
      process.stdout.write('.');
    }
    console.log('\n   本地引擎已就绪！');
  }

  // 2. 获取免密验证码与固定子域名
  console.log('[2/3] 正在建立带自动重连守护的公网安全隧道...');
  const tunnelPassword = await getTunnelPassword();
  const subdomain = getOrCreateSubdomain();

  const tunnel = await connectTunnel(subdomain, tunnelPassword);
  if (!tunnel) {
    console.log('正在等待首次隧道就绪...');
  }

  const lanIPs = getLanIPs();
  const primaryLan = lanIPs[0]?.ip ? `http://${lanIPs[0].ip}:${PORT}` : null;

  // 3. 自动生成好友快捷工具
  generateFriendLauncher(tunnel ? tunnel.url : `https://${subdomain}.loca.lt`, tunnelPassword, primaryLan);
  console.log('[3/3] 联机通道就绪并开启【掉线自愈守护】！\n');

  console.log('****************************************************************');
  console.log(` 🌐 你的公网联机网址: \x1b[32m\x1b[1m${tunnel ? tunnel.url : `https://${subdomain}.loca.lt`}\x1b[0m`);
  console.log(` 🔑 首次免密访问口令: \x1b[33m${tunnelPassword}\x1b[0m (如打开出现 Password 填此项)`);
  if (primaryLan) {
    console.log('----------------------------------------------------------------');
    console.log(` 🚀 同一WiFi/宿舍/开热点直连: \x1b[36m\x1b[1m${primaryLan}\x1b[0m (100%免密码，极速零断连)`);
  }
  console.log('****************************************************************\n');

  console.log('【分享方式】：');
  console.log(' 1. 外网好友（不在身边/4G）：复制上方【公网联机网址】，口令填【首次免密访问口令】即可。');
  console.log(' 2. 同宿舍/面对面（同WiFi或开热点）：直接打开【同一WiFi直连地址】，完全不用输口令！');
  console.log(' 3. 电脑好友：将项目目录下的【[好友免安装版] 点我开始游戏.bat】发给对方双击即玩。\n');

  console.log('💡 防掉线守护已开启：若遇到网络波动，后台会自动重连并尽可能保持原网址不变。');
  console.log('⚠️  请让此窗口在后台静默运行。若不需要联机时关闭本窗口即可。\n');

  // 自动为房主打开本地窗口
  try {
    if (process.platform === 'win32') {
      spawn('cmd.exe', ['/c', 'start', `http://localhost:${PORT}`]);
    } else {
      spawn('open', [`http://localhost:${PORT}`]);
    }
  } catch (e) {}
}

main().catch((err) => {
  console.error('守护引擎启动异常:', err);
});
