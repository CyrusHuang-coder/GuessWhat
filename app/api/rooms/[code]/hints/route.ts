import { NextRequest, NextResponse } from 'next/server';
import { getRoomStore } from '@/lib/store';
import { generateHintForMaster } from '@/lib/ai/gemini';
import { HintCost } from '@/lib/types/game';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const token = req.headers.get('x-player-token') || '';
    if (!token) {
      return NextResponse.json({ success: false, error: '缺少玩家凭证 (token)' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const store = getRoomStore();

    // 1. 猜词人申请线索提示 (价值 1、3、5 次提问)
    if (action === 'request') {
      const cost = Number(body.cost) as HintCost;
      if (![1, 3, 5].includes(cost)) {
        return NextResponse.json(
          { success: false, error: '提示价值仅支持 1、3、5 个问题梯度' },
          { status: 400 }
        );
      }

      let hint = await store.requestHint(code, token, cost);

      // 人机对战局：若出题人是 AI Bot，自动生成符合价值梯度的线索并答复
      const state = await store.getRoomState(code, token);
      if (state?.session && state.session.question_master_id === 'bot_player') {
        const secretWord = await store.getSecretWordForBot(code);
        if (secretWord) {
          let hintText = `这是一条关于【${state.session.theme || '词条'}】的线索。`;
          try {
            const aiRes = await generateHintForMaster({
              secretWord,
              theme: state.session.theme || '日常物品',
              cost,
            });
            hintText = aiRes.hintText;
          } catch (e) {
            hintText = `该词条属于【${state.session.secret_word_category || '常见类别'}】，请从更具体的使用场景与物理特征思考。`;
          }
          const result = await store.provideHint(code, 'bot_player', hint.id, hintText);
          hint = result.hint;
        }
      }

      return NextResponse.json({ success: true, hint });
    }

    // 2. 出题人回复/提供线索
    if (action === 'provide') {
      const { hintId, hintText } = body;
      if (!hintId || !hintText?.trim()) {
        return NextResponse.json(
          { success: false, error: '提示 ID 与线索内容不能为空' },
          { status: 400 }
        );
      }

      const result = await store.provideHint(code, token, hintId, hintText);
      return NextResponse.json({ success: true, hint: result.hint, session: result.session });
    }

    // 3. 婉拒或取消线索申请
    if (action === 'reject') {
      const { hintId } = body;
      if (!hintId) {
        return NextResponse.json({ success: false, error: '缺少提示 ID' }, { status: 400 });
      }

      const hint = await store.rejectHint(code, token, hintId);
      return NextResponse.json({ success: true, hint });
    }

    // 4. 出题人向 AI 咨询生成符合该价值梯度的线索草稿
    if (action === 'ai_suggest') {
      const cost = Number(body.cost) as HintCost;
      if (![1, 3, 5].includes(cost)) {
        return NextResponse.json(
          { success: false, error: '提示价值仅支持 1、3、5 个问题梯度' },
          { status: 400 }
        );
      }

      // 获取出题人真实的 secret_word 进行服务端 AI 生成，绝不向客户端暴露其他字段
      const state = await store.getRoomState(code, token);
      if (!state || !state.session) {
        return NextResponse.json({ success: false, error: '未找到对局' }, { status: 404 });
      }
      if (state.myRole !== 'question_master') {
        return NextResponse.json({ success: false, error: '只有出题人可以使用线索构思顾问' }, { status: 403 });
      }
      if (!state.session.secret_word) {
        return NextResponse.json({ success: false, error: '秘密词条尚未设定' }, { status: 400 });
      }

      const answeredQuestions = (state.questions || [])
        .filter((q) => q.status === 'answered' && q.answer)
        .map((q) => {
          const answerMap = { yes: '是', no: '不是', uncertain: '不确定' };
          return {
            question: q.revised_text || q.original_text,
            answer: answerMap[q.answer as keyof typeof answerMap] || q.answer!,
          };
        });

      const suggestion = await generateHintForMaster({
        secretWord: state.session.secret_word,
        theme: state.session.theme || '未知主题',
        cost,
        previousQuestions: answeredQuestions,
      });

      return NextResponse.json({
        success: true,
        suggestion: typeof suggestion === 'string' ? suggestion : suggestion.hintText,
      });
    }

    return NextResponse.json({ success: false, error: '未知操作类型' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

