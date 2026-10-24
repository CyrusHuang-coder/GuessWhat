'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, X } from 'lucide-react';

interface Props {
  onTranscript: (text: string) => void;
  className?: string;
  size?: 'sm' | 'md';
  title?: string;
}

// 扩展 window 类型支持 WebkitSpeechRecognition
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export function VoiceInputButton({
  onTranscript,
  className = '',
  size = 'md',
  title = '点击进行语音转文字输入',
}: Props) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 使用 ref 捕获最新的 onTranscript 回调，避免因为父组件重绘导致 useEffect 反复销毁重建
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const showError = useCallback((msg: string) => {
    setErrorMessage(msg);
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
    }
    // 4 秒后自动消失
    errorTimerRef.current = setTimeout(() => {
      setErrorMessage(null);
    }, 4000);
  }, []);

  useEffect(() => {
    const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
    const SpeechRecognition = win?.SpeechRecognition || win?.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      // 禁用中间过度片断（interimResults），避免频繁触发导致文本重复拼接成“它 它是 它是男...”
      recognition.interimResults = false;
      recognition.lang = 'zh-CN'; // 默认中文识别

      let sessionTranscript = '';
      let hasEmitted = false;

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMessage(null);
        sessionTranscript = '';
        hasEmitted = false;
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i];
          if (item && item[0] && item[0].transcript) {
            finalTranscript += item[0].transcript;
          }
        }

        const cleaned = finalTranscript.trim();
        if (cleaned) {
          sessionTranscript = cleaned;
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        const err = event.error;

        // aborted: 正常停止/取消或失去焦点，不应弹红报错
        // no-speech: 没检测到声音静音停止，不应弹红报错
        if (err === 'aborted' || err === 'no-speech') {
          return;
        }

        if (err === 'not-allowed' || err === 'service-not-allowed') {
          showError('麦克风权限被拒绝，请在浏览器地址栏允许麦克风访问');
        } else if (err === 'audio-capture') {
          showError('未检测到麦克风，请检查音频输入设备');
        } else if (err === 'network') {
          showError('语音服务连接受阻（浏览器在线语音识别需要访问服务）');
        } else {
          showError(`语音识别提示: ${err}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (sessionTranscript && !hasEmitted) {
          hasEmitted = true;
          onTranscriptRef.current(sessionTranscript);
          sessionTranscript = '';
        }
      };

      recognitionRef.current = recognition;
    } catch (err) {
      setIsSupported(false);
    }

    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      try {
        recognitionRef.current?.abort();
      } catch (e) {
        // ignore
      }
    };
  }, [showError]); // 只在组件初始化加载一次，不再因 onTranscript 重新触发

  const toggleListening = () => {
    if (!isSupported) {
      alert('您的浏览器暂不支持原生语音识别，建议使用 Chrome、Edge 或 Safari 浏览器。');
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch (e) {
        recognitionRef.current?.abort();
      }
      setIsListening(false);
    } else {
      try {
        setErrorMessage(null);
        recognitionRef.current?.start();
      } catch (err) {
        // 如果已经处于启动状态，尝试重置
        try {
          recognitionRef.current?.abort();
          setTimeout(() => {
            recognitionRef.current?.start();
          }, 100);
        } catch (e) {
          // ignore
        }
      }
    }
  };

  if (!isSupported) {
    return null; // 不支持时平稳隐藏
  }

  const isSmall = size === 'sm';

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={toggleListening}
        title={isListening ? '正在录音，点击结束' : title}
        className={`relative flex items-center justify-center rounded-game-sm transition border select-none ${
          isListening
            ? 'bg-status-err text-white border-status-err animate-pulse shadow-sm'
            : 'bg-warm-bg hover:bg-sage-100 text-ink-muted hover:text-sage-700 border-warm-border'
        } ${isSmall ? 'p-1.5 text-xs' : 'p-2.5 text-sm'} ${className}`}
      >
        {isListening ? (
          <span className="flex items-center gap-1 font-bold">
            <Mic className={`${isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4'} animate-bounce`} />
            <span className="text-[11px] font-semibold">听取中...</span>
          </span>
        ) : (
          <Mic className={isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        )}
      </button>

      {/* 错误提示浮层（支持自动消失和手动关闭） */}
      {errorMessage && (
        <div className="absolute bottom-full left-0 mb-2 w-52 p-2 bg-status-errBg border border-status-errBorder text-status-err text-[11px] rounded-game-sm shadow-lg z-50 animate-in fade-in flex items-start justify-between gap-1">
          <span className="leading-tight">{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-status-err hover:opacity-70 p-0.5"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
