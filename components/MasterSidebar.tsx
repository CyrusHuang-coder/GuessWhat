'use client';

import { GameStateDTO } from '@/lib/types/game';
import { Lock, ShieldCheck, HelpCircle, CheckCircle2, XCircle, AlertCircle, MessageSquare } from 'lucide-react';

interface Props {
  state: GameStateDTO;
}

export function MasterSidebar({ state }: Props) {
  const { session, room } = state;
  if (!session) return null;

  return (
    <aside className="space-y-4">
      {/* 1. 秘密答案卡片 (显著常驻，带权限标签) */}
      <div className="bg-white rounded-game border border-sage-300 p-4 shadow-board space-y-3 bg-gradient-to-b from-sage-50/50 to-white">
        <div className="flex items-center justify-between pb-2 border-b border-sage-200">
          <div className="flex items-center gap-1.5 text-xs font-bold text-sage-800">
            <Lock className="w-4 h-4 text-sage-600" />
            <span>我的秘密词条</span>
          </div>
          <span className="text-[10px] font-bold text-sage-700 bg-sage-100 border border-sage-200 px-2 py-0.5 rounded-full">
            仅你可见 (服务端绝不泄露)
          </span>
        </div>

        <div>
          <div className="text-2xl font-black text-ink-text tracking-wide py-1">
            {session.secret_word}
          </div>
          <div className="flex items-center gap-2 text-xs text-ink-muted mt-1">
            <span>主题: <strong className="text-ink-text">{session.theme}</strong></span>
            <span>•</span>
            <span>难度: <strong className="text-ink-text">{session.difficulty}</strong></span>
          </div>
          {session.secret_word_note && (
            <div className="mt-2 text-xs bg-warm-subtle p-2.5 rounded-game-sm border border-warm-border text-ink-muted">
              <strong>备忘注释：</strong>{session.secret_word_note}
            </div>
          )}
        </div>
      </div>

      {/* 2. 出题人回答与裁定指南 */}
      <div className="bg-white rounded-game border border-warm-border p-4 shadow-board space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-ink-text pb-2 border-b border-warm-border">
          <ShieldCheck className="w-4 h-4 text-sage-600" />
          <span>出题与裁定操作指南</span>
        </div>

        <div className="space-y-2.5 text-xs text-ink-muted leading-relaxed">
          <div className="flex items-start gap-2">
            <span className="font-bold text-status-ok shrink-0">【是】/【不是】：</span>
            <span>当您能根据事实确切判定时，请直接点击。</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-status-warn shrink-0">【不确定】：</span>
            <span>当您不知道确切答案、或属于主观感受无法可靠断定时，请点击「不确定」。它属于正式回答，计入问答次数。</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-terracotta-600 shrink-0">【请求澄清】：</span>
            <span>若问题存在重大歧义（缺少标准、一问多意），可请求猜词人重写。每题限 1 次，澄清中不消耗提问额度。</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-indigo-600 shrink-0">【正式猜词】：</span>
            <span>收到猜词通知后，由您裁定是否完全命中。猜错会增加猜错计数，游戏继续。</span>
          </div>
        </div>
      </div>

      {/* 3. 对局状态小结 */}
      <div className="bg-warm-subtle rounded-game border border-warm-border p-3.5 text-xs text-ink-muted space-y-1.5">
        <div className="font-bold text-ink-text mb-1">对局概览</div>
        <div>房间代码：<strong className="font-mono text-sage-700">{room.code}</strong></div>
        <div>对局轮次：第 {session.round_number} 局</div>
        <div>模式规则：{session.mode === 'challenge' ? `挑战模式 (${session.max_questions}次上限)` : '普通模式 (不设上限)'}</div>
      </div>
    </aside>
  );
}

