'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { GameStateDTO } from '@/lib/types/game';
import { RoomHeader } from '@/components/RoomHeader';
import { GameSettingsModal } from '@/components/GameSettingsModal';
import { WordSelectionModal } from '@/components/WordSelectionModal';
import { QuestionTimeline } from '@/components/QuestionTimeline';
import { GuesserControls } from '@/components/GuesserControls';
import { MasterControls } from '@/components/MasterControls';
import { GuesserSidebar } from '@/components/GuesserSidebar';
import { MasterSidebar } from '@/components/MasterSidebar';
import { SettlementModal } from '@/components/SettlementModal';
import { Copy, Check, Users, Loader2, UserPlus } from 'lucide-react';

interface PageProps {
  params: Promise<{ code: string }>;
}

export default function RoomPage({ params }: PageProps) {
  const router = useRouter();
  const { code: rawCode } = use(params);
  const code = rawCode.toUpperCase();

  const [playerToken, setPlayerToken] = useState<string>('');
  const [gameState, setGameState] = useState<GameStateDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 快捷加入表单状态（如果直接打开链接进入）
  const [needsJoin, setNeedsJoin] = useState(false);
  const [joinNickname, setJoinNickname] = useState('');
  const [joining, setJoining] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // 跨组件填入推荐问题
  const [presetQuestion, setPresetQuestion] = useState<string>('');

  // 获取房间状态 (内置轻量重试以抵御 Serverless 路由漂移)
  const fetchState = useCallback(async (token?: string, retries = 2): Promise<GameStateDTO | null> => {
    try {
      const activeToken = token ?? playerToken;
      const res = await fetch(`/api/rooms/${code}`, {
        headers: {
          'x-player-token': activeToken || '',
        },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!data.success) {
        if (retries > 0) {
          await new Promise((r) => setTimeout(r, 400));
          return fetchState(token, retries - 1);
        }
        throw new Error(data.error || '获取房间数据失败');
      }
      setGameState(data.data);
      setError(null);
      return data.data as GameStateDTO;
    } catch (err: any) {
      if (retries > 0) {
        await new Promise((r) => setTimeout(r, 400));
        return fetchState(token, retries - 1);
      }
      setError(err.message);
      return null;
    }
  }, [code, playerToken]);

  // 初始化 Token 并拉取首次状态
  useEffect(() => {
    const savedToken = sessionStorage.getItem(`gw_token_${code}`) || '';
    setPlayerToken(savedToken);

    fetchState(savedToken).then((state) => {
      setLoading(false);
      if (state && !savedToken) {
        if (!state.room.guest_player_id) {
          setNeedsJoin(true);
        } else {
          setError('该房间已有两名实际玩家，已满员');
        }
      }
    });
  }, [code, fetchState]);

  // 心跳上报 (每 5 秒一次)
  useEffect(() => {
    if (!playerToken) return;

    const sendHeartbeat = () => {
      fetch(`/api/rooms/${code}/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-token': playerToken,
        },
      }).catch(() => {});
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 5000);
    return () => clearInterval(interval);
  }, [code, playerToken]);

  // 当移动端切屏返回或锁屏唤醒时，立即同步状态与心跳
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && code) {
        if (playerToken) {
          fetch(`/api/rooms/${code}/heartbeat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-player-token': playerToken,
            },
          }).catch(() => {});
        }
        fetchState();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [code, playerToken, fetchState]);

  // 实时 SSE 订阅 + 3s 温和轮询兜底
  useEffect(() => {
    if (!code) return;

    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(`/api/rooms/${code}/events?token=${playerToken}`);

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type && payload.type !== 'CONNECTED') {
            fetchState();
          }
        } catch (e) {}
      };

      eventSource.onerror = () => {
        eventSource?.close();
      };
    } catch (e) {}

    const fallbackPoll = setInterval(() => {
      fetchState();
    }, 3000);

    return () => {
      eventSource?.close();
      clearInterval(fallbackPoll);
    };
  }, [code, playerToken, fetchState]);

  // 链接直达快捷加入
  const handleJoinDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (joining) return;
    setJoining(true);
    setError(null);

    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestNickname: joinNickname.trim() || '猜词伙伴' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      sessionStorage.setItem(`gw_token_${code}`, data.playerToken);
      sessionStorage.setItem(`gw_nick_${code}`, joinNickname.trim() || '猜词伙伴');
      setPlayerToken(data.playerToken);
      setNeedsJoin(false);
      await fetchState(data.playerToken);
    } catch (err: any) {
      setError(err.message || '加入房间失败');
    } finally {
      setJoining(false);
    }
  };

  const copyInvite = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSurrender = async () => {
    if (!window.confirm('确定要主动认输并揭晓本局秘密答案吗？')) return;
    try {
      const res = await fetch(`/api/rooms/${code}/surrender`, {
        method: 'POST',
        headers: { 'x-player-token': playerToken },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
    } catch (err: any) {
      alert(`认输失败: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-warm-bg flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-sage-600 animate-spin mb-3" />
        <p className="text-sm text-ink-muted font-medium">正在进入对局房间...</p>
      </div>
    );
  }

  if (error && !gameState) {
    return (
      <div className="min-h-screen bg-warm-bg flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-game border border-warm-border max-w-md w-full text-center shadow-board">
          <div className="w-12 h-12 rounded-full bg-status-errBg text-status-err flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            !
          </div>
          <h2 className="text-lg font-bold text-ink-text mb-2">进入房间失败</h2>
          <p className="text-xs text-ink-muted mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 bg-sage-500 hover:bg-sage-600 text-white text-xs font-bold rounded-game-sm transition"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  if (needsJoin && gameState) {
    return (
      <div className="min-h-screen bg-warm-bg flex items-center justify-center p-4">
        <div className="bg-white p-6 sm:p-8 rounded-game border border-warm-border shadow-board max-w-md w-full">
          <div className="flex items-center gap-2 mb-4 text-sage-600">
            <UserPlus className="w-6 h-6" />
            <h2 className="text-lg font-bold text-ink-text">受邀加入游戏房间</h2>
          </div>
          <p className="text-xs text-ink-muted mb-4 leading-relaxed">
            房主 <strong className="text-ink-text">{gameState.room.host_nickname}</strong> 邀请你加入「浮出水面 (Surface)」双人猜词对局（房间码：<span className="font-mono font-bold text-sage-700">{code}</span>）。
          </p>

          {error && (
            <div className="mb-4 p-2.5 bg-status-errBg text-status-err text-xs rounded-game-sm border border-status-errBorder">{error}</div>
          )}

          <form onSubmit={handleJoinDirect} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1.5">你的昵称：</label>
              <input
                type="text"
                value={joinNickname}
                onChange={(e) => setJoinNickname(e.target.value)}
                placeholder="例如：推理小达人"
                maxLength={15}
                className="w-full px-4 py-2.5 text-sm border border-warm-border rounded-game-sm bg-warm-bg focus:outline-none focus:ring-2 focus:ring-sage-500 text-ink-text"
                autoFocus
                required
              />
            </div>
            <button
              type="submit"
              disabled={joining || !joinNickname.trim()}
              className="w-full py-3 bg-sage-500 hover:bg-sage-600 active:bg-sage-700 disabled:opacity-50 text-white font-bold text-sm rounded-game-sm shadow transition"
            >
              {joining ? '正在进入...' : '立即加入对局'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!gameState) return null;

  const { room, session, myRole } = gameState;

  return (
    <div className="min-h-screen flex flex-col bg-warm-bg">
      {/* 顶部房间栏 */}
      <RoomHeader state={gameState} />

      {/* 主工作区 */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-between">
        {/* 阶段 1: 等待第二位玩家加入 */}
        {room.status === 'waiting_player' && (
          <div className="my-auto py-12 text-center max-w-md mx-auto bg-white p-8 rounded-game border border-warm-border shadow-board space-y-4">
            <div className="w-16 h-16 rounded-game-sm bg-sage-100 text-sage-600 flex items-center justify-center mx-auto shadow-inner animate-pulse">
              <Users className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink-text">等待另一位玩家加入</h2>
              <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                将房间码或专属邀请链接发送给朋友即可联机对局
              </p>
            </div>

            <div className="p-3.5 bg-warm-bg rounded-game-sm border border-warm-border space-y-1">
              <div className="text-[11px] text-ink-subtle font-medium">房间代码</div>
              <div className="font-mono text-3xl font-black text-sage-700 tracking-wider">
                {room.code}
              </div>
            </div>

            <button
              type="button"
              onClick={copyInvite}
              className="w-full py-3.5 bg-sage-500 hover:bg-sage-600 text-white font-bold text-sm rounded-game-sm shadow transition flex items-center justify-center gap-2"
            >
              {copiedLink ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? '链接已成功复制到剪贴板！' : '复制房间邀请链接'}</span>
            </button>
          </div>
        )}

        {/* 阶段 2: 猜词人设置阶段 */}
        {room.status === 'in_game' && session?.status === 'setting_selection' && (
          <GameSettingsModal state={gameState} roomCode={code} playerToken={playerToken} />
        )}

        {/* 阶段 3: 出题人选词阶段 */}
        {room.status === 'in_game' && session?.status === 'word_selection' && (
          <WordSelectionModal state={gameState} roomCode={code} playerToken={playerToken} />
        )}

        {/* 阶段 4: 对局进行中 (采用桌面端主区 2/3 + 侧栏 1/3 布局) */}
        {room.status === 'in_game' && session?.status === 'playing' && (
          <div className="lg:grid lg:grid-cols-3 lg:gap-6 items-start pb-20 lg:pb-8">
            {/* 游戏主区 (约 2/3 宽度) */}
            <div className="lg:col-span-2 space-y-4">
              <QuestionTimeline
                questions={gameState.questions}
                guesses={gameState.guesses}
                hints={gameState.hints}
                completedCount={session.completed_questions_count}
                maxQuestions={session.max_questions}
                isChallengeMode={session.mode === 'challenge'}
              />

              {/* 游戏主区下方操作流程 */}
              {myRole === 'guesser' && (
                <GuesserControls
                  state={gameState}
                  roomCode={code}
                  playerToken={playerToken}
                  presetQuestion={presetQuestion}
                  onClearPresetQuestion={() => setPresetQuestion('')}
                />
              )}
              {myRole === 'question_master' && (
                <MasterControls state={gameState} roomCode={code} playerToken={playerToken} />
              )}
            </div>

            {/* 辅助侧栏 (桌面端 1/3 独立右栏，手机端位于主区下方可平滑滑动查看) */}
            <div className="mt-6 lg:mt-0 lg:col-span-1">
              {myRole === 'guesser' && (
                <GuesserSidebar
                  state={gameState}
                  roomCode={code}
                  playerToken={playerToken}
                  onSelectRecommendedQuestion={(q) => setPresetQuestion(q)}
                  onSurrender={handleSurrender}
                />
              )}
              {myRole === 'question_master' && (
                <MasterSidebar
                  state={gameState}
                  roomCode={code}
                  playerToken={playerToken}
                />
              )}
            </div>
          </div>
        )}

        {/* 阶段 5: 对局已结束 */}
        {room.status === 'ended' && (
          <div className="my-auto py-12 text-center max-w-md mx-auto bg-white p-8 rounded-game border border-warm-border shadow-board space-y-4">
            <h2 className="text-xl font-bold text-ink-text">本次游戏已结束</h2>
            <p className="text-xs text-ink-muted">感谢游玩「浮出水面」，您可以返回首页发起新的对局。</p>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="w-full py-3 bg-sage-500 hover:bg-sage-600 text-white font-bold text-xs rounded-game-sm transition"
            >
              返回首页
            </button>
          </div>
        )}
      </main>

      {/* 结算弹窗 */}
      {session?.status === 'settled' && (
        <SettlementModal state={gameState} roomCode={code} playerToken={playerToken} />
      )}
    </div>
  );
}
