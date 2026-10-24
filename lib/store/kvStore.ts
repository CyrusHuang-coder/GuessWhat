import {
  AnswerType,
  Difficulty,
  GameMode,
  GameSession,
  GameStateDTO,
  Guess,
  HintCost,
  HintExchange,
  MatchHistoryItem,
  OffTrackEvaluation,
  PlayerRole,
  Question,
  Room,
} from '../types/game';
import { IRoomStore } from './interface';
import { realtimeBroadcaster } from '../realtime/broadcaster';

function generateRoomCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

interface StoredRoomData {
  room: Room;
  session: GameSession;
  questions: Question[];
  guesses: Guess[];
  hints: HintExchange[];
  offTrackEvaluations: OffTrackEvaluation[];
  matchHistory: MatchHistoryItem[];
}

export class KvRoomStore implements IRoomStore {
  private url: string;
  private token: string;

  constructor() {
    this.url = (
      process.env.KV_REST_API_URL ||
      process.env.UPSTASH_REDIS_REST_URL ||
      ''
    ).replace(/\/+$/, '');
    this.token =
      process.env.KV_REST_API_TOKEN ||
      process.env.UPSTASH_REDIS_REST_TOKEN ||
      '';
  }

  private async executeCommand(command: string, ...args: any[]): Promise<any> {
    if (!this.url || !this.token) {
      throw new Error('未配置 KV_REST_API_URL 或 UPSTASH_REDIS_REST_URL');
    }

    const endpoint = `${this.url}/${command}/${args.map((a) => encodeURIComponent(typeof a === 'object' ? JSON.stringify(a) : String(a))).join('/')}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`KV Error (${res.status}): ${txt}`);
    }

    const json = await res.json();
    return json.result;
  }

  private async getStored(code: string): Promise<StoredRoomData | null> {
    const raw = await this.executeCommand('get', `room_data:${code.toUpperCase()}`);
    if (!raw) return null;
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
      return null;
    }
  }

  private async saveStored(code: string, data: StoredRoomData): Promise<void> {
    // 存入 Redis 并设置 24 小时过期 (86400秒)
    await this.executeCommand('set', `room_data:${code.toUpperCase()}`, JSON.stringify(data), 'ex', 86400);
  }

  async createRoom(hostNickname: string): Promise<{ room: Room; playerToken: string }> {
    let code = generateRoomCode();
    let existing = await this.getStored(code);
    while (existing) {
      code = generateRoomCode();
      existing = await this.getStored(code);
    }

    const hostToken = crypto.randomUUID();
    const now = new Date().toISOString();

    const room: Room = {
      id: crypto.randomUUID(),
      code,
      status: 'waiting_player',
      host_player_id: hostToken,
      host_nickname: hostNickname.trim() || '出题房主',
      guest_player_id: null,
      guest_nickname: null,
      host_last_active: now,
      guest_last_active: null,
      created_at: now,
      updated_at: now,
    };

    const sessionId = crypto.randomUUID();
    const session: GameSession = {
      id: sessionId,
      room_id: room.id,
      round_number: 1,
      status: 'setting_selection',
      question_master_id: hostToken,
      guesser_id: '',
      theme: null,
      difficulty: 'medium',
      mode: 'normal',
      max_questions: 15,
      secret_word: null,
      secret_word_category: null,
      secret_word_note: null,
      is_custom_word: false,
      completed_questions_count: 0,
      wrong_guesses_count: 0,
      ai_quota_total: 2,
      ai_quota_used: 0,
      off_track_enabled: false,
      result: null,
      started_at: now,
      ended_at: null,
      created_at: now,
    };

    const data: StoredRoomData = {
      room,
      session,
      questions: [],
      guesses: [],
      hints: [],
      offTrackEvaluations: [],
      matchHistory: [],
    };

    await this.saveStored(code, data);
    return { room, playerToken: hostToken };
  }

  async getRoomByCode(code: string): Promise<Room | null> {
    const data = await this.getStored(code);
    return data?.room || null;
  }

  async joinRoom(code: string, guestNickname: string): Promise<{ room: Room; playerToken: string }> {
    const data = await this.getStored(code);
    if (!data) throw new Error('房间不存在，请检查房间码');
    if (data.room.status === 'ended') throw new Error('该房间已解散');
    if (data.room.guest_player_id) throw new Error('该房间已有两名玩家参与，无法再加入');

    const guestToken = crypto.randomUUID();
    const now = new Date().toISOString();

    data.room.guest_player_id = guestToken;
    data.room.guest_nickname = guestNickname.trim() || '猜词伙伴';
    data.room.guest_last_active = now;
    data.room.status = 'in_game';
    data.room.updated_at = now;

    if (data.session) {
      data.session.guesser_id = guestToken;
    }

    await this.saveStored(code, data);
    realtimeBroadcaster.notify(code.toUpperCase(), 'PLAYER_JOINED');
    return { room: data.room, playerToken: guestToken };
  }

  async updateHeartbeat(code: string, playerToken: string): Promise<boolean> {
    const data = await this.getStored(code);
    if (!data) return false;

    const now = new Date().toISOString();
    let updated = false;

    if (data.room.host_player_id === playerToken) {
      data.room.host_last_active = now;
      updated = true;
    } else if (data.room.guest_player_id === playerToken) {
      data.room.guest_last_active = now;
      updated = true;
    }

    if (updated) {
      await this.saveStored(code, data);
    }
    return updated;
  }

  async getRoomState(code: string, playerToken?: string): Promise<GameStateDTO | null> {
    const data = await this.getStored(code);
    if (!data) return null;

    const { room, session, questions, guesses, hints, offTrackEvaluations, matchHistory } = data;
    const isHost = playerToken === room.host_player_id;
    let myRole: PlayerRole | 'spectator' = 'spectator';

    if (session) {
      if (playerToken === session.question_master_id) myRole = 'question_master';
      else if (playerToken === session.guesser_id) myRole = 'guesser';
    }

    const now = Date.now();
    // 宽容的心跳阈值 (40秒)，避免移动端切屏或蜂窝网络抖动导致频繁提示离线
    const isOnline = (iso?: string | null) => (iso ? now - new Date(iso).getTime() < 40000 : false);
    const opponentOnline = isHost ? isOnline(room.guest_last_active) : isOnline(room.host_last_active);

    let sanitizedSession: GameSession | null = null;
    if (session) {
      const cloned = { ...session };
      if (myRole !== 'question_master' && session.status !== 'settled') {
        cloned.secret_word = null;
        cloned.secret_word_note = null;
      }
      sanitizedSession = cloned;
    }

    return {
      room: { ...room },
      session: sanitizedSession,
      questions: [...questions],
      guesses: [...guesses],
      hints: [...hints],
      offTrackEvaluations: myRole === 'guesser' ? [...offTrackEvaluations] : [],
      matchHistory: [...matchHistory],
      myRole,
      isHost,
      opponentOnline,
    };
  }

  async saveSettings(
    code: string,
    playerToken: string,
    settings: { theme: string; difficulty: Difficulty; mode: GameMode; maxQuestions?: number }
  ): Promise<GameSession> {
    const data = await this.getStored(code);
    if (!data || !data.session) throw new Error('对局未初始化');

    if (data.session.guesser_id !== playerToken) throw new Error('只有猜词人可以设置游戏主题与模式');
    if (data.session.status !== 'setting_selection') throw new Error('当前对局状态不在设置阶段');

    data.session.theme = settings.theme;
    data.session.difficulty = settings.difficulty;
    data.session.mode = settings.mode;
    data.session.max_questions = settings.mode === 'challenge' ? Math.max(1, settings.maxQuestions ?? 15) : 999;

    if (settings.difficulty === 'easy') data.session.ai_quota_total = 3;
    else if (settings.difficulty === 'medium') data.session.ai_quota_total = 2;
    else data.session.ai_quota_total = 1;
    data.session.ai_quota_used = 0;

    data.session.status = 'word_selection';
    await this.saveStored(code, data);
    realtimeBroadcaster.notify(code.toUpperCase(), 'SETTINGS_SAVED');
    return { ...data.session };
  }

  async setWord(
    code: string,
    playerToken: string,
    wordData: { word: string; category?: string; note?: string; isCustom?: boolean }
  ): Promise<GameSession> {
    const data = await this.getStored(code);
    if (!data || !data.session) throw new Error('对局未初始化');

    if (data.session.question_master_id !== playerToken) throw new Error('只有出题人可以设定秘密答案');
    if (data.session.status !== 'word_selection') throw new Error('当前对局状态不在选词阶段');
    if (!wordData.word || !wordData.word.trim()) throw new Error('秘密答案不能为空');

    data.session.secret_word = wordData.word.trim();
    data.session.secret_word_category = wordData.category || data.session.theme;
    data.session.secret_word_note = wordData.note || null;
    data.session.is_custom_word = !!wordData.isCustom;
    data.session.status = 'playing';
    data.session.started_at = new Date().toISOString();

    await this.saveStored(code, data);
    realtimeBroadcaster.notify(code.toUpperCase(), 'WORD_SET');
    return { ...data.session };
  }

  async submitQuestion(code: string, playerToken: string, text: string): Promise<Question> {
    const data = await this.getStored(code);
    if (!data || !data.session) throw new Error('对局未初始化');
    if (data.session.guesser_id !== playerToken) throw new Error('只有猜词人可以发起提问');
    if (data.session.status !== 'playing') throw new Error('当前对局状态不在进行中');

    const hasPending = data.questions.some((q) => q.status === 'pending' || q.status === 'revised');
    if (hasPending) throw new Error('上一问题尚未回答，请等待出题人反馈后再提问');

    if (data.session.mode === 'challenge' && data.session.completed_questions_count >= data.session.max_questions) {
      throw new Error('挑战模式有效提问额度已耗尽，请使用正式猜词');
    }

    const question: Question = {
      id: crypto.randomUUID(),
      session_id: data.session.id,
      room_id: data.room.id,
      question_number: data.session.completed_questions_count + 1,
      original_text: text.trim(),
      revised_text: null,
      status: 'pending',
      clarification_reason: null,
      clarification_count: 0,
      answer: null,
      answered_at: null,
      created_at: new Date().toISOString(),
    };

    data.questions.push(question);
    await this.saveStored(code, data);
    realtimeBroadcaster.notify(code.toUpperCase(), 'QUESTION_SUBMITTED');
    return question;
  }

  async answerQuestion(
    code: string,
    playerToken: string,
    questionId: string,
    answer: AnswerType
  ): Promise<Question> {
    const data = await this.getStored(code);
    if (!data || !data.session) throw new Error('对局未初始化');
    if (data.session.question_master_id !== playerToken) throw new Error('只有出题人可以正式回答问题');

    const question = data.questions.find((q) => q.id === questionId);
    if (!question) throw new Error('未找到指定问题');
    if (question.status !== 'pending' && question.status !== 'revised') {
      throw new Error('该问题已被回答或正等待修改');
    }

    question.answer = answer;
    question.status = 'answered';
    question.answered_at = new Date().toISOString();

    data.session.completed_questions_count += 1;
    await this.saveStored(code, data);
    realtimeBroadcaster.notify(code.toUpperCase(), 'QUESTION_ANSWERED');
    return { ...question };
  }

  async clarifyQuestion(code: string, playerToken: string, questionId: string, reason: string): Promise<Question> {
    const data = await this.getStored(code);
    if (!data || !data.session) throw new Error('对局未初始化');
    if (data.session.question_master_id !== playerToken) throw new Error('只有出题人可以请求澄清');

    const question = data.questions.find((q) => q.id === questionId);
    if (!question) throw new Error('未找到指定问题');
    if (question.clarification_count >= 1) throw new Error('该问题已澄清过一次，无法再次请求澄清');

    question.status = 'clarification_requested';
    question.clarification_reason = reason;
    question.clarification_count += 1;

    await this.saveStored(code, data);
    realtimeBroadcaster.notify(code.toUpperCase(), 'QUESTION_CLARIFIED');
    return { ...question };
  }

  async reviseQuestion(code: string, playerToken: string, questionId: string, revisedText: string): Promise<Question> {
    const data = await this.getStored(code);
    if (!data || !data.session) throw new Error('对局未初始化');
    if (data.session.guesser_id !== playerToken) throw new Error('只有猜词人可以修改重提');

    const question = data.questions.find((q) => q.id === questionId);
    if (!question) throw new Error('未找到指定问题');
    if (question.status !== 'clarification_requested') throw new Error('当前问题未处于待澄清状态');

    question.revised_text = revisedText.trim();
    question.status = 'revised';

    await this.saveStored(code, data);
    realtimeBroadcaster.notify(code.toUpperCase(), 'QUESTION_REVISED');
    return { ...question };
  }

  async submitGuess(code: string, playerToken: string, guessText: string): Promise<Guess> {
    const data = await this.getStored(code);
    if (!data || !data.session) throw new Error('对局未初始化');
    if (data.session.guesser_id !== playerToken) throw new Error('只有猜词人可以发起正式猜词');
    if (data.session.status !== 'playing') throw new Error('当前对局状态不在进行中');

    const hasPending = data.guesses.some((g) => g.status === 'pending');
    if (hasPending) throw new Error('上一猜词结果正在裁定中，请等待出题人反馈');

    const guess: Guess = {
      id: crypto.randomUUID(),
      session_id: data.session.id,
      room_id: data.room.id,
      guess_text: guessText.trim(),
      status: 'pending',
      adjudicated_at: null,
      created_at: new Date().toISOString(),
    };

    data.guesses.push(guess);
    await this.saveStored(code, data);
    realtimeBroadcaster.notify(code.toUpperCase(), 'GUESS_SUBMITTED');
    return guess;
  }

  async adjudicateGuess(
    code: string,
    playerToken: string,
    guessId: string,
    status: 'correct' | 'incorrect'
  ): Promise<{ guess: Guess; session: GameSession }> {
    const data = await this.getStored(code);
    if (!data || !data.session) throw new Error('对局未初始化');
    if (data.session.question_master_id !== playerToken) throw new Error('只有出题人可以裁定猜词');

    const guess = data.guesses.find((g) => g.id === guessId);
    if (!guess) throw new Error('未找到指定猜词记录');
    if (guess.status !== 'pending') throw new Error('该猜词已完成裁定');

    guess.status = status;
    guess.adjudicated_at = new Date().toISOString();

    if (status === 'correct') {
      data.session.status = 'settled';
      data.session.result = 'guessed';
      data.session.ended_at = new Date().toISOString();
      this.recordMatchHistory(data);
    } else {
      data.session.wrong_guesses_count += 1;
    }

    await this.saveStored(code, data);
    realtimeBroadcaster.notify(code.toUpperCase(), 'GUESS_ADJUDICATED');
    return { guess: { ...guess }, session: { ...data.session } };
  }

  async surrender(code: string, playerToken: string): Promise<GameSession> {
    const data = await this.getStored(code);
    if (!data || !data.session) throw new Error('对局未初始化');
    if (data.session.guesser_id !== playerToken) throw new Error('只有猜词人可以发起认输');
    if (data.session.status !== 'playing') throw new Error('对局已结束或尚未开始');

    data.session.status = 'settled';
    data.session.result = 'surrendered';
    data.session.ended_at = new Date().toISOString();
    this.recordMatchHistory(data);

    await this.saveStored(code, data);
    realtimeBroadcaster.notify(code.toUpperCase(), 'SESSION_SURRENDERED');
    return { ...data.session };
  }

  async nextRoundAction(
    code: string,
    playerToken: string,
    action: 'swap_roles' | 'keep_roles' | 'end_game' | 'restart_game'
  ): Promise<Room> {
    const data = await this.getStored(code);
    if (!data || !data.session) throw new Error('对局未初始化');

    if (action === 'end_game') {
      data.room.status = 'ended';
      data.room.updated_at = new Date().toISOString();
      await this.saveStored(code, data);
      realtimeBroadcaster.notify(code.toUpperCase(), 'GAME_ENDED');
      return { ...data.room };
    }

    data.room.status = 'in_game';
    data.room.updated_at = new Date().toISOString();

    const newSessionId = crypto.randomUUID();
    const now = new Date().toISOString();

    let newQuestionMasterId = data.session.question_master_id;
    let newGuesserId = data.session.guesser_id;

    if (action === 'swap_roles') {
      newQuestionMasterId = data.session.guesser_id;
      newGuesserId = data.session.question_master_id;
    }

    data.session = {
      id: newSessionId,
      room_id: data.room.id,
      round_number: data.session.round_number + 1,
      status: 'setting_selection',
      question_master_id: newQuestionMasterId,
      guesser_id: newGuesserId,
      theme: null,
      difficulty: 'medium',
      mode: 'normal',
      max_questions: 15,
      secret_word: null,
      secret_word_category: null,
      secret_word_note: null,
      is_custom_word: false,
      completed_questions_count: 0,
      wrong_guesses_count: 0,
      ai_quota_total: 2,
      ai_quota_used: 0,
      off_track_enabled: false,
      result: null,
      started_at: now,
      ended_at: null,
      created_at: now,
    };

    data.questions = [];
    data.guesses = [];
    data.hints = [];
    data.offTrackEvaluations = [];

    await this.saveStored(code, data);
    realtimeBroadcaster.notify(code.toUpperCase(), 'NEXT_ROUND_STARTED');
    return { ...data.room };
  }

  async saveOffTrackEvaluation(
    code: string,
    evaluation: {
      sessionId: string;
      questionTriggerCount: number;
      status: 'effective' | 'possible_off_track' | 'insufficient_info';
      rationale: string;
    }
  ): Promise<OffTrackEvaluation> {
    const data = await this.getStored(code);
    if (!data) throw new Error('对局未初始化');

    const item: OffTrackEvaluation = {
      id: crypto.randomUUID(),
      session_id: evaluation.sessionId,
      room_id: data.room.id,
      question_trigger_count: evaluation.questionTriggerCount,
      status: evaluation.status,
      rationale: evaluation.rationale,
      created_at: new Date().toISOString(),
    };

    data.offTrackEvaluations.push(item);
    await this.saveStored(code, data);
    realtimeBroadcaster.notify(code.toUpperCase(), 'OFF_TRACK_EVALUATED');
    return item;
  }

  async useAIQuota(code: string, playerToken: string): Promise<boolean> {
    const data = await this.getStored(code);
    if (!data || !data.session) return false;
    if (data.session.ai_quota_used >= data.session.ai_quota_total) return false;

    data.session.ai_quota_used += 1;
    await this.saveStored(code, data);
    realtimeBroadcaster.notify(code.toUpperCase(), 'AI_QUOTA_USED');
    return true;
  }

  async toggleOffTrack(code: string, playerToken: string, enabled: boolean): Promise<GameSession> {
    const data = await this.getStored(code);
    if (!data || !data.session) throw new Error('对局未初始化');
    if (data.session.guesser_id !== playerToken) throw new Error('只有猜词人可以开关思路偏航预警');

    data.session.off_track_enabled = enabled;
    await this.saveStored(code, data);
    realtimeBroadcaster.notify(code.toUpperCase(), 'OFF_TRACK_TOGGLED');
    return { ...data.session };
  }

  async requestHint(code: string, playerToken: string, cost: HintCost): Promise<HintExchange> {
    const data = await this.getStored(code);
    if (!data || !data.session) throw new Error('对局未初始化');
    if (data.session.guesser_id !== playerToken) throw new Error('只有猜词人可以申请线索提示');
    if (data.session.status !== 'playing') throw new Error('当前对局状态不在进行中，无法申请提示');

    if (data.session.mode === 'challenge') {
      const remaining = data.session.max_questions - data.session.completed_questions_count;
      if (remaining < cost) {
        throw new Error(`当前挑战模式仅剩 ${Math.max(0, remaining)} 次提问机会，不足以支付价值 ${cost} 次的线索`);
      }
    }

    const hasPending = data.hints.some((h) => h.status === 'pending');
    if (hasPending) throw new Error('当前已有正在等待出题人回应的提示申请，请勿重复申请');

    const hint: HintExchange = {
      id: crypto.randomUUID(),
      session_id: data.session.id,
      room_id: data.room.id,
      cost,
      status: 'pending',
      hint_text: null,
      requested_at: new Date().toISOString(),
      responded_at: null,
    };

    data.hints.push(hint);
    await this.saveStored(code, data);
    realtimeBroadcaster.notify(code.toUpperCase(), 'HINT_REQUESTED');
    return { ...hint };
  }

  async provideHint(
    code: string,
    playerToken: string,
    hintId: string,
    hintText: string
  ): Promise<{ hint: HintExchange; session: GameSession }> {
    const data = await this.getStored(code);
    if (!data || !data.session) throw new Error('对局未初始化');
    if (data.session.question_master_id !== playerToken) throw new Error('只有出题人可以提供线索提示');
    if (data.session.status !== 'playing') throw new Error('当前对局状态不在进行中');

    const hint = data.hints.find((h) => h.id === hintId);
    if (!hint) throw new Error('未找到该提示申请记录');
    if (hint.status !== 'pending') throw new Error('该提示申请已被处理');

    const cleanedText = hintText.trim();
    if (!cleanedText) throw new Error('线索内容不能为空');

    hint.hint_text = cleanedText;
    hint.status = 'provided';
    hint.responded_at = new Date().toISOString();

    data.session.completed_questions_count += hint.cost;
    await this.saveStored(code, data);
    realtimeBroadcaster.notify(code.toUpperCase(), 'HINT_PROVIDED');
    return { hint: { ...hint }, session: { ...data.session } };
  }

  async rejectHint(code: string, playerToken: string, hintId: string): Promise<HintExchange> {
    const data = await this.getStored(code);
    if (!data || !data.session) throw new Error('对局未初始化');
    if (data.session.question_master_id !== playerToken && data.session.guesser_id !== playerToken) {
      throw new Error('无权操作该提示申请');
    }

    const hint = data.hints.find((h) => h.id === hintId);
    if (!hint) throw new Error('未找到该提示申请记录');
    if (hint.status !== 'pending') throw new Error('该提示申请已被处理');

    hint.status = 'rejected';
    hint.responded_at = new Date().toISOString();

    await this.saveStored(code, data);
    realtimeBroadcaster.notify(code.toUpperCase(), 'HINT_REJECTED');
    return { ...hint };
  }

  private recordMatchHistory(data: StoredRoomData): void {
    const { room, session } = data;
    const duration =
      session.ended_at && session.started_at
        ? Math.max(1, Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000))
        : 0;

    const qmNickname =
      session.question_master_id === room.host_player_id ? room.host_nickname : room.guest_nickname || '玩家';
    const guesserNickname =
      session.guesser_id === room.host_player_id ? room.host_nickname : room.guest_nickname || '玩家';

    const historyItem: MatchHistoryItem = {
      round_number: session.round_number,
      question_master_nickname: qmNickname,
      guesser_nickname: guesserNickname,
      theme: session.theme || '未指定',
      difficulty: session.difficulty,
      mode: session.mode,
      max_questions: session.max_questions,
      completed_questions_count: session.completed_questions_count,
      wrong_guesses_count: session.wrong_guesses_count,
      result: session.result || 'guessed',
      secret_word: session.secret_word || '',
      duration_seconds: duration,
      ai_quota_used: session.ai_quota_used,
      off_track_enabled: session.off_track_enabled,
      ended_at: session.ended_at || new Date().toISOString(),
    };

    data.matchHistory.push(historyItem);
  }
}

