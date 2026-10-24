import { NextRequest, NextResponse } from 'next/server';
import { getRoomStore } from '@/lib/store';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const body = await req.json().catch(() => ({}));
    const guestNickname = body.guestNickname || '猜词伙伴';

    const store = getRoomStore();
    const result = await store.joinRoom(code, guestNickname);

    return NextResponse.json({
      success: true,
      playerToken: result.playerToken,
      room: result.room,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

