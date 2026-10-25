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
    const reclaimRole = body.reclaimRole as ('host' | 'guest' | undefined);
    const playerToken = req.headers.get('x-player-token') || body.playerToken;

    const store = getRoomStore();
    const result = await store.joinRoom(code, guestNickname, { reclaimRole, playerToken });

    return NextResponse.json({
      success: true,
      playerToken: result.playerToken,
      room: result.room,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message,
        isFull: !!err.isFull,
        canReclaim: !!err.canReclaim,
        hostNickname: err.hostNickname,
        guestNickname: err.guestNickname,
      },
      { status: err.canReclaim ? 409 : 400 }
    );
  }
}

