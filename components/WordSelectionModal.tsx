'use client';

import { useState, useEffect, useCallback } from 'react';
import { GameStateDTO, WordItem } from '@/lib/types/game';
import { getRandomWordsByFilter } from '@/lib/data/wordBank';
import { KeyRound, Dices, ShieldAlert, Check, Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import { VoiceInputButton } from './VoiceInputButton';

interface Props {
  state: GameStateDTO;
  roomCode: string;
  playerToken: string;
}

export function WordSelectionModal({ state, roomCode, playerToken }: Props) {
  const { session, myRole } = state;
  const isMaster = myRole === 'question_master';

  const [selectedWord, setSelectedWord] = useState<string>('');
  const [selectedNote, setSelectedNote] = useState<string>('');
  const [customWord, setCustomWord] = useState<string>('');
  const [customNote, setCustomNote] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 候选词条列表与 AI 状态
  const [candidates, setCandidates] = useState<WordItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isAIGenerated, setIsAIGenerated] = useState(false);

  // 首次或主题改变时装载初始候选词（从扩充词库随机乱序 9 个）
  useEffect(() => {
    if (session?.theme) {
      const initial = getRandomWordsByFilter(session.theme, session.difficulty, 9);
      setCandidates(initial);
      setIsAIGenerated(false);
    }
  }, [session?.theme, session?.difficulty]);

  // 换一批：优先由 AI 动态生成，若 AI 未配置或异常则从丰富词库重新洗牌抽选
  const handleRefreshWords = useCallback(async () => {
    if (!session || refreshing) return;
    setRefreshing(true);
    setError(null);

    try {
      const res = await fetch(`/api/rooms/${roomCode}/ai-words`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-token': playerToken,
        },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.words) && data.words.length > 0) {
        setCandidates(data.words);
        setIsAIGenerated(Boolean(data.isAI));
      } else {
        // 优雅降级本地抽取
        const localWords = getRandomWordsByFilter(session.theme || undefined, session.difficulty, 9);
        setCandidates(localWords);
        setIsAIGenerated(false);
      }
    } catch (err) {
      // 容错降级
      const localWords = getRandomWordsByFilter(session.theme || undefined, session.difficulty, 9);
      setCandidates(localWords);
      setIsAIGenerated(false);
    } finally {
      setRefreshing(false);
    }
  }, [session, refreshing, roomCode, playerToken]);

  const handleRandomPick = () => {
    if (candidates.length === 0) return;
    const random = candidates[Math.floor(Math.random() * candidates.length)];
    setSelectedWord(random.name);
    setSelectedNote(random.note || '');
    setIsCustom(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMaster) return;

    const finalWord = isCustom ? customWord.trim() : selectedWord.trim();
    const finalNote = isCustom ? customNote.trim() : selectedNote.trim();

    if (!finalWord) {
      setError('请选择或输入一个秘密词条');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/rooms/${roomCode}/word`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-token': playerToken,
        },
        body: JSON.stringify({
          word: finalWord,
          category: session?.theme,
          note: finalNote,
          isCustom,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || '设定秘密答案失败');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (session?.status !== 'word_selection') return null;

  if (!isMaster) {
    return (
      <div className="bg-white rounded-game border border-warm-border p-8 text-center max-w-md mx-auto my-12 shadow-board">
        <div className="w-12 h-12 rounded-full bg-sage-100 text-sage-600 flex items-center justify-center mx-auto mb-4 animate-bounce">
          <KeyRound className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-ink-text mb-2">出题人正在选择秘密词条</h3>
        <p className="text-sm text-ink-muted leading-relaxed">
          出题人正在根据你选定的主题【<strong className="text-ink-text">{session?.theme}</strong>】挑选或由 AI 灵感推荐秘密答案。设词完成后对局即刻开始！
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-game border border-warm-border p-6 md:p-8 max-w-2xl mx-auto my-6 shadow-board">
      <div className="flex items-center gap-3 pb-4 border-b border-warm-border mb-6">
        <div className="w-10 h-10 rounded-game-sm bg-sage-100 text-sage-600 flex items-center justify-center">
          <KeyRound className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-ink-text">设定秘密答案</h2>
          <p className="text-xs text-ink-muted mt-0.5">
            主题: <strong className="text-sage-700">{session?.theme}</strong> • 难度:{' '}
            <strong className="text-terracotta-600">{session?.difficulty}</strong> • 模式:{' '}
            <strong>{session?.mode === 'challenge' ? `挑战模式(${session.max_questions}次)` : '普通模式(不限次)'}</strong>
          </p>
        </div>
      </div>

      <div className="bg-warm-subtle border border-warm-border text-ink-text text-xs p-3.5 rounded-game-sm flex items-center gap-2.5 mb-6">
        <ShieldAlert className="w-4 h-4 text-sage-600 shrink-0" />
        <span className="leading-relaxed">
          <strong>防剧透安全保护已启用：</strong>秘密答案仅对您可见。在猜中结算前，猜词人与任何网络请求均无法获取。
        </span>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-status-errBg text-status-err text-xs rounded-game-sm border border-status-errBorder">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 选词方式切换 */}
        <div className="flex items-center gap-2 p-1 bg-warm-subtle rounded-game-sm text-xs font-semibold">
          <button
            type="button"
            onClick={() => setIsCustom(false)}
            className={`flex-1 py-2 rounded-game-sm transition ${
              !isCustom
                ? 'bg-white shadow-2xs text-ink-text font-bold'
                : 'text-ink-muted hover:text-ink-text'
            }`}
          >
            从推荐词条中挑选 (支持AI换一批)
          </button>
          <button
            type="button"
            onClick={() => setIsCustom(true)}
            className={`flex-1 py-2 rounded-game-sm transition ${
              isCustom
                ? 'bg-white shadow-2xs text-ink-text font-bold'
                : 'text-ink-muted hover:text-ink-text'
            }`}
          >
            自定义秘密词条
          </button>
        </div>

        {!isCustom ? (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-ink-text">
                  推荐候选词条
                </span>
                {isAIGenerated ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-sage-700 font-semibold bg-sage-100 border border-sage-200 px-2 py-0.5 rounded-full">
                    <Sparkles className="w-3 h-3 text-sage-600" /> AI 实时生成
                  </span>
                ) : (
                  <span className="text-[11px] text-ink-muted">
                    精选词库 (每次刷新不重复)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefreshWords}
                  disabled={refreshing}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-game-sm bg-sage-50 text-sage-700 hover:bg-sage-100 active:bg-sage-200 border border-sage-200 transition disabled:opacity-50"
                  title="生成全新一批不重复的灵感词条"
                >
                  {refreshing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-sage-600" />
                      <span>构思中...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-sage-600" />
                      <span>换一批 (AI灵感)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleRandomPick}
                  className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink-text px-2 py-1 rounded-game-sm border border-warm-border hover:bg-warm-subtle transition"
                  title="从当前候选列表中随机帮我选一个"
                >
                  <Dices className="w-3.5 h-3.5" />
                  <span>随机选</span>
                </button>
              </div>
            </div>

            {candidates.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto p-1.5 border border-warm-border rounded-game-sm bg-warm-bg/40">
                {candidates.map((item) => (
                  <button
                    type="button"
                    key={item.id || item.name}
                    onClick={() => {
                      setSelectedWord(item.name);
                      setSelectedNote(item.note || '');
                    }}
                    className={`p-3 rounded-game-sm border text-left transition flex flex-col justify-between ${
                      selectedWord === item.name
                        ? 'border-sage-500 bg-sage-100 text-ink-text ring-1 ring-sage-500 shadow-2xs'
                        : 'border-warm-border bg-white hover:bg-warm-bg text-ink-text'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between gap-1">
                      <span className="truncate">{item.name}</span>
                      {selectedWord === item.name && (
                        <Check className="w-3.5 h-3.5 text-sage-600 shrink-0" />
                      )}
                    </div>
                    {item.note && (
                      <div className="text-[10px] text-ink-muted mt-1.5 line-clamp-2 leading-relaxed">
                        {item.note}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-ink-muted bg-warm-subtle rounded-game-sm">
                暂无词条，请点击上方“换一批”或切换为自定义输入
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">
                自定义秘密答案：
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={customWord}
                  onChange={(e) => setCustomWord(e.target.value)}
                  placeholder="例如：初中同桌、天气观测员、手冲咖啡、黑天鹅..."
                  maxLength={40}
                  className="w-full pl-3.5 pr-11 py-2.5 text-sm border border-warm-border rounded-game-sm bg-warm-bg focus:outline-none focus:ring-2 focus:ring-sage-500 text-ink-text"
                  required
                />
                <div className="absolute right-1.5 flex items-center">
                  <VoiceInputButton
                    onTranscript={(txt) => setCustomWord(txt)}
                    size="sm"
                    title="语音输入自定义秘密词条"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">
                出题人自用备忘提示（选填，对局中仅您可见）：
              </label>
              <input
                type="text"
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="例如：常驻高山记录云层；注意引导猜词人从工作环境提问"
                maxLength={60}
                className="w-full px-3 py-2 text-xs border border-warm-border rounded-game-sm bg-warm-bg text-ink-text"
              />
            </div>
          </div>
        )}

        {/* 选定预览 */}
        {(selectedWord || customWord) && (
          <div className="p-4 bg-sage-50 border border-sage-200 rounded-game-sm flex items-center justify-between animate-in fade-in">
            <div>
              <div className="text-[11px] text-sage-700 font-medium">已确认设定的秘密词条：</div>
              <div className="text-lg font-black text-ink-text mt-0.5">
                {isCustom ? customWord : selectedWord}
              </div>
              {(selectedNote || customNote) && (
                <div className="text-xs text-ink-muted mt-0.5">
                  备忘: {isCustom ? customNote : selectedNote}
                </div>
              )}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || (!selectedWord && !customWord)}
          className="w-full py-3.5 bg-sage-500 hover:bg-sage-600 active:bg-sage-700 disabled:opacity-50 text-white font-bold text-sm rounded-game-sm shadow transition"
        >
          {submitting ? '设定中...' : '确认答案并开启对局 ➜'}
        </button>
      </form>
    </div>
  );
}
