'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@/lib/types/game';
import { MessageCircle, X, Send, PhoneCall, Mic, Volume2 } from 'lucide-react';
import { soundEffects } from '@/lib/audio/sound';
import { useVoiceCall } from '@/lib/audio/useVoiceCall';
import { VoiceCallBar } from '@/components/VoiceCallBar';

interface Props {
  roomCode: string;
  playerToken: string;
  chatMessages: ChatMessage[];
  myNickname: string;
  opponentNickname?: string;
  opponentOnline?: boolean;
  hasGuest?: boolean;
  onRefresh?: () => void;
}

const QUICK_PHRASES = [
  '太难啦！🤯',
  '有点头绪了💡',
  '给点线索嘛🥺',
  '我快猜中了！🎯',
  '再仔细想想~🤔',
  '快点回答呀⏱️',
  '哈哈哈哈😂',
  '承让承让😏',
];

// 微信风格时间格式化
function formatChatTime(dateString: string): string {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  if (isToday) {
    return timeStr;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  if (isYesterday) {
    return `昨天 ${timeStr}`;
  }

  if (d.getFullYear() === now.getFullYear()) {
    const month = d.getMonth() + 1;
    const date = d.getDate();
    return `${month}月${date}日 ${timeStr}`;
  }

  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${timeStr}`;
}

// 微信同款语音消息条
function VoiceMessageBubble({ content, isMe }: { content: string; isMe: boolean }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const match = content.match(/^\[VOICE:(\d+)\](.*)$/);
  const duration = match ? parseInt(match[1], 10) : 3;
  const audioSrc = match ? match[2] : '';

  const togglePlay = () => {
    if (!audioSrc) return;
    if (!audioRef.current) {
      const audio = new Audio(audioSrc);
      audio.onended = () => setPlaying(false);
      audio.onerror = () => setPlaying(false);
      audioRef.current = audio;
    }

    if (playing) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  };

  return (
    <button
      type="button"
      onClick={togglePlay}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-game-sm text-xs transition shadow-2xs ${
        isMe
          ? 'bg-sage-600 text-white rounded-tr-none hover:bg-sage-700'
          : 'bg-white border border-warm-border text-ink-text rounded-tl-none hover:bg-warm-bg'
      }`}
      style={{ minWidth: '96px', maxWidth: '180px' }}
      title="点击播放对讲语音"
    >
      <Volume2 className={`w-3.5 h-3.5 shrink-0 ${playing ? 'animate-pulse text-amber-300' : ''}`} />
      <span className="font-mono font-bold text-xs">{duration}"</span>
      <span className="text-[10px] opacity-80 ml-auto">{playing ? '播放中' : '对讲'}</span>
    </button>
  );
}

