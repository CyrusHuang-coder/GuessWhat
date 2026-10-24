import { NextRequest, NextResponse } from 'next/server';
import { getRoomStore } from '@/lib/store';
import { generateWordCandidates, isAIConfigured } from '@/lib/ai/gemini';
import { getRandomWordsByFilter } from '@/lib/data/wordBank';

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

    if (state.myRole !== 'question_master') {
      return NextResponse.json(
        { success: false, error: '只有出题人可以获取灵感推荐词条' },
        { status: 403 }
      );
    }

    const theme = state.session.theme || '日常物品';
    const difficulty = state.session.difficulty;

    // 1. 如果配置了 AI，尝试让 AI 动态实时生成
    if (isAIConfigured()) {
      try {
        const aiWords = await generateWordCandidates({
          theme,
          difficulty,
          count: 9,
        });

        if (aiWords && aiWords.length > 0) {
          return NextResponse.json({
            success: true,
            isAI: true,
            words: aiWords.map((item, idx) => ({
              id: `ai-${Date.now()}-${idx}`,
              name: item.name,
              theme,
              difficulty: item.difficulty,
              note: item.note,
            })),
          });
        }
      } catch (err: any) {
        console.warn('AI word generation failed, falling back to local word bank:', err.message);
      }
    }

    // 2. 降级回退：从扩充后的本地词库中随机乱序抽取 9 个
    const fallback = getRandomWordsByFilter(theme, difficulty, 9);
    return NextResponse.json({
      success: true,
      isAI: false,
      words: fallback,
      message: '当前由精选词库随机刷新',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || '获取推荐词条失败' },
      { status: 500 }
    );
  }
}

