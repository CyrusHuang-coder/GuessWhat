import { NextRequest, NextResponse } from 'next/server';
import { getRoomStore } from '@/lib/store';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const token = req.headers.get('x-player-token') || '';
    if (!token) {
      return NextResponse.json({ success: false, error: '缺少身份凭证 (token)' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const store = getRoomStore();
    const room = await store.addBotToRoom(code, token, {
      theme: body.theme,
      difficulty: body.difficulty,
    });

    return NextResponse.json({ success: true, room });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || '召唤 AI 陪练失败' }, { status: 400 });
  }
}
