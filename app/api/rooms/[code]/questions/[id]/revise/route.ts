import { NextRequest, NextResponse } from 'next/server';
import { getRoomStore } from '@/lib/store';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string; id: string }> }
) {
  try {
    const { code, id } = await context.params;
    const token = req.headers.get('x-player-token') || '';
    const body = await req.json();

    const store = getRoomStore();
    const question = await store.reviseQuestion(code, token, id, body.revisedText);

    return NextResponse.json({ success: true, question });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

