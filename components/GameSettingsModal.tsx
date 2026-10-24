'use client';

import { useState } from 'react';
import { Difficulty, GameMode, GameStateDTO } from '@/lib/types/game';
import { THEMES } from '@/lib/data/wordBank';
import { Settings2, Clock, Zap, Sparkles, Check } from 'lucide-react';

interface Props {
  state: GameStateDTO;
  roomCode: string;
  playerToken: string;
}

export function GameSettingsModal({ state, roomCode, playerToken }: Props) {
  const { session, myRole } = state;
  const isGuesser = myRole === 'guesser';

  const [selectedTheme, setSelectedTheme] = useState<string>('动物');
  const [customTheme, setCustomTheme] = useState<string>('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [mode, setMode] = useState<GameMode>('normal'); // 默认普通模式（允许一直猜）
  const [maxQuestions, setMaxQuestions] = useState<number>(30); // 挑战模式默认 30 次
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session?.status !== 'setting_selection') return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGuesser) return;

    const finalTheme = selectedTheme === '自定义主题' ? customTheme.trim() : selectedTheme;
    if (!finalTheme) {
      setError('请输入或选择一个有效的主题');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/rooms/${roomCode}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-token': playerToken,
        },
        body: JSON.stringify({
          theme: finalTheme,
          difficulty,
          mode,
          maxQuestions: Number(maxQuestions),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || '保存设置失败');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 出题人视角等待
  if (!isGuesser) {
    return (
      <div className="bg-white rounded-game border border-warm-border p-8 text-center max-w-md mx-auto my-12 shadow-board">
        <div className="w-12 h-12 rounded-full bg-sage-100 text-sage-600 flex items-center justify-center mx-auto mb-4 animate-spin">
          <Settings2 className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-ink-text mb-2">等待猜词人选择游戏规则</h3>
        <p className="text-sm text-ink-muted leading-relaxed">
          猜词人正在选择本轮的主题、难度与玩法模式（默认允许一直提问推理）。设置完成后将由您选定秘密词条。
        </p>
      </div>
    );
  }

  // 猜词人设置面板
  return (
    <div className="bg-white rounded-game border border-warm-border p-6 md:p-8 max-w-2xl mx-auto my-6 shadow-board">
      <div className="flex items-center gap-3 pb-4 border-b border-warm-border mb-6">
        <div className="w-10 h-10 rounded-game-sm bg-sage-100 text-sage-600 flex items-center justify-center">
          <Settings2 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-ink-text">对局初始化设置</h2>
          <p className="text-xs text-ink-muted">制定本轮的推理范围与挑战规则，随后交给出题人确定秘密词条</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-status-errBg text-status-err text-xs rounded-game-sm border border-status-errBorder">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. 主题选择 */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2.5">
            1. 选择游戏主题
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {THEMES.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setSelectedTheme(t)}
                className={`py-2 px-3 rounded-game-sm text-xs font-medium border text-left transition flex items-center justify-between ${
                  selectedTheme === t
                    ? 'border-sage-500 bg-sage-100 text-sage-800 font-bold shadow-2xs'
                    : 'border-warm-border hover:bg-warm-bg text-ink-text'
                }`}
              >
                <span>{t}</span>
                {selectedTheme === t && <Check className="w-3.5 h-3.5 text-sage-600" />}
              </button>
            ))}
          </div>

          {selectedTheme === '自定义主题' && (
            <input
              type="text"
              value={customTheme}
              onChange={(e) => setCustomTheme(e.target.value)}
              placeholder="请输入自定义主题（例如：科幻电影道具、名胜古迹等）"
              className="mt-3 w-full px-3.5 py-2 text-sm border border-warm-border rounded-game-sm bg-warm-bg focus:outline-none focus:ring-2 focus:ring-sage-500 text-ink-text"
              maxLength={30}
              required
            />
          )}
        </div>

        {/* 2. 词条难度 */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2.5">
            2. 词条难度 (影响推荐词范围与 AI 主动辅助额度)
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { val: 'easy', label: '简单', ai: 'AI 额度 3 次', desc: '生活高频词条' },
              { val: 'medium', label: '普通', ai: 'AI 额度 2 次', desc: '均衡经典词汇' },
              { val: 'hard', label: '困难', ai: 'AI 额度 1 次', desc: '冷门特征更考思维' },
            ].map((d) => (
              <button
                type="button"
                key={d.val}
                onClick={() => setDifficulty(d.val as Difficulty)}
                className={`p-3 rounded-game-sm border text-center transition ${
                  difficulty === d.val
                    ? 'border-sage-500 bg-sage-100/70 text-sage-900 shadow-2xs ring-1 ring-sage-500'
                    : 'border-warm-border hover:bg-warm-bg text-ink-text'
                }`}
              >
                <div className="font-bold text-sm">{d.label}</div>
                <div className="text-[11px] text-sage-700 font-medium mt-0.5">{d.ai}</div>
                <div className="text-[10px] text-ink-muted mt-1">{d.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 3. 游戏模式 */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2.5">
            3. 游戏模式
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode('normal')}
              className={`p-3.5 rounded-game-sm border text-left transition ${
                mode === 'normal'
                  ? 'border-sage-500 bg-sage-100/70 shadow-2xs ring-1 ring-sage-500'
                  : 'border-warm-border hover:bg-warm-bg'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm text-ink-text">
                <Clock className="w-4 h-4 text-sage-600" />
                <span>普通模式 (默认)</span>
              </div>
              <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                不设提问上限，允许慢慢推敲一直猜，适合休闲与较深难度的探索
              </p>
            </button>

            <button
              type="button"
              onClick={() => setMode('challenge')}
              className={`p-3.5 rounded-game-sm border text-left transition ${
                mode === 'challenge'
                  ? 'border-terracotta-500 bg-terracotta-100 shadow-2xs ring-1 ring-terracotta-500'
                  : 'border-warm-border hover:bg-warm-bg'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm text-ink-text">
                <Zap className="w-4 h-4 text-terracotta-600" />
                <span>挑战模式</span>
              </div>
              <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                自设提问额度上限，额度用尽后仍可无限次正式猜词
              </p>
            </button>
          </div>

          {/* 挑战模式次数配置 */}
          {mode === 'challenge' && (
            <div className="mt-4 p-4 bg-terracotta-50 border border-terracotta-200 rounded-game-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-terracotta-700">有效提问次数上限：</span>
                <span className="text-sm font-black text-terracotta-700">{maxQuestions} 次</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[20, 30, 40, 50].map((num) => (
                  <button
                    type="button"
                    key={num}
                    onClick={() => setMaxQuestions(num)}
                    className={`py-1.5 px-2 text-xs rounded-game-sm border transition text-center ${
                      maxQuestions === num
                        ? 'bg-terracotta-600 text-white border-terracotta-600 font-bold shadow-2xs'
                        : 'bg-white text-terracotta-700 border-terracotta-200 hover:bg-terracotta-100'
                    }`}
                  >
                    {num} 次{num === 30 && ' (推荐)'}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-ink-muted pt-1">
                <div className="flex items-center gap-2">
                  <span>自定义提问次数：</span>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={maxQuestions}
                    onChange={(e) => setMaxQuestions(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 px-2 py-1 text-xs border border-terracotta-200 rounded bg-white text-center font-bold text-ink-text"
                  />
                  <span>次 (1-100)</span>
                </div>
                <span className="text-[11px] text-terracotta-600/80">
                  提示：复杂词条通常需 30~40 次慢慢缩小范围
                </span>
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 bg-sage-500 hover:bg-sage-600 active:bg-sage-700 disabled:opacity-50 text-white font-bold text-sm rounded-game-sm shadow transition flex items-center justify-center gap-2"
        >
          <span>{submitting ? '保存中...' : '确认设置，交给出题人确定词条 ➜'}</span>
        </button>
      </form>
    </div>
  );
}
