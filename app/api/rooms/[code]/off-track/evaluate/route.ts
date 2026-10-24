import { NextRequest, NextResponse } from 'next/server';
import { getRoomStore } from '@/lib/store';
import { evaluateOffTrackWarning } from '@/lib/ai/gemini';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const token = req.headers.get('x-player-token') || '';

    const store = getRoomStore();
    const state = await store.getRoomState(code, token);
    if (!state?.session) {
      return NextResponse.json({ success: false, error: '对局未开始' }, { status: 400 });
    }

    if (state.myRole !== 'guesser') {
      return NextResponse.json(
        { success: false, error: '只有猜词人可以评估偏航预警' },
        { status: 403 }
      );
    }

    const evalResult = await evaluateOffTrackWarning({
      theme: state.session.theme || '未知',
      difficulty: state.session.difficulty,
      questions: state.questions,
    });

    const saved = await store.saveOffTrackEvaluation(code, {
      sessionId: state.session.id,
      questionTriggerCount: state.session.completed_questions_count,
      status: evalResult.status,
      rationale: evalResult.rationale,
    });

    return NextResponse.json({
      success: true,
      evaluation: saved,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || '偏航评估失败' },
      { status: 500 }
    );
  }
}

