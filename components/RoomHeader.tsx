'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GameStateDTO } from '@/lib/types/game';
import { Copy, Check, AlertTriangle, ArrowLeft, Smartphone, HelpCircle, X, ShieldCheck, Zap, Sparkles, ArrowLeftRight, Volume2, VolumeX, Pin } from 'lucide-react';
import { EngineBadge } from './EngineBadge';
import { SurfaceLogo } from './SurfaceLogo';
import { InstallPwaModal } from './InstallPwaModal';
import { soundEffects } from '@/lib/audio/sound';
import { togglePinRoom, isRoomPinned } from '@/lib/store/localHistory';

interface Props {
  state: GameStateDTO;
  playerToken?: string;
  onRefresh?: () => void;
}

export function RoomHeader({ state, playerToken, onRefresh }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [swappingRoles, setSwappingRoles] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(soundEffects.isEnabled());
  const [pinned, setPinned] = useState(() => isRoomPinned(state.room.code));
  const { room, session, isHost, opponentOnline } = state;

  const handleTogglePin = () => {
    const next = togglePinRoom(room.code);
    setPinned(next);
    soundEffects.playPop();
  };

  // 计算双方历史大比分
  const hostNick = room.host_nickname;
  const guestNick = room.guest_nickname;
  let hostWins = 0;
  let guestWins = 0;

  (state.matchHistory || []).forEach((m) => {
    if (m.result === 'guessed') {
      if (m.guesser_nickname === hostNick) hostWins++;
      else if (m.guesser_nickname === guestNick) guestWins++;
    } else if (m.result === 'surrendered') {
      if (m.question_master_nickname === hostNick) hostWins++;
      else if (m.question_master_nickname === guestNick) guestWins++;
    }
  });

  const totalMatches = (state.matchHistory || []).length;

  const copyInviteLink = () => {
    const url = `${window.location.origin}/room/${room.code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSwapRoles = async () => {
    if (swappingRoles || !playerToken) return;
    setSwappingRoles(true);
    try {
      const res = await fetch(`/api/rooms/${room.code}/roles/swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-token': playerToken,
        },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      onRefresh?.();
    } catch (err: any) {
      alert(`调换身份失败: ${err.message}`);
    } finally {
      setSwappingRoles(false);
    }
  };

  const getRoleBadge = (playerId: string | null) => {
    if (!playerId || !session) return null;
    const isMaster = session.question_master_id === playerId;
    return isMaster ? (
      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sage-100 text-sage-800 border border-sage-200">
        出题人
      </span>
    ) : (
      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-terracotta-100 text-terracotta-700 border border-terracotta-200">
        猜词人
      </span>
    );
  };

  const difficultyMap = {
    easy: '简单',
    medium: '普通',
    hard: '困难',
  };

  return (
    <header className="bg-white border-b border-warm-border sticky top-0 z-30 shadow-board">
      {/* 离线警示横幅 */}
      {!opponentOnline && room.guest_player_id && (
        <div className="bg-status-warnBg text-status-warn border-b border-status-warnBorder text-xs py-1.5 px-4 text-center flex items-center justify-center gap-1.5 font-medium animate-pulse">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>对方玩家网络连接不稳定或已暂时离线，等待恢复连接中...</span>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* 左侧：返回大厅、Logo 与房间信息 */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              if (session?.status === 'playing') {
                if (window.confirm('当前正在对局中，确定要返回大厅吗？')) {
                  router.push('/');
                }
              } else {
                router.push('/');
              }
            }}
            className="p-1.5 rounded-game-sm hover:bg-warm-subtle text-ink-muted hover:text-ink-text transition border border-transparent hover:border-warm-border"
            title="返回大厅"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <SurfaceLogo size="sm" showText={false} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-ink-text text-base">GuessWhat</h1>
              <div className="flex items-center gap-1">
                <button
                  onClick={copyInviteLink}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-game-sm bg-warm-subtle hover:bg-warm-border text-ink-text text-xs font-mono font-medium transition border border-warm-border"
                  title="点击复制房间链接分享给好友"
                >
                  <span>房间: {room.code}</span>
                  {copied ? <Check className="w-3 h-3 text-sage-600" /> : <Copy className="w-3 h-3 text-ink-subtle" />}
                </button>
                <button
                  onClick={handleTogglePin}
                  className={`p-1 rounded-game-sm border transition ${
                    pinned
                      ? 'bg-terracotta-50 border-terracotta-200 text-terracotta-600'
                      : 'bg-warm-subtle hover:bg-warm-border border-warm-border text-ink-subtle hover:text-ink-text'
                  }`}
                  title={pinned ? '已置顶此常用房间（点击取消）' : '置顶此常用房间'}
                >
                  <Pin className={`w-3 h-3 -rotate-45 ${pinned ? 'fill-current text-terracotta-600' : ''}`} />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted mt-0.5">
              <span>第 {session?.round_number ?? 1} 局</span>
              {totalMatches > 0 && (
                <>
                  <span>•</span>
                  <span className="font-bold text-amber-900 bg-amber-100/90 border border-amber-200 px-1.5 py-0.2 rounded text-[10px]">
                    比分 {hostWins} : {guestWins}
                  </span>
                </>
              )}
              {session?.theme && (
                <>
                  <span>•</span>
                  <span><strong className="text-ink-text">{session.theme}</strong></span>
                  <span>•</span>
                  <span><strong className="text-ink-text">{difficultyMap[session.difficulty]}</strong></span>
                  <span>•</span>
                  <span className="font-medium text-ink-text">
                    {session.mode === 'challenge' ? `挑战(${session.max_questions}次)` : '无限次'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 右侧：玩家卡片与引擎标签 */}
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <div className="flex items-center gap-1.5 bg-warm-bg border border-warm-border rounded-game-sm p-1 text-xs">
            {/* 房主 */}
            <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded shadow-2xs border border-warm-border">
              <div
                className={`w-2 h-2 rounded-full ${
                  isHost ? 'bg-status-ok' : state.opponentOnline ? 'bg-status-ok' : 'bg-warm-border'
                }`}
              />
              <span className="font-bold text-ink-text max-w-[80px] truncate">
                {room.host_nickname}
                {isHost && ' (我)'}
              </span>
              {getRoleBadge(room.host_player_id)}
            </div>

            {session?.status === 'setting_selection' && room.guest_player_id ? (
              <button
                type="button"
                onClick={handleSwapRoles}
                disabled={swappingRoles}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-sage-50 hover:bg-sage-100 active:scale-95 text-sage-800 text-[11px] font-bold border border-sage-300 transition shadow-2xs"
                title="双方调换出题与猜词身份"
              >
                <ArrowLeftRight className={`w-3 h-3 text-sage-600 ${swappingRoles ? 'animate-spin' : ''}`} />
                <span>换身份</span>
              </button>
            ) : (
              <span className="text-ink-subtle font-bold px-0.5">VS</span>
            )}

            {/* 加入者 */}
            <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded shadow-2xs border border-warm-border">
              <div
                className={`w-2 h-2 rounded-full ${
                  !room.guest_player_id
                    ? 'bg-status-warn animate-ping'
                    : !isHost
                    ? 'bg-status-ok'
                    : state.opponentOnline
                    ? 'bg-status-ok'
                    : 'bg-warm-border'
                }`}
              />
              <span className="font-bold text-ink-text max-w-[80px] truncate">
                {room.guest_nickname ? (
                  <>
                    {room.guest_nickname}
                    {!isHost && ' (我)'}
                  </>
                ) : (
                  <span className="text-ink-subtle italic">等待加入...</span>
                )}
              </span>
              {getRoleBadge(room.guest_player_id)}
            </div>
          </div>

          <button
            onClick={() => setSoundEnabled(soundEffects.toggle())}
            className={`p-1.5 rounded-game-sm border transition ${
              soundEnabled
                ? 'bg-warm-subtle hover:bg-warm-border text-sage-700 border-warm-border'
                : 'bg-warm-bg text-ink-subtle border-warm-border'
            }`}
            title={soundEnabled ? '提示音已开启（点击静音）' : '提示音已关闭（点击开启）'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setShowInstallModal(true)}
            className="p-1.5 rounded-game-sm bg-warm-subtle hover:bg-warm-border text-ink-muted hover:text-ink-text border border-warm-border transition"
            title="存为手机桌面 App"
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setShowRulesModal(true)}
            className="p-1.5 rounded-game-sm bg-warm-subtle hover:bg-warm-border text-ink-muted hover:text-ink-text border border-warm-border transition"
            title="查看游戏规则说明"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          <div className="hidden sm:block">
            <EngineBadge />
          </div>
        </div>
      </div>

      <InstallPwaModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      />

      {/* 规则说明弹窗 */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-game border border-warm-border max-w-sm w-full p-5 shadow-board relative animate-in fade-in zoom-in-95 duration-150 space-y-3">
            <button
              onClick={() => setShowRulesModal(false)}
              className="absolute top-4 right-4 p-1 text-ink-muted hover:text-ink-text rounded hover:bg-warm-bg transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-game-sm bg-sage-100 text-sage-600 flex items-center justify-center">
                <HelpCircle className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-ink-text text-sm">猜词游戏玩法指南</h3>
            </div>

            <div className="space-y-2.5 text-xs text-ink-text pt-1">
              <div className="p-2.5 bg-warm-bg rounded-game-sm border border-warm-border">
                <div className="font-bold text-sage-800 mb-0.5">二十问是非推理</div>
                <p className="text-ink-muted leading-relaxed">
                  猜词人提出能用“是 / 不是 / 不确定”回答的问题逐步缩小范围，收窄到具体目标后发起正式猜词。
                </p>
              </div>

              <div className="p-2.5 bg-warm-bg rounded-game-sm border border-warm-border">
                <div className="font-bold text-terracotta-700 mb-0.5">线索提示交易</div>
                <p className="text-ink-muted leading-relaxed">
                  猜词人遇到卡点时，可消耗 1、3 或 5 次提问机会申请出题人专属线索，出题人答复后提问次数相应累加。
                </p>
              </div>

              <div className="p-2.5 bg-warm-bg rounded-game-sm border border-warm-border">
                <div className="font-bold text-sage-800 mb-0.5">服务端绝对防剧透</div>
                <p className="text-ink-muted leading-relaxed">
                  秘密答案在猜中揭晓前绝不下发给猜词人，也不输入给 AI 偏航预警模型，确保绝对公正。
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="w-full py-2 bg-sage-500 hover:bg-sage-600 text-white font-bold text-xs rounded-game-sm transition"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
