# 🌊 GuessWhat —— 双人实时在线是非推理猜词游戏

<p align="center">
  <img src="public/icon.svg" width="128" height="128" alt="GuessWhat Logo" />
</p>

<p align="center">
  <strong>在「是」与「否」的边缘，让沉睡在水下的隐秘真相逐层浮现。</strong><br>
  一款清新治愈、极简优雅的现代双人在线推理桌游。支持好友跨网联机、双向语音连麦、微信同款对讲语音条、内置聊天室、丰富全能词库、AI 灵感生成与逻辑二分辅助。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15_App_Router-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css" alt="Tailwind" />
  <img src="https://img.shields.io/badge/WebRTC-P2P_%2B_TURN_Relay-3B82F6" alt="WebRTC" />
  <img src="https://img.shields.io/badge/AI_Support-DeepSeek_%7C_Gemini_%7C_BYOK-5F7C69" alt="AI" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

---

## 📖 游戏核心玩法

1. **设置秘密**：一名玩家担任**出题人**，根据选定主题挑选或自定义秘密词条（例如：“天气观测员”、“水熊虫”）。
2. **逻辑二分**：另一名玩家担任**猜词人**，连续提出只能用 **【是】** 、**【不是】** 或 **【不确定】** 回答的问题（例如：“它是活着的生物吗？”、“它常见于室内吗？”）。
3. **真相大白**：通过逐步排除缩小范围，发起正式猜词！猜词人猜中即可揭晓答案并获得对局胜利！

---

## ✨ 最新核心亮点与特性

- 🎮 **双人实时在线**：房主创建房间一键生成 6 位房间码与邀请链接，好友点开即连，支持手机、平板、电脑跨端毫秒级实时同步。
- 🎙️ **双人实时语音连麦**：集成 WebRTC 与全球 OpenRelay TURN 中继节点池（支持 UDP + TCP 443端口转发），彻底突破手机 4G/5G 蜂窝对称 NAT 与 VPN 阻拦，边聊边猜更畅快。
- 📻 **微信同款对讲语音小纸条**：输入框内置录音功能，一键录制并发送语音消息（`[▶ 3" 对讲]`），走标准 HTTPS 传输，任何网络、任何防火墙下 100% 绝对通畅。
- 💬 **联机对局独立聊天室**：
  - 悬浮精致抽屉设计，高对比度深色顶栏与柔和灰底画布，与主游戏界面界限分明；
  - 微信同款时间分割标记（两条消息间隔超过 1 分钟自动打卡标时）；
  - 完美适配 iPad 横屏与桌面宽屏，固定优雅宽度（380px），杜绝全屏横向拉伸；
  - 一键快捷常用梗词（*“太难啦！”*、*“有点头绪了”*、*“给点线索嘛”*等）。
- 📌 **常用房间一键置顶**：
  - 支持将常玩的房间一键置顶，卡片带有专属斜插大头针 Logo（`-rotate-45`）与加深立体投影；
  - 首页历史列表自动置顶排序；房间内顶栏也支持随时收藏/取消置顶。
- 🔄 **同房多局连玩与攻守互换**：
  - 一局结束后直接在结算面板点击“下一局”或“互换角色再来一局”，无需退房重新分享链接，大比分持续保留。
- 🛡️ **微信/多设备无缝身份恢复**：
  - 彻底解决微信跳出、切换浏览器或误关网页后被误报“房间已满员”的顽疾；支持同名无缝接管或一键身份认领（*“我是出题人 / 我是猜词人”*）。
- ✏️ **出题人防手滑撤回改答（`[改答]`）**：
  - 出题人点错回答时，可随时点击小巧的 `[改答]` 按钮更正，不打乱题号计数，实时同步猜词人。
- 🔔 **原生 Web Audio 清脆提示音**：
  - 浏览器原生合成空灵 Ding 提示音与大吉胜利和弦，零音频文件网络延迟，支持顶部一键静音。
- 🧊 **零剧透安全保护**：
  - 对局未结算前，秘密答案仅对出题人可见，接口响应严格在服务端过滤脱敏，旁观者与猜词人抓包绝对无法提前剧透。
- 📚 **全能精选词库**：内置 11 大主题、数百条涵盖大众到极其冷门小众的特色词条（如“天气观测员”、“古籍修复师”、“姑娘果”等）。
- 💡 **AI 智能推理顾问**：支持 DeepSeek、OpenAI、Gemini 双向灵感换一批与二分法提问思路辅助。

---

## 🚀 小白本地 3 分钟快速上手开玩

无需购买云服务器，在自己的电脑上即可极速启动体验：

