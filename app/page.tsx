'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { EngineBadge } from '@/components/EngineBadge';
import { SurfaceLogo } from '@/components/SurfaceLogo';
import {
  Sparkles,
  Users,
  ArrowRight,
  ShieldCheck,
  Zap,
  HelpCircle,
  Smartphone,
  History,
  Settings,
  Gamepad2,
  Trash2,
  Play,
  RotateCcw,
  Check,
} from 'lucide-react';
import { InstallPwaModal } from '@/components/InstallPwaModal';
import {
  getRecentRooms,
  removeRecentRoom,
  savePlayerToken,
  getUserPreferences,
  saveUserPreferences,
  RecentRoomItem,
  UserPreferences,
} from '@/lib/store/localHistory';

type MainTab = 'play' | 'history' | 'prefs' | 'rules';

function timeAgo(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return '刚刚';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} 小时前`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} 天前`;
}

export default function HomePage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<MainTab>('play');
  const [recentRooms, setRecentRooms] = useState<RecentRoomItem[]>([]);
  const [prefs, setPrefs] = useState<UserPreferences>({
    defaultNickname: '',
    autoCopyInviteLink: true,
    hapticFeedback: true,
  });

  // 创建房间表单
  const [createNickname, setCreateNickname] = useState('');
  const [creating, setCreating] = useState(false);

  // 加入房间表单
  const [joinCode, setJoinCode] = useState('');
  const [joinNickname, setJoinNickname] = useState('');
  const [joining, setJoining] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [reclaimInfo, setReclaimInfo] = useState<{
    code: string;
    hostNickname: string;
    guestNickname: string;
  } | null>(null);
  const [reclaiming, setReclaiming] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);

  // 加载本地历史与偏好
  useEffect(() => {
    const loadedPrefs = getUserPreferences();
    setPrefs(loadedPrefs);
    if (loadedPrefs.defaultNickname) {
      setCreateNickname(loadedPrefs.defaultNickname);
      setJoinNickname(loadedPrefs.defaultNickname);
    }
    setRecentRooms(getRecentRooms());
  }, []);

  // 创建房间
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setError(null);

    const finalNick = createNickname.trim() || prefs.defaultNickname || '出题房主';

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostNickname: finalNick }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      savePlayerToken(data.roomCode, data.playerToken, finalNick);
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
    const finalNick = joinNickname.trim() || prefs.defaultNickname || '猜词伙伴';

    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestNickname: finalNick }),
      });
      const data = await res.json();
      if (!data.success) {
        if (data.canReclaim) {
          setReclaimInfo({
            code,
            hostNickname: data.hostNickname,
            guestNickname: data.guestNickname,
          });
          setJoining(false);
          return;
        }
        throw new Error(data.error);
      }

      savePlayerToken(code, data.playerToken, finalNick);
      router.push(`/room/${code}`);
    } catch (err: any) {
      setError(err.message || '加入房间失败');
      setJoining(false);
    }
  };

  const handleReclaimOnHome = async (role: 'host' | 'guest') => {
    if (!reclaimInfo || reclaiming) return;
    setReclaiming(true);
    setError(null);

    try {
      const res = await fetch(`/api/rooms/${reclaimInfo.code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reclaimRole: role }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const nick = role === 'host' ? reclaimInfo.hostNickname : reclaimInfo.guestNickname;
      savePlayerToken(reclaimInfo.code, data.playerToken, nick);
      router.push(`/room/${reclaimInfo.code}`);
    } catch (err: any) {
      setError(err.message || '恢复身份失败');
    } finally {
      setReclaiming(false);
    }
  };

  // 恢复历史房间
  const handleResumeRoom = (code: string) => {
    router.push(`/room/${code.toUpperCase()}`);
  };

  // 删除历史房间记录
  const handleDeleteHistory = (code: string) => {
    if (window.confirm(`确定从本机历史中移除房间 ${code} 吗？`)) {
      removeRecentRoom(code);
      setRecentRooms(getRecentRooms());
    }
  };

  // 保存偏好设置
  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    saveUserPreferences(prefs);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const activeRecent = recentRooms.find((r) => r.status !== 'ended') || recentRooms[0];

  return (
    <main className="min-h-screen bg-warm-bg flex flex-col justify-between p-4 sm:p-8">
      {/* 顶部主导航栏 */}
      <header className="w-full max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 pb-4 border-b border-warm-border/60">
        <div className="w-full sm:w-auto flex items-center justify-between">
          <SurfaceLogo size="md" showText={true} />
          <div className="sm:hidden">
            <EngineBadge />
          </div>
        </div>

        <div className="w-full sm:w-auto flex items-center justify-center sm:justify-end gap-2">
          <div className="flex items-center gap-1 bg-warm-subtle/80 p-1 rounded-game-sm border border-warm-border">
            <button
              type="button"
              onClick={() => setActiveTab('play')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition ${
                activeTab === 'play'
                  ? 'bg-white shadow-2xs text-sage-700'
                  : 'text-ink-muted hover:text-ink-text'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>游戏</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition relative ${
                activeTab === 'history'
                  ? 'bg-white shadow-2xs text-sage-700'
                  : 'text-ink-muted hover:text-ink-text'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>历史</span>
              {recentRooms.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-sage-500 text-white text-[10px] flex items-center justify-center font-mono">
                  {recentRooms.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('prefs')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition ${
                activeTab === 'prefs'
                  ? 'bg-white shadow-2xs text-sage-700'
                  : 'text-ink-muted hover:text-ink-text'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>偏好</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('rules')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition ${
                activeTab === 'rules'
                  ? 'bg-white shadow-2xs text-sage-700'
                  : 'text-ink-muted hover:text-ink-text'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>规则</span>
            </button>
          </div>

          <div className="hidden sm:block">
            <EngineBadge />
          </div>
        </div>
      </header>

      {/* 主体内容区 */}
      <div className="w-full max-w-4xl mx-auto my-auto py-6 space-y-6">
        {error && (
          <div className="max-w-md mx-auto p-3 bg-status-errBg text-status-err text-xs rounded-game-sm border border-status-errBorder text-center font-medium animate-in fade-in">
            {error}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 1: 开始与继续游戏 */}
        {/* ============================================================== */}
        {activeTab === 'play' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* 极简 Slogan */}
            <div className="text-center space-y-2">
              <h1 className="text-2xl sm:text-4xl font-black text-ink-text tracking-tight">
                在「是」与「否」的边缘，推演未知真相
              </h1>
              <p className="text-xs sm:text-sm text-ink-muted max-w-md mx-auto">
                出题人掌控秘密，猜词人通过二分问答步步逼近核心答案。
              </p>
            </div>

            {/* 可恢复房间：如果存在活跃历史房间，顶部醒目展示一键继续卡片 */}
            {activeRecent && (
              <div className="bg-sage-50 border border-sage-200 rounded-game p-4 sm:p-5 max-w-2xl mx-auto shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-sage-500 animate-pulse" />
                    <span className="text-xs font-bold text-sage-900">检测到正在进行的对局</span>
                    <span className="text-[10px] font-mono bg-sage-100 text-sage-700 px-1.5 py-0.2 rounded border border-sage-200">
                      {activeRecent.code}
                    </span>
                  </div>
                  <p className="text-xs text-sage-700">
                    您与 <strong>{activeRecent.opponentNickname || '伙伴'}</strong> 的对局 (第 {activeRecent.roundNumber} 局 · {timeAgo(activeRecent.updatedAt)})
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleResumeRoom(activeRecent.code)}
                  className="px-5 py-2.5 bg-sage-500 hover:bg-sage-600 active:bg-sage-700 text-white font-bold text-xs rounded-game-sm shadow-2xs transition flex items-center gap-1.5 shrink-0"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>恢复进入房间</span>
                </button>
              </div>
            )}

            {/* 双入口卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              {/* 创建房间 */}
              <div className="bg-white p-6 rounded-game border border-warm-border shadow-board space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-game-sm bg-sage-100 text-sage-700 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-ink-text">创建新房间</h2>
                    <p className="text-xs text-ink-muted">发起对局并生成专属邀请链接</p>
                  </div>
                </div>

                <form onSubmit={handleCreateRoom} className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-ink-muted mb-1">
                      您的昵称（首局担任出题人）
                    </label>
                    <input
                      type="text"
                      value={createNickname}
                      onChange={(e) => setCreateNickname(e.target.value)}
                      placeholder={prefs.defaultNickname || '例如：福尔摩斯'}
                      maxLength={15}
                      className="w-full px-3.5 py-2 text-xs border border-warm-border rounded-game-sm bg-warm-bg/50 focus:outline-none focus:ring-2 focus:ring-sage-500 text-ink-text"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={creating}
                    className="w-full py-2.5 bg-sage-500 hover:bg-sage-600 active:bg-sage-700 disabled:opacity-50 text-white font-bold text-xs rounded-game-sm shadow transition flex items-center justify-center gap-1.5"
                  >
                    <span>{creating ? '正在创建...' : '立即创建房间'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>

              {/* 加入房间 */}
              <div className="bg-white p-6 rounded-game border border-warm-border shadow-board space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-game-sm bg-terracotta-100 text-terracotta-600 flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-ink-text">输入房间码</h2>
                    <p className="text-xs text-ink-muted">加入好友已建好的对局</p>
                  </div>
                </div>

                <form onSubmit={handleJoinRoom} className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-ink-muted mb-1">
                      房间代码（6 位英文数字）
                    </label>
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="例如：7K9X2A"
                      maxLength={10}
                      className="w-full px-3.5 py-2 text-xs border border-warm-border rounded-game-sm bg-warm-bg/50 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-terracotta-500 text-ink-text"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-ink-muted mb-1">
                      您的昵称（首局担任猜词人）
                    </label>
                    <input
                      type="text"
                      value={joinNickname}
                      onChange={(e) => setJoinNickname(e.target.value)}
                      placeholder={prefs.defaultNickname || '例如：华生'}
                      maxLength={15}
                      className="w-full px-3.5 py-2 text-xs border border-warm-border rounded-game-sm bg-warm-bg/50 focus:outline-none focus:ring-2 focus:ring-terracotta-500 text-ink-text"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={joining || !joinCode.trim()}
                    className="w-full py-2.5 bg-terracotta-500 hover:bg-terracotta-600 active:bg-terracotta-700 disabled:opacity-50 text-white font-bold text-xs rounded-game-sm shadow transition flex items-center justify-center gap-1.5"
                  >
                    <span>{joining ? '进入中...' : '进入房间'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>

            {/* 手机桌面 App 入口 */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setShowInstallModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white text-ink-muted hover:text-ink-text text-xs border border-warm-border shadow-2xs hover:bg-warm-subtle transition"
              >
                <Smartphone className="w-3.5 h-3.5 text-sage-600" />
                <span>保存到手机桌面 App（iOS & 安卓免商店）</span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: 历史房间 */}
        {/* ============================================================== */}
        {activeTab === 'history' && (
          <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-ink-text">本机历史房间</h2>
                <p className="text-xs text-ink-muted">随时无缝重连已建立的房间，双方身份与战绩持续保留</p>
              </div>
              <span className="text-xs text-ink-muted font-mono">{recentRooms.length} 个记录</span>
            </div>

            {recentRooms.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-game border border-warm-border space-y-3">
                <History className="w-8 h-8 text-ink-subtle mx-auto" />
                <p className="text-xs text-ink-muted">暂无历史对局，创建或加入房间后将自动留存。</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('play')}
                  className="px-4 py-2 bg-sage-500 text-white text-xs font-bold rounded-game-sm hover:bg-sage-600 transition"
                >
                  去创建第一个房间
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentRooms.map((r) => (
                  <div
                    key={r.code}
                    className="p-4 bg-white rounded-game border border-warm-border shadow-2xs flex items-center justify-between gap-3 hover:border-sage-300 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-ink-text tracking-wide">
                          {r.code}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                            r.status === 'in_game'
                              ? 'bg-sage-100 text-sage-700'
                              : r.status === 'waiting_player'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-warm-subtle text-ink-muted'
                          }`}
                        >
                          {r.status === 'in_game' ? '对局中' : r.status === 'waiting_player' ? '等待玩家' : '已结算'}
                        </span>
                        <span className="text-xs text-ink-subtle">• 第 {r.roundNumber} 局</span>
                      </div>
                      <p className="text-xs text-ink-muted">
                        我 ({r.myNickname}) VS {r.opponentNickname || '等待加入'} • {timeAgo(r.updatedAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleResumeRoom(r.code)}
                        className="px-3.5 py-1.5 bg-sage-500 hover:bg-sage-600 active:bg-sage-700 text-white font-bold text-xs rounded-game-sm shadow-2xs transition flex items-center gap-1"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>进入</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteHistory(r.code)}
                        className="p-1.5 text-ink-subtle hover:text-status-err hover:bg-warm-bg rounded-game-sm transition"
                        title="从本机移除此房间"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: 偏好设置 */}
        {/* ============================================================== */}
        {activeTab === 'prefs' && (
          <div className="max-w-md mx-auto bg-white rounded-game border border-warm-border p-6 shadow-board space-y-5 animate-in fade-in duration-150">
            <div>
              <h2 className="text-base font-bold text-ink-text">用户偏好设置</h2>
              <p className="text-xs text-ink-muted">设置将安全保存在本机浏览器中，自动应用于所有对局</p>
            </div>

            <form onSubmit={handleSavePreferences} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">
                  默认游戏昵称
                </label>
                <input
                  type="text"
                  value={prefs.defaultNickname}
                  onChange={(e) => setPrefs({ ...prefs, defaultNickname: e.target.value })}
                  placeholder="创建或加入房间时自动填入"
                  maxLength={15}
                  className="w-full px-3.5 py-2 text-xs border border-warm-border rounded-game-sm bg-warm-bg/50 focus:outline-none focus:ring-2 focus:ring-sage-500 text-ink-text"
                />
              </div>

              <div className="space-y-2.5 pt-1">
                <label className="flex items-center justify-between text-xs cursor-pointer">
                  <span className="text-ink-text">自动复制房间邀请链接</span>
                  <input
                    type="checkbox"
                    checked={prefs.autoCopyInviteLink}
                    onChange={(e) => setPrefs({ ...prefs, autoCopyInviteLink: e.target.checked })}
                    className="accent-sage-500 w-4 h-4 rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between text-xs cursor-pointer">
                  <span className="text-ink-text">按键与语音触感震动反馈</span>
                  <input
                    type="checkbox"
                    checked={prefs.hapticFeedback}
                    onChange={(e) => setPrefs({ ...prefs, hapticFeedback: e.target.checked })}
                    className="accent-sage-500 w-4 h-4 rounded cursor-pointer"
                  />
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-sage-500 hover:bg-sage-600 active:bg-sage-700 text-white font-bold text-xs rounded-game-sm shadow transition flex items-center justify-center gap-1.5"
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>设置已保存</span>
                  </>
                ) : (
                  <span>保存偏好设置</span>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: 规则说明 */}
        {/* ============================================================== */}
        {activeTab === 'rules' && (
          <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in duration-150">
            <div>
              <h2 className="text-lg font-bold text-ink-text">游戏规则与机制说明</h2>
              <p className="text-xs text-ink-muted">经典二十问（海龟汤）是非推理玩法介绍</p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 bg-white rounded-game border border-warm-border shadow-2xs space-y-1.5">
                <div className="font-bold text-sage-800 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-sage-600" />
                  <span>核心推理规则</span>
                </div>
                <p className="text-ink-muted leading-relaxed">
                  出题人设定一个秘密词条，猜词人通过提出一系列是非问题（只能用“是”、“不是”、“不确定”回答）逐步收窄范围。猜词人认为明确时可随时发起正式猜词。
                </p>
              </div>

              <div className="p-4 bg-white rounded-game border border-warm-border shadow-2xs space-y-1.5">
                <div className="font-bold text-terracotta-700 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-terracotta-600" />
                  <span>双模式规则</span>
                </div>
                <p className="text-ink-muted leading-relaxed">
                  <strong>普通模式</strong>：无限次提问，适合轻松闲聊与好友推测；<br />
                  <strong>挑战模式</strong>：限制提问次数（如 15 次），额度耗尽后仍保留无限次最终猜词机会。
                </p>
              </div>

              <div className="p-4 bg-white rounded-game border border-warm-border shadow-2xs space-y-1.5">
                <div className="font-bold text-sage-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-sage-600" />
                  <span>服务端防剧透保障</span>
                </div>
                <p className="text-ink-muted leading-relaxed">
                  秘密答案在猜中揭晓前绝不下发给猜词人的手机或浏览器，亦不传给 AI 偏航预警模型，保证绝对公正、无作弊空间。
                </p>
              </div>

              <div className="p-4 bg-white rounded-game border border-warm-border shadow-2xs space-y-1.5">
                <div className="font-bold text-ink-text flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-sage-600" />
                  <span>AI 智能思维辅助</span>
                </div>
                <p className="text-ink-muted leading-relaxed">
                  猜词人可使用有限额度的 AI 思维助手推荐二分探索方向；出题人可由 AI 查证未知事实，避免因出题人知识盲区导致答错误导。
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 页脚说明 */}
      <footer className="text-center text-xs text-ink-subtle py-4 border-t border-warm-border/40 max-w-4xl w-full mx-auto">
        GuessWhat · 双人实时在线猜词 · 免注册即开即玩
      </footer>

      {/* PWA 桌面安装引导弹窗 */}
      <InstallPwaModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      />

      {/* 房间满员但支持身份恢复弹窗 */}
      {reclaimInfo && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-game border border-warm-border p-6 shadow-board max-w-sm w-full space-y-4 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-sage-100 text-sage-600 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink-text">恢复房间对局身份</h3>
              <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                房间 <strong className="text-sage-700 font-mono">{reclaimInfo.code}</strong> 正在进行对局。<br />
                若您刚从微信或其它设备切换过来，请选择您在这场游戏中的角色直接恢复：
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                disabled={reclaiming}
                onClick={() => handleReclaimOnHome('host')}
                className="w-full py-2.5 px-3 bg-sage-50 hover:bg-sage-100 border border-sage-300 rounded-game-sm text-left flex items-center justify-between transition"
              >
                <div>
                  <div className="font-bold text-xs text-sage-900">
                    我是 {reclaimInfo.hostNickname}
                  </div>
                  <div className="text-[10px] text-sage-600">本局出题人 / 房主</div>
                </div>
                <span className="text-xs font-bold text-sage-700">
                  {reclaiming ? '进入中...' : '一键恢复 →'}
                </span>
              </button>

              <button
                type="button"
                disabled={reclaiming}
                onClick={() => handleReclaimOnHome('guest')}
                className="w-full py-2.5 px-3 bg-terracotta-50 hover:bg-terracotta-100 border border-terracotta-300 rounded-game-sm text-left flex items-center justify-between transition"
              >
                <div>
                  <div className="font-bold text-xs text-terracotta-900">
                    我是 {reclaimInfo.guestNickname}
                  </div>
                  <div className="text-[10px] text-terracotta-600">本局猜词人 / 客方</div>
                </div>
                <span className="text-xs font-bold text-terracotta-700">
                  {reclaiming ? '进入中...' : '一键恢复 →'}
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setReclaimInfo(null)}
              className="w-full py-1.5 text-xs text-ink-subtle hover:text-ink-text transition"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
