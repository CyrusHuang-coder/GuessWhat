# 🌊 浮出水面 (Surface) —— 双人实时在线是非推理猜词游戏

<p align="center">
  <img src="public/icon.svg" width="128" height="128" alt="浮出水面 Logo" />
</p>

<p align="center">
  <strong>在「是」与「否」的边缘，让沉睡在水下的隐秘真相逐层浮现。</strong><br>
  一款清新治愈、极简优雅的现代双人在线推理桌游。支持好友跨网联机、丰富全能词库、AI 灵感生成与逻辑二分辅助。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15_App_Router-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css" alt="Tailwind" />
  <img src="https://img.shields.io/badge/AI_Support-DeepSeek_%7C_Gemini_3.8-5F7C69" alt="AI" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

---

## 📖 游戏核心玩法

1. **设置秘密**：一名玩家担任**出题人**，根据选定主题挑选或自定义秘密词条（例如：“天气观测员”、“水熊虫”）。
2. **逻辑二分**：另一名玩家担任**猜词人**，连续提出只能用**【是】**、**【不是】**或**【不确定】**回答的问题（例如：“它是活着的生物吗？”、“它常见于室内吗？”）。
3. **真相大白**：通过逐步排除缩小范围，发起正式猜词！猜词人猜中即可揭晓答案并获得胜利！

---

## ✨ 亮点特色

- 🎮 **双人实时在线**：房主创建房间一键生成 6 位房间码与邀请链接，好友点开即连，支持手机/电脑跨端实时同步。
- 🧊 **零剧透安全保护**：在猜中结算前，秘密答案仅对出题人可见，接口响应与数据流严格加密隔离。
- 📚 **全能精选词库**：内置 11 大主题、数百条涵盖大众到极其冷门小众的特色词条（如“天气观测员”、“古籍修复师”、“姑娘果”等）。
- 💡 **AI 灵感与思路辅助**：
  - **出题人端**：支持「✨ 换一批 (AI 灵感)」，每次动态生成 9 个全新候选词条；
  - **猜词人端**：提供智能二分法问题推荐、属性探索方向提示，以及可选的「思路偏航预警」。
- 🔌 **国内直连大模型**：原生兼容 **DeepSeek**（免翻墙）与 **Google Gemini** 双通道。
- 📱 **PWA 桌面级体验**：手机浏览器一键“添加到主屏幕”，秒变独立 App 图标；电脑端提供免安装一键启动小软件。

---

## 🚀 小白新手 3 步开玩指南

### 1. 克隆代码与安装依赖
```bash
# 1. 下载项目
git clone https://github.com/你的用户名/GuessWhat.git
cd GuessWhat

# 2. 安装必要运行依赖
npm install
```

### 2. 启动游戏服务
在项目根目录下运行：
```bash
npm run dev
```
打开浏览器访问：`http://localhost:3000`，即可在本机打开游戏！可在另一个无痕窗口模拟两名玩家联机。

---

## 🌐 怎么发给好友一起联机？（电脑后台跑着，朋友随时玩）

无需掏钱买服务器，只要您的电脑在后台开着，就可以通过以下两种最简单的方式与朋友跨网联机：

### 方式 A：房主一键生成公网链接（最推荐）
在项目根目录中，直接双击运行：
👉 **`[房主启动] 运行浮出水面并生成联机公网链接.bat`** *(或在终端输入 `npm run share`)*

1. 控制台会在几秒内打印出专属公网地址，例如：
   ```text
   🌐 你的公网联机链接: https://happy-panda-88.loca.lt
   🔑 首次免密访问口令: 35.200.xx.xx (页面若弹出密码验证，输入此项即可)
   ```
2. **把链接直接发给微信/QQ好友**，朋友在手机或电脑浏览器点开即可加入房间！

### 方式 B：给好友发送“免安装独立小软件”
在项目根目录中，找到：
👉 **`[好友免安装版] 点我开始游戏.bat`**
- 房主启动联机服务后，把这个不到 1KB 的轻量批处理文件发给微信好友。
- 好友在 Windows 电脑上双击，会直接以**纯净独立软件窗口**（无多余浏览器标签页、无地址栏）弹出游戏，体验与专门开发的客户端完全一致！

---

## 🤖 AI 智能大模型配置（可选）

游戏在**完全不配置任何 AI 密钥的情况下也可完整游玩所有核心联机功能**。如果您希望开启 AI 推荐下一问与出题人换一批灵感生成，复制根目录下的 `.env.example` 重命名为 `.env.local`：

### 方案 1：使用 DeepSeek（最推荐，国内直接可用，无需翻墙）
在 [DeepSeek 开放平台](https://platform.deepseek.com/) 注册并获取 API Key 后，填入 `.env.local`：
```env
OPENAI_API_KEY=sk-你的DeepSeek密钥
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-chat
```
> 保存后刷新页面，游戏顶部状态栏会自动点亮为 **AI: ✔ 就绪 (DeepSeek)**。

### 方案 2：使用 Google Gemini 官方大模型
如果您有境外节点网络环境，在 [Google AI Studio](https://aistudio.google.com/app/apikey) 创建并获取密钥：
```env
GEMINI_API_KEY=AIzaSy你的Gemini密钥
GEMINI_MODEL=gemini-3.8-flash
```

---

## 📁 目录结构说明

```text
GuessWhat/
├── app/                  # Next.js 15 App Router 页面与服务端 API 路由
│   ├── api/rooms/        # 房间创建、问答、猜词、澄清与 AI 路由
│   ├── room/[code]/      # 游戏房间对局主页面
│   └── page.tsx          # 游戏首页大厅
├── components/           # 页面 UI 组件
│   ├── SurfaceLogo.tsx   # 「浮出水面」高定矢量几何 Logo
│   ├── GuesserControls.tsx # 猜词人操作控制台与语音输入
│   ├── MasterControls.tsx  # 出题人回答与澄清仲裁台
│   ├── WordSelectionModal.tsx # 出题人设词与 AI 灵感换一批
│   └── VoiceInputButton.tsx   # 浏览器原生语音转文字输入按钮
├── lib/
│   ├── ai/gemini.ts      # 统一 AI 推理适配器 (DeepSeek / Gemini)
│   ├── data/wordBank.ts  # 全能精选词库 (11大主题、冷门专业词汇)
│   └── store/            # 存储引擎 (本地极速内存+SSE广播 / Supabase)
├── public/               # 静态资源 (高清矢量图标、PWA manifest)
├── scripts/share.js      # 公网联机穿透与好友启动器自动生成脚本
├── [房主启动] 运行浮出水面并生成联机公网链接.bat # 房主一键公网联机启动器
└── [好友免安装版] 点我开始游戏.bat             # 发给好友的独立桌面小软件
```

---

## 🧪 自动化测试与构建

项目内置了完整的单元测试与防剧透权限安全测试：
```bash
# 运行单元测试套件
npm run test

# 生产环境打包编译检查
npm run build
```

---

## 📄 开源许可

本项目基于 [MIT License](LICENSE) 开源。欢迎点亮 ⭐️ Star 并邀请好友一起来玩！