### 1. 下载源码与安装依赖
```bash
# 1. 克隆项目源码
git clone https://github.com/CyrusHuang-coder/GuessWhat.git
cd GuessWhat

# 2. 安装依赖包 (推荐 Node.js >= 18.18)
npm install
```

### 2. 本地启动
```bash
npm run dev
```
打开浏览器访问：`http://localhost:3000`，即可打开游戏！
> **提示**：可以在同一个浏览器中打开一个正常标签页（创建房间）和一个**无痕模式标签页**（加入房间），在同一台电脑上模拟双人联机对战！

### 3. 同一局域网 / 宿舍 Wi-Fi 联机开玩（完全免翻墙、免外网）
如果您和朋友在同一个 Wi-Fi（如宿舍、家里、咖啡厅）下：
1. 在电脑终端查看你的局域网 IP（Windows 运行 `ipconfig`，Mac/Linux 运行 `ifconfig`，例如 `192.168.1.5`）；
2. 朋友在手机或另一台电脑浏览器输入：`http://192.168.1.5:3000`；
3. 两人即可直接免翻墙、免公网极速联机！

### 4. Windows 电脑一键公网联机（免装环境发给好友）
项目根目录下准备了便捷脚本：
- 👉 **`[房主启动] 运行GuessWhat并生成联机公网链接.bat`**：双击即可在几秒内启动服务并自动生成公网分享链接，发给微信好友点开即玩。
- 👉 **`[好友免安装版] 点我开始游戏.bat`**：发给 Windows 好友，双击以独立 App 窗口免安装秒开游戏。

---

## 🌐 彻底解决“不开梯子玩不了”：国内免翻墙部署全攻略

### 为什么默认部署在 Vercel 在国内打不开？
Vercel 默认赠送的免费二级域名后缀 `*.vercel.app` 受到国内网络环境（GFW DNS 污染）限制，导致在大陆直接访问时可能会卡住或无法连接。

**但 Vercel 本身对自定义域名是 100% 免费且不限流量的！** 只要采用以下任意一种方案，国内手机、微信、电脑即可**零延迟直连、永久免梯子秒开**：

### 【最推荐方案】绑定自定义域名（永久免翻墙，几块钱搞定）

Vercel 提供了全球 Anycast CDN 节点。绑定您自己的域名后，国内访客将通过亚太优化路由直连，彻底解除梯子依赖：

