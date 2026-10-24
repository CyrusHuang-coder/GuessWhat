import { NextRequest, NextResponse } from 'next/server';
import { getRoomStore } from '@/lib/store';
import { evaluateOffTrackWarning, isAIConfigured } from '@/lib/ai/gemini';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string; id: string }> }
) {
  try {
    const { code, id } = await context.params;
    const token = req.headers.get('x-player-token') || '';
    const body = await req.json();

    const store = getRoomStore();
    const question = await store.answerQuestion(code, token, id, body.answer);

    // 触发思路偏航预警评估检查 (若开启偏航预警，且已完成问答数为 4, 7, 10, 13...)
    const state = await store.getRoomState(code, token);
    if (state?.session && state.session.off_track_enabled) {
      const count = state.session.completed_questions_count;
      const isTriggerPoint = count >= 4 && (count === 4 || (count - 4) % 3 === 0);

      if (isTriggerPoint) {
        // 异步执行偏航预警评估，避免阻塞回答响应
        (async () => {
          try {
            const evalResult = await evaluateOffTrackWarning({
              theme: state.session?.theme || '未知',
              difficulty: state.session?.difficulty || 'medium',
              questions: state.questions,
            });
            await store.saveOffTrackEvaluation(code, {
              sessionId: state.session!.id,
              questionTriggerCount: count,
              status: evalResult.status,
              rationale: evalResult.rationale,
            });
          } catch (err) {
            console.error('Off-track background evaluation failed:', err);
          }
        })();
      }
    }

    return NextResponse.json({ success: true, question });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

