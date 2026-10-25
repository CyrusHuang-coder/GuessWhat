'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, PhoneCall, PhoneOff, Loader2, Volume2 } from 'lucide-react';
import { WebRTCSignal } from '@/lib/types/game';

interface Props {
  roomCode: string;
  playerToken: string;
  opponentOnline: boolean;
  hasGuest: boolean;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function VoiceCallBar({ roomCode, playerToken, opponentOnline, hasGuest }: Props) {
  const [callState, setCallState] = useState<'idle' | 'calling' | 'connected'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastSignalTimeRef = useRef<string>(new Date(Date.now() - 5000).toISOString());
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 发配信令
  const sendSignal = useCallback(
    async (type: 'offer' | 'answer' | 'candidate' | 'hangup', payload: any) => {
      try {
        await fetch(`/api/rooms/${roomCode}/webrtc/signal`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-player-token': playerToken,
          },
          body: JSON.stringify({ type, payload }),
        });
      } catch (e) {
        console.warn('Send WebRTC signal failed', e);
      }
    },
    [roomCode, playerToken]
  );

  // 关闭连接与清理资源
  const cleanupCall = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    setCallState('idle');
    setIsMuted(false);
  }, []);

  const handleHangup = useCallback(() => {
    sendSignal('hangup', {});
    cleanupCall();
  }, [sendSignal, cleanupCall]);

  // 处理接收到的远程信令
  const handleRemoteSignal = useCallback(
    async (signal: WebRTCSignal) => {
      if (signal.type === 'hangup') {
        cleanupCall();
        return;
      }

      if (signal.type === 'offer') {
        // 收到对方发起的呼叫
        try {
          if (!pcRef.current) {
            // 获取本地麦克风
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true },
            });
            localStreamRef.current = stream;

            const pc = new RTCPeerConnection(RTC_CONFIG);
            pcRef.current = pc;

            stream.getTracks().forEach((track) => pc.addTrack(track, stream));

            pc.ontrack = (evt) => {
              if (remoteAudioRef.current && evt.streams[0]) {
                remoteAudioRef.current.srcObject = evt.streams[0];
                remoteAudioRef.current.play().catch(() => {});
              }
            };

            pc.onicecandidate = (evt) => {
              if (evt.candidate) {
                sendSignal('candidate', evt.candidate.toJSON());
              }
            };

            pc.onconnectionstatechange = () => {
              if (pc.connectionState === 'connected') {
                setCallState('connected');
              } else if (
                pc.connectionState === 'disconnected' ||
                pc.connectionState === 'failed' ||
                pc.connectionState === 'closed'
              ) {
                cleanupCall();
              }
            };
          }

          const pc = pcRef.current;
          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal('answer', answer);
          setCallState('calling');
        } catch (e: any) {
          console.error('Answer offer error', e);
          setErrorMsg('接听语音失败：' + (e.message || '麦克风权限受限'));
          cleanupCall();
        }
      } else if (signal.type === 'answer') {
        if (pcRef.current && pcRef.current.signalingState !== 'closed') {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(signal.payload));
          setCallState('connected');
        }
      } else if (signal.type === 'candidate') {
        if (pcRef.current && pcRef.current.remoteDescription) {
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(signal.payload));
          } catch (err) {
            console.warn('Add ICE candidate error', err);
          }
        }
      }
    },
    [sendSignal, cleanupCall]
  );

  // 定期轮询远端信令
  useEffect(() => {
    const pollSignals = async () => {
      try {
        const res = await fetch(
          `/api/rooms/${roomCode}/webrtc/signal?since=${encodeURIComponent(lastSignalTimeRef.current)}`,
          {
            headers: { 'x-player-token': playerToken },
          }
        );
        const data = await res.json();
        if (data.success && Array.isArray(data.signals) && data.signals.length > 0) {
          for (const s of data.signals) {
            lastSignalTimeRef.current = s.created_at;
            await handleRemoteSignal(s);
          }
        }
      } catch (e) {
        // 网络抖动静默
      }
    };

    const interval = setInterval(pollSignals, 1500);
    return () => clearInterval(interval);
  }, [roomCode, playerToken, handleRemoteSignal]);

  // 主动发起开麦
  const startCall = async () => {
    setErrorMsg(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg('当前浏览器不支持语音开麦通话功能');
      return;
    }

    try {
      setCallState('calling');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (evt) => {
        if (remoteAudioRef.current && evt.streams[0]) {
          remoteAudioRef.current.srcObject = evt.streams[0];
          remoteAudioRef.current.play().catch(() => {});
        }
      };

      pc.onicecandidate = (evt) => {
        if (evt.candidate) {
          sendSignal('candidate', evt.candidate.toJSON());
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setCallState('connected');
        } else if (
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed'
        ) {
          cleanupCall();
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal('offer', offer);
    } catch (e: any) {
      console.error('Start call error', e);
      setErrorMsg('无法启动麦克风，请检查并授予麦克风权限');
      cleanupCall();
    }
  };

  // 静音切换
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  if (!hasGuest) return null;

  return (
    <div className="bg-white border border-warm-border rounded-game-sm p-2 shadow-2xs flex flex-wrap items-center justify-between gap-2 text-xs">
      {/* 隐藏的音频接收器 */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-sage-50 text-sage-700 flex items-center justify-center border border-sage-200">
          <Volume2 className="w-4 h-4" />
        </div>
        <div>
          <div className="font-bold text-ink-text flex items-center gap-1.5">
            <span>双人实时语音连麦</span>
            {callState === 'connected' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-status-ok bg-status-okBg px-1.5 py-0.2 rounded-full border border-status-okBorder animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-status-ok" />
                通话中
              </span>
            )}
            {callState === 'calling' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded-full border border-amber-200">
                <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                正在接通双方...
              </span>
            )}
          </div>
          <p className="text-[11px] text-ink-subtle">
            {callState === 'idle'
              ? '直接开麦通话，边聊边猜更畅快'
              : callState === 'connected'
              ? isMuted
                ? '麦克风已静音（对方听不到你的声音）'
                : '双方已接通，正在双向语音传输'
              : '正在握手连接对方麦克风通道...'}
          </p>
        </div>
      </div>

      {errorMsg && (
        <span className="text-[11px] text-status-err font-medium px-2 py-0.5 bg-status-errBg rounded border border-status-errBorder">
          {errorMsg}
        </span>
      )}

      {/* 控制操作区 */}
      <div className="flex items-center gap-1.5">
        {callState === 'idle' ? (
          <button
            type="button"
            onClick={startCall}
            disabled={!opponentOnline}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-game-sm bg-sage-50 hover:bg-sage-100 active:bg-sage-200 text-sage-800 font-bold border border-sage-300 transition shadow-2xs disabled:opacity-40"
            title={opponentOnline ? '开启实时语音连麦' : '对方离线，暂无法接通话'}
          >
            <PhoneCall className="w-3.5 h-3.5 text-sage-600" />
            <span>开启连麦 (开麦)</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={toggleMute}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-game-sm border text-xs font-bold transition ${
                isMuted
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-warm-subtle border-warm-border text-ink-text hover:bg-warm-bg'
              }`}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5 text-amber-600" /> : <Mic className="w-3.5 h-3.5 text-sage-600" />}
              <span>{isMuted ? '取消静音' : '静音'}</span>
            </button>

            <button
              type="button"
              onClick={handleHangup}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-game-sm bg-status-errBg hover:bg-status-errBorder text-status-err font-bold border border-status-errBorder transition"
              title="挂断语音通话"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>挂断</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

