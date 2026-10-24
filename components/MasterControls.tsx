'use client';

import { useState, useEffect } from 'react';
import { AnswerType, GameStateDTO } from '@/lib/types/game';
import { CheckCircle2, XCircle, HelpCircle, MessageSquare, X, Sparkles, Loader2 } from 'lucide-react';

interface Props {
  state: GameStateDTO;
  roomCode: string;
  playerToken: string;
}

export function MasterControls({ state, roomCode, playerToken }: Props) {
  const { session, questions, guesses } = state;

  const [answering, setAnswering] = useState(false);
  const [adjudicating, setAdjudicating] = useState(false);
  const [showClarifyModal, setShowClarifyModal] = useState(false);
  const [clarifyReason, setClarifyReason] = useState('问题范围不明确');
  const [customClarify, setCustomClarify] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 出题人 AI 知识百科查证状态
  const [checkingFact, setCheckingFact] = useState(false);
  const [factCheckResult, setFactCheckResult] = useState<{
    suggestedAnswer: AnswerType;
    explanation: string;
  } | null>(null);
  const [factError, setFactError] = useState<string | null>(null);

  // 待回答的问题
  const pendingQuestion = questions.find(
    (q) => q.status === 'pending' || q.status === 'revised'
  );

  // 当待回答题目变化时，重置上一题的事实查证结果
  useEffect(() => {
    setFactCheckResult(null);
    setFactError(null);
  }, [pendingQuestion?.id]);

  if (session?.status !== 'playing') return null;

  // 待裁定的猜词
  const pendingGuess = guesses.find((g) => g.status === 'pending');

  // 正式回答
  const handleAnswer = async (answer: AnswerType) => {
    if (!pendingQuestion || answering) return;
    setAnswering(true);
    setError(null);

    try {
      const res = await fetch(`/api/rooms/${roomCode}/questions/${pendingQuestion.id}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-token': playerToken,
        },
        body: JSON.stringify({ answer }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnswering(false);
    }
  };

  // 请求澄清
  const handleClarify = async () => {
    if (!pendingQuestion || answering) return;
    const finalReason = clarifyReason === '自定义' ? customClarify.trim() : clarifyReason;
    if (!finalReason) {
      setError('请选择或输入澄清原因');
      return;
    }

    setAnswering(true);
    setError(null);

    try {
      const res = await fetch(`/api/rooms/${roomCode}/questions/${pendingQuestion.id}/clarify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-token': playerToken,
        },
        body: JSON.stringify({ reason: finalReason }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setShowClarifyModal(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnswering(false);
    }
  };

  // 裁定猜词
  const handleAdjudicate = async (status: 'correct' | 'incorrect') => {
    if (!pendingGuess || adjudicating) return;
    setAdjudicating(true);
    setError(null);

    try {
      const res = await fetch(`/api/rooms/${roomCode}/guesses/${pendingGuess.id}/adjudicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-token': playerToken,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdjudicating(false);
    }
  };

  // 向 AI 请求当前题目事实查证（知识型问题百科顾问）
  const handleFactCheck = async () => {
    if (!pendingQuestion || checkingFact) return;
    setCheckingFact(true);
    setFactError(null);

    try {
      const qText = pendingQuestion.revised_text || pendingQuestion.original_text;
      const res = await fetch(`/api/rooms/${roomCode}/ai-fact-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-token': playerToken,
        },
        body: JSON.stringify({ questionText: qText }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || data.error);
      }
      setFactCheckResult(data.data);
    } catch (err: any) {
      setFactError(err.message || '查询事实失败');
    } finally {
      setCheckingFact(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-2.5 bg-status-errBg text-status-err text-xs rounded-game-sm border border-status-errBorder">
          {error}
        </div>
      )}

      {/* 1. 待裁定正式猜词（优先级最高） */}
      {pendingGuess && (
        <div className="p-4 bg-terracotta-50 border-2 border-terracotta-300 rounded-game space-y-3 shadow-board animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-terracotta-700 uppercase tracking-wider">
              🎯 猜词人发起了正式猜词：
            </span>
            <span className="text-[11px] text-terracotta-600 font-semibold bg-terracotta-100 px-2 py-0.5 rounded-full">
              请出题人裁定
            </span>
          </div>
          <div className="text-xl font-black text-ink-text py-1">
            “{pendingGuess.guess_text}”
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => handleAdjudicate('correct')}
              disabled={adjudicating}
              className="flex-1 py-3 bg-status-ok hover:opacity-90 active:scale-98 text-white font-black text-sm rounded-game-sm shadow transition flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>猜中了！(揭晓答案并结算)</span>
            </button>
            <button
              type="button"
              onClick={() => handleAdjudicate('incorrect')}
              disabled={adjudicating}
              className="flex-1 py-3 bg-status-err hover:opacity-90 active:scale-98 text-white font-black text-sm rounded-game-sm shadow transition flex items-center justify-center gap-1.5"
            >
              <XCircle className="w-4 h-4" />
              <span>没猜中 (对局继续)</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. 待正式回答的问题 */}
      {pendingQuestion && !pendingGuess && (
        <div className="p-4 bg-white border border-warm-border rounded-game shadow-board space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-muted">
              猜词人提问 #{pendingQuestion.question_number}：
            </span>
            {pendingQuestion.status === 'revised' && (
              <span className="text-xs text-sage-700 font-bold bg-sage-100 px-2 py-0.5 rounded-full border border-sage-200">
                已按澄清修改
              </span>
            )}
          </div>

          <div className="text-base font-bold text-ink-text bg-warm-bg/70 p-3.5 rounded-game-sm border border-warm-border">
            {pendingQuestion.revised_text || pendingQuestion.original_text}
          </div>

          {/* 出题人 AI 知识百科查证与顾问辅助 */}
          {factError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-game-sm text-xs text-red-700 flex items-start justify-between gap-2">
              <div className="leading-relaxed whitespace-pre-wrap">{factError}</div>
              <button
                type="button"
                onClick={() => setFactError(null)}
                className="text-red-500 hover:text-red-800 shrink-0 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {factCheckResult ? (
            <div className="p-3.5 bg-gradient-to-r from-sage-50 to-emerald-50 border border-sage-300 rounded-game-sm space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-sage-900">
                  <Sparkles className="w-4 h-4 text-sage-600" />
                  <span>AI 知识顾问查证建议：</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-black text-white ${
                    factCheckResult.suggestedAnswer === 'yes' ? 'bg-status-ok' :
                    factCheckResult.suggestedAnswer === 'no' ? 'bg-status-err' : 'bg-status-warn'
                  }`}>
                    建议回答【{factCheckResult.suggestedAnswer === 'yes' ? '是' : factCheckResult.suggestedAnswer === 'no' ? '不是' : '不确定'}】
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFactCheckResult(null)}
                  className="text-ink-subtle hover:text-ink-text p-1 text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="text-xs text-ink-text bg-white/80 p-2.5 rounded border border-sage-200/60 leading-relaxed">
                <span className="font-semibold text-sage-800">事实解析：</span>
                {factCheckResult.explanation}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleAnswer(factCheckResult.suggestedAnswer)}
                  disabled={answering}
                  className="px-3 py-1.5 bg-sage-600 hover:bg-sage-700 text-white font-bold text-xs rounded shadow-xs transition flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>一键采纳此回答并提交</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleFactCheck}
                disabled={checkingFact || answering}
                className="text-xs text-sage-700 hover:text-sage-900 font-medium py-1.5 px-2.5 bg-sage-50 hover:bg-sage-100/80 border border-sage-200 rounded-game-sm transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {checkingFact ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-sage-600" />
                    <span>正在查证关于秘密词条的百科事实...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-sage-600" />
                    <span>对该知识点拿不准？让 AI 查证此题事实（不泄密）</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* 3个核心正式回答按钮 + 1个独立澄清操作 */}
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleAnswer('yes')}
                disabled={answering}
                className="py-3 bg-status-ok hover:opacity-90 active:scale-98 disabled:opacity-50 text-white font-black text-sm rounded-game-sm shadow-2xs transition flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>是</span>
              </button>

              <button
                type="button"
                onClick={() => handleAnswer('no')}
                disabled={answering}
                className="py-3 bg-status-err hover:opacity-90 active:scale-98 disabled:opacity-50 text-white font-black text-sm rounded-game-sm shadow-2xs transition flex items-center justify-center gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                <span>不是</span>
              </button>

              <button
                type="button"
                onClick={() => handleAnswer('uncertain')}
                disabled={answering}
                className="py-3 bg-status-warn hover:opacity-90 active:scale-98 disabled:opacity-50 text-white font-black text-sm rounded-game-sm shadow-2xs transition flex items-center justify-center gap-1.5"
                title="当您无法准确断定或问题标准不一时使用"
              >
                <HelpCircle className="w-4 h-4" />
                <span>不确定</span>
              </button>
            </div>

            {/* 独立澄清按钮 (仅限初次提交的问题，严禁作为第四种回答混淆) */}
            {pendingQuestion.status === 'pending' && pendingQuestion.clarification_count === 0 && (
              <button
                type="button"
                onClick={() => setShowClarifyModal(true)}
                disabled={answering}
                className="w-full py-2 bg-warm-subtle hover:bg-warm-border text-ink-text font-semibold text-xs rounded-game-sm border border-warm-border transition flex items-center justify-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5 text-terracotta-600" />
                <span>该问题存在歧义？点击请求澄清一次（不消耗问答额度）</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 无待处理事件时的占位 */}
      {!pendingGuess && !pendingQuestion && (
        <div className="text-center py-6 text-xs text-ink-subtle bg-white rounded-game border border-dashed border-warm-border">
          出题人就绪 · 等待猜词人提问或发起正式猜词...
        </div>
      )}

      {/* 澄清原因选择弹窗 */}
      {showClarifyModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-game-lg max-w-md w-full p-6 shadow-2xl border border-warm-border animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-warm-border mb-3">
              <h3 className="text-base font-bold text-ink-text">选择请求澄清的原因</h3>
              <button
                type="button"
                onClick={() => setShowClarifyModal(false)}
                className="text-ink-subtle hover:text-ink-text p-1 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-ink-muted leading-relaxed mb-4">
              每个问题严格限澄清 1 次。猜词人修改重提后将由您再次回答，澄清过程不消耗有效问答额度。
            </p>

            <div className="space-y-2 mb-4">
              {[
                '问题范围不明确',
                '缺少明确客观的判断标准',
                '一个问题包含多个独立判断条件',
                '自定义',
              ].map((reason) => (
                <button
                  type="button"
                  key={reason}
                  onClick={() => setClarifyReason(reason)}
                  className={`w-full p-2.5 text-xs text-left rounded-game-sm border font-medium transition ${
                    clarifyReason === reason
                      ? 'border-terracotta-500 bg-terracotta-50 text-terracotta-700 font-bold ring-1 ring-terracotta-400'
                      : 'border-warm-border hover:bg-warm-bg text-ink-text'
                  }`}
                >
                  {reason}
                </button>
              ))}

              {clarifyReason === '自定义' && (
                <input
                  type="text"
                  value={customClarify}
                  onChange={(e) => setCustomClarify(e.target.value)}
                  placeholder="输入具体澄清说明..."
                  maxLength={50}
                  className="w-full px-3 py-2 text-xs border border-terracotta-300 rounded-game-sm bg-warm-bg focus:outline-none focus:ring-2 focus:ring-terracotta-500 text-ink-text"
                  autoFocus
                />
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowClarifyModal(false)}
                className="flex-1 py-2 text-xs font-semibold text-ink-muted hover:bg-warm-bg rounded-game-sm"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleClarify}
                className="flex-1 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white font-bold text-xs rounded-game-sm shadow"
              >
                发送澄清请求
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
