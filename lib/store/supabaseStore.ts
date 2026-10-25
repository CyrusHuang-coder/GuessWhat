import { createClient, SupabaseClient } from '@supabase/supabase-js';
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

function generateRoomCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export class SupabaseRoomStore implements IRoomStore {
  private client: SupabaseClient | null = null;
  private chatMessagesByRoom: Map<string, ChatMessage[]> = new Map();
  private webrtcSignalsByRoom: Map<string, WebRTCSignal[]> = new Map();

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && serviceKey) {
      this.client = createClient(url, serviceKey, {
        auth: { persistSession: false },
      });
    }
  }

  private ensureClient(): SupabaseClient {
    if (!this.client) {
      throw new Error(
        '未检测到有效的 Supabase 配置。请在 .env.local 中设置 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY，或切换 DATA_PROVIDER=local 使用内置极速实时引擎。'
      );
    }
    return this.client;
  }

  async createRoom(hostNickname: string): Promise<{ room: Room; playerToken: string }> {
    const supabase = this.ensureClient();
    const code = generateRoomCode();
    const hostToken = crypto.randomUUID();
    const now = new Date().toISOString();

    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .insert({
        code,
        status: 'waiting_player',
        host_player_id: hostToken,
        host_nickname: hostNickname.trim() || '出题房主',
        host_last_active: now,
      })
      .select()
      .single();

    if (roomErr || !room) {
      throw new Error(`创建房间失败: ${roomErr?.message}`);
    }

    const { error: sessionErr } = await supabase.from('game_sessions').insert({
      room_id: room.id,
      round_number: 1,
      status: 'setting_selection',
      question_master_id: hostToken,
      guesser_id: '',
      difficulty: 'medium',
      mode: 'normal',
      max_questions: 15,
      ai_quota_total: 2,
      ai_quota_used: 0,
      off_track_enabled: false,
    });

    if (sessionErr) {
      throw new Error(`初始化对局失败: ${sessionErr.message}`);
    }

    return { room, playerToken: hostToken };
  }

  async createBotRoom(
    nickname: string,
    options?: { theme?: string; difficulty?: Difficulty }
  ): Promise<{ room: Room; playerToken: string }> {
    const supabase = this.ensureClient();
    const code = generateRoomCode();
    const hostToken = crypto.randomUUID();
    const botPlayerId = 'bot_player';
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

    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .insert({
        code,
        status: 'in_game',
        host_player_id: hostToken,
        host_nickname: nickname.trim() || '人类侦探',
        guest_player_id: botPlayerId,
        guest_nickname: 'AI 智能出题官 (DeepSeek)',
      })
      .select()
      .single();

    if (roomErr || !room) {
      throw new Error(`创建人机房间失败: ${roomErr?.message}`);
    }

    const { error: sessionErr } = await supabase.from('sessions').insert({
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
      ai_quota_total: 2,
      ai_quota_used: 0,
      off_track_enabled: false,
    });

    if (sessionErr) {
      throw new Error(`初始化人机对局失败: ${sessionErr.message}`);
    }

    return { room, playerToken: hostToken };
  }

  async getSecretWordForBot(code: string): Promise<string | null> {
    const supabase = this.ensureClient();
    const room = await this.getRoomByCode(code);
    if (!room) return null;
    const { data } = await supabase
      .from('sessions')
      .select('secret_word')
      .eq('room_id', room.id)
      .order('round_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.secret_word || null;
  }

  async getRoomByCode(code: string): Promise<Room | null> {
    const supabase = this.ensureClient();
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code.toUpperCase())
      .maybeSingle();

    if (error || !data) return null;
    return data;
  }

  async joinRoom(
    code: string,
    guestNickname: string,
    options?: { reclaimRole?: 'host' | 'guest'; playerToken?: string }
  ): Promise<{ room: Room; playerToken: string }> {
    const supabase = this.ensureClient();
    const room = await this.getRoomByCode(code);
    if (!room) throw new Error('房间不存在');
    if (room.status === 'ended') throw new Error('房间已解散');

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

      // 3. 携带已有的 Token
      if (options?.playerToken === room.host_player_id) {
        return { room, playerToken: room.host_player_id };
      }
      if (options?.playerToken === room.guest_player_id) {
        return { room, playerToken: room.guest_player_id };
      }

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

    const { data: updatedRoom, error: updateErr } = await supabase
      .from('rooms')
      .update({
        guest_player_id: guestToken,
        guest_nickname: guestNickname.trim() || '猜词伙伴',
        guest_last_active: now,
        status: 'in_game',
        updated_at: now,
      })
      .eq('id', room.id)
      .select()
      .single();

    if (updateErr) throw new Error(`加入房间失败: ${updateErr.message}`);

    // 更新当前会话的猜词人
    await supabase
      .from('game_sessions')
      .update({ guesser_id: guestToken })
      .eq('room_id', room.id)
      .eq('round_number', 1);

    realtimeBroadcaster.notify(code.toUpperCase(), 'PLAYER_JOINED');
    return { room: updatedRoom, playerToken: guestToken };
  }

  async updateHeartbeat(code: string, playerToken: string): Promise<boolean> {
    const supabase = this.ensureClient();
    const room = await this.getRoomByCode(code);
    if (!room) return false;

    const now = new Date().toISOString();
    const updateObj: Record<string, string> = {};
    if (room.host_player_id === playerToken) updateObj.host_last_active = now;
    else if (room.guest_player_id === playerToken) updateObj.guest_last_active = now;
    else return false;

    await supabase.from('rooms').update(updateObj).eq('id', room.id);
    return true;
  }

  async getRoomState(code: string, playerToken?: string): Promise<GameStateDTO | null> {
    const supabase = this.ensureClient();
    const room = await this.getRoomByCode(code);
    if (!room) return null;

    const { data: session } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('room_id', room.id)
      .order('round_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    let questions: Question[] = [];
    let guesses: Guess[] = [];
    let offTrackEvaluations: OffTrackEvaluation[] = [];

    if (session) {
      const { data: qData } = await supabase
        .from('questions')
        .select('*')
        .eq('session_id', session.id)
        .order('question_number', { ascending: true });
      questions = qData || [];

      const { data: gData } = await supabase
        .from('guesses')
        .select('*')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true });
      guesses = gData || [];

      const { data: otData } = await supabase
        .from('off_track_evaluations')
        .select('*')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true });
      offTrackEvaluations = otData || [];
    }

    const isHost = playerToken === room.host_player_id;
    let myRole: PlayerRole | 'spectator' = 'spectator';
    if (session) {
      if (playerToken === session.question_master_id) myRole = 'question_master';
      else if (playerToken === session.guesser_id) myRole = 'guesser';
    }

    const now = Date.now();
    const isOnline = (iso?: string | null) => (iso ? now - new Date(iso).getTime() < 40000 : false);
    const opponentOnline = isHost ? isOnline(room.guest_last_active) : isOnline(room.host_last_active);

    // 防剧透脱敏：只要不是出题人且未结算，绝对不返回秘密答案及注解
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
      room,
      session: sanitizedSession,
      questions,
      guesses,
      hints: [],
      offTrackEvaluations: myRole === 'guesser' ? offTrackEvaluations : [],
      matchHistory: [],
      myRole,
      isHost,
      opponentOnline,
      chatMessages: (this.chatMessagesByRoom.get(code.toUpperCase()) || []).slice(-50),
    };
  }

  async saveSettings(
    code: string,
    playerToken: string,
    settings: { theme: string; difficulty: Difficulty; mode: GameMode; maxQuestions?: number }
  ): Promise<GameSession> {
    const supabase = this.ensureClient();
    const state = await this.getRoomState(code, playerToken);
    if (!state?.session) throw new Error('对局未初始化');
    if (state.session.guesser_id !== playerToken) throw new Error('只有猜词人可以设置游戏');

    const quota = settings.difficulty === 'easy' ? 3 : settings.difficulty === 'medium' ? 2 : 1;
    const maxQ = settings.mode === 'challenge' ? Math.max(1, settings.maxQuestions ?? 15) : 999;

    const { data: updated, error } = await supabase
      .from('game_sessions')
      .update({
        theme: settings.theme,
        difficulty: settings.difficulty,
        mode: settings.mode,
        max_questions: maxQ,
        ai_quota_total: quota,
        ai_quota_used: 0,
        status: 'word_selection',
      })
      .eq('id', state.session.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    realtimeBroadcaster.notify(code.toUpperCase(), 'SETTINGS_SAVED');
    return updated;
  }

  async revertToSettingSelection(code: string, playerToken: string): Promise<GameSession> {
    const supabase = this.ensureClient();
    const state = await this.getRoomState(code, playerToken);
    if (!state?.session) throw new Error('对局未初始化');
    if (state.session.guesser_id !== playerToken) throw new Error('只有猜词人可以重新选择主题');
    if (state.session.status !== 'word_selection') {
      throw new Error('出题人已选定词条或游戏已进入后续阶段，无法直接回退');
    }

    const { data: updated, error } = await supabase
      .from('game_sessions')
      .update({
        theme: null,
        status: 'setting_selection',
      })
      .eq('id', state.session.id)
      .select()
      .single();

    if (error || !updated) throw new Error(error?.message || '重置主题失败');
    realtimeBroadcaster.notify(code.toUpperCase(), 'SETTINGS_RESET');
    return updated;
  }

  async swapInitialRoles(code: string, playerToken: string): Promise<GameSession> {
    const supabase = this.ensureClient();
    const state = await this.getRoomState(code, playerToken);
    if (!state?.session) throw new Error('对局未初始化');

    if (state.session.status !== 'setting_selection') {
      throw new Error('只有在对局准备阶段（设定规则前）可以调整角色');
    }

    if (playerToken !== state.room.host_player_id && playerToken !== state.room.guest_player_id) {
      throw new Error('只有房间内的玩家可以调整角色');
    }

    if (!state.room.guest_player_id) {
      throw new Error('等待第二位玩家进入房间后方可互换出题与猜词身份');
    }

    const { data: updated, error } = await supabase
      .from('game_sessions')
      .update({
        question_master_id: state.session.guesser_id,
        guesser_id: state.session.question_master_id,
      })
      .eq('id', state.session.id)
      .select()
      .single();

    if (error || !updated) throw new Error(error?.message || '互换角色失败');
    realtimeBroadcaster.notify(code.toUpperCase(), 'ROLES_SWAPPED');
    return updated;
  }

  async setWord(
    code: string,
    playerToken: string,
    wordData: { word: string; category?: string; note?: string; isCustom?: boolean }
  ): Promise<GameSession> {
    const supabase = this.ensureClient();
    const state = await this.getRoomState(code, playerToken);
    if (!state?.session) throw new Error('对局未初始化');
    if (state.session.question_master_id !== playerToken) throw new Error('只有出题人可以设定秘密答案');

    const { data: updated, error } = await supabase
      .from('game_sessions')
      .update({
        secret_word: wordData.word.trim(),
        secret_word_category: wordData.category || state.session.theme,
        secret_word_note: wordData.note || null,
        is_custom_word: !!wordData.isCustom,
        status: 'playing',
        started_at: new Date().toISOString(),
      })
      .eq('id', state.session.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    realtimeBroadcaster.notify(code.toUpperCase(), 'WORD_SET');
    return updated;
  }

  async submitQuestion(code: string, playerToken: string, text: string): Promise<Question> {
    const supabase = this.ensureClient();
    const state = await this.getRoomState(code, playerToken);
    if (!state?.session) throw new Error('对局未初始化');
    if (state.session.guesser_id !== playerToken) throw new Error('只有猜词人可以提问');

    const { data: q, error } = await supabase
      .from('questions')
      .insert({
        session_id: state.session.id,
        room_id: state.room.id,
        question_number: state.questions.length + 1,
        original_text: text.trim(),
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    realtimeBroadcaster.notify(code.toUpperCase(), 'QUESTION_SUBMITTED');
    return q;
  }

  async answerQuestion(
    code: string,
    playerToken: string,
    questionId: string,
    answer: AnswerType
  ): Promise<Question> {
    const supabase = this.ensureClient();
    const state = await this.getRoomState(code, playerToken);
    if (!state?.session) throw new Error('对局未初始化');
    if (state.session.question_master_id !== playerToken) throw new Error('只有出题人可以回答');

    const { data: q, error } = await supabase
      .from('questions')
      .update({
        answer,
        status: 'answered',
        answered_at: new Date().toISOString(),
      })
      .eq('id', questionId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await supabase
      .from('game_sessions')
      .update({ completed_questions_count: state.session.completed_questions_count + 1 })
      .eq('id', state.session.id);

    realtimeBroadcaster.notify(code.toUpperCase(), 'QUESTION_ANSWERED');
    return q;
  }

  async reviseAnswer(
    code: string,
    playerToken: string,
    questionId: string,
    newAnswer: AnswerType
  ): Promise<Question> {
    const supabase = this.ensureClient();
    const state = await this.getRoomState(code, playerToken);
    if (!state?.session) throw new Error('对局未初始化');
    if (state.session.question_master_id !== playerToken) throw new Error('只有出题人可以修正回答');
    if (state.session.status !== 'playing') throw new Error('对局不在进行中');

    const { data: q, error } = await supabase
      .from('questions')
      .update({
        answer: newAnswer,
        answered_at: new Date().toISOString(),
      })
      .eq('id', questionId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    realtimeBroadcaster.notify(code.toUpperCase(), 'QUESTION_ANSWER_REVISED');
    return q;
  }

  async clarifyQuestion(code: string, playerToken: string, questionId: string, reason: string): Promise<Question> {
    const supabase = this.ensureClient();
    const { data: q, error } = await supabase
      .from('questions')
      .update({
        status: 'clarification_requested',
        clarification_reason: reason.trim() || '问题存在歧义',
        clarification_count: 1,
      })
      .eq('id', questionId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    realtimeBroadcaster.notify(code.toUpperCase(), 'CLARIFICATION_REQUESTED');
    return q;
  }

  async reviseQuestion(code: string, playerToken: string, questionId: string, revisedText: string): Promise<Question> {
    const supabase = this.ensureClient();
    const { data: q, error } = await supabase
      .from('questions')
      .update({
        status: 'revised',
        revised_text: revisedText.trim(),
      })
      .eq('id', questionId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    realtimeBroadcaster.notify(code.toUpperCase(), 'QUESTION_REVISED');
    return q;
  }

  async submitGuess(code: string, playerToken: string, guessText: string): Promise<Guess> {
    const supabase = this.ensureClient();
    const state = await this.getRoomState(code, playerToken);
    if (!state?.session) throw new Error('对局未初始化');

    const { data: g, error } = await supabase
      .from('guesses')
      .insert({
        session_id: state.session.id,
        room_id: state.room.id,
        guess_text: guessText.trim(),
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    realtimeBroadcaster.notify(code.toUpperCase(), 'GUESS_SUBMITTED');
    return g;
  }

  async adjudicateGuess(
    code: string,
    playerToken: string,
    guessId: string,
    status: 'correct' | 'incorrect'
  ): Promise<{ guess: Guess; session: GameSession }> {
    const supabase = this.ensureClient();
    const state = await this.getRoomState(code, playerToken);
    if (!state?.session) throw new Error('对局未初始化');

    const { data: g, error } = await supabase
      .from('guesses')
      .update({
        status,
        adjudicated_at: new Date().toISOString(),
      })
      .eq('id', guessId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    let sessionUpdate: Record<string, any> = {};
    if (status === 'incorrect') {
      sessionUpdate = { wrong_guesses_count: state.session.wrong_guesses_count + 1 };
    } else {
      sessionUpdate = {
        status: 'settled',
        result: 'guessed',
        ended_at: new Date().toISOString(),
      };
    }

    const { data: updatedSession } = await supabase
      .from('game_sessions')
      .update(sessionUpdate)
      .eq('id', state.session.id)
      .select()
      .single();

    realtimeBroadcaster.notify(code.toUpperCase(), 'GUESS_ADJUDICATED');
    return { guess: g, session: updatedSession };
  }

  async surrender(code: string, playerToken: string): Promise<GameSession> {
    const supabase = this.ensureClient();
    const state = await this.getRoomState(code, playerToken);
    if (!state?.session) throw new Error('对局未初始化');

    const { data: updatedSession, error } = await supabase
      .from('game_sessions')
      .update({
        status: 'settled',
        result: 'surrendered',
        ended_at: new Date().toISOString(),
      })
      .eq('id', state.session.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    realtimeBroadcaster.notify(code.toUpperCase(), 'SURRENDERED');
    return updatedSession;
  }

  async nextRoundAction(
    code: string,
    playerToken: string,
    action: 'swap_roles' | 'keep_roles' | 'end_game' | 'restart_game'
  ): Promise<Room> {
    const supabase = this.ensureClient();
    const state = await this.getRoomState(code, playerToken);
    if (!state?.room || !state.session) throw new Error('房间或对局不存在');

    if (action === 'end_game') {
      const { data: r } = await supabase
        .from('rooms')
        .update({ status: 'ended' })
        .eq('id', state.room.id)
        .select()
        .single();
      realtimeBroadcaster.notify(code.toUpperCase(), 'GAME_ENDED');
      return r;
    }

    await supabase.from('rooms').update({ status: 'in_game' }).eq('id', state.room.id);

    const qm = action === 'swap_roles' ? state.session.guesser_id : state.session.question_master_id;
    const gs = action === 'swap_roles' ? state.session.question_master_id : state.session.guesser_id;

    await supabase.from('game_sessions').insert({
      room_id: state.room.id,
      round_number: state.session.round_number + 1,
      status: 'setting_selection',
      question_master_id: qm,
      guesser_id: gs,
      difficulty: 'medium',
      mode: 'normal',
      max_questions: 15,
      ai_quota_total: 2,
      ai_quota_used: 0,
      off_track_enabled: false,
    });

    realtimeBroadcaster.notify(code.toUpperCase(), 'NEXT_ROUND_STARTED');
    return state.room;
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
    const supabase = this.ensureClient();
    const { data, error } = await supabase
      .from('off_track_evaluations')
      .insert({
        session_id: evaluation.sessionId,
        room_id: (await this.getRoomByCode(code))?.id,
        question_trigger_count: evaluation.questionTriggerCount,
        status: evaluation.status,
        rationale: evaluation.rationale,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    realtimeBroadcaster.notify(code.toUpperCase(), 'OFF_TRACK_EVALUATED');
    return data;
  }

  async useAIQuota(code: string, playerToken: string): Promise<boolean> {
    const supabase = this.ensureClient();
    const state = await this.getRoomState(code, playerToken);
    if (!state?.session) return false;
    if (state.session.ai_quota_used >= state.session.ai_quota_total) return false;

    await supabase
      .from('game_sessions')
      .update({ ai_quota_used: state.session.ai_quota_used + 1 })
      .eq('id', state.session.id);

    realtimeBroadcaster.notify(code.toUpperCase(), 'AI_QUOTA_USED');
    return true;
  }

  async toggleOffTrack(code: string, playerToken: string, enabled: boolean): Promise<GameSession> {
    const supabase = this.ensureClient();
    const state = await this.getRoomState(code, playerToken);
    if (!state?.session) throw new Error('对局未初始化');

    const { data: updated, error } = await supabase
      .from('game_sessions')
      .update({ off_track_enabled: enabled })
      .eq('id', state.session.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    realtimeBroadcaster.notify(code.toUpperCase(), 'OFF_TRACK_TOGGLED');
    return updated;
  }

  async requestHint(code: string, playerToken: string, cost: HintCost): Promise<HintExchange> {
    const state = await this.getRoomState(code, playerToken);
    if (!state?.session) throw new Error('对局未初始化');
    if (state.session.guesser_id !== playerToken) throw new Error('只有猜词人可以申请线索提示');

    const hint: HintExchange = {
      id: crypto.randomUUID(),
      session_id: state.session.id,
      room_id: state.room.id,
      cost,
      status: 'pending',
      hint_text: null,
      requested_at: new Date().toISOString(),
      responded_at: null,
    };
    realtimeBroadcaster.notify(code.toUpperCase(), 'HINT_REQUESTED');
    return hint;
  }

  async provideHint(
    code: string,
    playerToken: string,
    hintId: string,
    hintText: string
  ): Promise<{ hint: HintExchange; session: GameSession }> {
    const supabase = this.ensureClient();
    const state = await this.getRoomState(code, playerToken);
    if (!state?.session) throw new Error('对局未初始化');
    if (state.session.question_master_id !== playerToken) throw new Error('只有出题人可以提供线索');

    const newCount = state.session.completed_questions_count + 1;
    const { data: session } = await supabase
      .from('game_sessions')
      .update({ completed_questions_count: newCount })
      .eq('id', state.session.id)
      .select()
      .single();

    const hint: HintExchange = {
      id: hintId,
      session_id: state.session.id,
      room_id: state.room.id,
      cost: 1,
      status: 'provided',
      hint_text: hintText,
      requested_at: new Date().toISOString(),
      responded_at: new Date().toISOString(),
    };
    realtimeBroadcaster.notify(code.toUpperCase(), 'HINT_PROVIDED');
    return { hint, session: session || state.session };
  }

  async rejectHint(code: string, playerToken: string, hintId: string): Promise<HintExchange> {
    const state = await this.getRoomState(code, playerToken);
    const hint: HintExchange = {
      id: hintId,
      session_id: state?.session?.id || '',
      room_id: state?.room?.id || '',
      cost: 1,
      status: 'rejected',
      hint_text: null,
      requested_at: new Date().toISOString(),
      responded_at: new Date().toISOString(),
    };
    realtimeBroadcaster.notify(code.toUpperCase(), 'HINT_REJECTED');
    return hint;
  }

  async sendChatMessage(code: string, playerToken: string, text: string): Promise<ChatMessage> {
    const uppercaseCode = code.toUpperCase();
    const room = await this.getRoomByCode(uppercaseCode);
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
    const room = await this.getRoomByCode(uppercaseCode);
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
