'use client';

import { PhoneCall, PhoneOff, Mic, MicOff, Loader2, Volume2, X } from 'lucide-react';
import { useVoiceCall } from '@/lib/audio/useVoiceCall';

interface Props {
  voiceCall: ReturnType<typeof useVoiceCall>;
  opponentNickname?: string;
  opponentOnline?: boolean;
}

export function VoiceCallBar({ voiceCall, opponentNickname = '对方', opponentOnline = true }: Props) {
  const {
    callState,
    isMuted,
    formattedDuration,
    errorMsg,
    startCall,
    acceptCall,
    rejectCall,
    hangupCall,
    toggleMute,
    clearError,
  } = voiceCall;

  return (
    <div className="flex flex-col border-b border-warm-border">
      {/* 错误提示横条 */}
      {errorMsg && (
        <div className="px-3 py-1.5 bg-status-errBg/90 text-status-err flex items-center justify-between text-[11px] border-b border-status-errBorder">
          <span className="truncate pr-1 font-medium">{errorMsg}</span>
          <button
            type="button"
            onClick={clearError}
            className="p-0.5 rounded hover:bg-status-errBorder/50 text-status-err transition shrink-0"
            title="关闭提示"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* 状态 1: 空闲未连麦 */}
      {callState === 'idle' && (
        <div className="px-3 py-2 bg-warm-subtle/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-ink-text">
            <div className="w-5 h-5 rounded-full bg-sage-100 text-sage-700 flex items-center justify-center">
              <Volume2 className="w-3 h-3" />
            </div>
            <div>
              <span className="font-bold text-[11px] text-ink-text">双人语音连麦</span>
              <span className="hidden sm:inline text-[10px] text-ink-subtle ml-1.5">
                实时通话边聊边猜
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={startCall}
            disabled={!opponentOnline}
            className="flex items-center gap-1 px-3 py-1 rounded-full bg-sage-500 hover:bg-sage-600 active:scale-95 text-white font-bold text-[11px] shadow-2xs transition disabled:opacity-40"
            title={opponentOnline ? '发起实时语音连麦' : '对方当前离线'}
          >
            <PhoneCall className="w-3 h-3" />
            <span>开启连麦</span>
          </button>
        </div>
      )}

      {/* 状态 2: 正在呼叫对方 (等待对方接听) */}
      {callState === 'calling' && (
        <div className="px-3 py-2 bg-amber-50 flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="text-amber-900 font-bold text-[11px]">
              正在呼叫 {opponentNickname} 接听...
            </span>
          </div>

          <button
            type="button"
            onClick={hangupCall}
            className="px-2.5 py-0.5 rounded-full bg-white hover:bg-amber-100 text-amber-900 text-[11px] font-medium border border-amber-300 transition"
          >
            取消
          </button>
        </div>
      )}

      {/* 状态 3: 对方呼叫我 (等待接听) */}
      {callState === 'incoming' && (
        <div className="px-3 py-2 bg-sage-100/90 flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-1.5 text-sage-900">
            <PhoneCall className="w-3.5 h-3.5 text-sage-700 animate-bounce" />
            <span className="font-bold text-[11px]">{opponentNickname} 邀请你开麦连麦！</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={acceptCall}
              className="flex items-center gap-1 px-3 py-1 rounded-full bg-sage-600 hover:bg-sage-700 active:scale-95 text-white font-bold text-[11px] shadow-2xs transition"
            >
              <span>立即接听</span>
            </button>
            <button
              type="button"
              onClick={rejectCall}
              className="px-2 py-1 rounded-full bg-white hover:bg-warm-bg text-ink-subtle text-[11px] font-medium border border-warm-border transition"
            >
              婉拒
            </button>
          </div>
        </div>
      )}

      {/* 状态 4: 双方正在建立通道 (握手协商中) */}
      {callState === 'connecting' && (
        <div className="px-3 py-2 bg-sage-50 flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2 text-sage-800">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-sage-600" />
            <span className="font-medium text-[11px]">正在建立双向语音通道...</span>
          </div>

          <button
            type="button"
            onClick={hangupCall}
            className="px-2.5 py-0.5 rounded-full bg-white hover:bg-warm-bg text-ink-subtle text-[11px] border border-warm-border transition"
          >
            取消
          </button>
        </div>
      )}

      {/* 状态 5: 成功接通通话中 */}
      {callState === 'connected' && (
        <div className="px-3 py-2 bg-sage-100/80 flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-status-ok animate-pulse" />
            <span className="font-bold text-sage-900 text-[11px]">通话中</span>
            <span className="font-mono text-sage-700 text-[11px]">{formattedDuration}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleMute}
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition ${
                isMuted
                  ? 'bg-amber-100 border-amber-300 text-amber-900'
                  : 'bg-white border-sage-300 text-sage-800 hover:bg-sage-50'
              }`}
            >
              {isMuted ? (
                <MicOff className="w-3 h-3 text-amber-700" />
              ) : (
                <Mic className="w-3 h-3 text-sage-600" />
              )}
              <span>{isMuted ? '已静音' : '开麦中'}</span>
            </button>

            <button
              type="button"
              onClick={hangupCall}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-status-errBg hover:bg-status-errBorder text-status-err font-bold text-[11px] border border-status-errBorder transition"
              title="挂断通话"
            >
              <PhoneOff className="w-3 h-3" />
              <span>挂断</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
