'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, Share2, PlusSquare, MoreVertical, X, Check, ArrowRight, ExternalLink } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPwaModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isWeChat, setIsWeChat] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 检测是否已作为独立 App 运行
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // 系统平台特征检测
    const ua = window.navigator.userAgent.toLowerCase();
    setIsIos(/iphone|ipad|ipod/.test(ua));
    setIsWeChat(/micromessenger/.test(ua));

    // 捕获 Android/Chrome 原生安装引导事件
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleNativeInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
        setTimeout(() => onClose(), 2000);
      }
      setDeferredPrompt(null);
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-game border border-warm-border max-w-sm w-full p-6 shadow-board relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-ink-muted hover:text-ink-text rounded-game-sm hover:bg-warm-bg transition"
          aria-label="关闭"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-game-sm bg-sage-100 text-sage-600 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-ink-text text-base">添加到手机桌面 (App)</h3>
            <p className="text-xs text-ink-muted">无需应用商店，一秒生成独立全屏图标</p>
          </div>
        </div>

        {isStandalone ? (
          <div className="p-4 bg-sage-50 border border-sage-200 rounded-game-sm text-center">
            <Check className="w-8 h-8 text-sage-600 mx-auto mb-2" />
            <p className="text-sm font-bold text-sage-700">当前已作为桌面应用运行！</p>
            <p className="text-xs text-sage-600 mt-1">您已享受全屏无地址栏的原生 App 游戏体验。</p>
          </div>
        ) : isWeChat ? (
          <div className="p-4 bg-status-warnBg border border-status-warnBorder rounded-game-sm text-xs text-status-warn space-y-2">
            <p className="font-bold flex items-center gap-1.5">
              <span>⚠️ 检测到当前在微信内打开</span>
            </p>
            <p className="leading-relaxed">
              微信内置浏览器无法直接保存到桌面。请点击屏幕右上角 <strong>「···」</strong>，选择 <strong>「在默认浏览器中打开」</strong>（Safari 或 Chrome），然后再保存即可。
            </p>
          </div>
        ) : isIos ? (
          /* iOS 苹果设备指引 */
          <div className="space-y-3.5 text-xs text-ink-text">
            <p className="text-ink-muted">
              在 iPhone / iPad 的 <strong>Safari 浏览器</strong> 中按以下两步操作：
            </p>
            <div className="p-3 bg-warm-bg rounded-game-sm border border-warm-border space-y-3">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-sage-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">
                  1
                </span>
                <div>
                  点击 Safari 屏幕底部的 <strong>【分享】</strong> 按钮
                  <div className="inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 bg-white border border-warm-border rounded text-ink-muted text-[11px]">
                    <Share2 className="w-3 h-3 text-sage-600" /> 分享图标
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-sage-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">
                  2
                </span>
                <div>
                  在弹出菜单中向下滑动，点击 <strong>【添加到主屏幕】</strong>
                  <div className="inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 bg-white border border-warm-border rounded text-ink-muted text-[11px]">
                    <PlusSquare className="w-3 h-3 text-sage-600" /> 添加到主屏幕
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-sage-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">
                  3
                </span>
                <div>
                  点击右上角的 <strong>【添加】</strong> 即可！
                </div>
              </div>
            </div>
            <p className="text-[11px] text-ink-subtle">
              💡 添加后手机主屏幕将生成 GuessWhat 专属图标，打开即享全屏 App 体验。
            </p>
          </div>
        ) : (
          /* Android 安卓设备指引 */
          <div className="space-y-3 text-xs text-ink-text">
            {deferredPrompt ? (
              <div className="space-y-3">
                <p className="text-ink-muted">系统已就绪，可一键安装到手机主屏幕：</p>
                <button
                  onClick={handleNativeInstall}
                  className="w-full py-3 bg-sage-500 hover:bg-sage-600 text-white font-bold text-xs rounded-game-sm shadow-2xs transition flex items-center justify-center gap-1.5"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>立即安装到手机桌面</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-ink-muted">在手机浏览器（Chrome 或系统自带浏览器）中：</p>
                <div className="p-3 bg-warm-bg rounded-game-sm border border-warm-border space-y-2.5">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-sage-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
                    <div>点击浏览器右上角或底部的 <strong>菜单「···」</strong></div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-sage-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">2</span>
                    <div>选择 <strong>「添加到主屏幕」</strong> 或 <strong>「安装应用」</strong></div>
                  </div>
                </div>
              </div>
            )}
            <p className="text-[11px] text-ink-subtle">
              💡 支持安卓各品牌手机（华为/小米/OPPO/vivo等），体积只有几百KB，极速启动。
            </p>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-warm-border">
          <button
            onClick={onClose}
            className="w-full py-2 bg-warm-bg hover:bg-warm-subtle text-ink-muted font-bold text-xs rounded-game-sm transition"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}