export function RoomChatDrawer({
  roomCode,
  playerToken,
  chatMessages = [],
  myNickname,
  opponentNickname = '好友',
  opponentOnline = true,
  hasGuest = true,
  onRefresh,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [lastReadCount, setLastReadCount] = useState(chatMessages.length);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 语音对讲录音状态
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);

  // 语音实时通话统一生命周期状态管理
  const voiceCall = useVoiceCall({
    roomCode,
    playerToken,
    opponentOnline,
    hasGuest,
  });

  const unreadCount = isOpen ? 0 : Math.max(0, chatMessages.length - lastReadCount);

  useEffect(() => {
    if (isOpen) {
      setLastReadCount(chatMessages.length);
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [isOpen, chatMessages.length]);

  // 发送消息
  const handleSend = async (messageText: string) => {
    const trimmed = messageText.trim();
    if (!trimmed || sending) return;
    setSending(true);

    try {
      const res = await fetch(`/api/rooms/${roomCode}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-token': playerToken,
        },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = await res.json();
      if (data.success) {
        setText('');
        soundEffects.playPop();
        onRefresh?.();
      }
    } catch (e) {
      console.error('Send chat failed', e);
    } finally {
      setSending(false);
    }
  };

  // 录音相关操作
  const cancelRecording = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((t) => t.stop());
      recordingStreamRef.current = null;
    }
    setIsRecording(false);
    setRecordDuration(0);
    audioChunksRef.current = [];
  };

  const stopAndSendRecording = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    const finalDuration = Math.max(1, recordDuration);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (recordingStreamRef.current) {
          recordingStreamRef.current.getTracks().forEach((t) => t.stop());
          recordingStreamRef.current = null;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          if (base64Audio) {
            handleSend(`[VOICE:${finalDuration}]${base64Audio}`);
          }
        };
        reader.readAsDataURL(audioBlob);
      };
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }

    setIsRecording(false);
    setRecordDuration(0);
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('当前浏览器不支持录音功能');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordDuration(0);
      soundEffects.playPop();

      recordTimerRef.current = setInterval(() => {
        setRecordDuration((prev) => {
          if (prev >= 20) {
            stopAndSendRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      alert('无法获取麦克风权限：' + (err.message || '受限'));
    }
  };

  return (
    <>
      {/* 关键：音频接收器始终保持挂载，即使收起抽屉，通话也不会中断 */}
      <audio ref={voiceCall.remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* 当抽屉关闭但收到对方的语音呼叫时，弹出悬浮接听卡片 */}
      {voiceCall.callState === 'incoming' && !isOpen && (
        <div className="fixed bottom-24 right-4 sm:bottom-20 sm:right-6 z-50 bg-white border-2 border-sage-500 rounded-game p-3.5 shadow-2xl animate-in slide-in-from-bottom-2 fade-in max-w-xs">
          <div className="flex items-center gap-2 mb-2.5">
            <PhoneCall className="w-4 h-4 text-sage-600 animate-bounce" />
            <span className="text-xs font-bold text-ink-text">
              {opponentNickname} 邀请你实时语音连麦！
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                voiceCall.acceptCall();
                setIsOpen(true);
              }}
              className="flex-1 py-1.5 px-3 rounded-full bg-sage-600 hover:bg-sage-700 text-white font-bold text-xs shadow-2xs transition"
            >
              接听 (开麦)
            </button>
            <button
              type="button"
              onClick={voiceCall.rejectCall}
              className="py-1.5 px-3 rounded-full bg-warm-subtle hover:bg-warm-bg text-ink-subtle font-medium text-xs border border-warm-border transition"
            >
              婉拒
            </button>
          </div>
        </div>
      )}

      {/* 浮动入口按钮 */}
      <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`relative flex items-center gap-1.5 px-3.5 py-2.5 rounded-full border shadow-board active:scale-95 text-xs font-bold transition ${
            voiceCall.callState === 'connected'
              ? 'bg-sage-50 border-sage-300 text-sage-900 ring-2 ring-sage-400/40'
              : voiceCall.callState === 'incoming'
              ? 'bg-amber-50 border-amber-300 text-amber-900 animate-bounce'
              : 'bg-white border-warm-border text-ink-text hover:bg-warm-bg'
          }`}
          title="打开对局联机聊天室与语音连麦"
        >
          {voiceCall.callState === 'connected' ? (
            <span className="flex items-center gap-1 text-sage-700">
              <span className="w-2 h-2 rounded-full bg-status-ok animate-pulse" />
              <span>通话中</span>
            </span>
          ) : voiceCall.callState === 'incoming' ? (
            <PhoneCall className="w-4 h-4 text-amber-600 animate-pulse" />
          ) : (
            <MessageCircle className="w-4 h-4 text-sage-600" />
          )}
          <span>聊天室</span>
          {unreadCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-terracotta-500 text-white text-[10px] flex items-center justify-center font-mono font-bold animate-bounce">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* 聊天抽屉弹窗（针对 iPad 横屏和桌面端优化，限制宽度与高度，加深阴影与独立高对比度层级） */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 sm:bottom-20 sm:right-6 w-[calc(100vw-2rem)] sm:w-[380px] max-w-[400px] h-[min(520px,calc(100vh-120px))] bg-[#FAF9F5] rounded-2xl border-2 border-sage-700/25 shadow-[0_25px_60px_-15px_rgba(20,35,25,0.4)] ring-1 ring-black/10 z-40 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-150">
          {/* 深色高对比度顶栏，清晰界定窗口 */}
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-sage-700 text-white shrink-0">
            <div className="flex items-center gap-1.5 text-xs font-bold tracking-wide">
              <MessageCircle className="w-4 h-4 text-sage-200" />
              <span>联机对局聊天室</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-full text-sage-200 hover:text-white hover:bg-white/20 transition"
              title="收起聊天室"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 嵌入式双人实时语音连麦栏 */}
          <VoiceCallBar
            voiceCall={voiceCall}
            opponentNickname={opponentNickname}
            opponentOnline={opponentOnline}
          />

          {/* 快捷常用语胶囊栏 */}
          <div className="px-2.5 py-1.5 border-b border-warm-border/70 bg-[#F4F1EA] flex gap-1 overflow-x-auto scrollbar-none shrink-0">
            {QUICK_PHRASES.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => handleSend(phrase)}
                className="shrink-0 text-[10px] font-medium bg-white hover:bg-sage-50 text-ink-text hover:text-sage-800 border border-warm-border px-2 py-0.5 rounded-full transition shadow-2xs"
              >
                {phrase}
              </button>
            ))}
          </div>

          {/* 消息滚动流：使用微信经典质感温和灰底，与主游戏界面形成分明区隔 */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs bg-[#EFECE6]"
          >
            {chatMessages.length === 0 ? (
              <div className="py-12 text-center text-ink-subtle text-[11px]">
                暂无聊天消息，开启连麦、录段语音或发句调侃打个招呼吧~
              </div>
            ) : (
              chatMessages.map((msg, index) => {
                const isMe = msg.sender_id === playerToken || msg.sender_nickname === myNickname;
                const prevMsg = index > 0 ? chatMessages[index - 1] : null;

                // 微信规则：第一条消息展示时间；后续消息若与上一条间隔超过 1 分钟（60秒），展示时间标记
                const showTimeDivider =
                  !prevMsg ||
                  new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() >
                    60 * 1000;

                const isVoice = msg.text.startsWith('[VOICE:');

                return (
                  <div key={msg.id} className="space-y-1.5">
                    {showTimeDivider && (
                      <div className="flex justify-center my-1.5">
                        <span className="text-[10px] text-ink-subtle/80 bg-black/5 px-2.5 py-0.5 rounded-full border border-black/5 font-sans select-none">
                          {formatChatTime(msg.created_at)}
                        </span>
                      </div>
                    )}
                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <span className="text-[10px] text-ink-subtle mb-0.5 px-1">
                        {isMe ? '我' : msg.sender_nickname}
                      </span>
                      {isVoice ? (
                        <VoiceMessageBubble content={msg.text} isMe={isMe} />
                      ) : (
                        <div
                          className={`max-w-[85%] px-3 py-1.5 rounded-game-sm text-xs leading-relaxed shadow-sm ${
                            isMe
                              ? 'bg-sage-600 text-white rounded-tr-none'
                              : 'bg-white border border-warm-border text-ink-text rounded-tl-none'
                          }`}
                        >
                          {msg.text}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 录音状态中横条 */}
          {isRecording ? (
            <div className="p-2 border-t border-warm-border flex items-center justify-between gap-2 bg-amber-50/90 rounded-b-2xl shrink-0 animate-in fade-in">
              <div className="flex items-center gap-2 pl-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-err opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-status-err"></span>
                </span>
                <span className="text-xs font-bold text-amber-900 font-mono">
                  正在录音 {recordDuration}s / 20s
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="px-2.5 py-1 text-xs text-ink-muted hover:text-ink-text bg-white border border-warm-border rounded-game-sm transition"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={stopAndSendRecording}
                  className="px-3 py-1 text-xs font-bold text-white bg-sage-600 hover:bg-sage-700 rounded-game-sm shadow-2xs transition"
                >
                  发送语音
                </button>
              </div>
            </div>
          ) : (
            /* 常规打字与麦克风输入栏 */
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(text);
              }}
              className="p-2 border-t border-warm-border/80 flex items-center gap-1.5 bg-[#FAF9F5] rounded-b-2xl shrink-0"
            >
              {/* 录制对讲语音消息按钮 */}
              <button
                type="button"
                onClick={startRecording}
                className="p-1.5 rounded-game-sm text-sage-700 hover:bg-sage-100 active:scale-95 transition shrink-0"
                title="录制一段对讲语音发送"
              >
                <Mic className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="发句调侃或打字交流..."
                maxLength={100}
                className="flex-1 text-xs px-2.5 py-1.5 bg-white border border-warm-border rounded-game-sm focus:outline-none focus:ring-1 focus:ring-sage-500 text-ink-text"
              />
              <button
                type="submit"
                disabled={sending || !text.trim()}
                className="p-1.5 rounded-game-sm bg-sage-600 hover:bg-sage-700 disabled:opacity-40 text-white transition shrink-0"
                title="发送"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
