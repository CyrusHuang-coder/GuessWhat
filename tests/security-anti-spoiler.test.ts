import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRoomStore } from '../lib/store/memoryStore';

describe('安全与防剧透权限测试', () => {
  let store: MemoryRoomStore;

  beforeEach(() => {
    store = new MemoryRoomStore();
  });

  it('防剧透核心保证：对局未结算前，猜词人与旁观者绝对无法读取秘密答案', async () => {
    const { room, playerToken: hostToken } = await store.createRoom('出题人');
    const { playerToken: guestToken } = await store.joinRoom(room.code, '猜词人');
    const strangerToken = 'stranger-random-uuid';

    await store.saveSettings(room.code, guestToken, {
      theme: '职业',
      difficulty: 'hard',
      mode: 'normal',
    });

    await store.setWord(room.code, hostToken, {
      word: '古籍修复师',
      note: '需要耐心与特制浆糊',
    });

    // 1. 出题人读取状态：能正常看到秘密答案与注释
    const masterState = await store.getRoomState(room.code, hostToken);
    expect(masterState?.session?.secret_word).toBe('古籍修复师');
    expect(masterState?.session?.secret_word_note).toBe('需要耐心与特制浆糊');

    // 2. 猜词人读取状态：secret_word 与 secret_word_note 必须严格为 null！
    const guesserState = await store.getRoomState(room.code, guestToken);
    expect(guesserState?.session?.secret_word).toBeNull();
    expect(guesserState?.session?.secret_word_note).toBeNull();

    // 3. 陌生人/旁观者读取状态：秘密答案也必须严格为 null！
    const strangerState = await store.getRoomState(room.code, strangerToken);
    expect(strangerState?.session?.secret_word).toBeNull();

    // 4. 正式猜中结算后：猜词人方可读取秘密答案
    const g = await store.submitGuess(room.code, guestToken, '古籍修复师');
    await store.adjudicateGuess(room.code, hostToken, g.id, 'correct');

    const settledState = await store.getRoomState(room.code, guestToken);
    expect(settledState?.session?.status).toBe('settled');
    expect(settledState?.session?.secret_word).toBe('古籍修复师');
  });

  it('严格的角色操作权限控制：越权调用必须被服务端拒绝', async () => {
    const { room, playerToken: hostToken } = await store.createRoom('出题人');
    const { playerToken: guestToken } = await store.joinRoom(room.code, '猜词人');

    // 1. 尝试让出题人设置主题模式（本应由猜词人设置）-> 拒绝
    await expect(
      store.saveSettings(room.code, hostToken, {
        theme: '水果',
        difficulty: 'easy',
        mode: 'normal',
      })
    ).rejects.toThrow('只有猜词人可以设置游戏主题与模式');

    // 猜词人正常设置
    await store.saveSettings(room.code, guestToken, {
      theme: '水果',
      difficulty: 'easy',
      mode: 'normal',
    });

    // 2. 尝试让猜词人设置秘密答案（本应由出题人设置）-> 拒绝
    await expect(
      store.setWord(room.code, guestToken, { word: '西瓜' })
    ).rejects.toThrow('只有出题人可以设定秘密答案');

    // 出题人正常设词
    await store.setWord(room.code, hostToken, { word: '西瓜' });

    // 3. 尝试让出题人提交问题 -> 拒绝
    await expect(
      store.submitQuestion(room.code, hostToken, '它是甜的吗？')
    ).rejects.toThrow('只有猜词人可以提问');

    // 猜词人正常提问
    const q = await store.submitQuestion(room.code, guestToken, '它是甜的吗？');

    // 4. 尝试让猜词人自己回答自己的问题 -> 拒绝
    await expect(
      store.answerQuestion(room.code, guestToken, q.id, 'yes')
    ).rejects.toThrow('只有出题人可以正式回答');

    // 5. 尝试让出题人发起正式猜词 -> 拒绝
    await expect(
      store.submitGuess(room.code, hostToken, '西瓜')
    ).rejects.toThrow('只有猜词人可以发起正式猜词');
  });

  it('房间容量限制：第3名玩家加入必须被拒绝', async () => {
    const { room } = await store.createRoom('房主');
    await store.joinRoom(room.code, '玩家2');

    // 尝试加入第 3 人
    await expect(
      store.joinRoom(room.code, '玩家3')
    ).rejects.toThrow('该房间已有两名玩家参与，无法再加入');
  });
});

