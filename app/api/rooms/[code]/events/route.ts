import { NextRequest } from 'next/server';
import { realtimeBroadcaster } from '@/lib/realtime/broadcaster';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const uppercaseCode = code.toUpperCase();

  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  // 立即发送握手成功消息
  writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'CONNECTED', code: uppercaseCode })}\n\n`));

  // 订阅该房间的广播事件
  const unsubscribe = realtimeBroadcaster.subscribe(uppercaseCode, (payload) => {
    writer.write(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)).catch(() => {});
  });

  // 定时发送心跳保持长连接 (每 15 秒一次)
  const intervalId = setInterval(() => {
    writer.write(encoder.encode(`: ping\n\n`)).catch(() => {
      clearInterval(intervalId);
    });
  }, 15000);

  // 客户端断开连接时清理资源
  req.signal.addEventListener('abort', () => {
    clearInterval(intervalId);
    unsubscribe();
    writer.close().catch(() => {});
  });

  return new Response(responseStream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

