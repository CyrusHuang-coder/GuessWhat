import {
  AnswerType,
  ChatMessage,
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
  WebRTCSignal,
} from '../types/game';
import { IRoomStore } from './interface';
import { realtimeBroadcaster } from '../realtime/broadcaster';
import { getRandomWordsByFilter } from '../data/wordBank';

// 生成 6 位大写英数房间码（剔除易混淆的 0, O, 1, I）
function generateRoomCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export class MemoryRoomStore implements IRoomStore {
  private rooms: Map<string, Room> = new Map(); // key: roomCode (uppercase)
  private sessions: Map<string, GameSession> = new Map(); // key: sessionId
  private currentSessionByRoom: Map<string, string> = new Map(); // key: roomCode, value: sessionId
  private questionsBySession: Map<string, Question[]> = new Map();
  private guessesBySession: Map<string, Guess[]> = new Map();
  private hintsBySession: Map<string, HintExchange[]> = new Map();
  private offTrackEvaluationsBySession: Map<string, OffTrackEvaluation[]> = new Map();
  private matchHistoryByRoom: Map<string, MatchHistoryItem[]> = new Map();
  private chatMessagesByRoom: Map<string, ChatMessage[]> = new Map();
  private webrtcSignalsByRoom: Map<string, WebRTCSignal[]> = new Map();

  async createRoom(hostNickname: string): Promise<{ room: Room; playerToken: string }> {
    let code = generateRoomCode();
    while (this.rooms.has(code)) {
      code = generateRoomCode();
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
      guesser_id: '', // 等待第二位玩家加入
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

    this.rooms.set(code, room);
    this.sessions.set(sessionId, session);
    this.currentSessionByRoom.set(code, sessionId);
    this.questionsBySession.set(sessionId, []);
    this.guessesBySession.set(sessionId, []);
    this.hintsBySession.set(sessionId, []);
    this.offTrackEvaluationsBySession.set(sessionId, []);
    this.matchHistoryByRoom.set(code, []);

    return { room, playerToken: hostToken };
  }

  async createBotRoom(
    nickname: string,
    options?: { theme?: string; difficulty?: Difficulty }
  ): Promise<{ room: Room; playerToken: string }> {
    const code = generateRoomCode();
    const now = new Date().toISOString();
    const hostToken = crypto.randomUUID();
    const botPlayerId = 'bot_player';
    const theme = options?.theme || '日常物品';
    const difficulty = options?.difficulty || 'easy';

    // 从词库随机抽取一个秘密词条作为 AI 的题
    const candidateWords = getRandomWordsByFilter(theme, difficulty, 1);
    const chosenWord = candidateWords[0] || {
      id: 'bot_fallback',
      name: '橡皮擦',
      theme: '日常物品',
      difficulty: 'easy' as Difficulty,
      note: '修正字迹的工具',
    };

    const room: Room = {
      id: crypto.randomUUID(),
      code,
      status: 'in_game',
      host_player_id: hostToken,
      host_nickname: nickname.trim() || '人类侦探',
      guest_player_id: botPlayerId,
      guest_nickname: 'AI 智能出题官 (DeepSeek)',
      host_last_active: now,
      guest_last_active: now,
      created_at: now,
      updated_at: now,
    };

    const sessionId = crypto.randomUUID();
    const session: GameSession = {
      id: sessionId,
      room_id: room.id,
      round_number: 1,
      status: 'playing', // 直接进入游戏提问对决
      question_master_id: botPlayerId, // AI 担任出题人
      guesser_id: hostToken, // 玩家担任猜词人
      theme,
      difficulty,
      mode: 'normal',
      max_questions: 20,
      secret_word: chosenWord.name,
      secret_word_category: chosenWord.theme,
      secret_word_note: chosenWord.note || null,
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

    this.rooms.set(code, room);
    this.sessions.set(sessionId, session);
    this.currentSessionByRoom.set(code, sessionId);
    this.questionsBySession.set(sessionId, []);
    this.guessesBySession.set(sessionId, []);
    this.hintsBySession.set(sessionId, []);
    this.offTrackEvaluationsBySession.set(sessionId, []);
    this.matchHistoryByRoom.set(code, []);

    return { room, playerToken: hostToken };
  }

  async addBotToRoom(
    code: string,
    hostToken: string,
    options?: { theme?: string; difficulty?: Difficulty }
  ): Promise<Room> {
    const uppercaseCode = code.toUpperCase();
    const room = this.rooms.get(uppercaseCode);
    if (!room) throw new Error('房间不存在');
    if (room.host_player_id !== hostToken) throw new Error('仅房主可邀请 AI 陪练');

    const botPlayerId = 'bot_player';
    room.guest_player_id = botPlayerId;
    room.guest_nickname = 'AI 智能出题官 (DeepSeek)';
    room.status = 'in_game';
    const now = new Date().toISOString();
    room.updated_at = now;

    const theme = options?.theme || '日常物品';
    const difficulty = options?.difficulty || 'easy';
    const candidateWords = getRandomWordsByFilter(theme, difficulty, 1);
    const chosenWord = candidateWords[0] || {
      id: 'bot_fallback',
      name: '橡皮擦',
      theme: '日常物品',
      difficulty: 'easy' as Difficulty,
      note: '修正字迹的工具',
    };

    const sessionId = crypto.randomUUID();
    const session: GameSession = {
      id: sessionId,
      room_id: room.id,
      round_number: 1,
      status: 'playing',
      question_master_id: botPlayerId,
      guesser_id: hostToken,
      theme,
      difficulty,
      mode: 'normal',
      max_questions: 20,
      secret_word: chosenWord.name,
      secret_word_category: chosenWord.theme,
      secret_word_note: chosenWord.note || null,
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

    this.sessions.set(sessionId, session);
    this.currentSessionByRoom.set(uppercaseCode, sessionId);
    this.questionsBySession.set(sessionId, []);
    this.guessesBySession.set(sessionId, []);
    this.hintsBySession.set(sessionId, []);
    this.offTrackEvaluationsBySession.set(sessionId, []);

    realtimeBroadcaster.notify(uppercaseCode, 'ROOM_JOINED');
    return room;
  }

  async getSecretWordForBot(code: string): Promise<string | null> {
    const uppercaseCode = code.toUpperCase();
    const sessionId = this.currentSessionByRoom.get(uppercaseCode);
    if (!sessionId) return null;
    const session = this.sessions.get(sessionId);
    return session?.secret_word || null;
  }

  async getRoomByCode(code: string): Promise<Room | null> {
    return this.rooms.get(code.toUpperCase()) || null;
  }

  async joinRoom(
    code: string,
    guestNickname: string,
    options?: { reclaimRole?: 'host' | 'guest'; playerToken?: string }
  ): Promise<{ room: Room; playerToken: string }> {
    const uppercaseCode = code.toUpperCase();
    const room = this.rooms.get(uppercaseCode);
    if (!room) {
      throw new Error('房间不存在，请检查房间码');
    }
    if (room.status === 'ended') {
      throw new Error('该房间已解散');
    }

    const sessionId = this.currentSessionByRoom.get(uppercaseCode);
    const session = sessionId ? this.sessions.get(sessionId) : null;

    // 若已经有客方且玩家尝试重新进入（解决微信内置浏览器/多端切换导致的满员被拒）
    if (room.guest_player_id) {
      const trimmedNick = guestNickname.trim();

      // 1. 指定身份为房主，或者输入的昵称与房主完全匹配
      if (options?.reclaimRole === 'host' || (trimmedNick && trimmedNick === room.host_nickname)) {
        return { room, playerToken: room.host_player_id };
      }

      // 2. 指定身份为客方，或者输入的昵称与客方完全匹配
      if (options?.reclaimRole === 'guest' || (trimmedNick && trimmedNick === room.guest_nickname)) {
        return { room, playerToken: room.guest_player_id };
      }

      // 3. 携带已有的 Token（如重连）
      if (options?.playerToken === room.host_player_id) {
        return { room, playerToken: room.host_player_id };
      }
      if (options?.playerToken === room.guest_player_id) {
        return { room, playerToken: room.guest_player_id };
      }

      // 4. 满员但提供结构化可恢复信息
      const err: any = new Error(
        `该房间已有两名玩家参与，无法再加入（出题人：${room.host_nickname}，猜词人：${room.guest_nickname}）。若您是其中一位，请选择对应身份直接恢复进入。`
      );
      err.isFull = true;
      err.canReclaim = true;
      err.hostNickname = room.host_nickname;
      err.guestNickname = room.guest_nickname;
      throw err;
    }

    const guestToken = crypto.randomUUID();
    const now = new Date().toISOString();

    room.guest_player_id = guestToken;
    room.guest_nickname = guestNickname.trim() || '猜词伙伴';
    room.guest_last_active = now;
    room.status = 'in_game';
    room.updated_at = now;

    if (session) {
      session.guesser_id = guestToken;
    }

    realtimeBroadcaster.notify(uppercaseCode, 'PLAYER_JOINED');
    return { room, playerToken: guestToken };
  }

  async updateHeartbeat(code: string, playerToken: string): Promise<boolean> {
    const uppercaseCode = code.toUpperCase();
    const room = this.rooms.get(uppercaseCode);
    if (!room) return false;

    const now = new Date().toISOString();
    if (room.host_player_id === playerToken) {
      room.host_last_active = now;
      return true;
    }
    if (room.guest_player_id === playerToken) {
      room.guest_last_active = now;
      return true;
    }
    return false;
  }

  async getRoomState(code: string, playerToken?: string): Promise<GameStateDTO | null> {
    const uppercaseCode = code.toUpperCase();
    const room = this.rooms.get(uppercaseCode);
    if (!room) return null;

    const sessionId = this.currentSessionByRoom.get(uppercaseCode);
    const session = sessionId ? this.sessions.get(sessionId) : null;
    const questions = sessionId ? this.questionsBySession.get(sessionId) || [] : [];
    const guesses = sessionId ? this.guessesBySession.get(sessionId) || [] : [];
    const hints = sessionId ? this.hintsBySession.get(sessionId) || [] : [];
    const offTrackEvaluations = sessionId
      ? this.offTrackEvaluationsBySession.get(sessionId) || []
      : [];
    const matchHistory = this.matchHistoryByRoom.get(uppercaseCode) || [];

    const isHost = playerToken === room.host_player_id;
    let myRole: PlayerRole | 'spectator' = 'spectator';

    if (session) {
      if (playerToken === session.question_master_id) {
        myRole = 'question_master';
      } else if (playerToken === session.guesser_id) {
        myRole = 'guesser';
      }
    }

    const now = Date.now();
    const isOnline = (isoString?: string | null) => {
      if (!isoString) return false;
      return now - new Date(isoString).getTime() < 40000;
    };

    const opponentOnline = isHost
      ? isOnline(room.guest_last_active)
      : isOnline(room.host_last_active);

    // 防剧透脱敏克隆：只要不是出题人且未结算，绝对不返回秘密答案及注解
    let sanitizedSession: GameSession | null = null;
    if (session) {
      const cloned = { ...session };
      if (myRole !== 'question_master' && session.status !== 'settled') {
        cloned.secret_word = null;
        cloned.secret_word_note = null;
      }
      sanitizedSession = cloned;
    }

    // 思路偏航预警仅猜词人可见
    const visibleEvaluations = myRole === 'guesser' ? offTrackEvaluations : [];
    const chatMessages = this.chatMessagesByRoom.get(uppercaseCode) || [];

    return {
      room: { ...room },
      session: sanitizedSession,
      questions: [...questions],
      guesses: [...guesses],
      hints: [...hints],
      offTrackEvaluations: visibleEvaluations,
      matchHistory: [...matchHistory],
      myRole,
      isHost,
      opponentOnline,
      chatMessages: [...chatMessages].slice(-50),
    };
  }

  async saveSettings(
    code: string,
    playerToken: string,
    settings: {
      theme: string;
      difficulty: Difficulty;
      mode: GameMode;
      maxQuestions?: number;
    }
  ): Promise<GameSession> {
    const uppercaseCode = code.toUpperCase();
    const sessionId = this.currentSessionByRoom.get(uppercaseCode);
    if (!sessionId) throw new Error('对局未初始化');
    const session = this.sessions.get(sessionId)!;

    if (session.guesser_id !== playerToken) {
      throw new Error('只有猜词人可以设置游戏主题与模式');
    }
    if (session.status !== 'setting_selection') {
      throw new Error('当前对局状态不在设置阶段');
    }

    session.theme = settings.theme;
    session.difficulty = settings.difficulty;
    session.mode = settings.mode;
    session.max_questions =
      settings.mode === 'challenge' ? Math.max(1, settings.maxQuestions ?? 15) : 999;

    // AI 辅助额度分配: 简单 3 次, 普通 2 次, 困难 1 次
    if (settings.difficulty === 'easy') {
      session.ai_quota_total = 3;
    } else if (settings.difficulty === 'medium') {
      session.ai_quota_total = 2;
    } else {
      session.ai_quota_total = 1;
    }
    session.ai_quota_used = 0;

    session.status = 'word_selection';
    realtimeBroadcaster.notify(uppercaseCode, 'SETTINGS_SAVED');
    return { ...session };
  }

  async revertToSettingSelection(code: string, playerToken: string): Promise<GameSession> {
    const uppercaseCode = code.toUpperCase();
    const sessionId = this.currentSessionByRoom.get(uppercaseCode);
    if (!sessionId) throw new Error('对局未初始化');
    const session = this.sessions.get(sessionId)!;

    if (session.guesser_id !== playerToken) {
      throw new Error('只有猜词人可以重新选择主题');
    }
    if (session.status !== 'word_selection') {
      throw new Error('出题人已选定词条或游戏已进入后续阶段，无法直接回退');
    }

    session.status = 'setting_selection';
    session.theme = null;
    realtimeBroadcaster.notify(uppercaseCode, 'SETTINGS_RESET');
    return { ...session };
  }

  async swapInitialRoles(code: string, playerToken: string): Promise<GameSession> {
    const uppercaseCode = code.toUpperCase();
    const room = this.rooms.get(uppercaseCode);
    if (!room) throw new Error('房间不存在');

    const sessionId = this.currentSessionByRoom.get(uppercaseCode);
    if (!sessionId) throw new Error('对局未初始化');
    const session = this.sessions.get(sessionId)!;

    if (session.status !== 'setting_selection') {
      throw new Error('只有在对局准备阶段（设定规则前）可以调整角色');
    }

    if (playerToken !== room.host_player_id && playerToken !== room.guest_player_id) {
      throw new Error('只有房间内的玩家可以调整角色');
    }

    if (!room.guest_player_id) {
      throw new Error('等待第二位玩家进入房间后方可互换出题与猜词身份');
    }

    const oldMaster = session.question_master_id;
    const oldGuesser = session.guesser_id;
    session.question_master_id = oldGuesser;
    session.guesser_id = oldMaster;

    realtimeBroadcaster.notify(uppercaseCode, 'ROLES_SWAPPED');
    return { ...session };
  }

  async setWord(
    code: string,
    playerToken: string,
    wordData: {
      word: string;
      category?: string;
      note?: string;
      isCustom?: boolean;
    }
  ): Promise<GameSession> {
    const uppercaseCode = code.toUpperCase();
    const sessionId = this.currentSessionByRoom.get(uppercaseCode);
    if (!sessionId) throw new Error('对局未初始化');
    const session = this.sessions.get(sessionId)!;

    if (session.question_master_id !== playerToken) {
      throw new Error('只有出题人可以设定秘密答案');
    }
    if (session.status !== 'word_selection') {
      throw new Error('当前对局状态不在选词阶段');
    }
    if (!wordData.word || !wordData.word.trim()) {
      throw new Error('秘密答案不能为空');
    }

    session.secret_word = wordData.word.trim();
    session.secret_word_category = wordData.category || session.theme;
    session.secret_word_note = wordData.note || null;
    session.is_custom_word = !!wordData.isCustom;
    session.status = 'playing';
    session.started_at = new Date().toISOString();

    realtimeBroadcaster.notify(uppercaseCode, 'WORD_SET');
    return { ...session };
  }

  async submitQuestion(code: string, playerToken: string, text: string): Promise<Question> {
    const uppercaseCode = code.toUpperCase();
    const sessionId = this.currentSessionByRoom.get(uppercaseCode);
    if (!sessionId) throw new Error('对局未初始化');
    const session = this.sessions.get(sessionId)!;

    if (session.guesser_id !== playerToken) {
      throw new Error('只有猜词人可以提问');
    }
    if (session.status !== 'playing') {
      throw new Error('当前对局尚未开始或已结束');
    }

    if (
      session.mode === 'challenge' &&
      session.completed_questions_count >= session.max_questions
    ) {
      throw new Error('挑战模式有效提问额度已耗尽，请使用正式猜词或认输');
    }

    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('问题内容不能为空');
    }

    const questions = this.questionsBySession.get(sessionId)!;
    // 检查是否有仍在等待出题人回答或澄清的问题
    const hasUnanswered = questions.some(
      (q) => q.status === 'pending' || q.status === 'clarification_requested' || q.status === 'revised'
    );
    if (hasUnanswered) {
      throw new Error('上一问题尚未处理完毕，请等待出题人回复');
    }

    const question: Question = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      room_id: session.room_id,
      question_number: questions.length + 1,
      original_text: trimmed,
      revised_text: null,
      status: 'pending',
      clarification_reason: null,
      clarification_count: 0,
      answer: null,
      answered_at: null,
      created_at: new Date().toISOString(),
    };

    questions.push(question);
    realtimeBroadcaster.notify(uppercaseCode, 'QUESTION_SUBMITTED');
    return { ...question };
  }

  async answerQuestion(
    code: string,
    playerToken: string,
    questionId: string,
    answer: AnswerType
  ): Promise<Question> {
    const uppercaseCode = code.toUpperCase();
    const sessionId = this.currentSessionByRoom.get(uppercaseCode);
    if (!sessionId) throw new Error('对局未初始化');
    const session = this.sessions.get(sessionId)!;

    if (session.question_master_id !== playerToken) {
      throw new Error('只有出题人可以正式回答');
    }
    if (session.status !== 'playing') {
      throw new Error('对局不在进行中');
    }

    const questions = this.questionsBySession.get(sessionId)!;
    const question = questions.find((q) => q.id === questionId);
    if (!question) {
      throw new Error('找不到该问题');
    }
    if (question.status !== 'pending' && question.status !== 'revised') {
      throw new Error('该问题目前不可直接回答');
    }

    question.answer = answer;
    question.status = 'answered';
    question.answered_at = new Date().toISOString();
    session.completed_questions_count += 1;

    realtimeBroadcaster.notify(uppercaseCode, 'QUESTION_ANSWERED');
    return { ...question };
  }

  async reviseAnswer(
    code: string,
    playerToken: string,
    questionId: string,
    newAnswer: AnswerType
  ): Promise<Question> {
    const uppercaseCode = code.toUpperCase();
    const sessionId = this.currentSessionByRoom.get(uppercaseCode);
    if (!sessionId) throw new Error('对局未初始化');
    const session = this.sessions.get(sessionId)!;

    if (session.question_master_id !== playerToken) {
      throw new Error('只有出题人可以修正回答');
    }
    if (session.status !== 'playing') {
      throw new Error('对局不在进行中，无法修改答案');
    }

    const questions = this.questionsBySession.get(sessionId)!;
    const question = questions.find((q) => q.id === questionId);
    if (!question) {
      throw new Error('找不到该问题');
    }
    if (question.status !== 'answered') {
      throw new Error('只有已回答的问题可以修正答案');
    }

    question.answer = newAnswer;
    question.answered_at = new Date().toISOString();

    realtimeBroadcaster.notify(uppercaseCode, 'QUESTION_ANSWER_REVISED');
    return { ...question };
  }

  async clarifyQuestion(
    code: string,
    playerToken: string,
    questionId: string,
    reason: string
  ): Promise<Question> {
    const uppercaseCode = code.toUpperCase();
    const sessionId = this.currentSessionByRoom.get(uppercaseCode);
    if (!sessionId) throw new Error('对局未初始化');
    const session = this.sessions.get(sessionId)!;

    if (session.question_master_id !== playerToken) {
      throw new Error('只有出题人可以请求澄清');
    }
    if (session.status !== 'playing') {
      throw new Error('对局不在进行中');
    }

    const questions = this.questionsBySession.get(sessionId)!;
    const question = questions.find((q) => q.id === questionId);
    if (!question) {
      throw new Error('找不到该问题');
    }
    if (question.status !== 'pending') {
      throw new Error('只能对初次提交的问题请求澄清');
    }
    if (question.clarification_count >= 1) {
      throw new Error('每个问题严格限澄清 1 次');
    }

    question.status = 'clarification_requested';
    question.clarification_reason = reason.trim() || '问题存在歧义，缺少明确标准';
    question.clarification_count = 1;

    realtimeBroadcaster.notify(uppercaseCode, 'CLARIFICATION_REQUESTED');
    return { ...question };
  }

  async reviseQuestion(
    code: string,
    playerToken: string,
    questionId: string,
    revisedText: string
  ): Promise<Question> {
    const uppercaseCode = code.toUpperCase();
    const sessionId = this.currentSessionByRoom.get(uppercaseCode);
    if (!sessionId) throw new Error('对局未初始化');
    const session = this.sessions.get(sessionId)!;

    if (session.guesser_id !== playerToken) {
      throw new Error('只有猜词人可以修改问题');
    }
    if (session.status !== 'playing') {
      throw new Error('对局不在进行中');
    }

    const questions = this.questionsBySession.get(sessionId)!;
    const question = questions.find((q) => q.id === questionId);
    if (!question) {
      throw new Error('找不到该问题');
    }
    if (question.status !== 'clarification_requested') {
      throw new Error('该问题未处于待澄清状态');
    }

    const trimmed = revisedText.trim();
    if (!trimmed) {
      throw new Error('修改后的问题不能为空');
    }

    question.revised_text = trimmed;
    question.status = 'revised';

    realtimeBroadcaster.notify(uppercaseCode, 'QUESTION_REVISED');
    return { ...question };
  }

  async submitGuess(code: string, playerToken: string, guessText: string): Promise<Guess> {
    const uppercaseCode = code.toUpperCase();
    const sessionId = this.currentSessionByRoom.get(uppercaseCode);
    if (!sessionId) throw new Error('对局未初始化');
    const session = this.sessions.get(sessionId)!;

    if (session.guesser_id !== playerToken) {
      throw new Error('只有猜词人可以发起正式猜词');
    }
    if (session.status !== 'playing') {
      throw new Error('对局不在进行中');
    }

    const trimmed = guessText.trim();
    if (!trimmed) {
      throw new Error('猜词内容不能为空');
    }

    const guesses = this.guessesBySession.get(sessionId)!;
    const hasPendingGuess = guesses.some((g) => g.status === 'pending');
    if (hasPendingGuess) {
      throw new Error('上一猜词正在等待出题人裁定');
    }

    const guess: Guess = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      room_id: session.room_id,
      guess_text: trimmed,
      status: 'pending',
      adjudicated_at: null,
      created_at: new Date().toISOString(),
    };

    guesses.push(guess);
    realtimeBroadcaster.notify(uppercaseCode, 'GUESS_SUBMITTED');
    return { ...guess };
  }

  async adjudicateGuess(
    code: string,
    playerToken: string,
    guessId: string,
    status: 'correct' | 'incorrect'
  ): Promise<{ guess: Guess; session: GameSession }> {
    const uppercaseCode = code.toUpperCase();
    const sessionId = this.currentSessionByRoom.get(uppercaseCode);
    if (!sessionId) throw new Error('对局未初始化');
    const session = this.sessions.get(sessionId)!;

    if (session.question_master_id !== playerToken) {
      throw new Error('只有出题人可以裁定猜词');
    }
    if (session.status !== 'playing') {
      throw new Error('对局不在进行中');
    }

    const guesses = this.guessesBySession.get(sessionId)!;
    const guess = guesses.find((g) => g.id === guessId);
    if (!guess) {
      throw new Error('找不到该猜词记录');
    }
    if (guess.status !== 'pending') {
      throw new Error('该猜词已被裁定');
    }

    guess.status = status;
    guess.adjudicated_at = new Date().toISOString();

    if (status === 'incorrect') {
      session.wrong_guesses_count += 1;
    } else {
      // 猜中了！进入结算
      session.status = 'settled';
      session.result = 'guessed';
      session.ended_at = new Date().toISOString();
      this.recordMatchHistory(uppercaseCode, session);
    }

    realtimeBroadcaster.notify(uppercaseCode, 'GUESS_ADJUDICATED');
    return { guess: { ...guess }, session: { ...session } };
  }

  async surrender(code: string, playerToken: string): Promise<GameSession> {
    const uppercaseCode = code.toUpperCase();
    const sessionId = this.currentSessionByRoom.get(uppercaseCode);
    if (!sessionId) throw new Error('对局未初始化');
    const session = this.sessions.get(sessionId)!;

    if (session.guesser_id !== playerToken) {
      throw new Error('只有猜词人可以主动认输');
    }
    if (session.status !== 'playing') {
      throw new Error('对局不在进行中');
    }

    session.status = 'settled';
    session.result = 'surrendered';
    session.ended_at = new Date().toISOString();
    this.recordMatchHistory(uppercaseCode, session);

    realtimeBroadcaster.notify(uppercaseCode, 'SURRENDERED');
    return { ...session };
  }

  async nextRoundAction(
    code: string,
    playerToken: string,
    action: 'swap_roles' | 'keep_roles' | 'end_game' | 'restart_game'
  ): Promise<Room> {
    const uppercaseCode = code.toUpperCase();
    const room = this.rooms.get(uppercaseCode);
    if (!room) throw new Error('房间不存在');

    const sessionId = this.currentSessionByRoom.get(uppercaseCode);
    const session = sessionId ? this.sessions.get(sessionId) : null;

    if (action !== 'restart_game' && (!session || session.status !== 'settled')) {
      throw new Error('只有当本局结算完成后才能开始下一轮');
    }

    if (playerToken !== room.host_player_id && playerToken !== room.guest_player_id) {
      throw new Error('只有房间内玩家可以发起操作');
    }

    if (action === 'end_game') {
      room.status = 'ended';
      realtimeBroadcaster.notify(uppercaseCode, 'GAME_ENDED');
      return { ...room };
    }

    // 复活或保持房间进行中
    room.status = 'in_game';

    // 开启新一局
    const newSessionId = crypto.randomUUID();
    const now = new Date().toISOString();

    let newQuestionMasterId = session ? session.question_master_id : room.host_player_id;
    let newGuesserId = session ? session.guesser_id : (room.guest_player_id || '');

    if (action === 'swap_roles' && session) {
      newQuestionMasterId = session.guesser_id;
      newGuesserId = session.question_master_id;
    }

    const nextSession: GameSession = {
      id: newSessionId,
      room_id: room.id,
      round_number: (session ? session.round_number : 0) + 1,
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

    this.sessions.set(newSessionId, nextSession);
    this.currentSessionByRoom.set(uppercaseCode, newSessionId);
    this.questionsBySession.set(newSessionId, []);
    this.guessesBySession.set(newSessionId, []);
    this.hintsBySession.set(newSessionId, []);
    this.offTrackEvaluationsBySession.set(newSessionId, []);

    realtimeBroadcaster.notify(uppercaseCode, 'NEXT_ROUND_STARTED');
    return { ...room };
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
    const list = this.offTrackEvaluationsBySession.get(evaluation.sessionId) || [];
    const item: OffTrackEvaluation = {
      id: crypto.randomUUID(),
      session_id: evaluation.sessionId,
      room_id: this.rooms.get(code.toUpperCase())?.id || '',
      question_trigger_count: evaluation.questionTriggerCount,
      status: evaluation.status,
      rationale: evaluation.rationale,
      created_at: new Date().toISOString(),
    };
    list.push(item);
    this.offTrackEvaluationsBySession.set(evaluation.sessionId, list);
    realtimeBroadcaster.notify(code.toUpperCase(), 'OFF_TRACK_EVALUATED');
    return item;
  }

  async useAIQuota(code: string, playerToken: string): Promise<boolean> {
    const uppercaseCode = code.toUpperCase();
    const sessionId = this.currentSessionByRoom.get(uppercaseCode);
    if (!sessionId) return false;
    const session = this.sessions.get(sessionId);
    if (!session || session.guesser_id !== playerToken) return false;

    if (session.ai_quota_used >= session.ai_quota_total) {
      return false;
    }

    session.ai_quota_used += 1;
    realtimeBroadcaster.notify(uppercaseCode, 'AI_QUOTA_USED');
    return true;
  }

  async toggleOffTrack(code: string, playerToken: string, enabled: boolean): Promise<GameSession> {
    const uppercaseCode = code.toUpperCase();
    const sessionId = this.currentSessionByRoom.get(uppercaseCode);
    if (!sessionId) throw new Error('对局未初始化');
    const session = this.sessions.get(sessionId)!;

    if (session.guesser_id !== playerToken) {
      throw new Error('只有猜词人可以开关思路偏航预警');
    }

    session.off_track_enabled = enabled;
    realtimeBroadcaster.notify(uppercaseCode, 'OFF_TRACK_TOGGLED');
    return { ...session };
  }

  async requestHint(code: string, playerToken: string, cost: HintCost): Promise<HintExchange> {
    const uppercaseCode = code.toUpperCase();
    const sessionId = this.currentSessionByRoom.get(uppercaseCode);
    if (!sessionId) throw new Error('对局未初始化');
    const session = this.sessions.get(sessionId)!;

    if (session.guesser_id !== playerToken) {
      throw new Error('只有猜词人可以申请线索提示');
    }
    if (session.status !== 'playing') {
      throw new Error('当前对局状态不在进行中，无法申请提示');
    }

    if (session.mode === 'challenge') {
      const remaining = session.max_questions - session.completed_questions_count;
      if (remaining < cost) {
        throw new Error(`当前挑战模式仅剩 ${Math.max(0, remaining)} 次提问机会，不足以支付价值 ${cost} 次的线索`);
      }
    }

    const sessionHints = this.hintsBySession.get(sessionId) || [];
    const hasPending = sessionHints.some((h) => h.status === 'pending');
    if (hasPending) {
      throw new Error('当前已有正在等待出题人回应的提示申请，请勿重复申请');
    }

    const hint: HintExchange = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      room_id: session.room_id,
      cost,
      status: 'pending',
      hint_text: null,
      requested_at: new Date().toISOString(),
      responded_at: null,
    };

    sessionHints.push(hint);
    this.hintsBySession.set(sessionId, sessionHints);

    realtimeBroadcaster.notify(uppercaseCode, 'HINT_REQUESTED');
    return { ...hint };
  }

  async provideHint(
    code: string,
    playerToken: string,
    hintId: string,
    hintText: string
  ): Promise<{ hint: HintExchange; session: GameSession }> {
    const uppercaseCode = code.toUpperCase();
    const sessionId = this.currentSessionByRoom.get(uppercaseCode);
    if (!sessionId) throw new Error('对局未初始化');
    const session = this.sessions.get(sessionId)!;

    if (session.question_master_id !== playerToken) {
      throw new Error('只有出题人可以提供线索提示');
    }
    if (session.status !== 'playing') {
      throw new Error('当前对局状态不在进行中');
    }

    const sessionHints = this.hintsBySession.get(sessionId) || [];
    const hint = sessionHints.find((h) => h.id === hintId);
    if (!hint) {
      throw new Error('未找到该提示申请记录');
    }
    if (hint.status !== 'pending') {
      throw new Error('该提示申请已被处理');
    }

    const cleanedText = hintText.trim();
    if (!cleanedText) {
      throw new Error('线索内容不能为空');
    }

    hint.hint_text = cleanedText;
    hint.status = 'provided';
    hint.responded_at = new Date().toISOString();

    // 核心机制：累加已完成问题次数（价值 1、3、5 次）
    session.completed_questions_count += hint.cost;

    realtimeBroadcaster.notify(uppercaseCode, 'HINT_PROVIDED');
    return { hint: { ...hint }, session: { ...session } };
  }

  async rejectHint(code: string, playerToken: string, hintId: string): Promise<HintExchange> {
    const uppercaseCode = code.toUpperCase();
    const sessionId = this.currentSessionByRoom.get(uppercaseCode);
    if (!sessionId) throw new Error('对局未初始化');
    const session = this.sessions.get(sessionId)!;

    if (session.question_master_id !== playerToken && session.guesser_id !== playerToken) {
      throw new Error('无权操作该提示申请');
    }

    const sessionHints = this.hintsBySession.get(sessionId) || [];
    const hint = sessionHints.find((h) => h.id === hintId);
    if (!hint) {
      throw new Error('未找到该提示申请记录');
    }
    if (hint.status !== 'pending') {
      throw new Error('该提示申请已被处理');
    }

    hint.status = 'rejected';
    hint.responded_at = new Date().toISOString();

    realtimeBroadcaster.notify(uppercaseCode, 'HINT_REJECTED');
    return { ...hint };
  }

  private recordMatchHistory(roomCode: string, session: GameSession): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const list = this.matchHistoryByRoom.get(roomCode) || [];
    const duration = session.ended_at && session.started_at
      ? Math.max(1, Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000))
      : 0;

    const qmNickname =
      session.question_master_id === room.host_player_id
        ? room.host_nickname
        : room.guest_nickname || '玩家';
    const guesserNickname =
      session.guesser_id === room.host_player_id
        ? room.host_nickname
        : room.guest_nickname || '玩家';

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

    list.push(historyItem);
    this.matchHistoryByRoom.set(roomCode, list);
  }

  async sendChatMessage(code: string, playerToken: string, text: string): Promise<ChatMessage> {
    const uppercaseCode = code.toUpperCase();
    const room = this.rooms.get(uppercaseCode);
    if (!room) throw new Error('房间不存在');

    let senderNick = '旁观者';
    if (playerToken === room.host_player_id) {
      senderNick = room.host_nickname;
    } else if (playerToken === room.guest_player_id) {
      senderNick = room.guest_nickname || '猜词伙伴';
    }

    const message: ChatMessage = {
      id: crypto.randomUUID(),
      sender_id: playerToken,
      sender_nickname: senderNick,
      text: text.startsWith('[VOICE:') ? text.trim().slice(0, 100000) : text.trim().slice(0, 200),
      created_at: new Date().toISOString(),
    };

    let list = this.chatMessagesByRoom.get(uppercaseCode);
    if (!list) {
      list = [];
      this.chatMessagesByRoom.set(uppercaseCode, list);
    }
    list.push(message);
    if (list.length > 100) list.shift();

    realtimeBroadcaster.notify(uppercaseCode, 'CHAT_MESSAGE');
    return message;
  }

  async sendWebRTCSignal(
    code: string,
    playerToken: string,
    signal: { type: 'offer' | 'answer' | 'candidate' | 'hangup'; payload: any }
  ): Promise<WebRTCSignal> {
    const uppercaseCode = code.toUpperCase();
    const room = this.rooms.get(uppercaseCode);
    if (!room) throw new Error('房间不存在');

    const item: WebRTCSignal = {
      id: crypto.randomUUID(),
      sender_id: playerToken,
      type: signal.type,
      payload: signal.payload,
      created_at: new Date().toISOString(),
    };

    let list = this.webrtcSignalsByRoom.get(uppercaseCode);
    if (!list) {
      list = [];
      this.webrtcSignalsByRoom.set(uppercaseCode, list);
    }
    list.push(item);
    if (list.length > 50) list.shift();

    realtimeBroadcaster.notify(uppercaseCode, 'WEBRTC_SIGNAL');
    return item;
  }

  async getWebRTCSignals(
    code: string,
    playerToken: string,
    since?: string
  ): Promise<WebRTCSignal[]> {
    const uppercaseCode = code.toUpperCase();
    const list = this.webrtcSignalsByRoom.get(uppercaseCode) || [];
    const sinceTime = since ? new Date(since).getTime() : 0;
    return list.filter(
      (s) => s.sender_id !== playerToken && new Date(s.created_at).getTime() > sinceTime
    );
  }
}

// 单例模式挂载至 globalThis，确保开发热更新与生产单例均不丢失内存数据
const globalForStore = globalThis as unknown as {
  memoryRoomStore?: MemoryRoomStore;
};

if (!globalForStore.memoryRoomStore) {
  globalForStore.memoryRoomStore = new MemoryRoomStore();
}

export const memoryRoomStore = globalForStore.memoryRoomStore;
