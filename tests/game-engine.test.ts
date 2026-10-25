import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRoomStore } from '../lib/store/memoryStore';

describe('游戏状态机与规则核心流程测试', () => {
  let store: MemoryRoomStore;

  beforeEach(() => {
    store = new MemoryRoomStore();
  });

  it('完整走完：创建房间 -> 加入 -> 猜词人设置 -> 出题人选词 -> 问答 -> 猜中结算', async () => {
    // 1. 房主创房 (出题人)
    const { room, playerToken: hostToken } = await store.createRoom('出题房主');
    expect(room.code).toHaveLength(6);
    expect(room.status).toBe('waiting_player');

    // 2. 玩家加入 (猜词人)
    const { room: joinedRoom, playerToken: guestToken } = await store.joinRoom(
      room.code,
      '猜词玩家'
    );
    expect(joinedRoom.status).toBe('in_game');
    expect(joinedRoom.guest_nickname).toBe('猜词玩家');

    // 3. 猜词人提交游戏设置 (动物, 普通难度, 普通模式)
    const session = await store.saveSettings(room.code, guestToken, {
      theme: '动物',
      difficulty: 'medium',
      mode: 'normal',
    });
    expect(session.status).toBe('word_selection');
    expect(session.theme).toBe('动物');
    expect(session.ai_quota_total).toBe(2); // 普通难度 2 次

    // 4. 出题人设置秘密答案
    const playingSession = await store.setWord(room.code, hostToken, {
      word: '海豚',
      category: '动物',
      note: '高智商海洋哺乳动物',
    });
    expect(playingSession.status).toBe('playing');
    expect(playingSession.secret_word).toBe('海豚');

    // 5. 猜词人提问
    const q1 = await store.submitQuestion(room.code, guestToken, '它是生活在水里的吗？');
    expect(q1.question_number).toBe(1);
    expect(q1.status).toBe('pending');

    // 6. 出题人正式回答【是】
    const answeredQ1 = await store.answerQuestion(room.code, hostToken, q1.id, 'yes');
    expect(answeredQ1.status).toBe('answered');
    expect(answeredQ1.answer).toBe('yes');

    // 7. 猜词人再次提问
    const q2 = await store.submitQuestion(room.code, guestToken, '它是鱼类吗？');
    const answeredQ2 = await store.answerQuestion(room.code, hostToken, q2.id, 'no');
    expect(answeredQ2.answer).toBe('no');

    // 8. 猜词人正式猜错
    const g1 = await store.submitGuess(room.code, guestToken, '蓝鲸');
    const adjG1 = await store.adjudicateGuess(room.code, hostToken, g1.id, 'incorrect');
    expect(adjG1.guess.status).toBe('incorrect');
    expect(adjG1.session.wrong_guesses_count).toBe(1);
    expect(adjG1.session.status).toBe('playing'); // 游戏继续，未结算

    // 9. 猜词人猜中
    const g2 = await store.submitGuess(room.code, guestToken, '海豚');
    const adjG2 = await store.adjudicateGuess(room.code, hostToken, g2.id, 'correct');
    expect(adjG2.guess.status).toBe('correct');
    expect(adjG2.session.status).toBe('settled');
    expect(adjG2.session.result).toBe('guessed');
  });

  it('挑战模式：提问额度耗尽后禁止提问，但仍允许发起正式猜词', async () => {
    const { room, playerToken: hostToken } = await store.createRoom('出题人');
    const { playerToken: guestToken } = await store.joinRoom(room.code, '挑战者');

    // 设置挑战模式，上限为 2 次
    await store.saveSettings(room.code, guestToken, {
      theme: '水果',
      difficulty: 'hard',
      mode: 'challenge',
      maxQuestions: 2,
    });

    await store.setWord(room.code, hostToken, { word: '红毛丹' });

    // 第 1 问
    const q1 = await store.submitQuestion(room.code, guestToken, '它是红色的吗？');
    await store.answerQuestion(room.code, hostToken, q1.id, 'yes');

    // 第 2 问 (已达上限 2 次)
    const q2 = await store.submitQuestion(room.code, guestToken, '它长毛吗？');
    await store.answerQuestion(room.code, hostToken, q2.id, 'yes');

    // 尝试第 3 问 -> 应该抛出额度耗尽异常
    await expect(
      store.submitQuestion(room.code, guestToken, '它很贵吗？')
    ).rejects.toThrow('挑战模式有效提问额度已耗尽');

    // 验证：额度耗尽后依然允许发起正式猜词！
    const guess = await store.submitGuess(room.code, guestToken, '红毛丹');
    expect(guess.status).toBe('pending');
    expect(guess.guess_text).toBe('红毛丹');

    const result = await store.adjudicateGuess(room.code, hostToken, guess.id, 'correct');
    expect(result.session.status).toBe('settled');
    expect(result.session.result).toBe('guessed');
  });

  it('问题澄清生命周期测试：澄清不扣次数，仅限1次，修改后正式回答计入1次', async () => {
    const { room, playerToken: hostToken } = await store.createRoom('出题人');
    const { playerToken: guestToken } = await store.joinRoom(room.code, '猜词人');

    await store.saveSettings(room.code, guestToken, {
      theme: '食物',
      difficulty: 'medium',
      mode: 'challenge',
      maxQuestions: 5,
    });
    await store.setWord(room.code, hostToken, { word: '螺蛳粉' });

    // 猜词人提交模糊问题
    const q = await store.submitQuestion(room.code, guestToken, '它好吃吗？');

    // 出题人请求澄清
    const clarifiedQ = await store.clarifyQuestion(
      room.code,
      hostToken,
      q.id,
      '缺少客观判断标准，口味因人而异'
    );
    expect(clarifiedQ.status).toBe('clarification_requested');
    expect(clarifiedQ.clarification_count).toBe(1);

    // 检查此时已完成问答数依然为 0
    let state = await store.getRoomState(room.code, guestToken);
    expect(state?.session?.completed_questions_count).toBe(0);

    // 再次尝试对同一问题请求澄清应被拒绝（严格限制1次）
    await expect(
      store.clarifyQuestion(room.code, hostToken, q.id, '再次澄清')
    ).rejects.toThrow();

    // 猜词人修改问题
    const revisedQ = await store.reviseQuestion(
      room.code,
      guestToken,
      q.id,
      '它闻起来有强烈的发酵酸臭味吗？'
    );
    expect(revisedQ.status).toBe('revised');
    expect(revisedQ.revised_text).toBe('它闻起来有强烈的发酵酸臭味吗？');

    // 出题人正式回答【是】
    const finalAnswered = await store.answerQuestion(room.code, hostToken, q.id, 'yes');
    expect(finalAnswered.status).toBe('answered');
    expect(finalAnswered.answer).toBe('yes');

    // 验证：最终正式回答后，已完成问答数只增加 1
    state = await store.getRoomState(room.code, guestToken);
    expect(state?.session?.completed_questions_count).toBe(1);
  });

  it('角色轮换与多轮对局测试', async () => {
    const { room, playerToken: hostToken } = await store.createRoom('张三');
    const { playerToken: guestToken } = await store.joinRoom(room.code, '李四');

    // 第 1 局：张三出题，李四猜词
    await store.saveSettings(room.code, guestToken, {
      theme: '水果',
      difficulty: 'easy',
      mode: 'normal',
    });
    await store.setWord(room.code, hostToken, { word: '苹果' });
    const g = await store.submitGuess(room.code, guestToken, '苹果');
    await store.adjudicateGuess(room.code, hostToken, g.id, 'correct');

    // 交换角色开启第 2 局
    await store.nextRoundAction(room.code, hostToken, 'swap_roles');

    const stateRound2 = await store.getRoomState(room.code, hostToken);
    expect(stateRound2?.session?.round_number).toBe(2);
    // 此时出题人变为李四 (guestToken)，猜词人变为张三 (hostToken)
    expect(stateRound2?.session?.question_master_id).toBe(guestToken);
    expect(stateRound2?.session?.guesser_id).toBe(hostToken);
    expect(stateRound2?.myRole).toBe('guesser'); // 张三此时是猜词人
  });

  it('提示线索交易机制：猜词人申请价值1、3、5个问题的提示，出题人提供后提问次数正确累加', async () => {
    const { room, playerToken: hostToken } = await store.createRoom('出题人');
    const { playerToken: guestToken } = await store.joinRoom(room.code, '猜词人');

    await store.saveSettings(room.code, guestToken, {
      theme: '生物',
      difficulty: 'medium',
      mode: 'normal',
    });
    await store.setWord(room.code, hostToken, { word: '水熊虫' });

    // 初始问答数 0
    let state = await store.getRoomState(room.code, guestToken);
    expect(state?.session?.completed_questions_count).toBe(0);

    // 1. 猜词人申请价值 3 次提问的提示
    const hintReq = await store.requestHint(room.code, guestToken, 3);
    expect(hintReq.status).toBe('pending');
    expect(hintReq.cost).toBe(3);

    // 2. 出题人提供相应线索
    const { hint: providedHint, session } = await store.provideHint(
      room.code,
      hostToken,
      hintReq.id,
      '它属于缓步动物门，具有极强的隐生耐寒能力'
    );
    expect(providedHint.status).toBe('provided');
    expect(providedHint.hint_text).toContain('缓步动物门');

    // 验证：有效问答计数自动累加 3 次！
    expect(session.completed_questions_count).toBe(3);

    // 再次从状态获取验证
    state = await store.getRoomState(room.code, guestToken);
    expect(state?.session?.completed_questions_count).toBe(3);
    expect(state?.hints).toHaveLength(1);
    expect(state?.hints[0].status).toBe('provided');

    // 3. 猜词人再申请价值 1 次提问的提示
    const hintReq2 = await store.requestHint(room.code, guestToken, 1);
    const { session: session2 } = await store.provideHint(
      room.code,
      hostToken,
      hintReq2.id,
      '体型微小，肉眼几乎不可见'
    );
    // 3 + 1 = 4
    expect(session2.completed_questions_count).toBe(4);
  });

  it('提示线索交易在挑战模式下的余额约束与拒绝机制', async () => {
    const { room, playerToken: hostToken } = await store.createRoom('出题人');
    const { playerToken: guestToken } = await store.joinRoom(room.code, '挑战者');

    // 挑战模式，最大 3 次提问
    await store.saveSettings(room.code, guestToken, {
      theme: '植物',
      difficulty: 'hard',
      mode: 'challenge',
      maxQuestions: 3,
    });
    await store.setWord(room.code, hostToken, { word: '捕蝇草' });

    // 尝试申请价值 5 个问题的线索 -> 剩余 3 < 5，应抛出异常
    await expect(store.requestHint(room.code, guestToken, 5)).rejects.toThrow(
      '不足以支付价值 5 次的线索'
    );

    // 申请价值 3 次的线索 -> 允许
    const hint = await store.requestHint(room.code, guestToken, 3);
    expect(hint.status).toBe('pending');

    // 出题人婉拒该申请
    const rejectedHint = await store.rejectHint(room.code, hostToken, hint.id);
    expect(rejectedHint.status).toBe('rejected');

    // 验证：婉拒后不累加提问次数
    const state = await store.getRoomState(room.code, guestToken);
    expect(state?.session?.completed_questions_count).toBe(0);
  });

  it('同一房间连续多局测试：交换角色开启新一轮，历史对局与大比分累积，复活已结束房间', async () => {
    const { room, playerToken: hostToken } = await store.createRoom('玩家A');
    const { playerToken: guestToken } = await store.joinRoom(room.code, '玩家B');

    // 第 1 局
    await store.saveSettings(room.code, guestToken, { theme: '科技', difficulty: 'easy', mode: 'normal' });
    await store.setWord(room.code, hostToken, { word: '智能手机' });
    const g1 = await store.submitGuess(room.code, guestToken, '智能手机');
    await store.adjudicateGuess(room.code, hostToken, g1.id, 'correct');

    let state = await store.getRoomState(room.code, hostToken);
    expect(state?.session?.status).toBe('settled');
    expect(state?.session?.round_number).toBe(1);
    expect(state?.matchHistory).toHaveLength(1);

    // 交换角色进入第 2 局 (不建新房，不换链接)
    await store.nextRoundAction(room.code, hostToken, 'swap_roles');

    state = await store.getRoomState(room.code, hostToken);
    expect(state?.room.status).toBe('in_game');
    expect(state?.session?.round_number).toBe(2);
    expect(state?.session?.status).toBe('setting_selection');
    // 角色互换：此时 玩家A (hostToken) 变成了猜词人，玩家B (guestToken) 变成了出题人
    expect(state?.session?.guesser_id).toBe(hostToken);
    expect(state?.session?.question_master_id).toBe(guestToken);

    // 玩家A作为猜词人提交设置
    await store.saveSettings(room.code, hostToken, { theme: '历史', difficulty: 'easy', mode: 'normal' });
    await store.setWord(room.code, guestToken, { word: '秦始皇' });
    const g2 = await store.submitGuess(room.code, hostToken, '汉武帝');
    await store.adjudicateGuess(room.code, guestToken, g2.id, 'incorrect');
    await store.surrender(room.code, hostToken);

    state = await store.getRoomState(room.code, hostToken);
    expect(state?.matchHistory).toHaveLength(2);

    // 结束游戏
    await store.nextRoundAction(room.code, hostToken, 'end_game');
    state = await store.getRoomState(room.code, hostToken);
    expect(state?.room.status).toBe('ended');

    // 复活房间继续游戏
    await store.nextRoundAction(room.code, hostToken, 'restart_game');
    state = await store.getRoomState(room.code, hostToken);
    expect(state?.room.status).toBe('in_game');
    expect(state?.session?.round_number).toBe(3);
  });

  it('主题反悔机制测试：出题人选词阶段允许猜词人撤回重设，非猜词人或已开局阶段禁止撤回', async () => {
    const { room, playerToken: hostToken } = await store.createRoom('出题人');
    const { playerToken: guestToken } = await store.joinRoom(room.code, '猜词人');

    // 猜词人提交初始主题
    await store.saveSettings(room.code, guestToken, {
      theme: '水果',
      difficulty: 'easy',
      mode: 'normal',
    });

    let state = await store.getRoomState(room.code, guestToken);
    expect(state?.session?.status).toBe('word_selection');
    expect(state?.session?.theme).toBe('水果');

    // 非猜词人（出题人）尝试撤回 -> 应被拒绝
    await expect(store.revertToSettingSelection(room.code, hostToken)).rejects.toThrow(
      '只有猜词人可以重新选择主题'
    );

    // 猜词人主动反悔撤回 -> 成功回退至 setting_selection
    const revertedSession = await store.revertToSettingSelection(room.code, guestToken);
    expect(revertedSession.status).toBe('setting_selection');
    expect(revertedSession.theme).toBeNull();

    // 再次拉取验证
    state = await store.getRoomState(room.code, hostToken);
    expect(state?.session?.status).toBe('setting_selection');

    // 猜词人重新提交新主题
    await store.saveSettings(room.code, guestToken, {
      theme: '职业',
      difficulty: 'medium',
      mode: 'normal',
    });
    state = await store.getRoomState(room.code, guestToken);
    expect(state?.session?.status).toBe('word_selection');
    expect(state?.session?.theme).toBe('职业');

    // 出题人设定词条，进入正式 playing 阶段
    await store.setWord(room.code, hostToken, { word: '调香师' });
    state = await store.getRoomState(room.code, guestToken);
    expect(state?.session?.status).toBe('playing');

    // 已进入正式阶段后，撤回操作应被拦截
    await expect(store.revertToSettingSelection(room.code, guestToken)).rejects.toThrow(
      '无法直接回退'
    );
  });

  it('对局准备阶段双方调换角色（互换攻守）测试', async () => {
    const { room, playerToken: hostToken } = await store.createRoom('房主小王');
    const { playerToken: guestToken } = await store.joinRoom(room.code, '好友小李');

    let stateHost = await store.getRoomState(room.code, hostToken);
    let stateGuest = await store.getRoomState(room.code, guestToken);

    // 默认：房主是出题人，好友是猜词人
    expect(stateHost?.myRole).toBe('question_master');
    expect(stateGuest?.myRole).toBe('guesser');

    // 好友小李发起调换角色（想出题）
    const swapped = await store.swapInitialRoles(room.code, guestToken);
    expect(swapped.question_master_id).toBe(guestToken);
    expect(swapped.guesser_id).toBe(hostToken);

    // 重新拉取状态校验
    stateHost = await store.getRoomState(room.code, hostToken);
    stateGuest = await store.getRoomState(room.code, guestToken);
    expect(stateHost?.myRole).toBe('guesser');
    expect(stateGuest?.myRole).toBe('question_master');

    // 房主小王再次点击互换（换回来）
    await store.swapInitialRoles(room.code, hostToken);
    stateHost = await store.getRoomState(room.code, hostToken);
    stateGuest = await store.getRoomState(room.code, guestToken);
    expect(stateHost?.myRole).toBe('question_master');
    expect(stateGuest?.myRole).toBe('guesser');
  });
});

