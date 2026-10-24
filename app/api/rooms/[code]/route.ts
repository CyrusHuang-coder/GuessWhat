import { NextRequest, NextResponse } from 'next/server';
import { getRoomStore } from '@/lib/store';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const token =
      req.headers.get('x-player-token') || req.nextUrl.searchParams.get('token') || '';

    const store = getRoomStore();
    const state = await store.getRoomState(code, token);

    if (!state) {
      return NextResponse.json({ success: false, error: '房间不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: state });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

