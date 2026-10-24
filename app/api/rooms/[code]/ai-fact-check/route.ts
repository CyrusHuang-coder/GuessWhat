import { NextRequest, NextResponse } from 'next/server';
import { getRoomStore } from '@/lib/store';
import { verifyQuestionFact, isAIConfigured } from '@/lib/ai/gemini';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const token = req.headers.get('x-player-token') || '';
    const body = await req.json().catch(() => ({}));

    const store = getRoomStore();
    const state = await store.getRoomState(code, token);
    if (!state?.session) {
      return NextResponse.json({ success: false, error: '对局未开始' }, { status: 400 });
    }

    if (state.myRole !== 'question_master') {
      return NextResponse.json(
        { success: false, error: '只有出题人可以使用知识查证功能' },
        { status: 403 }
      );
    }

    if (!isAIConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'AI_NOT_CONFIGURED',
          message: '未配置大模型 API Key，请在 .env.local 中配置后即可启用 AI 知识百科查证。',
        },
        { status: 503 }
      );
    }

    const secretWord = state.session.secret_word;
    if (!secretWord) {
      return NextResponse.json(
        { success: false, error: '秘密词条尚未设定' },
        { status: 400 }
      );
    }

    // 查询文本：可以传入特定文本，或者默认使用当前待回答的问题
    let questionText = body.questionText;
    if (!questionText) {
      const pendingQ = state.questions.find(
        (q) => q.status === 'pending' || q.status === 'revised'
      );
      if (pendingQ) {
        questionText = pendingQ.revised_text || pendingQ.original_text;
      }
    }

    if (!questionText || !questionText.trim()) {
      return NextResponse.json(
        { success: false, error: '没有需要查证的问题内容' },
        { status: 400 }
      );
    }

    const result = await verifyQuestionFact({
      secretWord,
      theme: state.session.theme || '未知',
      questionText: questionText.trim(),
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'AI 知识查证失败' },
      { status: 500 }
    );
  }
}

