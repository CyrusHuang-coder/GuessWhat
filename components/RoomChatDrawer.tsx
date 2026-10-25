'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@/lib/types/game';
import { MessageCircle, X, Send, PhoneCall } from 'lucide-react';
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

  // 语音通话统一生命周期状态管理
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

  return (
    <>
      {/* 关键：音频接收器始终保持挂载，即使收起抽屉，通话也不会中断 */}
      <audio ref={voiceCall.remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* 当抽屉关闭但收到对方的语音呼叫时，弹出桌面级气泡提示 */}
      {voiceCall.callState === 'incoming' && !isOpen && (
        <div className="fixed bottom-24 right-4 sm:bottom-20 sm:right-6 z-50 bg-white border-2 border-sage-500 rounded-game p-3.5 shadow-board animate-in slide-in-from-bottom-2 fade-in max-w-xs">
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

      {/* 聊天抽屉弹窗 */}
      {isOpen && (
        <div className="fixed bottom-32 right-4 sm:bottom-18 sm:right-6 w-[calc(100vw-2rem)] sm:w-84 bg-white rounded-game border border-warm-border shadow-2xl z-40 flex flex-col max-h-[500px] animate-in fade-in slide-in-from-bottom-4 duration-150">
          {/* 顶栏 */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-warm-border bg-warm-subtle/50 rounded-t-game">
            <div className="flex items-center gap-1.5 text-xs font-bold text-ink-text">
              <MessageCircle className="w-3.5 h-3.5 text-sage-600" />
              <span>联机对局聊天室</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-full text-ink-subtle hover:text-ink-text hover:bg-warm-subtle transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 嵌入式双人实时语音连麦栏 */}
          <VoiceCallBar
            voiceCall={voiceCall}
            opponentNickname={opponentNickname}
            opponentOnline={opponentOnline}
          />

          {/* 快捷常用语胶囊栏 */}
          <div className="px-2.5 py-1.5 border-b border-warm-border/60 bg-warm-bg/50 flex gap-1 overflow-x-auto scrollbar-none">
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

          {/* 消息滚动流 */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[160px] max-h-[240px] text-xs bg-warm-bg/20"
          >
            {chatMessages.length === 0 ? (
              <div className="py-8 text-center text-ink-subtle text-[11px]">
                暂无聊天消息，开启连麦或发句调侃打个招呼吧~
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

                return (
                  <div key={msg.id} className="space-y-1.5">
                    {showTimeDivider && (
                      <div className="flex justify-center my-1.5">
                        <span className="text-[10px] text-ink-subtle/80 bg-warm-subtle/70 px-2.5 py-0.5 rounded-full border border-warm-border/40 font-sans select-none shadow-2xs">
                          {formatChatTime(msg.created_at)}
                        </span>
                      </div>
                    )}
                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <span className="text-[10px] text-ink-subtle mb-0.5 px-1">
                        {isMe ? '我' : msg.sender_nickname}
                      </span>
                      <div
                        className={`max-w-[85%] px-3 py-1.5 rounded-game-sm text-xs leading-relaxed shadow-2xs ${
                          isMe
                            ? 'bg-sage-500 text-white rounded-tr-none'
                            : 'bg-white border border-warm-border text-ink-text rounded-tl-none'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 输入框 */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(text);
            }}
            className="p-2 border-t border-warm-border flex items-center gap-1.5 bg-white rounded-b-game"
          >
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="发句调侃或打字交流..."
              maxLength={100}
              className="flex-1 text-xs px-2.5 py-1.5 bg-warm-bg border border-warm-border rounded-game-sm focus:outline-none focus:ring-1 focus:ring-sage-500 text-ink-text"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="p-1.5 rounded-game-sm bg-sage-500 hover:bg-sage-600 disabled:opacity-40 text-white transition shrink-0"
              title="发送"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
