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

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-ink-muted bg-white border border-warm-border rounded-full px-3 py-1 shadow-2xs">
      <div className="flex items-center gap-1.5">
        <Database className="w-3.5 h-3.5 text-sage-600" />
        <span>
          引擎:{' '}
          <span className="font-bold text-ink-text">
            {info.storeType === 'supabase' ? 'Supabase 云端数据库' : '本地极速实时引擎'}
          </span>
        </span>
      </div>
      <span className="text-warm-border">|</span>
      <div className="flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-terracotta-500" />
        <span>AI: </span>
        {info.aiConfigured ? (
          <span className="inline-flex items-center text-status-ok font-bold gap-0.5">
            <CheckCircle2 className="w-3 h-3" /> 就绪 ({info.aiModel || 'Gemini 3.8'})
          </span>
        ) : (
          <span className="inline-flex items-center text-status-warn font-medium gap-0.5" title="在 .env.local 中配置 API Key 即可启用">
            <AlertCircle className="w-3 h-3" /> 未配置 (核心游戏可完整畅玩)
          </span>
        )}
      </div>
    </div>
  );
}
