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

    if (!body?.text || !body.text.trim()) {
      return NextResponse.json({ success: false, error: '消息内容不能为空' }, { status: 400 });
    }

    const store = getRoomStore();
    const message = await store.sendChatMessage(code, token, body.text);

    return NextResponse.json({ success: true, message });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

