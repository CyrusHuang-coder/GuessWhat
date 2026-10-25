import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudioWithAI } from '@/lib/ai/gemini';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const token = req.headers.get('x-player-token') || '';
    if (!token) {
      return NextResponse.json({ success: false, error: '缺少身份凭证' }, { status: 401 });
    }

    const body = await req.json();
    const { audio, mimeType } = body;
    if (!audio) {
      return NextResponse.json({ success: false, error: '缺少音频数据' }, { status: 400 });
    }

    const text = await transcribeAudioWithAI(audio, mimeType || 'audio/mp4');
    return NextResponse.json({ success: true, text });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || '语音转文字失败' }, { status: 400 });
  }
}
