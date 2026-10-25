'use client';

import { useState } from 'react';
import { GameStateDTO } from '@/lib/types/game';
import {
  Sparkles,
  Compass,
  Lightbulb,
  AlertTriangle,
  Flag,
  HelpCircle,
  ChevronRight,
  ShieldCheck,
  X,
} from 'lucide-react';

interface Props {
  state: GameStateDTO;
  roomCode: string;
  playerToken: string;
  onSelectRecommendedQuestion: (question: string) => void;
  onSurrender: () => void;
}

export function GuesserSidebar({
  state,
  roomCode,
  playerToken,
  onSelectRecommendedQuestion,
  onSurrender,
}: Props) {
  const { session, offTrackEvaluations } = state;

  const [aiLoading, setAILoading] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<
    { question: string; rationale: string }[] | null
  >(null);
  const [stageHint, setStageHint] = useState<{ direction: string; hint: string } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  if (!session) return null;

  // 请求 AI 推荐
  const handleRequestAIRecommend = async () => {
    setAILoading(true);
    setAiError(null);
    try {
      const res = await fetch(`/api/rooms/${roomCode}/ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-token': playerToken,
        },
        body: JSON.stringify({ type: 'recommend' }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || data.error);
      }
      setAiRecommendations(data.data.questions);
    } catch (err: any) {
      setAiError(err.message);
    } finally {
      setAILoading(false);
    }
  };

  // 请求 AI 阶段提示
  const handleRequestAIHint = async () => {
    setAILoading(true);
    setAiError(null);
    try {
      const res = await fetch(`/api/rooms/${roomCode}/ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-token': playerToken,
        },
        body: JSON.stringify({ type: 'hint' }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || data.error);
      }
      setStageHint(data.data);
    } catch (err: any) {
      setAiError(err.message);
    } finally {
      setAILoading(false);
    }
  };

  // 偏航预警开关
  const handleToggleOffTrack = async () => {
    try {
      await fetch(`/api/rooms/${roomCode}/off-track/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-token': playerToken,
        },
        body: JSON.stringify({ enabled: !session.off_track_enabled }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  // 手动即刻发起当前思路偏航评估（不消耗主动额度）
  const handleEvaluateNow = async () => {
    if (evaluating) return;
    setEvaluating(true);
    try {
      await fetch(`/api/rooms/${roomCode}/off-track/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-token': playerToken,
        },
      });
    } catch (err) {
      console.error(err);
    } finally {
      setEvaluating(false);
    }
  };

  const latestEvaluation =
    offTrackEvaluations.length > 0
      ? offTrackEvaluations[offTrackEvaluations.length - 1]
      : null;

  const remainingQuota = session.ai_quota_total - session.ai_quota_used;

  return (
    <aside className="space-y-4">
      {/* 1. AI 思路助手卡片 */}
      <div className="bg-white rounded-game border border-warm-border p-4 shadow-board space-y-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-warm-border">
          <div className="flex items-center gap-1.5 text-xs font-bold text-ink-text">
            <Sparkles className="w-4 h-4 text-sage-600" />
            <span>AI 思路助手</span>
          </div>
          <span className="text-[11px] font-semibold text-sage-700 bg-sage-100 px-2 py-0.5 rounded-full">
            剩余额度: {remainingQuota} 次
          </span>
        </div>

        <p className="text-xs text-ink-muted leading-relaxed">
          AI 仅基于公开已知问答辅助二分策略，绝对不会向您直接透露秘密答案。
        </p>

        {aiError && (
          <div className="p-3 bg-status-errBg text-status-err text-xs rounded-game-sm border border-status-errBorder relative">
            <button
              type="button"
              onClick={() => setAiError(null)}
              className="absolute top-2 right-2 text-status-err hover:opacity-75 p-0.5"
              title="关闭提示"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="whitespace-pre-wrap leading-relaxed font-sans pr-5">
              {aiError}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleRequestAIRecommend}
            disabled={aiLoading || remainingQuota <= 0}
            className="py-2.5 px-2 bg-sage-50 hover:bg-sage-100 border border-sage-200 text-sage-800 font-bold text-xs rounded-game-sm transition disabled:opacity-50 text-center"
          >
            {aiLoading ? '思考中...' : '💡 推荐下一问'}
          </button>
          <button
            type="button"
            onClick={handleRequestAIHint}
            disabled={aiLoading || remainingQuota <= 0}
            className="py-2.5 px-2 bg-terracotta-50 hover:bg-terracotta-100 border border-terracotta-200 text-terracotta-700 font-bold text-xs rounded-game-sm transition disabled:opacity-50 text-center"
          >
            {aiLoading ? '思考中...' : '🧭 方向探索提示'}
          </button>
        </div>

        {/* 候选问题列表 */}
        {aiRecommendations && (
          <div className="space-y-2 pt-2 border-t border-warm-border">
            <div className="text-[11px] font-bold text-ink-text flex items-center justify-between">
              <span>候选二分问题 (点击填入)：</span>
            </div>
            {aiRecommendations.map((rec, i) => (
              <button
                type="button"
                key={i}
                onClick={() => onSelectRecommendedQuestion(rec.question)}
                className="w-full p-2.5 bg-warm-bg/70 hover:bg-sage-50 text-left rounded-game-sm border border-warm-border hover:border-sage-300 transition group"
              >
                <div className="text-xs font-bold text-ink-text group-hover:text-sage-700 flex items-center justify-between">
                  <span>{rec.question}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-sage-500 opacity-60 group-hover:opacity-100" />
                </div>
                <div className="text-[11px] text-ink-muted mt-0.5">{rec.rationale}</div>
              </button>
            ))}
          </div>
        )}

        {/* 阶段方向提示 */}
        {stageHint && (
          <div className="p-3 bg-terracotta-50 border border-terracotta-200 rounded-game-sm text-xs space-y-1">
            <div className="font-bold text-terracotta-700 flex items-center gap-1">
              <Lightbulb className="w-3.5 h-3.5" />
              <span>维度建议: {stageHint.direction}</span>
            </div>
            <p className="text-ink-text leading-relaxed">{stageHint.hint}</p>
          </div>
        )}
      </div>

      {/* 2. 思路偏航预警设置卡片 */}
      <div className="bg-white rounded-game border border-warm-border p-4 shadow-board space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-ink-text">
            <Compass className="w-4 h-4 text-terracotta-500" />
            <span>思路偏航预警 (仅自己可见)</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={session.off_track_enabled}
              onChange={handleToggleOffTrack}
              className="sr-only peer"
            />
            <div className="w-8 h-4 bg-warm-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-sage-500"></div>
          </label>
        </div>

        <p className="text-[11px] text-ink-muted leading-relaxed">
          开启后，系统将在第 4、7、10... 次问答完成时自动评估策略是否盲目固着；亦可随时手动点击即刻评估（不消耗额度）。
        </p>

        {session.off_track_enabled && (
          <button
            type="button"
            onClick={handleEvaluateNow}
            disabled={evaluating || state.questions.filter((q) => q.status === 'answered').length === 0}
            className="w-full py-2 px-2.5 bg-terracotta-50 hover:bg-terracotta-100 text-terracotta-700 text-xs font-bold rounded-game-sm transition border border-terracotta-200 flex items-center justify-center gap-1.5 disabled:opacity-50"
            title="对当前已问问题进行逻辑策略评估"
          >
            <Compass className={`w-3.5 h-3.5 text-terracotta-600 ${evaluating ? 'animate-spin' : ''}`} />
            <span>{evaluating ? '正在推演评估当前思路...' : '⚡ 立即评估当前提问思路'}</span>
          </button>
        )}

        {session.off_track_enabled && latestEvaluation && (
          <div
            className={`p-3 rounded-game-sm border text-xs space-y-1 ${
              latestEvaluation.status === 'possible_off_track'
                ? 'bg-status-warnBg border-status-warnBorder text-status-warn'
                : latestEvaluation.status === 'effective'
                ? 'bg-status-okBg border-status-okBorder text-status-ok'
                : 'bg-warm-subtle border-warm-border text-ink-text'
            }`}
          >
            <div className="font-bold flex items-center gap-1">
              {latestEvaluation.status === 'possible_off_track' && <AlertTriangle className="w-3.5 h-3.5" />}
              <span>
                {latestEvaluation.status === 'possible_off_track'
                  ? '可能偏航提示'
                  : latestEvaluation.status === 'effective'
                  ? '推理有效推进中'
                  : '策略评估参考'}
              </span>
            </div>
            <p className="leading-relaxed">{latestEvaluation.rationale}</p>
          </div>
        )}
      </div>

      {/* 3. 主动认输与局势终结 */}
      <div className="bg-warm-subtle rounded-game border border-warm-border p-3 space-y-2">
        <button
          type="button"
          onClick={onSurrender}
          className="w-full py-2 text-xs font-semibold text-status-err hover:bg-status-errBg rounded-game-sm transition flex items-center justify-center gap-1.5"
        >
          <Flag className="w-3.5 h-3.5" />
          <span>遇到瓶颈？主动认输并揭晓答案</span>
        </button>
      </div>
    </aside>
  );
}

