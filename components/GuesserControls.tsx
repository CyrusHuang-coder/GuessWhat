'use client';

import { useState, useEffect } from 'react';
import { GameStateDTO } from '@/lib/types/game';
import {
  Send,
  Target,
  Sparkles,
  AlertTriangle,
  Flag,
  X,
} from 'lucide-react';
import { GuesserSidebar } from './GuesserSidebar';
import { VoiceInputButton } from './VoiceInputButton';

interface Props {
  state: GameStateDTO;
  roomCode: string;
  playerToken: string;
  presetQuestion?: string;
  onClearPresetQuestion?: () => void;
}

export function GuesserControls({
  state,
  roomCode,
  playerToken,
  presetQuestion,
  onClearPresetQuestion,
}: Props) {
  const { session, questions, guesses } = state;

  const [questionText, setQuestionText] = useState('');
  const [submittingQ, setSubmittingQ] = useState(false);

  // 同步外部填入的问题（例如从 AI 推荐中填入）
  useEffect(() => {
    if (presetQuestion) {
      setQuestionText(presetQuestion);
      onClearPresetQuestion?.();
    }
  }, [presetQuestion, onClearPresetQuestion]);

  // 待澄清修改
  const pendingClarification = questions.find((q) => q.status === 'clarification_requested');
  const [revisedText, setRevisedText] = useState(pendingClarification?.original_text || '');
  const [submittingRevise, setSubmittingRevise] = useState(false);

  // 正式猜词独立弹窗
  const [showGuessModal, setShowGuessModal] = useState(false);
  const [guessInput, setGuessInput] = useState('');
  const [submittingGuess, setSubmittingGuess] = useState(false);

  // 移动端专用 AI 抽屉
  const [showMobileAIDrawer, setShowMobileAIDrawer] = useState(false);

  const [error, setError] = useState<string | null>(null);

  if (session?.status !== 'playing') return null;

  // 状态检查
  const hasPendingQuestion = questions.some(
    (q) => q.status === 'pending' || q.status === 'revised'
  );
  const hasPendingGuess = guesses.some((g) => g.status === 'pending');
  const isChallenge = session.mode === 'challenge';
  const isQuestionQuotaExhausted =
    isChallenge && session.completed_questions_count >= session.max_questions;

  // 提交普通问题
  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim() || submittingQ || hasPendingQuestion || isQuestionQuotaExhausted) return;

    setSubmittingQ(true);
    setError(null);

    try {
      const res = await fetch(`/api/rooms/${roomCode}/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-token': playerToken,
        },
        body: JSON.stringify({ text: questionText.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setQuestionText('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingQ(false);
    }
  };

  // 提交修改后问题
  const handleReviseQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingClarification || !revisedText.trim() || submittingRevise) return;

    setSubmittingRevise(true);
    setError(null);

    try {
      const res = await fetch(`/api/rooms/${roomCode}/questions/${pendingClarification.id}/revise`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-token': playerToken,
        },
        body: JSON.stringify({ revisedText: revisedText.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingRevise(false);
    }
  };

  // 提交正式猜词
  const handleSubmitGuess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guessInput.trim() || submittingGuess) return;

    setSubmittingGuess(true);
    setError(null);

    try {
      const res = await fetch(`/api/rooms/${roomCode}/guesses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-token': playerToken,
        },
        body: JSON.stringify({ guessText: guessInput.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setGuessInput('');
      setShowGuessModal(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingGuess(false);
    }
  };

  // 主动认输
  const handleSurrender = async () => {
    if (!window.confirm('确定要主动认输并揭晓本局秘密答案吗？')) return;
    try {
      const res = await fetch(`/api/rooms/${roomCode}/surrender`, {
        method: 'POST',
        headers: { 'x-player-token': playerToken },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
    } catch (err: any) {
      alert(`认输失败: ${err.message}`);
    }
  };

  return (
    <div className="space-y-3">
      {/* 错误提示 */}
      {error && (
        <div className="p-2.5 bg-status-errBg text-status-err text-xs rounded-game-sm border border-status-errBorder">
          {error}
        </div>
      )}

      {/* 1. 待澄清修改提示条 (当出题人请求澄清时置顶突出) */}
      {pendingClarification && (
        <form
          onSubmit={handleReviseQuestion}
          className="p-3.5 bg-status-warnBg border border-status-warnBorder rounded-game-sm space-y-2.5 shadow-2xs"
        >
          <div className="text-xs font-bold text-status-warn flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>出题人请求澄清原问题：{pendingClarification.clarification_reason}</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={revisedText}
              onChange={(e) => setRevisedText(e.target.value)}
              placeholder="修改后的更明确的是非问题..."
              className="flex-1 px-3 py-2 text-xs border border-status-warnBorder rounded-game-sm bg-white focus:outline-none focus:ring-2 focus:ring-status-warn text-ink-text"
              required
            />
            <VoiceInputButton
              onTranscript={(txt) => setRevisedText((prev) => (prev ? `${prev} ${txt}` : txt))}
              size="sm"
              title="语音输入修改后的问题"
            />
            <button
              type="submit"
              disabled={submittingRevise}
              className="px-4 py-2 bg-status-warn text-white font-bold text-xs rounded-game-sm shadow-2xs hover:opacity-90 transition shrink-0"
            >
              {submittingRevise ? '提交中...' : '提交修改后的问题'}
            </button>
          </div>
        </form>
      )}

      {/* 2. 主操作条：提问输入框 + 独立正式猜词入口 */}
      <div className="bg-white p-3 rounded-game border border-warm-border shadow-board space-y-2">
        <div className="flex flex-col sm:flex-row items-center gap-2">
          {/* 普通提问表单 */}
          <form onSubmit={handleSubmitQuestion} className="flex-1 w-full flex items-center gap-2">
            <div className="flex-1 relative flex items-center">
              <input
                type="text"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder={
                  isQuestionQuotaExhausted
                    ? '挑战模式提问额度已用尽，请使用右侧“正式猜词”'
                    : hasPendingQuestion
                    ? '等待出题人回复上一问题...'
                    : '提一个是非问题（如：它属于现代科技产品吗？）'
                }
                disabled={submittingQ || hasPendingQuestion || isQuestionQuotaExhausted}
                className="w-full pl-4 pr-11 py-2.5 text-sm border border-warm-border rounded-game-sm bg-warm-bg/50 focus:outline-none focus:ring-2 focus:ring-sage-500 disabled:bg-warm-subtle disabled:text-ink-subtle text-ink-text"
                maxLength={80}
              />
              <div className="absolute right-1.5 flex items-center">
                <VoiceInputButton
                  onTranscript={(txt) => setQuestionText((prev) => (prev ? `${prev} ${txt}` : txt))}
                  size="sm"
                  title="点击语音输入问题"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={
                submittingQ ||
                !questionText.trim() ||
                hasPendingQuestion ||
                isQuestionQuotaExhausted
              }
              className="px-4 py-2.5 bg-sage-500 hover:bg-sage-600 active:bg-sage-700 disabled:opacity-40 text-white font-bold text-sm rounded-game-sm shadow-2xs flex items-center gap-1.5 shrink-0 transition"
            >
              <Send className="w-4 h-4" />
              <span>提问</span>
            </button>
          </form>

          {/* 独立正式猜词按钮 */}
          <button
            type="button"
            onClick={() => setShowGuessModal(true)}
            disabled={hasPendingGuess}
            className="w-full sm:w-auto px-4 py-2.5 bg-terracotta-500 hover:bg-terracotta-600 active:bg-terracotta-700 text-white font-bold text-sm rounded-game-sm shadow-2xs flex items-center justify-center gap-1.5 shrink-0 transition"
          >
            <Target className="w-4 h-4" />
            <span>正式猜词</span>
          </button>
        </div>

        {/* 移动端专属快捷工具条 (AI 助手与主动认输) */}
        <div className="flex lg:hidden items-center justify-between text-xs pt-1 border-t border-warm-border">
          <button
            type="button"
            onClick={() => setShowMobileAIDrawer(true)}
            className="flex items-center gap-1.5 text-sage-700 font-bold py-1 px-2 rounded-game-sm bg-sage-100/80"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI 思路助手 ({session.ai_quota_total - session.ai_quota_used}次)</span>
          </button>

          <button
            type="button"
            onClick={handleSurrender}
            className="flex items-center gap-1 text-ink-subtle hover:text-status-err transition text-xs"
          >
            <Flag className="w-3.5 h-3.5" />
            <span>认输揭晓</span>
          </button>
        </div>
      </div>

      {/* 3. 正式猜词弹窗 (必须独立提交，防误触) */}
      {showGuessModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-game-lg max-w-md w-full p-6 shadow-2xl border border-warm-border animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-warm-border mb-4">
              <div className="flex items-center gap-2 text-terracotta-600">
                <Target className="w-5 h-5" />
                <h3 className="text-base font-black text-ink-text">发起正式猜词</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuessModal(false)}
                className="text-ink-subtle hover:text-ink-text p-1 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-ink-muted leading-relaxed mb-4">
              正式猜词是独立的结算裁定流程。出题人将判断是否完全猜中。猜错不会判负（仅记录猜错次数），猜中则立即揭晓答案并进入结算。
            </p>

            <form onSubmit={handleSubmitGuess} className="space-y-4">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={guessInput}
                  onChange={(e) => setGuessInput(e.target.value)}
                  placeholder="输入你确信的秘密答案..."
                  className="w-full pl-4 pr-11 py-2.5 text-sm border border-terracotta-200 rounded-game-sm bg-warm-bg focus:outline-none focus:ring-2 focus:ring-terracotta-500 text-ink-text"
                  maxLength={40}
                  autoFocus
                  required
                />
                <div className="absolute right-1.5 flex items-center">
                  <VoiceInputButton
                    onTranscript={(txt) => setGuessInput(txt)}
                    size="sm"
                    title="语音输入猜词答案"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowGuessModal(false)}
                  className="flex-1 py-2.5 text-xs font-semibold text-ink-muted hover:bg-warm-bg rounded-game-sm transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submittingGuess || !guessInput.trim()}
                  className="flex-1 py-2.5 bg-terracotta-500 hover:bg-terracotta-600 active:bg-terracotta-700 disabled:opacity-50 text-white font-bold text-xs rounded-game-sm shadow transition"
                >
                  {submittingGuess ? '提交中...' : '确认提交裁定'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. 移动端专属底部 AI 抽屉 */}
      {showMobileAIDrawer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-50 flex flex-col justify-end lg:hidden">
          <div className="bg-white rounded-t-game-lg max-h-[85vh] overflow-y-auto p-5 shadow-2xl border-t border-warm-border space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-warm-border">
              <div className="flex items-center gap-1.5 text-xs font-bold text-ink-text">
                <Sparkles className="w-4 h-4 text-sage-600" />
                <span>AI 思路助手 (移动端)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileAIDrawer(false)}
                className="text-ink-subtle hover:text-ink-text p-1 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <GuesserSidebar
              state={state}
              roomCode={roomCode}
              playerToken={playerToken}
              onSelectRecommendedQuestion={(q) => {
                setQuestionText(q);
                setShowMobileAIDrawer(false);
              }}
              onSurrender={() => {
                setShowMobileAIDrawer(false);
                handleSurrender();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
