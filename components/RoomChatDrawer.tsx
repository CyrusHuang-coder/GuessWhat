'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@/lib/types/game';
import { MessageCircle, X, Send, Smile } from 'lucide-react';
import { soundEffects } from '@/lib/audio/sound';

interface Props {
  roomCode: string;
  playerToken: string;
  chatMessages: ChatMessage[];
  myNickname: string;
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

export function RoomChatDrawer({
  roomCode,
  playerToken,
  chatMessages = [],
  myNickname,
  onRefresh,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [lastReadCount, setLastReadCount] = useState(chatMessages.length);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      {/* 浮动入口按钮 */}
      <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="relative flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-white border border-warm-border shadow-board hover:bg-warm-bg active:scale-95 text-xs font-bold text-ink-text transition"
          title="打开对局联机聊天室"
        >
          <MessageCircle className="w-4 h-4 text-sage-600" />
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
        <div className="fixed bottom-32 right-4 sm:bottom-18 sm:right-6 w-[calc(100vw-2rem)] sm:w-80 bg-white rounded-game border border-warm-border shadow-2xl z-40 flex flex-col max-h-[460px] animate-in fade-in slide-in-from-bottom-4 duration-150">
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
            className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[180px] max-h-[260px] text-xs bg-warm-bg/20"
          >
            {chatMessages.length === 0 ? (
              <div className="py-8 text-center text-ink-subtle text-[11px]">
                暂无聊天消息，点击快捷词或发句话打个招呼吧~
              </div>
            ) : (
              chatMessages.map((msg) => {
                const isMe = msg.sender_id === playerToken || msg.sender_nickname === myNickname;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
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

