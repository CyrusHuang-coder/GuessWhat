import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  AnswerType,
  Difficulty,
  GameMode,
  GameSession,
  GameStateDTO,
  Guess,
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

export class SupabaseRoomStore implements IRoomStore {
  private client: SupabaseClient | null = null;

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

  async joinRoom(code: string, guestNickname: string): Promise<{ room: Room; playerToken: string }> {
    const supabase = this.ensureClient();
    const room = await this.getRoomByCode(code);
    if (!room) throw new Error('房间不存在');
    if (room.status === 'ended') throw new Error('房间已解散');
    if (room.guest_player_id) throw new Error('房间已满员');

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
    const isOnline = (iso?: string | null) => (iso ? now - new Date(iso).getTime() < 15000 : false);
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
      offTrackEvaluations: myRole === 'guesser' ? offTrackEvaluations : [],
      matchHistory: [],
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
    action: 'swap_roles' | 'keep_roles' | 'end_game'
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
}
