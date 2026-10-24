'use client';

import { useEffect, useState } from 'react';
import { GameStateDTO, MatchHistoryItem } from '@/lib/types/game';
import confetti from 'canvas-confetti';
import { Trophy, Flag, RefreshCw, Repeat, Award, BarChart2 } from 'lucide-react';

interface Props {
  state: GameStateDTO;
  roomCode: string;
  playerToken: string;
}

export function SettlementModal({ state, roomCode, playerToken }: Props) {
  const { session, room, matchHistory } = state;
  const [submittingAction, setSubmittingAction] = useState(false);

  useEffect(() => {
    if (session?.status === 'settled' && session.result === 'guessed') {
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch (err) {}
    }
  }, [session?.status, session?.result]);

  if (session?.status !== 'settled') return null;

  const handleAction = async (action: 'swap_roles' | 'keep_roles' | 'end_game') => {
    setSubmittingAction(true);
    try {
      const res = await fetch(`/api/rooms/${roomCode}/round/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-token': playerToken,
        },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
    } catch (err: any) {
      alert(`操作失败: ${err.message}`);
    } finally {
      setSubmittingAction(false);
    }
  };

  const isGuessed = session.result === 'guessed';
  const durationSeconds =
    session.ended_at && session.started_at
      ? Math.max(
          1,
          Math.round(
            (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000
          )
        )
      : 0;

  // 双方表现对比分析
  const hostNick = room.host_nickname;
  const guestNick = room.guest_nickname || '玩家2';

  const hostAsGuesser = matchHistory.filter((m) => m.guesser_nickname === hostNick);
  const guestAsGuesser = matchHistory.filter((m) => m.guesser_nickname === guestNick);

  const canCompare = hostAsGuesser.length > 0 && guestAsGuesser.length > 0;

  const calcAvg = (
    items: MatchHistoryItem[],
    key: 'completed_questions_count' | 'wrong_guesses_count' | 'duration_seconds'
  ) => {
    if (items.length === 0) return 0;
    const sum = items.reduce((acc, curr) => acc + curr[key], 0);
    return (sum / items.length).toFixed(1);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-game-lg max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-warm-border my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* 顶部状态与揭晓 */}
        <div className="text-center space-y-2 mb-6">
          <div
            className={`w-14 h-14 rounded-game-sm mx-auto flex items-center justify-center shadow-sm ${
              isGuessed ? 'bg-sage-100 text-sage-600' : 'bg-warm-subtle text-ink-muted'
            }`}
          >
            {isGuessed ? <Trophy className="w-7 h-7" /> : <Flag className="w-7 h-7" />}
          </div>
          <h2 className="text-2xl font-black text-ink-text">
            {isGuessed ? '🎉 猜词成功！' : '🏳️ 猜词人主动认输'}
          </h2>
          <div className="text-xs text-ink-muted">
            第 {session.round_number} 局结算 • 秘密答案是：
          </div>
          <div className="inline-block py-2.5 px-6 bg-sage-50 border-2 border-sage-500 text-sage-900 font-black text-2xl rounded-game shadow-inner mt-1">
            {session.secret_word}
          </div>
          {session.secret_word_note && (
            <p className="text-xs text-ink-muted mt-1">出题人备忘: {session.secret_word_note}</p>
          )}
        </div>

        {/* 本局关键数据 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6 text-center">
          <div className="p-3 bg-warm-bg rounded-game-sm border border-warm-border">
            <div className="text-[11px] text-ink-muted font-medium">有效问答数</div>
            <div className="text-lg font-black text-ink-text mt-0.5">
              {session.completed_questions_count}
              {session.mode === 'challenge' && (
                <span className="text-xs text-ink-subtle font-normal"> / {session.max_questions}</span>
              )}
            </div>
          </div>
          <div className="p-3 bg-warm-bg rounded-game-sm border border-warm-border">
            <div className="text-[11px] text-ink-muted font-medium">正式猜错</div>
            <div className="text-lg font-black text-status-err mt-0.5">
              {session.wrong_guesses_count} 次
            </div>
          </div>
          <div className="p-3 bg-warm-bg rounded-game-sm border border-warm-border">
            <div className="text-[11px] text-ink-muted font-medium">对局用时</div>
            <div className="text-lg font-black text-ink-text mt-0.5">
              {durationSeconds} 秒
            </div>
          </div>
          <div className="p-3 bg-warm-bg rounded-game-sm border border-warm-border">
            <div className="text-[11px] text-ink-muted font-medium">AI 辅助用量</div>
            <div className="text-lg font-black text-terracotta-600 mt-0.5">
              {session.ai_quota_used} 次
            </div>
          </div>
        </div>

        {/* 双方表现对称对比 (双方均担任过猜词人时解锁) */}
        {canCompare ? (
          <div className="mb-6 p-4 bg-sage-50/70 border border-sage-200 rounded-game space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-sage-900">
              <BarChart2 className="w-4 h-4 text-sage-600" />
              <span>双方作为猜词人时平均表现对比（已完成 {matchHistory.length} 局）</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white rounded-game-sm border border-warm-border shadow-2xs">
                <div className="font-bold text-ink-text mb-1.5 flex items-center justify-between">
                  <span>{hostNick}</span>
                  <span className="text-[10px] text-sage-700 bg-sage-100 px-1.5 py-0.2 rounded">
                    猜词 {hostAsGuesser.length} 次
                  </span>
                </div>
                <div className="space-y-0.5 text-ink-muted text-[11px]">
                  <div>平均提问: <strong>{calcAvg(hostAsGuesser, 'completed_questions_count')}</strong> 次</div>
                  <div>平均猜错: <strong>{calcAvg(hostAsGuesser, 'wrong_guesses_count')}</strong> 次</div>
                  <div>平均用时: <strong>{calcAvg(hostAsGuesser, 'duration_seconds')}</strong> 秒</div>
                </div>
              </div>

              <div className="p-3 bg-white rounded-game-sm border border-warm-border shadow-2xs">
                <div className="font-bold text-ink-text mb-1.5 flex items-center justify-between">
                  <span>{guestNick}</span>
                  <span className="text-[10px] text-terracotta-700 bg-terracotta-100 px-1.5 py-0.2 rounded">
                    猜词 {guestAsGuesser.length} 次
                  </span>
                </div>
                <div className="space-y-0.5 text-ink-muted text-[11px]">
                  <div>平均提问: <strong>{calcAvg(guestAsGuesser, 'completed_questions_count')}</strong> 次</div>
                  <div>平均猜错: <strong>{calcAvg(guestAsGuesser, 'wrong_guesses_count')}</strong> 次</div>
                  <div>平均用时: <strong>{calcAvg(guestAsGuesser, 'duration_seconds')}</strong> 秒</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-6 p-3 bg-warm-subtle border border-warm-border rounded-game-sm text-xs text-ink-muted text-center flex items-center justify-center gap-2">
            <Award className="w-4 h-4 text-ink-subtle" />
            <span>双方都至少担任过一次猜词方后，将解锁双方表现对称对比看板</span>
          </div>
        )}

        {/* 三大操作按钮 */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => handleAction('swap_roles')}
            disabled={submittingAction}
            className="w-full py-3.5 bg-sage-500 hover:bg-sage-600 active:bg-sage-700 disabled:opacity-50 text-white font-bold text-sm rounded-game-sm shadow transition flex items-center justify-center gap-2"
          >
            <Repeat className="w-4 h-4" />
            <span>交换角色再来一局 (出题人 ⇋ 猜词人)</span>
          </button>

          <button
            type="button"
            onClick={() => handleAction('keep_roles')}
            disabled={submittingAction}
            className="w-full py-2.5 bg-warm-subtle hover:bg-warm-border disabled:opacity-50 text-ink-text font-semibold text-xs rounded-game-sm transition flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>保持当前角色再来一局</span>
          </button>

          <button
            type="button"
            onClick={() => handleAction('end_game')}
            disabled={submittingAction}
            className="w-full py-2 text-ink-subtle hover:text-ink-text text-xs transition"
          >
            结束本次游戏
          </button>
        </div>
      </div>
    </div>
  );
}
