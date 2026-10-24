import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  evaluateOffTrackWarning,
  generateQuestionRecommendations,
  generateStageHint,
  isAIConfigured,
} from '../lib/ai/gemini';
import { MemoryRoomStore } from '../lib/store/memoryStore';

describe('AI 辅助与额度隔离测试', () => {
  const originalEnv = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.GEMINI_API_KEY = originalEnv;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
  });

  it('未配置 GEMINI_API_KEY 时检测准确且优雅降级', async () => {
    expect(isAIConfigured()).toBe(false);

    // 主动推荐调用抛出明确的缺失 Key 异常，而不是伪造数据
    await expect(
      generateQuestionRecommendations({
        theme: '水果',
        difficulty: 'medium',
        questions: [],
      })
    ).rejects.toThrow('MISSING_API_KEY');

    await expect(
      generateStageHint({
        theme: '水果',
        difficulty: 'medium',
        questions: [],
      })
    ).rejects.toThrow('MISSING_API_KEY');

    // 偏航预警在无 Key 时平稳降级为 insufficient_info，绝不中断对局
    const otResult = await evaluateOffTrackWarning({
      theme: '水果',
      difficulty: 'medium',
      questions: [],
    });
    expect(otResult.status).toBe('insufficient_info');
    expect(otResult.rationale).toContain('未配置');
  });

  it('AI 辅助额度与难度绑定规则及原子消耗测试', async () => {
    const store = new MemoryRoomStore();
    const { room, playerToken: hostToken } = await store.createRoom('出题人');
    const { playerToken: guestToken } = await store.joinRoom(room.code, '猜词人');

    // 1. 简单难度：额度应为 3
    await store.saveSettings(room.code, guestToken, {
      theme: '动物',
      difficulty: 'easy',
      mode: 'normal',
    });
    let state = await store.getRoomState(room.code, guestToken);
    expect(state?.session?.ai_quota_total).toBe(3);
    expect(state?.session?.ai_quota_used).toBe(0);

    // 消耗 1 次
    let used = await store.useAIQuota(room.code, guestToken);
    expect(used).toBe(true);

    // 消耗第 2 次
    used = await store.useAIQuota(room.code, guestToken);
    expect(used).toBe(true);

    // 消耗第 3 次 (耗尽)
    used = await store.useAIQuota(room.code, guestToken);
    expect(used).toBe(true);

    // 第 4 次尝试消耗 -> 拒绝
    used = await store.useAIQuota(room.code, guestToken);
    expect(used).toBe(false);

    state = await store.getRoomState(room.code, guestToken);
    expect(state?.session?.ai_quota_used).toBe(3);
  });

  it('思路偏航预警不消耗主动 AI 额度', async () => {
    const store = new MemoryRoomStore();
    const { room, playerToken: hostToken } = await store.createRoom('出题人');
    const { playerToken: guestToken } = await store.joinRoom(room.code, '猜词人');

    await store.saveSettings(room.code, guestToken, {
      theme: '食物',
      difficulty: 'hard', // 困难难度 1 次
      mode: 'normal',
    });
    await store.setWord(room.code, hostToken, { word: '烤鸭' });

    // 开启偏航预警
    await store.toggleOffTrack(room.code, guestToken, true);

    // 保存一条偏航预警评估记录
    await store.saveOffTrackEvaluation(room.code, {
      sessionId: (await store.getRoomState(room.code))!.session!.id,
      questionTriggerCount: 4,
      status: 'effective',
      rationale: '提问维度推进合理',
    });

    const state = await store.getRoomState(room.code, guestToken);
    // 验证主动 AI 额度依然为 0，完全没有被消耗
    expect(state?.session?.ai_quota_used).toBe(0);
    expect(state?.session?.ai_quota_total).toBe(1);
    expect(state?.offTrackEvaluations).toHaveLength(1);
  });
});

