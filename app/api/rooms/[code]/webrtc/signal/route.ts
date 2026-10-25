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

    if (!body?.type || !body?.payload) {
      return NextResponse.json({ success: false, error: '缺少有效信令参数' }, { status: 400 });
    }

    const store = getRoomStore();
    const signal = await store.sendWebRTCSignal(code, token, {
      type: body.type,
      payload: body.payload,
    });

    return NextResponse.json({ success: true, signal });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const token = req.headers.get('x-player-token') || req.nextUrl.searchParams.get('token') || '';
    const since = req.nextUrl.searchParams.get('since') || undefined;

    const store = getRoomStore();
    const signals = await store.getWebRTCSignals(code, token, since);

    return NextResponse.json({ success: true, signals });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

