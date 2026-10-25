'use client';

import { use, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AnswerType, GameStateDTO } from '@/lib/types/game';
import { RoomHeader } from '@/components/RoomHeader';
import { GameSettingsModal } from '@/components/GameSettingsModal';
import { WordSelectionModal } from '@/components/WordSelectionModal';
import { QuestionTimeline } from '@/components/QuestionTimeline';
import { GuesserControls } from '@/components/GuesserControls';
import { MasterControls } from '@/components/MasterControls';
import { GuesserSidebar } from '@/components/GuesserSidebar';
import { MasterSidebar } from '@/components/MasterSidebar';
import { SettlementModal } from '@/components/SettlementModal';
import { RoomChatDrawer } from '@/components/RoomChatDrawer';
import { soundEffects } from '@/lib/audio/sound';
import { Copy, Check, Users, Loader2, UserPlus, ArrowRight, Bot } from 'lucide-react';
import { getPlayerToken, savePlayerToken, saveRecentRoom } from '@/lib/store/localHistory';

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

  // 快捷加入与身份恢复表单状态
  const [needsJoin, setNeedsJoin] = useState(false);
  const [needsReclaim, setNeedsReclaim] = useState(false);
  const [reclaiming, setReclaiming] = useState(false);
  const [joinNickname, setJoinNickname] = useState('');
  const [joining, setJoining] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // 跨组件填入推荐问题
  const [presetQuestion, setPresetQuestion] = useState<string>('');

  // 记录上一轮快照以触发高保真提示音
  const prevSnapshotRef = useRef<{
    questionsCount: number;
    answeredCount: number;
    guessesCount: number;
    settled: boolean;
  }>({ questionsCount: 0, answeredCount: 0, guessesCount: 0, settled: false });

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
      const newState = data.data as GameStateDTO;
      setGameState(newState);
      setError(null);

      // 智能触发提示音 (Ding! / 胜利音效)
      const prev = prevSnapshotRef.current;
      const currentAnswered = newState.questions.filter((q) => q.status === 'answered').length;

      if (prev.questionsCount > 0 || prev.answeredCount > 0) {
        // 猜词人听到回答
        if (newState.myRole === 'guesser' && currentAnswered > prev.answeredCount) {
          soundEffects.playDing();
        }
        // 出题人听到新提问
        if (newState.myRole === 'question_master' && newState.questions.length > prev.questionsCount) {
          soundEffects.playDing();
        }
        // 出题人听到正式猜词
        if (newState.myRole === 'question_master' && newState.guesses.length > prev.guessesCount) {
          soundEffects.playDing();
        }
        // 猜中揭晓胜利和弦
        if (!prev.settled && newState.session?.status === 'settled' && newState.session.result === 'guessed') {
          soundEffects.playVictory();
        }
      }

      prevSnapshotRef.current = {
        questionsCount: newState.questions.length,
        answeredCount: currentAnswered,
        guessesCount: newState.guesses.length,
        settled: newState.session?.status === 'settled',
      };

      return newState;
    } catch (err: any) {
      if (retries > 0) {
        await new Promise((r) => setTimeout(r, 400));
        return fetchState(token, retries - 1);
      }
      setError(err.message);
      return null;
    }
  }, [code, playerToken]);

  // 初始化 Token 并拉取首次状态 (同时读取 localStorage 保证跨标签/重开链接不丢身份)
  useEffect(() => {
    const savedToken = getPlayerToken(code);
    setPlayerToken(savedToken);

    fetchState(savedToken).then((state) => {
      setLoading(false);
      if (state) {
        if (savedToken) {
          const isHost = savedToken === state.room.host_player_id;
          const isGuest = savedToken === state.room.guest_player_id;
          if (isHost || isGuest) {
            saveRecentRoom({
              code: state.room.code,
              myNickname: isHost ? state.room.host_nickname : (state.room.guest_nickname || '猜词伙伴'),
              opponentNickname: isHost ? state.room.guest_nickname : state.room.host_nickname,
              role: isHost ? 'host' : 'guest',
              roundNumber: state.session?.round_number ?? 1,
              status: state.room.status,
              updatedAt: Date.now(),
            });
          }
        } else {
          if (!state.room.guest_player_id) {
            setNeedsJoin(true);
          } else {
            // 两人已在房间中，直接唤起身份恢复选项卡（完美解决微信切浏览器或多端登录满员问题）
            setNeedsReclaim(true);
          }
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

    const finalNick = joinNickname.trim() || '猜词伙伴';

    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestNickname: finalNick }),
      });
      const data = await res.json();
      if (!data.success) {
        if (data.canReclaim) {
          setNeedsJoin(false);
          setNeedsReclaim(true);
          return;
        }
        throw new Error(data.error);
      }

      savePlayerToken(code, data.playerToken, finalNick);
      setPlayerToken(data.playerToken);
      setNeedsJoin(false);
      const state = await fetchState(data.playerToken);
      if (state) {
        saveRecentRoom({
          code: state.room.code,
          myNickname: finalNick,
          opponentNickname: state.room.host_nickname,
          role: 'guest',
          roundNumber: state.session?.round_number ?? 1,
          status: state.room.status,
          updatedAt: Date.now(),
        });
      }
    } catch (err: any) {
      setError(err.message || '加入房间失败');
    } finally {
      setJoining(false);
    }
  };

  // 微信/多设备身份恢复一键接管
  const handleReclaim = async (role: 'host' | 'guest') => {
    if (reclaiming || !gameState) return;
    setReclaiming(true);
    setError(null);

    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reclaimRole: role }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const myNick = role === 'host' ? data.room.host_nickname : data.room.guest_nickname;
      savePlayerToken(code, data.playerToken, myNick);
      setPlayerToken(data.playerToken);
      setNeedsReclaim(false);
      setNeedsJoin(false);

      const state = await fetchState(data.playerToken);
      if (state) {
        saveRecentRoom({
          code: state.room.code,
          myNickname: myNick,
          opponentNickname: role === 'host' ? state.room.guest_nickname : state.room.host_nickname,
          role,
          roundNumber: state.session?.round_number ?? 1,
          status: state.room.status,
          updatedAt: Date.now(),
        });
      }
    } catch (err: any) {
      setError(err.message || '恢复身份失败');
    } finally {
      setReclaiming(false);
    }
  };

  // 出题人修改回答
  const handleReviseAnswer = async (questionId: string, newAnswer: AnswerType) => {
    try {
      const res = await fetch(`/api/rooms/${code}/questions/${questionId}/answer`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-player-token': playerToken,
        },
        body: JSON.stringify({ answer: newAnswer }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      soundEffects.playPop();
      fetchState();
    } catch (err: any) {
      alert(`修改回答失败: ${err.message}`);
    }
  };

  // 在当前房间直接重新开局（复活房间）
  const handleRestartInCurrentRoom = async () => {
    try {
      const res = await fetch(`/api/rooms/${code}/round/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-token': playerToken,
        },
        body: JSON.stringify({ action: 'restart_game' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      fetchState();
    } catch (err: any) {
      alert(`重新开局失败: ${err.message}`);
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

  const [invitingBot, setInvitingBot] = useState(false);
  const handleInviteBot = async () => {
    if (invitingBot || !playerToken) return;
    setInvitingBot(true);
    try {
      const res = await fetch(`/api/rooms/${code}/bot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-token': playerToken,
        },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      soundEffects.playPop();
      fetchState();
    } catch (err: any) {
      alert(`召唤 AI 陪练失败: ${err.message}`);
    } finally {
      setInvitingBot(false);
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
            房主 <strong className="text-ink-text">{gameState.room.host_nickname}</strong> 邀请你加入「GuessWhat」双人猜词对局（房间码：<span className="font-mono font-bold text-sage-700">{code}</span>）。
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

  // 微信/多设备跨端进入时的身份一键恢复面板（彻底解决“满员进不去”难题）
  if (needsReclaim && gameState) {
    return (
      <div className="min-h-screen bg-warm-bg flex items-center justify-center p-4">
        <div className="bg-white p-6 sm:p-8 rounded-game border border-warm-border shadow-board max-w-md w-full space-y-4 text-center animate-in fade-in zoom-in-95 duration-150">
          <div className="w-12 h-12 rounded-full bg-sage-100 text-sage-600 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-ink-text">恢复房间对局身份</h2>
            <p className="text-xs text-ink-muted mt-1 leading-relaxed">
              房间 <strong className="text-sage-700 font-mono">{code}</strong> 正在进行对局。<br />
              若您刚从微信、其它手机或电脑浏览器切过来，请选择您在这场游戏中的角色直接恢复：
            </p>
          </div>

          {error && (
            <div className="p-2.5 bg-status-errBg text-status-err text-xs rounded-game-sm border border-status-errBorder">
              {error}
            </div>
          )}

          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              disabled={reclaiming}
              onClick={() => handleReclaim('host')}
              className="w-full py-3 px-4 bg-sage-50 hover:bg-sage-100 border border-sage-300 rounded-game-sm text-left flex items-center justify-between group transition shadow-2xs"
            >
              <div>
                <div className="font-bold text-xs text-sage-900">
                  我是 {gameState.room.host_nickname}
                </div>
                <div className="text-[11px] text-sage-600">本局出题人 / 房主</div>
              </div>
              <span className="text-xs font-bold text-sage-700 flex items-center gap-1 group-hover:translate-x-0.5 transition">
                <span>{reclaiming ? '正在进入...' : '一键恢复'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>

            <button
              type="button"
              disabled={reclaiming}
              onClick={() => handleReclaim('guest')}
              className="w-full py-3 px-4 bg-terracotta-50 hover:bg-terracotta-100 border border-terracotta-300 rounded-game-sm text-left flex items-center justify-between group transition shadow-2xs"
            >
              <div>
                <div className="font-bold text-xs text-terracotta-900">
                  我是 {gameState.room.guest_nickname}
                </div>
                <div className="text-[11px] text-terracotta-600">本局猜词人 / 客方</div>
              </div>
              <span className="text-xs font-bold text-terracotta-700 flex items-center gap-1 group-hover:translate-x-0.5 transition">
                <span>{reclaiming ? '正在进入...' : '一键恢复'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!gameState) return null;

  const { room, session, myRole } = gameState;

  return (
    <div className="min-h-screen flex flex-col bg-warm-bg">
      {/* 顶部房间栏 */}
      <RoomHeader
        state={gameState}
        playerToken={playerToken}
        onRefresh={() => fetchState()}
      />

      {/* 主工作区 */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-between space-y-4">
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

            {/* 好友暂时不在？直接在房间内一键唤起 AI 陪练 */}
            <div className="pt-2 border-t border-warm-border">
              <button
                type="button"
                onClick={handleInviteBot}
                disabled={invitingBot}
                className="w-full py-3 bg-gradient-to-r from-sage-50 to-amber-50 hover:from-sage-100 hover:to-amber-100 text-sage-900 border border-sage-300 font-bold text-xs rounded-game-sm shadow-2xs transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Bot className="w-4 h-4 text-sage-600" />
                <span>{invitingBot ? '正在唤醒 AI 智脑出题官...' : '🤖 好友暂未上线？召唤 AI 陪练立即开局'}</span>
              </button>
            </div>
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
                isQuestionMaster={myRole === 'question_master'}
                onReviseAnswer={handleReviseAnswer}
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
            <p className="text-xs text-ink-muted">无需重新建房或重新发送链接，点击下方即可在当前房间开启全新对局！</p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleRestartInCurrentRoom}
                className="w-full py-3 bg-sage-500 hover:bg-sage-600 active:bg-sage-700 text-white font-bold text-xs rounded-game-sm shadow transition flex items-center justify-center gap-1.5"
              >
                <span>🔄 在当前房间直接重新开局</span>
              </button>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="w-full py-2.5 bg-warm-bg hover:bg-warm-subtle text-ink-muted text-xs font-semibold rounded-game-sm transition"
              >
                返回首页
              </button>
            </div>
          </div>
        )}
      </main>

      {/* 结算弹窗 */}
      {session?.status === 'settled' && (
        <SettlementModal state={gameState} roomCode={code} playerToken={playerToken} />
      )}

      {/* 浮动联机聊天室与嵌入式语音通话 */}
      {Boolean(room.guest_player_id) && (
        <RoomChatDrawer
          roomCode={code}
          playerToken={playerToken}
          chatMessages={gameState.chatMessages || []}
          myNickname={
            myRole === 'question_master'
              ? room.host_nickname
              : room.guest_nickname || '猜词伙伴'
          }
          opponentNickname={
            myRole === 'question_master'
              ? room.guest_nickname || '猜词伙伴'
              : room.host_nickname
          }
          opponentOnline={gameState.opponentOnline}
          hasGuest={Boolean(room.guest_player_id)}
          onRefresh={() => fetchState()}
        />
      )}
    </div>
  );
}
