import { NextRequest, NextResponse } from 'next/server';
import { getRoomStore } from '@/lib/store';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const token = req.headers.get('x-player-token') || '';
    const body = await req.json();

    const store = getRoomStore();
    let guess = await store.submitGuess(code, token, body.guessText);

    // 人机对战局：若出题人是 AI Bot，自动裁定是否猜中并结算
    const state = await store.getRoomState(code, token);
    if (state?.session && state.session.question_master_id === 'bot_player') {
      const secretWord = await store.getSecretWordForBot(code);
      if (secretWord) {
        const cleanedGuess = (body.guessText || '').trim().toLowerCase();
        const cleanedTarget = secretWord.trim().toLowerCase();
        const isMatch =
          cleanedGuess === cleanedTarget ||
          cleanedTarget.includes(cleanedGuess) ||
          cleanedGuess.includes(cleanedTarget);

        const adjResult = await store.adjudicateGuess(
          code,
          'bot_player',
          guess.id,
          isMatch ? 'correct' : 'incorrect'
        );
        guess = adjResult.guess;
      }
    }

    return NextResponse.json({ success: true, guess });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
