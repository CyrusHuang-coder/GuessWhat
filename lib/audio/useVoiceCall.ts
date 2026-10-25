'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { WebRTCSignal } from '@/lib/types/game';
import { soundEffects } from '@/lib/audio/sound';

export type VoiceCallState = 'idle' | 'calling' | 'incoming' | 'connecting' | 'connected';

interface UseVoiceCallProps {
  roomCode: string;
  playerToken: string;
  opponentOnline?: boolean;
  hasGuest?: boolean;
}

// 采用国内高可用 STUN 节点（腾讯、小米、B站、Cloudflare）与 Google 节点作为多重备份
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.qq.com:3478' },
    { urls: 'stun:stun.miwifi.com:3478' },
    { urls: 'stun:stun.chat.bilibili.com:3478' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.sipgate.net:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

export function useVoiceCall({
  roomCode,
  playerToken,
  opponentOnline = true,
  hasGuest = true,
}: UseVoiceCallProps) {
  const [callState, setCallState] = useState<VoiceCallState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingOfferRef = useRef<any>(null);
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const candidateBufferRef = useRef<RTCIceCandidateInit[]>([]);
  const candidateTimerRef = useRef<NodeJS.Timeout | null>(null);

  const lastSignalTimeRef = useRef<string>(new Date(Date.now() - 3000).toISOString());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const callingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 通话时长计时器
  useEffect(() => {
    if (callState === 'connected') {
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setDuration(0);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // 发送信令到后端
  const sendSignal = useCallback(
    async (type: 'offer' | 'answer' | 'candidate' | 'hangup', payload: any) => {
      if (!roomCode || !playerToken) return;
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
        console.warn('WebRTC signal post failed', e);
      }
    },
    [roomCode, playerToken]
  );

  // 清理所有通话资源
  const cleanupCall = useCallback(() => {
    if (callingTimeoutRef.current) {
      clearTimeout(callingTimeoutRef.current);
      callingTimeoutRef.current = null;
    }
    if (connectingTimeoutRef.current) {
      clearTimeout(connectingTimeoutRef.current);
      connectingTimeoutRef.current = null;
    }
    if (candidateTimerRef.current) {
      clearTimeout(candidateTimerRef.current);
      candidateTimerRef.current = null;
    }
    candidateBufferRef.current = [];
    iceCandidateQueueRef.current = [];
    pendingOfferRef.current = null;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (e) {}
      pcRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    setCallState('idle');
    setIsMuted(false);
  }, []);

  // 挂断通话
  const hangupCall = useCallback(() => {
    sendSignal('hangup', { reason: 'user_hangup' });
    cleanupCall();
  }, [sendSignal, cleanupCall]);

  // 婉拒对方的来电
  const rejectCall = useCallback(() => {
    sendSignal('hangup', { reason: 'rejected' });
    cleanupCall();
  }, [sendSignal, cleanupCall]);

  // 辅助函数：创建并初始化 PeerConnection
  const setupPeerConnection = useCallback(
    (stream: MediaStream): RTCPeerConnection => {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      // 添加本地音频轨
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // 接收远端音频轨
      pc.ontrack = (evt) => {
        if (remoteAudioRef.current && evt.streams[0]) {
          remoteAudioRef.current.srcObject = evt.streams[0];
          remoteAudioRef.current.play().catch((err) => {
            console.warn('AutoPlay blocked, waiting for interaction', err);
          });
        }
      };

      // 收集并批量防抖发送 ICE Candidates，避免大量微并发挤压存储
      pc.onicecandidate = (evt) => {
        if (evt.candidate) {
          candidateBufferRef.current.push(evt.candidate.toJSON());
          if (candidateTimerRef.current) clearTimeout(candidateTimerRef.current);
          candidateTimerRef.current = setTimeout(() => {
            if (candidateBufferRef.current.length > 0) {
              sendSignal('candidate', candidateBufferRef.current);
              candidateBufferRef.current = [];
            }
          }, 60);
        }
      };

      const handleConnectionSuccess = () => {
        if (connectingTimeoutRef.current) {
          clearTimeout(connectingTimeoutRef.current);
          connectingTimeoutRef.current = null;
        }
        setCallState('connected');
        soundEffects.playPop();
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          handleConnectionSuccess();
        } else if (
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed'
        ) {
          cleanupCall();
        }
      };

      // 部分移动端（如某些版本 iOS Safari/微信）优先触发 iceConnectionStateChange
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          handleConnectionSuccess();
        } else if (pc.iceConnectionState === 'failed') {
          setErrorMsg('P2P 语音直连受限，建议同一 Wi-Fi 或在聊天室打字交流');
          cleanupCall();
        }
      };

      return pc;
    },
    [sendSignal, cleanupCall]
  );

  // 主动发起开麦呼叫
  const startCall = async () => {
    setErrorMsg(null);
    if (!hasGuest) {
      setErrorMsg('房间内目前仅有您一人，等待好友加入后再连麦吧');
      return;
    }
    if (!opponentOnline) {
      setErrorMsg('对方当前似乎离线或未切回网页，暂无法发起连麦');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg('当前浏览器不支持麦克风录音通话，请使用系统自带浏览器打开');
      return;
    }

    try {
      setCallState('calling');
      soundEffects.playPop();

      // 在手势触发的第一时间预先激活 audio 标签（绕过 iOS Safari 自动播放限制）
      if (remoteAudioRef.current) {
        remoteAudioRef.current.play().catch(() => {});
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;

      const pc = setupPeerConnection(stream);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await sendSignal('offer', offer);

      // 发起后等待接听，超过 25 秒无人接听则自动取消呼叫
      callingTimeoutRef.current = setTimeout(() => {
        if (pcRef.current && pcRef.current.connectionState !== 'connected') {
          setErrorMsg('对方暂未接听，已取消呼叫（可在聊天室发消息提醒对方）');
          cleanupCall();
        }
      }, 25000);
    } catch (err: any) {
      console.error('Start call error', err);
      setErrorMsg(
        err.name === 'NotAllowedError'
          ? '未获取到麦克风权限，请在手机设置或浏览器地址栏中允许使用麦克风'
          : `无法启动麦克风: ${err.message || '未知错误'}`
      );
      cleanupCall();
    }
  };

  // 接听对方的来电（必须由玩家亲自点击触发，以获得移动端麦克风授权）
  const acceptCall = async () => {
    setErrorMsg(null);
    if (!pendingOfferRef.current) {
      cleanupCall();
      return;
    }

    try {
      setCallState('connecting');
      soundEffects.playPop();

      // 预激活音频
      if (remoteAudioRef.current) {
        remoteAudioRef.current.play().catch(() => {});
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;

      const pc = setupPeerConnection(stream);

      // 设置远端 Offer
      await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));

      // 释放并载入队列中提前到达的 ICE Candidates
      if (iceCandidateQueueRef.current.length > 0) {
        for (const cand of iceCandidateQueueRef.current) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (e) {}
        }
        iceCandidateQueueRef.current = [];
      }

      // 生成并提交 Answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal('answer', answer);

      // 握手超时兜底保护（15 秒无法连通则提示）
      connectingTimeoutRef.current = setTimeout(() => {
        if (pcRef.current && pcRef.current.connectionState !== 'connected') {
          setErrorMsg('语音通道握手超时（可能由于手机蜂窝网络 NAT 限制），建议在聊天室打字交流');
          cleanupCall();
        }
      }, 15000);
    } catch (err: any) {
      console.error('Accept call error', err);
      setErrorMsg(
        err.name === 'NotAllowedError'
          ? '未获取到麦克风权限，请允许麦克风权限后重试'
          : `接听失败: ${err.message || '未知错误'}`
      );
      cleanupCall();
    }
  };

  // 处理接收到的远端信令
  const handleRemoteSignal = useCallback(
    async (signal: WebRTCSignal) => {
      // 1. 对方挂断或拒绝
      if (signal.type === 'hangup') {
        if (callState === 'calling') {
          setErrorMsg('对方婉拒了本次语音通话');
        }
        cleanupCall();
        return;
      }

      // 2. 收到对方发起的呼叫 Offer
      if (signal.type === 'offer') {
        // 如果我当前正在通话中或已经发起了呼叫，忽略冲突
        if (pcRef.current && callState === 'connected') return;

        // 暂存 Offer，进入 incoming 状态等待玩家主动点击接听，绝不在后台自动调用 getUserMedia
        pendingOfferRef.current = signal.payload;
        setCallState('incoming');
        soundEffects.playDing();
        return;
      }

      // 3. 收到对方确认的 Answer
      if (signal.type === 'answer') {
        if (pcRef.current && pcRef.current.signalingState === 'have-local-offer') {
          if (callingTimeoutRef.current) {
            clearTimeout(callingTimeoutRef.current);
            callingTimeoutRef.current = null;
          }
          setCallState('connecting');
          try {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(signal.payload));

            // 清空队列中的 candidate
            if (iceCandidateQueueRef.current.length > 0) {
              for (const cand of iceCandidateQueueRef.current) {
                try {
                  await pcRef.current.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) {}
              }
              iceCandidateQueueRef.current = [];
            }
          } catch (e: any) {
            console.warn('Set remote answer failed', e);
          }
        }
        return;
      }

      // 4. 收到对方发来的 ICE Candidates
      if (signal.type === 'candidate') {
        const cands = Array.isArray(signal.payload) ? signal.payload : [signal.payload];
        for (const c of cands) {
          if (c && pcRef.current && pcRef.current.remoteDescription) {
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(c));
            } catch (err) {}
          } else if (c) {
            iceCandidateQueueRef.current.push(c);
          }
        }
      }
    },
    [callState, cleanupCall]
  );

  // 定期轮询信令通道（智能自适应轮询频率）
  useEffect(() => {
    if (!roomCode || !playerToken) return;

    let isMounted = true;
    const pollSignals = async () => {
      try {
        const res = await fetch(
          `/api/rooms/${roomCode}/webrtc/signal?since=${encodeURIComponent(lastSignalTimeRef.current)}`,
          {
            headers: { 'x-player-token': playerToken },
          }
        );
        if (!isMounted) return;
        const data = await res.json();
        if (data.success && Array.isArray(data.signals) && data.signals.length > 0) {
          for (const s of data.signals) {
            lastSignalTimeRef.current = s.created_at;
            await handleRemoteSignal(s);
          }
        }
      } catch (e) {}
    };

    // 通话中或呼叫中 1 秒高频同步信令；空闲时 2 秒轮询即可
    const intervalMs = callState === 'idle' ? 2000 : 1000;
    const interval = setInterval(pollSignals, intervalMs);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [roomCode, playerToken, callState, handleRemoteSignal]);

  // 静音切换
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        soundEffects.playPop();
      }
    }
  };

  const formattedDuration = `${Math.floor(duration / 60)
    .toString()
    .padStart(2, '0')}:${(duration % 60).toString().padStart(2, '0')}`;

  return {
    callState,
    isMuted,
    duration,
    formattedDuration,
    errorMsg,
    remoteAudioRef,
    startCall,
    acceptCall,
    rejectCall,
    hangupCall,
    toggleMute,
    clearError: () => setErrorMsg(null),
  };
}

