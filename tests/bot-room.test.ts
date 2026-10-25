import { describe, it, expect } from 'vitest';
import { POST as createBotRoomPost } from '../app/api/rooms/bot/route';
import { POST as inviteBotPost } from '../app/api/rooms/[code]/bot/route';
import { POST as createNormalRoomPost } from '../app/api/rooms/route';
import { GET as getRoomState } from '../app/api/rooms/[code]/route';
import { POST as submitQuestionPost } from '../app/api/rooms/[code]/questions/route';
import { POST as submitGuessPost } from '../app/api/rooms/[code]/guesses/route';
import { getRoomStore } from '../lib/store';
import { NextRequest } from 'next/server';

function createMockRequest(url: string, method: string, body?: any, headers: Record<string, string> = {}) {
  const init: any = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), init);
}

describe('人机对战 (Bot Mode) 完整测试', () => {
  it('能够创建人机对局，且 AI 自动裁决问题与正确猜词', async () => {
    // 1. 创建单人人机房间
    const reqCreate = createMockRequest('/api/rooms/bot', 'POST', { nickname: '孤勇者侦探' });
    const resCreate = await createBotRoomPost(reqCreate);
    const dataCreate = await resCreate.json();
    expect(dataCreate.success).toBe(true);

    const code = dataCreate.roomCode;
    const playerToken = dataCreate.playerToken;

    // 2. 检查房间状态：人类为猜词人，bot_player 为出题人，防剧透机制生效
    const reqState = createMockRequest(`/api/rooms/${code}`, 'GET', undefined, { 'x-player-token': playerToken });
    const resState = await getRoomState(reqState, { params: Promise.resolve({ code }) });
    const dataState = await resState.json();

    expect(dataState.data.myRole).toBe('guesser');
    expect(dataState.data.session.status).toBe('playing');
    expect(dataState.data.session.secret_word).toBeNull(); // 绝不泄密

    // 获取内部真实的 secretWord 用于验证猜词
    const store = getRoomStore();
    const actualSecretWord = await store.getSecretWordForBot(code);
    expect(actualSecretWord).toBeTruthy();

    // 3. 提问测试：人类提问，Bot 自动回答
    const reqQ = createMockRequest(
      `/api/rooms/${code}/questions`,
      'POST',
      { text: '它是在地球上真实存在的吗？' },
      { 'x-player-token': playerToken }
    );
    const resQ = await submitQuestionPost(reqQ, { params: Promise.resolve({ code }) });
    const dataQ = await resQ.json();
    expect(dataQ.success).toBe(true);
    expect(dataQ.question.status).toBe('answered'); // 自动秒级作答
    expect(['yes', 'no', 'uncertain']).toContain(dataQ.question.answer);

    // 4. 正确猜词测试：提交正确答案，Bot 自动裁定为 correct 并获胜
    const reqGuess = createMockRequest(
      `/api/rooms/${code}/guesses`,
      'POST',
      { guessText: actualSecretWord! },
      { 'x-player-token': playerToken }
    );
    const resGuess = await submitGuessPost(reqGuess, { params: Promise.resolve({ code }) });
    const dataGuess = await resGuess.json();
    expect(dataGuess.success).toBe(true);
    expect(dataGuess.guess.status).toBe('correct');

    // 5. 结算验证：对局已结束，最终揭晓答案
    const reqFinalState = createMockRequest(`/api/rooms/${code}`, 'GET', undefined, { 'x-player-token': playerToken });
    const resFinalState = await getRoomState(reqFinalState, { params: Promise.resolve({ code }) });
    const dataFinalState = await resFinalState.json();
    expect(dataFinalState.data.session.status).toBe('settled');
    expect(dataFinalState.data.session.secret_word).toBe(actualSecretWord);
  });

  it('在普通等待房间内，房主可以直接召唤 AI 陪练立即开启单挑', async () => {
    // 1. 创建普通房间
    const reqCreate = createMockRequest('/api/rooms', 'POST', { hostNickname: '独行侠' });
    const resCreate = await createNormalRoomPost(reqCreate);
    const dataCreate = await resCreate.json();
    const code = dataCreate.roomCode;
    const token = dataCreate.playerToken;

    // 2. 召唤 AI 陪练加入
    const reqInvite = createMockRequest(`/api/rooms/${code}/bot`, 'POST', {}, { 'x-player-token': token });
    const resInvite = await inviteBotPost(reqInvite, { params: Promise.resolve({ code }) });
    const dataInvite = await resInvite.json();
    expect(dataInvite.success).toBe(true);
    expect(dataInvite.room.guest_player_id).toBe('bot_player');

    // 3. 验证进入 playing 状态
    const reqState = createMockRequest(`/api/rooms/${code}`, 'GET', undefined, { 'x-player-token': token });
    const resState = await getRoomState(reqState, { params: Promise.resolve({ code }) });
    const dataState = await resState.json();
    expect(dataState.data.session.status).toBe('playing');
    expect(dataState.data.session.question_master_id).toBe('bot_player');
    expect(dataState.data.myRole).toBe('guesser');
  });
});
