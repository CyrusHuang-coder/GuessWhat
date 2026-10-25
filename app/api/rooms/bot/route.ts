import { NextRequest, NextResponse } from 'next/server';
import { getRoomStore } from '@/lib/store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const nickname = body.nickname || '侦探玩家';
    const theme = body.theme || '日常物品';
    const difficulty = body.difficulty || 'easy';

    const store = getRoomStore();
    const result = await store.createBotRoom(nickname, { theme, difficulty });

    return NextResponse.json({
      success: true,
      roomCode: result.room.code,
      playerToken: result.playerToken,
      room: result.room,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
