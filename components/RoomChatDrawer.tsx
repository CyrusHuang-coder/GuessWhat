'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@/lib/types/game';
import {
  MessageCircle,
  X,
  Send,
  PhoneCall,
  Mic,
  Volume2,
  FileText,
  Loader2,
  AudioLines,
} from 'lucide-react';
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

// 跨平台二进制解析：探测真实音频容器 (解决 iOS Safari 将 MP4 容器标为 webm 或 dataURL 播放受限问题)
function parseAudioBlob(dataUrl: string): Blob {
  try {
    const commaIdx = dataUrl.indexOf(',');
    const header = commaIdx > -1 ? dataUrl.slice(0, commaIdx) : '';
    const b64 = commaIdx > -1 ? dataUrl.slice(commaIdx + 1) : dataUrl;
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    let detectedMime = 'audio/mp4';
    // 检查是否为 WebM EBML header: 0x1A 0x45 0xDF 0xA3
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
      detectedMime = 'audio/webm';
    } else if (
      // 检查是否为 MP4 ftyp box (bytes 4..7: 'f','t','y','p')
      bytes.length > 8 &&
      bytes[4] === 0x66 &&
      bytes[5] === 0x74 &&
      bytes[6] === 0x79 &&
      bytes[7] === 0x70
    ) {
      detectedMime = 'audio/mp4';
    } else {
      const mimeMatch = header.match(/data:([^;]+);/);
      if (mimeMatch) detectedMime = mimeMatch[1];
    }

    return new Blob([bytes], { type: detectedMime });
  } catch (e) {
    return new Blob([], { type: 'audio/mp4' });
  }
}

