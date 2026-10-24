import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-warm-bg flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-game border border-warm-border max-w-md w-full text-center shadow-board space-y-4">
        <div className="w-12 h-12 rounded-full bg-status-warnBg text-status-warn flex items-center justify-center mx-auto font-bold text-xl">
          404
        </div>
        <h2 className="text-lg font-bold text-ink-text">页面未找到</h2>
        <p className="text-xs text-ink-muted">您访问的房间或页面不存在，可能已失效或地址有误。</p>
        <Link
          href="/"
          className="inline-block w-full py-2.5 bg-sage-500 hover:bg-sage-600 text-white font-bold text-xs rounded-game-sm transition"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}

