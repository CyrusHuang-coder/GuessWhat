export type PlayerRole = 'question_master' | 'guesser';

export type RoomStatus = 'waiting_player' | 'in_game' | 'ended';

export type SessionStatus = 'setting_selection' | 'word_selection' | 'playing' | 'settled';

export type GameMode = 'normal' | 'challenge';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type AnswerType = 'yes' | 'no' | 'uncertain';

export type QuestionStatus = 'pending' | 'clarification_requested' | 'revised' | 'answered';

export type GuessStatus = 'pending' | 'correct' | 'incorrect';

export type OffTrackStatus = 'effective' | 'possible_off_track' | 'insufficient_info';

export interface Room {
  id: string;
  code: string;
  status: RoomStatus;
  host_player_id: string;
  host_nickname: string;
  guest_player_id: string | null;
  guest_nickname: string | null;
  host_last_active: string;
  guest_last_active: string | null;
  created_at: string;
  updated_at: string;
}

export interface GameSession {
  id: string;
  room_id: string;
  round_number: number;
  status: SessionStatus;
  question_master_id: string;
  guesser_id: string;
  theme: string | null;
  difficulty: Difficulty;
  mode: GameMode;
  max_questions: number;
  secret_word: string | null; // 仅向出题人或结算后展示
  secret_word_category: string | null;
  secret_word_note: string | null;
  is_custom_word: boolean;
  completed_questions_count: number;
  wrong_guesses_count: number;
  ai_quota_total: number;
  ai_quota_used: number;
  off_track_enabled: boolean;
  result: 'guessed' | 'surrendered' | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface Question {
  id: string;
  session_id: string;
  room_id: string;
  question_number: number;
  original_text: string;
  revised_text: string | null;
  status: QuestionStatus;
  clarification_reason: string | null;
  clarification_count: number;
  answer: AnswerType | null;
  answered_at: string | null;
  created_at: string;
}

export interface Guess {
  id: string;
  session_id: string;
  room_id: string;
  guess_text: string;
  status: GuessStatus;
  adjudicated_at: string | null;
  created_at: string;
}

export type HintCost = 1 | 3 | 5;
export type HintStatus = 'pending' | 'provided' | 'rejected';

export interface HintExchange {
  id: string;
  session_id: string;
  room_id: string;
  cost: HintCost;
  status: HintStatus;
  hint_text: string | null;
  requested_at: string;
  responded_at: string | null;
}

export interface OffTrackEvaluation {
  id: string;
  session_id: string;
  room_id: string;
  question_trigger_count: number;
  status: OffTrackStatus;
  rationale: string;
  created_at: string;
}

export interface WordItem {
  id: string;
  name: string;
  theme: string;
  difficulty: Difficulty;
  aliases?: string[];
  note?: string;
}

export interface MatchHistoryItem {
  round_number: number;
  question_master_nickname: string;
  guesser_nickname: string;
  theme: string;
  difficulty: Difficulty;
  mode: GameMode;
  max_questions: number;
  completed_questions_count: number;
  wrong_guesses_count: number;
  result: 'guessed' | 'surrendered';
  secret_word: string;
  duration_seconds: number;
  ai_quota_used: number;
  off_track_enabled: boolean;
  ended_at: string;
}

/**
 * 前端拉取或实时接收的安全 DTO，根据调用者身份已完成脱敏
 */
export interface GameStateDTO {
  room: Room;
  session: GameSession | null;
  questions: Question[];
  guesses: Guess[];
  hints: HintExchange[]; // 新增：线索提示兑换记录
  offTrackEvaluations: OffTrackEvaluation[]; // 仅猜词人可见
  matchHistory: MatchHistoryItem[];
  myRole: PlayerRole | 'spectator';
  isHost: boolean;
  opponentOnline: boolean;
  chatMessages?: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_nickname: string;
  text: string;
  created_at: string;
}

export interface WebRTCSignal {
  id: string;
  sender_id: string;
  type: 'offer' | 'answer' | 'candidate' | 'hangup';
  payload: any;
  created_at: string;
}

export interface AIRecommendation {
  questions: {
    question: string;
    rationale: string;
  }[];
}

export interface AIStageHint {
  hint: string;
  direction: string;
}