// 微信同款语音对讲条，支持双端解码播放与语音转文字展示
function VoiceMessageBubble({
  content,
  isMe,
  roomCode,
  playerToken,
}: {
  content: string;
  isMe: boolean;
  roomCode: string;
  playerToken: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [manualText, setManualText] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const currentBlobUrlRef = useRef<string | null>(null);

  // 解析格式：[VOICE:3:转写文本]data:audio/... 或旧格式 [VOICE:3]data:audio/...
  const match = content.match(/^\[VOICE:(\d+)(?::([^\]]*))?\]([\s\S]*)$/);
  const duration = match ? parseInt(match[1], 10) : 3;
  const embeddedText = match?.[2] || '';
  const audioSrc = match?.[3] || '';

  const displayText = manualText ?? embeddedText;

  // 释放资源
  useEffect(() => {
    return () => {
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
      }
      if (audioCtxSourceRef.current) {
        try {
          audioCtxSourceRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  // Web Audio API 强力解码兜底播放
  const playWithAudioContext = async (blob: Blob) => {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) {
        setPlaying(false);
        return;
      }
      const ctx = new AudioCtxClass();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const arrayBuffer = await blob.arrayBuffer();
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = decodedBuffer;
      source.connect(ctx.destination);
      audioCtxSourceRef.current = source;
      source.onended = () => {
        setPlaying(false);
        try {
          ctx.close();
        } catch (e) {}
      };
      source.start(0);
      setPlaying(true);
    } catch (e) {
      console.warn('AudioContext playback fallback also failed:', e);
      setPlaying(false);
    }
  };

  const togglePlay = async () => {
    if (!audioSrc) return;

    if (playing) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (audioCtxSourceRef.current) {
        try {
          audioCtxSourceRef.current.stop();
        } catch (e) {}
      }
      setPlaying(false);
      return;
    }

    try {
      const blob = parseAudioBlob(audioSrc);
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
      }
      const objectUrl = URL.createObjectURL(blob);
      currentBlobUrlRef.current = objectUrl;

      const audio = new Audio();
      audio.src = objectUrl;
      (audio as any).playsInline = true;
      audioRef.current = audio;

      audio.onended = () => {
        setPlaying(false);
      };

      audio.onerror = async () => {
        // HTML5 Audio 无法解码时，使用 Web Audio API 解码
        await playWithAudioContext(blob);
      };

      await audio.play();
      setPlaying(true);
    } catch (err) {
      // 捕获 iOS 自动播放或解码异常
      const blob = parseAudioBlob(audioSrc);
      await playWithAudioContext(blob);
    }
  };

  // 请求服务端/AI 进行语音转文字
  const handleRequestTranscribe = async () => {
    if (transcribing || !audioSrc) return;
    setTranscribing(true);

    try {
      const res = await fetch(`/api/rooms/${roomCode}/chat/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-token': playerToken,
        },
        body: JSON.stringify({
          audio: audioSrc,
          mimeType: parseAudioBlob(audioSrc).type,
        }),
      });
      const data = await res.json();
      if (data.success && data.text) {
        setManualText(data.text);
      } else {
        setManualText('（语音未能识别或未配置大模型密钥）');
      }
    } catch (e: any) {
      setManualText('（转文字请求失败）');
    } finally {
      setTranscribing(false);
    }
  };

  return (
    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] space-y-1`}>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={togglePlay}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-game-sm text-xs transition shadow-2xs active:scale-95 ${
            isMe
              ? 'bg-sage-600 text-white rounded-tr-none hover:bg-sage-700'
              : 'bg-white border border-warm-border text-ink-text rounded-tl-none hover:bg-warm-bg'
          }`}
          style={{ minWidth: '96px', maxWidth: '180px' }}
          title="点击播放对讲语音"
        >
          <Volume2 className={`w-3.5 h-3.5 shrink-0 ${playing ? 'animate-bounce text-amber-300' : ''}`} />
          <span className="font-mono font-bold text-xs">{duration}"</span>
          <span className="text-[10px] opacity-80 ml-auto">{playing ? '播放中' : '对讲'}</span>
        </button>

        {!displayText && !transcribing && (
          <button
            type="button"
            onClick={handleRequestTranscribe}
            className="p-1 text-[10px] text-ink-subtle hover:text-sage-700 bg-white/70 hover:bg-white rounded border border-warm-border/60 transition flex items-center gap-0.5 shadow-2xs"
            title="转为文字"
          >
            <FileText className="w-2.5 h-2.5" />
            <span>转文字</span>
          </button>
        )}

        {transcribing && (
          <span className="text-[10px] text-ink-subtle flex items-center gap-1">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            <span>识别中...</span>
          </span>
        )}
      </div>

      {/* 识别文字气泡展示 */}
      {displayText && (
        <div
          className={`text-[11px] px-2.5 py-1 rounded-md leading-relaxed border select-text ${
            isMe
              ? 'bg-sage-50 text-sage-900 border-sage-200 text-right'
              : 'bg-white text-ink-text border-warm-border text-left'
          }`}
        >
          <span className="text-[10px] text-ink-subtle mr-1">💬</span>
          <span>{displayText}</span>
        </div>
      )}
    </div>
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
  const [liveTranscription, setLiveTranscription] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const audioMimeRef = useRef<string>('audio/mp4');
  const speechRecognizerRef = useRef<any>(null);

  // 独立语音转文字听写输入状态 (直接听写打字)
  const [isDictating, setIsDictating] = useState(false);
  const dictationRecognizerRef = useRef<any>(null);

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
    if (speechRecognizerRef.current) {
      try {
        speechRecognizerRef.current.stop();
      } catch (e) {}
      speechRecognizerRef.current = null;
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
    setLiveTranscription('');
    audioChunksRef.current = [];
  };

  const stopAndSendRecording = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (speechRecognizerRef.current) {
      try {
        speechRecognizerRef.current.stop();
      } catch (e) {}
      speechRecognizerRef.current = null;
    }

    const finalDuration = Math.max(1, recordDuration);
    const finalTranscription = liveTranscription.trim();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        const mimeType = audioMimeRef.current || 'audio/mp4';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (recordingStreamRef.current) {
          recordingStreamRef.current.getTracks().forEach((t) => t.stop());
          recordingStreamRef.current = null;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          if (base64Audio) {
            const formatted = finalTranscription
              ? `[VOICE:${finalDuration}:${finalTranscription}]${base64Audio}`
              : `[VOICE:${finalDuration}]${base64Audio}`;
            handleSend(formatted);
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
    setLiveTranscription('');
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('当前浏览器环境不支持录音功能');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;

      // 智能匹配最佳跨平台音频编码格式 (iOS Safari 优先使用 mp4/aac，Chrome 优先使用 webm/mp4)
      let chosenMime = '';
      const candidates = [
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/aac',
      ];
      for (const t of candidates) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) {
          chosenMime = t;
          break;
        }
      }

      const options = chosenMime ? { mimeType: chosenMime } : undefined;
      const mediaRecorder = options ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioMimeRef.current = mediaRecorder.mimeType || chosenMime || 'audio/mp4';
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordDuration(0);
      setLiveTranscription('');
      soundEffects.playPop();

      // 启动同步语音转文字识别
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognizer = new SpeechRecognition();
          recognizer.lang = 'zh-CN';
          recognizer.continuous = true;
          recognizer.interimResults = true;
          recognizer.onresult = (e: any) => {
            let transcript = '';
            for (let i = 0; i < e.results.length; i++) {
              transcript += e.results[i][0].transcript;
            }
            if (transcript) setLiveTranscription(transcript);
          };
          recognizer.start();
          speechRecognizerRef.current = recognizer;
        } catch (e) {
          // 语音识别降级
        }
      }

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

  // 独立的打字语音听写功能 (直接填入输入框)
  const toggleDictation = () => {
    if (isDictating) {
      if (dictationRecognizerRef.current) {
        try {
          dictationRecognizerRef.current.stop();
        } catch (e) {}
        dictationRecognizerRef.current = null;
      }
      setIsDictating(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('当前浏览器暂不支持免录音的纯实时语音打字，您可点击左侧麦克风发送对讲语音');
      return;
    }

    try {
      const recognizer = new SpeechRecognition();
      recognizer.lang = 'zh-CN';
      recognizer.continuous = true;
      recognizer.interimResults = true;

      recognizer.onresult = (e: any) => {
        let transcript = '';
        for (let i = 0; i < e.results.length; i++) {
          transcript += e.results[i][0].transcript;
        }
        if (transcript) {
          setText((prev) => {
            // 避免重复叠加
            return transcript;
          });
        }
      };

      recognizer.onerror = () => {
        setIsDictating(false);
      };

      recognizer.onend = () => {
        setIsDictating(false);
      };

      recognizer.start();
      dictationRecognizerRef.current = recognizer;
      setIsDictating(true);
      soundEffects.playPop();
    } catch (e: any) {
      alert('无法开启语音识别：' + (e.message || '未知'));
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

      {/* 统一外层容器：聊天抽屉与小胶囊在同一垂直流中，小胶囊始终紧贴在窗口下方，绝不遮挡 */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end pointer-events-none gap-2">
        {/* 聊天抽屉弹窗 */}
        {isOpen && (
          <div className="pointer-events-auto w-[calc(100vw-2rem)] sm:w-[380px] max-w-[400px] h-[min(520px,calc(100vh-140px))] bg-[#FAF9F5] rounded-2xl border-2 border-sage-700/25 shadow-[0_25px_60px_-15px_rgba(20,35,25,0.4)] ring-1 ring-black/10 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-150">
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

            {/* 消息滚动流 */}
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
                          <VoiceMessageBubble
                            content={msg.text}
                            isMe={isMe}
                            roomCode={roomCode}
                            playerToken={playerToken}
                          />
                        ) : (
                          <div
                            className={`max-w-[85%] px-3 py-1.5 rounded-game-sm text-xs leading-relaxed shadow-sm select-text ${
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

            {/* 录音对讲状态横条 (实时显示语音转文字) */}
            {isRecording ? (
              <div className="p-2 border-t border-warm-border flex flex-col gap-1.5 bg-amber-50/95 rounded-b-2xl shrink-0 animate-in fade-in">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 pl-1">
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
                {liveTranscription && (
                  <div className="text-[11px] text-amber-950 bg-amber-100/80 px-2 py-1 rounded border border-amber-200/80 truncate">
                    💬 实时转写: {liveTranscription}
                  </div>
                )}
              </div>
            ) : (
              /* 常规打字与麦克风输入栏 */
              <div className="border-t border-warm-border/80 bg-[#FAF9F5] rounded-b-2xl shrink-0">
                {isDictating && (
                  <div className="px-3 py-1 bg-sage-100/80 border-b border-sage-200 text-xs text-sage-900 flex items-center justify-between animate-pulse">
                    <span className="flex items-center gap-1">
                      <AudioLines className="w-3.5 h-3.5 text-sage-700" />
                      <span>正在语音转文字，请直接说话...</span>
                    </span>
                    <button
                      type="button"
                      onClick={toggleDictation}
                      className="text-[10px] font-bold text-sage-700 underline"
                    >
                      完成
                    </button>
                  </div>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend(text);
                  }}
                  className="p-2 flex items-center gap-1.5"
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

                  {/* 实时语音转文字听写打字按钮 */}
                  <button
                    type="button"
                    onClick={toggleDictation}
                    className={`p-1.5 rounded-game-sm transition shrink-0 ${
                      isDictating
                        ? 'bg-sage-600 text-white animate-pulse'
                        : 'text-sage-700 hover:bg-sage-100'
                    }`}
                    title={isDictating ? '点击停止听写' : '开启语音转文字输入'}
                  >
                    <AudioLines className="w-4 h-4" />
                  </button>

                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={isDictating ? '正在聆听您的声音...' : '发句调侃或打字交流...'}
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
              </div>
            )}
          </div>
        )}

        {/* 浮动入口/收起胶囊按钮：紧贴在聊天窗口正下方，绝不遮挡 */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`pointer-events-auto relative flex items-center gap-1.5 px-3.5 py-2 rounded-full border shadow-board active:scale-95 text-xs font-bold transition ${
            isOpen
              ? 'bg-sage-700 text-white border-sage-800 hover:bg-sage-800'
              : voiceCall.callState === 'connected'
              ? 'bg-sage-50 border-sage-300 text-sage-900 ring-2 ring-sage-400/40'
              : voiceCall.callState === 'incoming'
              ? 'bg-amber-50 border-amber-300 text-amber-900 animate-bounce'
              : 'bg-white border-warm-border text-ink-text hover:bg-warm-bg'
          }`}
          title={isOpen ? '收起聊天窗口' : '打开对局联机聊天室'}
        >
          {isOpen ? (
            <>
              <X className="w-4 h-4" />
              <span>收起聊天</span>
            </>
          ) : (
            <>
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
            </>
          )}
        </button>
      </div>
    </>
  );
}
