'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EngineBadge } from '@/components/EngineBadge';
import { SurfaceLogo } from '@/components/SurfaceLogo';
import { Sparkles, Users, ArrowRight, ShieldCheck, Zap, HelpCircle, Smartphone } from 'lucide-react';
import { InstallPwaModal } from '@/components/InstallPwaModal';

export default function HomePage() {
  const router = useRouter();

  const [createNickname, setCreateNickname] = useState('');
  const [creating, setCreating] = useState(false);

  const [joinCode, setJoinCode] = useState('');
  const [joinNickname, setJoinNickname] = useState('');
  const [joining, setJoining] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);

  // 创建房间
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setError(null);

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostNickname: createNickname.trim() || '出题房主' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      // 将 playerToken 存入 sessionStorage
      sessionStorage.setItem(`gw_token_${data.roomCode}`, data.playerToken);
      sessionStorage.setItem(`gw_nick_${data.roomCode}`, createNickname.trim() || '出题房主');

      router.push(`/room/${data.roomCode}`);
    } catch (err: any) {
      setError(err.message || '创建房间失败');
      setCreating(false);
    }
  };

  // 加入房间
  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (joining || !joinCode.trim()) return;
    setJoining(true);
    setError(null);

    const code = joinCode.trim().toUpperCase();

    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestNickname: joinNickname.trim() || '猜词伙伴' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      sessionStorage.setItem(`gw_token_${code}`, data.playerToken);
      sessionStorage.setItem(`gw_nick_${code}`, joinNickname.trim() || '猜词伙伴');

      router.push(`/room/${code}`);
    } catch (err: any) {
      setError(err.message || '加入房间失败');
      setJoining(false);
    }
  };

  return (
    <main className="min-h-screen bg-warm-bg flex flex-col items-center justify-between p-4 sm:p-8">
      {/* 顶部指示条 */}
      <div className="w-full max-w-4xl flex items-center justify-between pb-6">
        <SurfaceLogo size="md" showText={true} />
        <EngineBadge />
      </div>

      {/* 核心主视觉与操作卡片 */}
      <div className="w-full max-w-4xl space-y-8 my-auto">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sage-100 border border-sage-200 text-sage-800 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-sage-600" />
            <span>双人实时在线猜词 · 经典二十问是非推理</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-ink-text tracking-tight">
            在「是」与「否」的边缘，推理隐秘的真相
          </h1>
          <p className="text-sm sm:text-base text-ink-muted max-w-xl mx-auto leading-relaxed">
            一名玩家设定秘密答案，另一名玩家通过连续提出只能用「是」「不是」「不确定」回答的问题逐步缩小范围。
          </p>
        </div>

        {error && (
          <div className="max-w-md mx-auto p-3 bg-status-errBg text-status-err text-xs rounded-game-sm border border-status-errBorder text-center font-medium">
            {error}
          </div>
        )}

        {/* 双入口卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* 创建房间 */}
          <div className="bg-white p-6 sm:p-8 rounded-game border border-warm-border shadow-board hover:shadow-board-hover transition">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-game-sm bg-sage-100 text-sage-700 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ink-text">创建新房间</h2>
                <p className="text-xs text-ink-muted">生成房间码与链接，邀请好友即刻联机</p>
              </div>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1.5">
                  您的昵称（首局担任出题人）：
                </label>
                <input
                  type="text"
                  value={createNickname}
                  onChange={(e) => setCreateNickname(e.target.value)}
                  placeholder="例如：出题小霸王、福尔摩斯"
                  maxLength={15}
                  className="w-full px-4 py-2.5 text-sm border border-warm-border rounded-game-sm bg-warm-bg focus:outline-none focus:ring-2 focus:ring-sage-500 text-ink-text"
                />
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full py-3.5 bg-sage-500 hover:bg-sage-600 active:bg-sage-700 disabled:opacity-50 text-white font-bold text-sm rounded-game-sm shadow transition flex items-center justify-center gap-2"
              >
                <span>{creating ? '创建中...' : '立即创建房间'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* 加入房间 */}
          <div className="bg-white p-6 sm:p-8 rounded-game border border-warm-border shadow-board hover:shadow-board-hover transition">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-game-sm bg-terracotta-100 text-terracotta-600 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ink-text">加入已有房间</h2>
                <p className="text-xs text-ink-muted">输入好友分享的 6 位房间代码</p>
              </div>
            </div>

            <form onSubmit={handleJoinRoom} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1.5">
                  房间代码（6 位大写英数）：
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="例如：XK8M2Q"
                  maxLength={10}
                  className="w-full px-4 py-2.5 text-sm border border-warm-border rounded-game-sm bg-warm-bg font-mono uppercase focus:outline-none focus:ring-2 focus:ring-terracotta-500 text-ink-text"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1.5">
                  您的昵称（首局担任猜词人）：
                </label>
                <input
                  type="text"
                  value={joinNickname}
                  onChange={(e) => setJoinNickname(e.target.value)}
                  placeholder="例如：推理家小红、华生"
                  maxLength={15}
                  className="w-full px-4 py-2.5 text-sm border border-warm-border rounded-game-sm bg-warm-bg focus:outline-none focus:ring-2 focus:ring-terracotta-500 text-ink-text"
                />
              </div>

              <button
                type="submit"
                disabled={joining || !joinCode.trim()}
                className="w-full py-3.5 bg-terracotta-500 hover:bg-terracotta-600 active:bg-terracotta-700 disabled:opacity-50 text-white font-bold text-sm rounded-game-sm shadow transition flex items-center justify-center gap-2"
              >
                <span>{joining ? '进入中...' : '进入对局房间'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* 游戏规则简介特性 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto pt-2 text-xs">
          <div className="p-4 bg-white rounded-game border border-warm-border shadow-board flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-sage-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-ink-text mb-0.5">严格服务端防剧透</div>
              <div className="text-ink-muted leading-relaxed">
                秘密答案在猜中揭晓前绝不下发给猜词人，亦不传给 AI 预警模型。
              </div>
            </div>
          </div>

          <div className="p-4 bg-white rounded-game border border-warm-border shadow-board flex items-start gap-3">
            <Zap className="w-5 h-5 text-terracotta-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-ink-text mb-0.5">普通与挑战双模式</div>
              <div className="text-ink-muted leading-relaxed">
                支持无限问答与自设提问上限，额度耗尽仍能无限次正式猜词。
              </div>
            </div>
          </div>

          <div className="p-4 bg-white rounded-game border border-warm-border shadow-board flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-sage-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-ink-text mb-0.5">AI 推荐与偏航预警</div>
              <div className="text-ink-muted leading-relaxed">
                仅辅助提问二分策略，绝不代替人工裁定；无 Key 自动平稳降级。
              </div>
            </div>
          </div>
        </div>
        {/* 存为手机桌面 App 按钮 */}
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => setShowInstallModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sage-50 hover:bg-sage-100 text-sage-700 text-xs font-semibold border border-sage-200 shadow-2xs transition"
          >
            <Smartphone className="w-3.5 h-3.5 text-sage-600" />
            <span>保存到手机桌面 App（iOS & 安卓免商店）</span>
          </button>
        </div>
      </div>

      {/* 页脚说明 */}
      <footer className="text-center text-xs text-ink-subtle py-6">
        GuessWhat · 双人实时在线猜词 · 免注册即开即玩
      </footer>

      {/* PWA 桌面安装引导弹窗 */}
      <InstallPwaModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      />
    </main>
  );
}
