import { NextRequest, NextResponse } from 'next/server';
import { getRoomStore } from '@/lib/store';
import {
  generateQuestionRecommendations,
  generateStageHint,
  isAIConfigured,
} from '@/lib/ai/gemini';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const token = req.headers.get('x-player-token') || '';
    const body = await req.json();
    const type: 'recommend' | 'hint' = body.type || 'recommend';

    if (!isAIConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'AI_NOT_CONFIGURED',
          message:
            '当前环境尚未配置 GEMINI_API_KEY。请在服务端 .env.local 中配置后即可启用 AI 推荐与提示，核心问答不受影响。',
        },
        { status: 503 }
      );
    }

    const store = getRoomStore();
    const state = await store.getRoomState(code, token);
    if (!state?.session) {
      return NextResponse.json({ success: false, error: '对局未开始' }, { status: 400 });
    }
    if (state.myRole !== 'guesser') {
      return NextResponse.json(
        { success: false, error: '只有猜词人可以使用 AI 辅助' },
        { status: 403 }
      );
    }

    // 检查额度
    if (state.session.ai_quota_used >= state.session.ai_quota_total) {
      return NextResponse.json(
        {
          success: false,
          error: 'QUOTA_EXHAUSTED',
          message: `本局 AI 主动辅助额度 (${state.session.ai_quota_total}次) 已耗尽`,
        },
        { status: 400 }
      );
    }

    // 调用 AI (严格不传入秘密答案！)
    let resultData: any = null;
    if (type === 'recommend') {
      resultData = await generateQuestionRecommendations({
        theme: state.session.theme || '未知',
        difficulty: state.session.difficulty,
        questions: state.questions,
      });
    } else {
      resultData = await generateStageHint({
        theme: state.session.theme || '未知',
        difficulty: state.session.difficulty,
        questions: state.questions,
      });
    }

    // AI 调用成功后扣除额度
    await store.useAIQuota(code, token);

    return NextResponse.json({
      success: true,
      type,
      data: resultData,
      quotaUsed: state.session.ai_quota_used + 1,
      quotaTotal: state.session.ai_quota_total,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'AI 辅助调用失败' },
      { status: 500 }
    );
  }
}

