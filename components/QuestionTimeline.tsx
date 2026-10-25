'use client';

import { useState } from 'react';
import { AnswerType, Guess, HintExchange, Question } from '@/lib/types/game';
import { HelpCircle, Target, CheckCircle2, XCircle, AlertCircle, Clock, MessageSquare, Lightbulb, Sparkles, Edit3 } from 'lucide-react';

interface Props {
  questions: Question[];
  guesses: Guess[];
  hints?: HintExchange[];
  completedCount: number;
  maxQuestions: number;
  isChallengeMode: boolean;
  isQuestionMaster?: boolean;
  onReviseAnswer?: (questionId: string, newAnswer: AnswerType) => Promise<void>;
}

export function QuestionTimeline({
  questions,
  guesses,
  hints = [],
  completedCount,
  maxQuestions,
  isChallengeMode,
  isQuestionMaster,
  onReviseAnswer,
}: Props) {
  const [activeReviseId, setActiveReviseId] = useState<string | null>(null);
  const [submittingRevise, setSubmittingRevise] = useState(false);
  type TimelineItem =
    | { type: 'question'; data: Question; time: number }
    | { type: 'guess'; data: Guess; time: number }
    | { type: 'hint'; data: HintExchange; time: number };

  const visibleHints = hints.filter((h) => h.status === 'provided');

  const items: TimelineItem[] = [
    ...questions.map((q) => ({
      type: 'question' as const,
      data: q,
      time: new Date(q.created_at).getTime(),
    })),
    ...guesses.map((g) => ({
      type: 'guess' as const,
      data: g,
      time: new Date(g.created_at).getTime(),
    })),
    ...visibleHints.map((h) => ({
      type: 'hint' as const,
      data: h,
      time: new Date(h.responded_at || h.requested_at).getTime(),
    })),
  ].sort((a, b) => a.time - b.time);

  return (
    <div className="space-y-4">
      {/* 顶部计数与信息进度条 */}
      <div className="flex flex-wrap items-center justify-between text-xs bg-warm-subtle/80 p-3 rounded-game-sm border border-warm-border">
        <div className="flex items-center gap-4 text-ink-text">
          <div>
            已完成有效问答: <strong className="font-bold text-ink-text text-sm">{completedCount}</strong>
            {isChallengeMode ? (
              <span className="text-ink-muted"> / {maxQuestions} 次</span>
            ) : (
              <span className="text-ink-muted"> 次 (不限次)</span>
            )}
          </div>
          <span className="text-warm-border">|</span>
          <div>
            正式猜错: <strong className="font-bold text-status-err text-sm">{guesses.filter(g => g.status === 'incorrect').length}</strong> 次
          </div>
        </div>

        {isChallengeMode && (
          <div className="font-semibold text-terracotta-700 bg-terracotta-100 px-2.5 py-0.5 rounded-full text-xs">
            剩余提问:{' '}
            <strong className="font-black text-sm">
              {Math.max(0, maxQuestions - completedCount)}
            </strong>{' '}
            次
          </div>
        )}
      </div>

      {/* 问答与正式猜词记录流 */}
      {items.length === 0 ? (
        <div className="py-16 text-center text-ink-subtle bg-white border border-dashed border-warm-border rounded-game shadow-2xs">
          <HelpCircle className="w-9 h-9 mx-auto mb-2 opacity-40 text-sage-500" />
          <p className="text-sm font-semibold text-ink-muted">本局暂无问答记录</p>
          <p className="text-xs text-ink-subtle mt-1">
            猜词人可从下方输入第一个可以用「是」「不是」「不确定」回答的问题
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            if (item.type === 'question') {
              const q = item.data;
              return (
                <div
                  key={`q-${q.id}`}
                  className={`p-4 rounded-game-sm border transition ${
                    q.status === 'pending' || q.status === 'revised'
                      ? 'bg-warm-bg border-sage-300'
                      : q.status === 'clarification_requested'
                      ? 'bg-status-warnBg border-status-warnBorder'
                      : 'bg-white border-warm-border shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-warm-subtle text-ink-muted font-bold text-xs flex items-center justify-center border border-warm-border">
                        #{q.question_number}
                      </span>
                      <div>
                        {/* 修改前与修改后 */}
                        {q.revised_text ? (
                          <div className="space-y-1">
                            <div className="text-xs text-ink-subtle line-through">
                              原问题: {q.original_text}
                            </div>
                            <div className="text-sm font-bold text-ink-text flex items-center gap-2">
                              <span>{q.revised_text}</span>
                              <span className="text-[10px] bg-sage-100 text-sage-800 font-semibold px-1.5 py-0.2 rounded border border-sage-200">
                                已按澄清修改
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm font-bold text-ink-text">{q.original_text}</div>
                        )}

                        {/* 澄清提示 */}
                        {q.status === 'clarification_requested' && (
                          <div className="mt-2 text-xs bg-status-warnBg text-status-warn p-2.5 rounded-game-sm border border-status-warnBorder flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>
                              出题人请求澄清：<strong>{q.clarification_reason}</strong>（待猜词人修改）
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 回答结果标签 (图标 + 明确文字) */}
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {q.status === 'answered' && (
                        <div className="flex items-center gap-1.5">
                          {q.answer === 'yes' && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-status-okBg text-status-ok border border-status-okBorder shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              是
                            </span>
                          )}
                          {q.answer === 'no' && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-status-errBg text-status-err border border-status-errBorder shadow-2xs">
                              <XCircle className="w-3.5 h-3.5" />
                              不是
                            </span>
                          )}
                          {q.answer === 'uncertain' && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-status-warnBg text-status-warn border border-status-warnBorder shadow-2xs">
                              <HelpCircle className="w-3.5 h-3.5" />
                              不确定
                            </span>
                          )}

                          {/* 出题人修正回答小按钮 */}
                          {isQuestionMaster && onReviseAnswer && (
                            <button
                              type="button"
                              onClick={() => setActiveReviseId(activeReviseId === q.id ? null : q.id)}
                              className="text-[10px] text-ink-subtle hover:text-ink-text px-1.5 py-0.5 rounded border border-warm-border hover:bg-warm-bg transition flex items-center gap-0.5"
                              title="点错了？点击修正此题回答"
                            >
                              <Edit3 className="w-2.5 h-2.5" />
                              <span>改答</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* 弹出改答选项条 */}
                      {isQuestionMaster && activeReviseId === q.id && (
                        <div className="flex items-center gap-1 bg-warm-subtle p-1 rounded-game-sm border border-warm-border shadow-xs animate-in fade-in zoom-in-95 duration-100">
                          <button
                            type="button"
                            disabled={submittingRevise || q.answer === 'yes'}
                            onClick={async () => {
                              setSubmittingRevise(true);
                              await onReviseAnswer?.(q.id, 'yes');
                              setSubmittingRevise(false);
                              setActiveReviseId(null);
                            }}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-status-okBg text-status-ok border border-status-okBorder disabled:opacity-30 hover:opacity-80"
                          >
                            改是
                          </button>
                          <button
                            type="button"
                            disabled={submittingRevise || q.answer === 'no'}
                            onClick={async () => {
                              setSubmittingRevise(true);
                              await onReviseAnswer?.(q.id, 'no');
                              setSubmittingRevise(false);
                              setActiveReviseId(null);
                            }}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-status-errBg text-status-err border border-status-errBorder disabled:opacity-30 hover:opacity-80"
                          >
                            改否
                          </button>
                          <button
                            type="button"
                            disabled={submittingRevise || q.answer === 'uncertain'}
                            onClick={async () => {
                              setSubmittingRevise(true);
                              await onReviseAnswer?.(q.id, 'uncertain');
                              setSubmittingRevise(false);
                              setActiveReviseId(null);
                            }}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-status-warnBg text-status-warn border border-status-warnBorder disabled:opacity-30 hover:opacity-80"
                          >
                            改不确定
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveReviseId(null)}
                            className="px-1 py-0.5 text-[10px] text-ink-subtle hover:text-ink-text"
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      {q.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-warm-subtle text-ink-muted border border-warm-border animate-pulse">
                          <Clock className="w-3 h-3" />
                          等待回答中
                        </span>
                      )}

                      {q.status === 'revised' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sage-100 text-sage-700 border border-sage-200 animate-pulse">
                          <Clock className="w-3 h-3" />
                          已修改，待出题人回复
                        </span>
                      )}

                      {q.status === 'clarification_requested' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-status-warnBg text-status-warn border border-status-warnBorder">
                          <MessageSquare className="w-3 h-3" />
                          等待澄清修改
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            } else if (item.type === 'hint') {
              // 提示线索兑换卡片 (温暖琥珀色风格，彰显价值梯度)
              const h = item.data;
              return (
                <div
                  key={`h-${h.id}`}
                  className="p-3.5 rounded-game-sm border border-amber-300 bg-gradient-to-r from-amber-50/90 via-orange-50/60 to-warm-bg shadow-2xs space-y-2 animate-in fade-in duration-200"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-amber-500 text-white shadow-2xs">
                        <Lightbulb className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-bold text-amber-950">线索提示兑换</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200/90 text-amber-900 border border-amber-300">
                        消耗 {h.cost} 次提问机会
                      </span>
                    </div>
                    <span className="text-[11px] text-amber-700/80 font-medium">出题人已提供</span>
                  </div>
                  <div className="text-sm font-bold text-ink-text bg-white/90 p-2.5 rounded-game-sm border border-amber-200/70 leading-relaxed shadow-2xs">
                    “{h.hint_text}”
                  </div>
                </div>
              );
            } else {
              // 正式猜词卡片 (明确区别于普通问答)
              const g = item.data;
              return (
                <div
                  key={`g-${g.id}`}
                  className={`p-3.5 rounded-game-sm border flex items-center justify-between transition ${
                    g.status === 'correct'
                      ? 'bg-status-okBg border-status-ok text-status-ok font-bold shadow-board'
                      : g.status === 'incorrect'
                      ? 'bg-status-errBg border-status-errBorder text-status-err'
                      : 'bg-terracotta-50 border-terracotta-200 text-terracotta-700 animate-pulse'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-1.5 rounded-game-sm ${
                        g.status === 'correct'
                          ? 'bg-status-ok text-white'
                          : g.status === 'incorrect'
                          ? 'bg-status-err text-white'
                          : 'bg-terracotta-500 text-white'
                      }`}
                    >
                      <Target className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold opacity-80">正式猜词：</span>
                      <span className="text-sm font-black ml-1">“{g.guess_text}”</span>
                    </div>
                  </div>

                  <div className="shrink-0 text-xs font-bold">
                    {g.status === 'pending' && <span>等待出题人正式裁定...</span>}
                    {g.status === 'incorrect' && (
                      <span className="flex items-center gap-1">
                        <XCircle className="w-4 h-4" /> 没猜中 (对局继续)
                      </span>
                    )}
                    {g.status === 'correct' && (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> 猜中了！
                      </span>
                    )}
                  </div>
                </div>
              );
            }
          })}
        </div>
      )}
    </div>
  );
}
