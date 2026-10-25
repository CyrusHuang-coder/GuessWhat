'use client';

import { useEffect, useState } from 'react';
import { Database, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

export function EngineBadge() {
  const [info, setInfo] = useState<{ storeType: string; aiConfigured: boolean; aiModel?: string } | null>(null);

  useEffect(() => {
    fetch('/api/info')
      .then((res) => res.json())
      .then((data) => setInfo(data))
      .catch(() => {});
  }, []);

  if (!info) return null;

  const storeLabel =
    info.storeType === 'supabase' ? 'Supabase' :
    info.storeType === 'kv' ? 'Vercel KV' : '本地存储';

  const aiName = info.aiModel || 'Gemini';

  return (
    <div className="inline-flex items-center gap-2 text-[11px] font-medium text-ink-muted bg-white/95 border border-warm-border rounded-full px-2.5 py-0.5 shadow-2xs whitespace-nowrap shrink-0">
      <div className="flex items-center gap-1">
        <Database className="w-3 h-3 text-sage-600 shrink-0" />
        <span className="font-semibold text-ink-text">{storeLabel}</span>
      </div>
      <span className="text-warm-border">·</span>
      <div className="flex items-center gap-1">
        <Sparkles className="w-3 h-3 text-terracotta-500 shrink-0" />
        {info.aiConfigured ? (
          <span className="inline-flex items-center text-status-ok font-semibold gap-0.5">
            <CheckCircle2 className="w-3 h-3 shrink-0" /> {aiName} 就绪
          </span>
        ) : (
          <span className="inline-flex items-center text-status-warn font-medium gap-0.5" title="在 .env.local 中配置 API Key 即可启用">
            <AlertCircle className="w-3 h-3 shrink-0" /> AI 未开启
          </span>
        )}
      </div>
    </div>
  );
}
