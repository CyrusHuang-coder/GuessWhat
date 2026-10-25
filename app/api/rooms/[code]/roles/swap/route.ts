import { NextRequest, NextResponse } from 'next/server';
import { getRoomStore } from '@/lib/store';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const playerToken = req.headers.get('x-player-token') || '';

    const store = getRoomStore();
    const session = await store.swapInitialRoles(code, playerToken);

    return NextResponse.json({ success: true, session });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || '调换角色失败' },
      { status: 400 }
    );
  }
}

