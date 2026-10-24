import { NextRequest, NextResponse } from 'next/server';
import { getRoomStore } from '@/lib/store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const hostNickname = body.hostNickname || '出题房主';
    const store = getRoomStore();
    const result = await store.createRoom(hostNickname);

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