1. **准备一个便宜的域名**：
   - 可以在 [腾讯云 DNSPod](https://dnspod.cloud.tencent.com/)、[阿里云万网](https://wanwang.aliyun.com/)、[Namesilo](https://www.namesilo.com/) 购买一个首年仅需 **5 ~ 10 元人民币**的顶级域名（例如 `.top`、`.xyz`、`.fun`、`.icu`）；
   - 如果您已经有自己的主域名，直接使用一个二级子域名（例如 `guess.yourdomain.com`）是**完全免费**的！
2. **在 Vercel 绑定域名**：
   - 登录 [Vercel 控制台](https://vercel.com/)，点击进入您的 `GuessWhat` 项目；
   - 依次点击 **Settings** -> **Domains**；
   - 在输入框中填入您的域名（如 `guess.yourdomain.com`），点击 **Add**；
3. **添加 DNS 解析记录**：
   - 前往您的域名解析后台（腾讯云/阿里云 DNS 控制台），添加一条解析记录：
     - **记录类型**：`CNAME`
     - **主机记录**：`guess`（如果绑定主域名填 `@`）
     - **记录值**：`cname.vercel-dns.com`
     - *(国内优化小技巧：也可以添加一条 A 记录指向 `76.76.21.21`)*
4. **生效验证**：
   - Vercel 会在 1 分钟内自动完成 DNS 校验，并自动免费签发全球信任的 SSL 证书（HTTPS）；
   - **完成！** 此时无论是您还是任何好友，在手机微信、系统浏览器中直接点开该域名，**均无需开启任何 VPN，秒开畅玩！**

### 【备选方案】Cloudflare CDN 免费反代加速
如果您不想购买域名：
1. 注册 Cloudflare 账号；
2. 在 Cloudflare Workers 中创建免费的反代网关将流量转发至 Vercel，或者通过 Cloudflare Pages 部署镜像；
3. 国内即可通过 Cloudflare 免费分配的专属节点免翻墙访问。

### 【私有云方案】国内轻量服务器 / Zeabur / Docker 一键托管
本项目是标准 Next.js 全栈项目，完全兼容国内云环境：
```bash
# 使用 Docker 一键运行（腾讯云 99元/年 轻量服务器、阿里云学生机均可）
docker build -t guess-what .
docker run -d -p 3000:3000 --restart always guess-what
```
或直接通过 [Zeabur](https://zeabur.com/)（提供香港免备案直连节点）一键连接 GitHub 仓库自动构建发布。

---

## 🔑 API 成本隔离与用户自带 Key（BYOK）指南

为了防止公共部署的站点被刷爆 API 额度，或者开发者不希望他人消耗自己的大模型账单，GuessWhat 深度设计了**零成本与自带 Key 架构**：

### 1. 纯离线零成本游玩（无需任何 API Key）
- 本项目**绝不强制依赖任何 AI 接口**；
- 如果服务器没有配置任何大模型密钥，系统将自动进入纯离线启发式推荐引擎与内置海量精选词库，所有核心是非猜词问答、语音连麦、聊天室等 100% 正常运行，**成本永远为 ¥0**。

### 2. 服务端全局配置 API（部署者自用）
若您作为房主希望给自己的对局开启大模型，可复制根目录下 `.env.example` 为 `.env.local`：

#### 方案 A：使用 DeepSeek（国内直连，价格极低且无需翻墙）
在 [DeepSeek 开放平台](https://platform.deepseek.com/) 注册并获取 API Key：
```env
OPENAI_API_KEY=sk-你的DeepSeek密钥
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-chat
```
> 保存后重启服务，页面顶部会自动点亮 **AI: ✔ 就绪 (DeepSeek)**。

#### 方案 B：使用 Google Gemini 官方大模型
在 [Google AI Studio](https://aistudio.google.com/app/apikey) 获取免费密钥：
```env
GEMINI_API_KEY=AIzaSy你的Gemini密钥
GEMINI_MODEL=gemini-3.8-flash
```

### 3. 用户自带密钥架构规划（BYOK - Bring Your Own Key）
为了在开源社区公开部署时让“各玩家用自己的额度，不耗费站长分毫”，项目已在系统层规划了 **BYOK（用户自带密钥）** 体系：

- **客户端本地存储**：玩家可在游戏首页的「偏好设置」或个人设置面板中填入自己申请的 DeepSeek / OpenAI / 通义千问 / Kimi / Gemini API Key；
- **安全隔离**：用户个人的 Key 仅保存在其手机本地浏览器的 `localStorage` 中，绝不会持久化到服务器数据库；
- **透明透传**：对局中调用 AI 辅助时，通过客户端安全 Header（`x-custom-ai-key`）发起按次请求；
- **纯离线选择**：不想配置 Key 的玩家可勾选“纯离线模式”，系统完全不请求任何外网大模型，完全避免账单纠纷与超额担忧。

---

## 📁 核心目录架构

```text
GuessWhat/
├── app/                  # Next.js 15 App Router 全栈架构
│   ├── api/rooms/        # 房间生命周期、二分问答、猜词仲裁、WebRTC 信令、聊天室
│   ├── room/[code]/      # 游戏房间对局核心主战场
│   └── page.tsx          # 游戏首页、历史对局、置顶房间、用户偏好
├── components/           # 页面 UI 组件库
│   ├── RoomChatDrawer.tsx  # 联机对局聊天室与对讲机语音条
│   ├── VoiceCallBar.tsx    # 双人 WebRTC 实时连麦与呼叫接听控制
│   ├── RoomHeader.tsx      # 顶栏导航、房间置顶图钉、大比分统计、音效切换
│   ├── QuestionTimeline.tsx# 问答时间线与出题人【改答】浮窗
│   ├── MasterControls.tsx  # 出题人回答台与裁决面板
│   ├── GuesserControls.tsx # 猜词人提问台与正式猜词
│   └── WordSelectionModal.tsx # 出题人设词与 AI 灵感候选
├── lib/
│   ├── ai/gemini.ts      # 统一 AI 推理适配器 (DeepSeek / Gemini / BYOK)
│   ├── audio/            # Web Audio 原生音效合成器与 WebRTC 语音 Hook
│   ├── data/wordBank.ts  # 精选多主题离线词库 (数百条冷门与经典词条)
│   └── store/            # 三模态存储引擎 (Memory 极速引擎 / Upstash KV / Supabase)
├── public/               # 高清矢量图标与 PWA Web Manifest
└── tests/                # 自动化安全权限、防剧透与游戏引擎测试集
```

---

## 🧪 自动化测试与质量保障

项目内置了严格的防剧透安全防护与游戏引擎生命周期测试：
```bash
# 运行全部 19 项自动化测试
npm run test

# 生产环境打包与严格类型检查
npm run build
```

---

## 📄 开源许可

本项目遵循 [MIT License](LICENSE) 开源协议。欢迎提交 PR、Issue 或点亮右上角 ⭐️ Star！与你的好友开启一场思维交锋的推理之旅吧！
