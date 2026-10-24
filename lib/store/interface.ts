import {
  AnswerType,
  Difficulty,
  GameMode,
  GameSession,
  GameStateDTO,
  Guess,
  HintCost,
  HintExchange,
  OffTrackEvaluation,
  Question,
  Room,
} from '../types/game';

export interface IRoomStore {
  createRoom(hostNickname: string): Promise<{ room: Room; playerToken: string }>;
  getRoomByCode(code: string): Promise<Room | null>;
  joinRoom(code: string, guestNickname: string): Promise<{ room: Room; playerToken: string }>;
  updateHeartbeat(code: string, playerToken: string): Promise<boolean>;
  getRoomState(code: string, playerToken?: string): Promise<GameStateDTO | null>;

  saveSettings(
    code: string,
    playerToken: string,
    settings: {
      theme: string;
      difficulty: Difficulty;
      mode: GameMode;
      maxQuestions?: number;
    }
  ): Promise<GameSession>;

  setWord(
    code: string,
    playerToken: string,
    wordData: {
      word: string;
      category?: string;
      note?: string;
      isCustom?: boolean;
    }
  ): Promise<GameSession>;

  submitQuestion(code: string, playerToken: string, text: string): Promise<Question>;

  answerQuestion(
    code: string,
    playerToken: string,
    questionId: string,
    answer: AnswerType
  ): Promise<Question>;

  clarifyQuestion(
    code: string,
    playerToken: string,
    questionId: string,
    reason: string
  ): Promise<Question>;

  reviseQuestion(
    code: string,
    playerToken: string,
    questionId: string,
    revisedText: string
  ): Promise<Question>;

  submitGuess(code: string, playerToken: string, guessText: string): Promise<Guess>;

  adjudicateGuess(
    code: string,
    playerToken: string,
    guessId: string,
    status: 'correct' | 'incorrect'
  ): Promise<{ guess: Guess; session: GameSession }>;

  surrender(code: string, playerToken: string): Promise<GameSession>;

  nextRoundAction(
    code: string,
    playerToken: string,
    action: 'swap_roles' | 'keep_roles' | 'end_game'
  ): Promise<Room>;

  saveOffTrackEvaluation(
    code: string,
    evaluation: {
      sessionId: string;
      questionTriggerCount: number;
      status: 'effective' | 'possible_off_track' | 'insufficient_info';
      rationale: string;
    }
  ): Promise<OffTrackEvaluation>;

  useAIQuota(code: string, playerToken: string): Promise<boolean>;

  toggleOffTrack(code: string, playerToken: string, enabled: boolean): Promise<GameSession>;

  requestHint(code: string, playerToken: string, cost: HintCost): Promise<HintExchange>;

  provideHint(
    code: string,
    playerToken: string,
    hintId: string,
    hintText: string
  ): Promise<{ hint: HintExchange; session: GameSession }>;

  rejectHint(code: string, playerToken: string, hintId: string): Promise<HintExchange>;
}

