type Listener = (payload: { type: string; timestamp: number }) => void;

class RealtimeBroadcaster {
  private channels: Map<string, Set<Listener>> = new Map();

  subscribe(roomCode: string, listener: Listener): () => void {
    const code = roomCode.toUpperCase();
    if (!this.channels.has(code)) {
      this.channels.set(code, new Set());
    }
    const channel = this.channels.get(code)!;
    channel.add(listener);

    return () => {
      channel.delete(listener);
      if (channel.size === 0) {
        this.channels.delete(code);
      }
    };
  }

  notify(roomCode: string, type: string = 'STATE_UPDATE'): void {
    const code = roomCode.toUpperCase();
    const channel = this.channels.get(code);
    if (!channel || channel.size === 0) return;

    const payload = {
      type,
      timestamp: Date.now(),
    };

    channel.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.error('Error notifying realtime listener:', err);
      }
    });
  }

  getSubscriberCount(roomCode: string): number {
    return this.channels.get(roomCode.toUpperCase())?.size ?? 0;
  }
}

// 单例保存在 globalThis 防止 Next.js 开发模式热重载时丢失订阅者映射
const globalForBroadcaster = globalThis as unknown as {
  realtimeBroadcaster?: RealtimeBroadcaster;
};

export const realtimeBroadcaster =
  globalForBroadcaster.realtimeBroadcaster ?? new RealtimeBroadcaster();

if (process.env.NODE_ENV !== 'production') {
  globalForBroadcaster.realtimeBroadcaster = realtimeBroadcaster;
}

