import { describe, it, expect } from 'vitest';
import { POST as createRoomPost } from '../app/api/rooms/route';
import { GET as getRoomState } from '../app/api/rooms/[code]/route';
import { POST as joinRoomPost } from '../app/api/rooms/[code]/join/route';
import { POST as saveSettingsPost } from '../app/api/rooms/[code]/settings/route';
import { POST as setWordPost } from '../app/api/rooms/[code]/word/route';
import { POST as submitQuestionPost } from '../app/api/rooms/[code]/questions/route';
import { POST as answerQuestionPost } from '../app/api/rooms/[code]/questions/[id]/answer/route';
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

describe('API 路由端到端集成测试', () => {
  it('通过 API Routes 完成完整的创房、入房、设词、问答流程', async () => {
    // 1. POST /api/rooms
    const reqCreate = createMockRequest('/api/rooms', 'POST', { hostNickname: '测试出题人' });
    const resCreate = await createRoomPost(reqCreate);
    const dataCreate = await resCreate.json();
    expect(dataCreate.success).toBe(true);
    const code = dataCreate.roomCode;
    const hostToken = dataCreate.playerToken;

    // 2. POST /api/rooms/[code]/join
    const reqJoin = createMockRequest(`/api/rooms/${code}/join`, 'POST', { guestNickname: '测试猜词人' });
    const resJoin = await joinRoomPost(reqJoin, { params: Promise.resolve({ code }) });
    const dataJoin = await resJoin.json();
    expect(dataJoin.success).toBe(true);
    const guestToken = dataJoin.playerToken;

    // 3. POST /api/rooms/[code]/settings
    const reqSettings = createMockRequest(
      `/api/rooms/${code}/settings`,
      'POST',
      { theme: '植物', difficulty: 'easy', mode: 'normal' },
      { 'x-player-token': guestToken }
    );
    const resSettings = await saveSettingsPost(reqSettings, { params: Promise.resolve({ code }) });
    const dataSettings = await resSettings.json();
    expect(dataSettings.success).toBe(true);

    // 4. POST /api/rooms/[code]/word
    const reqWord = createMockRequest(
      `/api/rooms/${code}/word`,
      'POST',
      { word: '向日葵', note: '追逐太阳' },
      { 'x-player-token': hostToken }
    );
    const resWord = await setWordPost(reqWord, { params: Promise.resolve({ code }) });
    const dataWord = await resWord.json();
    expect(dataWord.success).toBe(true);

    // 5. 验证防剧透 GET /api/rooms/[code]
    const reqStateGuest = createMockRequest(`/api/rooms/${code}`, 'GET', undefined, { 'x-player-token': guestToken });
    const resStateGuest = await getRoomState(reqStateGuest, { params: Promise.resolve({ code }) });
    const dataStateGuest = await resStateGuest.json();
    expect(dataStateGuest.data.session.secret_word).toBeNull(); // 猜词人看不到向日葵！

    const reqStateHost = createMockRequest(`/api/rooms/${code}`, 'GET', undefined, { 'x-player-token': hostToken });
    const resStateHost = await getRoomState(reqStateHost, { params: Promise.resolve({ code }) });
    const dataStateHost = await resStateHost.json();
    expect(dataStateHost.data.session.secret_word).toBe('向日葵'); // 出题人能看到！

    // 6. POST /api/rooms/[code]/questions
    const reqQ = createMockRequest(
      `/api/rooms/${code}/questions`,
      'POST',
      { text: '它是黄色的花吗？' },
      { 'x-player-token': guestToken }
    );
    const resQ = await submitQuestionPost(reqQ, { params: Promise.resolve({ code }) });
    const dataQ = await resQ.json();
    expect(dataQ.success).toBe(true);
    const qId = dataQ.question.id;

    // 7. POST /api/rooms/[code]/questions/[id]/answer
    const reqAns = createMockRequest(
      `/api/rooms/${code}/questions/${qId}/answer`,
      'POST',
      { answer: 'yes' },
      { 'x-player-token': hostToken }
    );
    const resAns = await answerQuestionPost(reqAns, { params: Promise.resolve({ code, id: qId }) });
    const dataAns = await resAns.json();
    expect(dataAns.success).toBe(true);
    expect(dataAns.question.answer).toBe('yes');
  });
});

