-- ========================================================
-- 「是非之间」 (Guess What) - Supabase 数据库初始化脚本
-- ========================================================

-- 1. 创建房间表
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) UNIQUE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'waiting_player', -- waiting_player, in_game, ended
    host_player_id VARCHAR(64) NOT NULL,
    host_nickname VARCHAR(64) NOT NULL,
    guest_player_id VARCHAR(64),
    guest_nickname VARCHAR(64),
    host_last_active TIMESTAMPTZ DEFAULT now(),
    guest_last_active TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 创建对局回合表
CREATE TABLE IF NOT EXISTS public.game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    round_number INT NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'setting_selection', -- setting_selection, word_selection, playing, settled
    question_master_id VARCHAR(64) NOT NULL,
    guesser_id VARCHAR(64) NOT NULL,
    theme VARCHAR(64),
    difficulty VARCHAR(20) DEFAULT 'medium', -- easy, medium, hard
    mode VARCHAR(20) DEFAULT 'normal', -- normal, challenge
    max_questions INT DEFAULT 15,
    secret_word TEXT, -- 严格保护：猜词人在结算前不可读取
    secret_word_category TEXT,
    secret_word_note TEXT,
    is_custom_word BOOLEAN DEFAULT false,
    completed_questions_count INT DEFAULT 0,
    wrong_guesses_count INT DEFAULT 0,
    ai_quota_total INT DEFAULT 2,
    ai_quota_used INT DEFAULT 0,
    off_track_enabled BOOLEAN DEFAULT false,
    result VARCHAR(30), -- guessed, surrendered
    started_at TIMESTAMPTZ DEFAULT now(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 创建问答表
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    question_number INT NOT NULL,
    original_text TEXT NOT NULL,
    revised_text TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending, clarification_requested, revised, answered
    clarification_reason TEXT,
    clarification_count INT DEFAULT 0,
    answer VARCHAR(20), -- yes, no, uncertain
    answered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. 创建正式猜词表
CREATE TABLE IF NOT EXISTS public.guesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    guess_text TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, correct, incorrect
    adjudicated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. 创建思路偏航预警记录表
CREATE TABLE IF NOT EXISTS public.off_track_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    question_trigger_count INT NOT NULL,
    status VARCHAR(30) NOT NULL, -- effective, possible_off_track, insufficient_info
    rationale TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. 创建索引以优化实时查询
CREATE INDEX IF NOT EXISTS idx_rooms_code ON public.rooms(code);
CREATE INDEX IF NOT EXISTS idx_sessions_room ON public.game_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_questions_session ON public.questions(session_id);
CREATE INDEX IF NOT EXISTS idx_guesses_session ON public.guesses(session_id);

-- 7. 开启 Supabase Realtime 复制广播
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.questions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guesses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.off_track_evaluations;

-- 8. 启用行级安全策略 (RLS)
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.off_track_evaluations ENABLE ROW LEVEL SECURITY;

-- 允许匿名客户端通过 Service Role (服务端函数/API Route) 全权操作
-- 客户端仅通过服务端 API 安全调用，避免在前端暴露 service_role_key 或绕过鉴权
CREATE POLICY "Allow public read for active rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Allow public read for non-secret game data" ON public.questions FOR SELECT USING (true);
CREATE POLICY "Allow public read for guesses" ON public.guesses FOR SELECT USING (true);

