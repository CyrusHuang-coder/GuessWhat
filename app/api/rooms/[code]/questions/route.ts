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
    const body = await req.json();

    const store = getRoomStore();
    let question = await store.submitQuestion(code, token, body.text);

    // 人机对战局：若出题人是 AI Bot，自动调用百科事实裁决，秒级返回【是 / 不是 / 不确定】
    const state = await store.getRoomState(code, token);
    if (state?.session && state.session.question_master_id === 'bot_player') {
      const secretWord = await store.getSecretWordForBot(code);
      if (secretWord) {
        let answer: 'yes' | 'no' | 'uncertain' = 'uncertain';

        if (isAIConfigured()) {
          try {
            const fact = await verifyQuestionFact({
              secretWord,
              theme: state.session.theme || '日常物品',
              questionText: body.text,
            });
            answer = fact.suggestedAnswer;
          } catch (e) {
            // 降级兜底
          }
        }

        question = await store.answerQuestion(code, 'bot_player', question.id, answer);
      }
    }

    return NextResponse.json({ success: true, question });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
