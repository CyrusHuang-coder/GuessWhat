'use client';

import { useState } from 'react';
import { GameStateDTO, AnswerType } from '@/lib/types/game';
import { Lock, ShieldCheck, Sparkles, Loader2, Send, HelpCircle, CheckCircle2, XCircle, Search, X } from 'lucide-react';
import { VoiceInputButton } from './VoiceInputButton';

interface Props {
  state: GameStateDTO;
  roomCode?: string;
  playerToken?: string;
}

export function MasterSidebar({ state, roomCode, playerToken }: Props) {
  const { session, room } = state;

  // 自查 AI 知识库状态
  const [queryText, setQueryText] = useState('');
  const [querying, setQuerying] = useState(false);
  const [queryResult, setQueryResult] = useState<{
    suggestedAnswer: AnswerType;
    explanation: string;
    questionText: string;
  } | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  if (!session) return null;

  const handleAskAI = async (textToAsk?: string) => {
    const text = (textToAsk || queryText).trim();
    if (!text || querying || !roomCode || !playerToken) return;

    setQuerying(true);
    setQueryError(null);

    try {
      const res = await fetch(`/api/rooms/${roomCode}/ai-fact-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-token': playerToken,
        },
        body: JSON.stringify({ questionText: text }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'AI 查证失败');
      }

      setQueryResult({
        suggestedAnswer: data.data.suggestedAnswer,
        explanation: data.data.explanation,
        questionText: text,
      });
      if (!textToAsk) setQueryText('');
    } catch (err: any) {
      setQueryError(err.message || 'AI 查证请求失败');
    } finally {
      setQuerying(false);
    }
  };

  return (
    <aside className="space-y-4">
      {/* 1. 秘密答案卡片 (显著常驻，带权限标签) */}
      <div className="bg-white rounded-game border border-sage-300 p-4 shadow-board space-y-3 bg-gradient-to-b from-sage-50/50 to-white">
        <div className="flex items-center justify-between pb-2 border-b border-sage-200">
          <div className="flex items-center gap-1.5 text-xs font-bold text-sage-800">
            <Lock className="w-4 h-4 text-sage-600" />
            <span>我的秘密词条</span>
          </div>
          <span className="text-[10px] font-bold text-sage-700 bg-sage-100 border border-sage-200 px-2 py-0.5 rounded-full">
            仅你可见 (服务端绝不泄露)
          </span>
        </div>

        <div>
          <div className="text-2xl font-black text-ink-text tracking-wide py-1">
            {session.secret_word}
          </div>
          <div className="flex items-center gap-2 text-xs text-ink-muted mt-1">
            <span>主题: <strong className="text-ink-text">{session.theme}</strong></span>
            <span>•</span>
            <span>难度: <strong className="text-ink-text">{session.difficulty}</strong></span>
          </div>
          {session.secret_word_note && (
            <div className="mt-2 text-xs bg-warm-subtle p-2.5 rounded-game-sm border border-warm-border text-ink-muted">
              <strong>备忘注释：</strong>{session.secret_word_note}
            </div>
          )}
        </div>
      </div>

      {/* 2. 出题人 AI 知识顾问（随时自查词条事实，不扣额度） */}
      <div className="bg-white rounded-game border border-warm-border p-4 shadow-board space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-warm-border">
          <div className="flex items-center gap-1.5 text-xs font-bold text-ink-text">
            <Sparkles className="w-4 h-4 text-sage-600" />
            <span>AI 知识顾问（自查词条特征）</span>
          </div>
          <span className="text-[10px] font-bold text-sage-700 bg-sage-100 border border-sage-200 px-2 py-0.5 rounded-full">
            无限次自查
          </span>
        </div>

        <p className="text-xs text-ink-muted leading-relaxed">
          拿不准关于秘密词条的冷门分类或科学特征？随时输入问题向 AI 求证：
        </p>

        {/* 输入框 + 语音按钮 */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAskAI();
          }}
          className="space-y-2"
        >
          <div className="relative flex items-center">
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="例：它是哺乳动物吗？能在零下存活吗？"
              disabled={querying || !playerToken}
              className="w-full text-xs pl-3 pr-16 py-2.5 bg-warm-bg border border-warm-border rounded-game-sm focus:outline-none focus:ring-2 focus:ring-sage-500 text-ink-text disabled:opacity-50"
            />
            <div className="absolute right-1.5 flex items-center gap-1">
              <VoiceInputButton
                onTranscript={(text) => setQueryText((prev) => (prev ? `${prev} ${text}` : text))}
                size="sm"
                title="语音输入查证问题"
              />
              <button
                type="submit"
                disabled={querying || !queryText.trim() || !playerToken}
                className="p-1.5 bg-sage-600 hover:bg-sage-700 disabled:opacity-40 text-white rounded-md transition shadow-2xs"
                title="向 AI 咨询"
              >
                {querying ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </form>

        {/* 快捷自查问题提示 */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {[
            '它是有生命的吗？',
            '它日常生活中常见吗？',
            '它是人造物品吗？',
          ].map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleAskAI(prompt)}
              disabled={querying || !playerToken}
              className="text-[11px] px-2 py-1 bg-warm-subtle hover:bg-warm-border text-ink-muted hover:text-ink-text rounded-md border border-warm-border transition"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* 查证错误提示 */}
        {queryError && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-game-sm text-xs text-red-700 flex items-start justify-between gap-1">
            <span className="leading-relaxed whitespace-pre-wrap">{queryError}</span>
            <button
              type="button"
              onClick={() => setQueryError(null)}
              className="text-red-500 hover:text-red-800 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 查证结果展示卡片 */}
        {queryResult && (
          <div className="p-3 bg-gradient-to-r from-sage-50 to-emerald-50 border border-sage-300 rounded-game-sm space-y-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-ink-muted truncate max-w-[180px]">
                查证：{queryResult.questionText}
              </span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-black text-white shrink-0 ${
                queryResult.suggestedAnswer === 'yes' ? 'bg-status-ok' :
                queryResult.suggestedAnswer === 'no' ? 'bg-status-err' : 'bg-status-warn'
              }`}>
                建议【{queryResult.suggestedAnswer === 'yes' ? '是' : queryResult.suggestedAnswer === 'no' ? '不是' : '不确定'}】
              </span>
            </div>
            <div className="text-xs text-ink-text bg-white/90 p-2 rounded border border-sage-200/60 leading-relaxed">
              {queryResult.explanation}
            </div>
          </div>
        )}
      </div>

      {/* 3. 对局状态小结 */}
      <div className="bg-warm-subtle rounded-game border border-warm-border p-3.5 text-xs text-ink-muted space-y-1.5">
        <div className="font-bold text-ink-text mb-1">对局概览</div>
        <div>房间代码：<strong className="font-mono text-sage-700">{room.code}</strong></div>
        <div>对局轮次：第 {session.round_number} 局</div>
        <div>模式规则：{session.mode === 'challenge' ? `挑战模式 (${session.max_questions}次上限)` : '普通模式 (不设上限)'}</div>
      </div>
    </aside>
  );
}
