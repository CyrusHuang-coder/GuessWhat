'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GameStateDTO } from '@/lib/types/game';
import { Copy, Check, AlertTriangle, ArrowLeft } from 'lucide-react';
import { EngineBadge } from './EngineBadge';
import { SurfaceLogo } from './SurfaceLogo';

interface Props {
  state: GameStateDTO;
}

export function RoomHeader({ state }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const { room, session, isHost, opponentOnline } = state;

  const copyInviteLink = () => {
    const url = `${window.location.origin}/room/${room.code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
              <h1 className="font-bold text-ink-text text-base">浮出水面</h1>
              <button
                onClick={copyInviteLink}
                className="flex items-center gap-1 px-2.5 py-0.5 rounded-game-sm bg-warm-subtle hover:bg-warm-border text-ink-text text-xs font-mono font-medium transition border border-warm-border"
                title="点击复制房间链接分享给好友"
              >
                <span>房间: {room.code}</span>
                {copied ? <Check className="w-3 h-3 text-sage-600" /> : <Copy className="w-3 h-3 text-ink-subtle" />}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted mt-0.5">
              <span>第 {session?.round_number ?? 1} 局</span>
              {session?.theme && (
                <>
                  <span>•</span>
                  <span>主题: <strong className="text-ink-text">{session.theme}</strong></span>
                  <span>•</span>
                  <span>难度: <strong className="text-ink-text">{difficultyMap[session.difficulty]}</strong></span>
                  <span>•</span>
                  <span className="font-medium text-ink-text">
                    {session.mode === 'challenge' ? `挑战模式 (${session.max_questions}次)` : '普通模式 (不限次)'}
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

            <span className="text-ink-subtle font-bold px-0.5">VS</span>

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

          <EngineBadge />
        </div>
      </div>
    </header>
  );
}
