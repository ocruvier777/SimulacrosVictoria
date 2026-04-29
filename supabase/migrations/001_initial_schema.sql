-- ============================================================
-- VictoriaEdu — Schema inicial
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Función trigger: updated_at automático
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ════════════════════════════════════════════════════════════
-- TABLAS
-- ════════════════════════════════════════════════════════════

-- ── institutions ────────────────────────────────────────────
CREATE TABLE institutions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  logo_url    TEXT,
  config_json JSONB DEFAULT '{}',
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trg_institutions_updated_at
  BEFORE UPDATE ON institutions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── programs ────────────────────────────────────────────────
CREATE TABLE programs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID NOT NULL REFERENCES institutions ON DELETE CASCADE,
  code            TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trg_programs_updated_at
  BEFORE UPDATE ON programs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── program_subjects ────────────────────────────────────────
CREATE TABLE program_subjects (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id     UUID NOT NULL REFERENCES programs ON DELETE CASCADE,
  name           TEXT NOT NULL,
  question_count INTEGER NOT NULL,
  icon           TEXT DEFAULT '📌',
  order_index    INTEGER DEFAULT 0,
  UNIQUE(program_id, name)
);

-- ── exams ───────────────────────────────────────────────────
CREATE TABLE exams (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    UUID NOT NULL REFERENCES programs ON DELETE CASCADE,
  exam_number   INTEGER NOT NULL,
  status        TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'available', 'closed')),
  time_minutes  INTEGER DEFAULT 120,
  num_options   INTEGER DEFAULT 4 CHECK (num_options IN (3, 4)),
  max_attempts  INTEGER DEFAULT 3,
  is_free       BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(program_id, exam_number)
);

CREATE TRIGGER trg_exams_updated_at
  BEFORE UPDATE ON exams
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── readings ────────────────────────────────────────────────
CREATE TABLE readings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID NOT NULL REFERENCES institutions ON DELETE CASCADE,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  language        TEXT DEFAULT 'es' CHECK (language IN ('es', 'en')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trg_readings_updated_at
  BEFORE UPDATE ON readings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── audios ──────────────────────────────────────────────────
CREATE TABLE audios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID NOT NULL REFERENCES institutions ON DELETE CASCADE,
  title           TEXT NOT NULL,
  audio_url       TEXT NOT NULL,
  max_plays       INTEGER DEFAULT 2,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trg_audios_updated_at
  BEFORE UPDATE ON audios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── questions ───────────────────────────────────────────────
CREATE TABLE questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id         UUID NOT NULL REFERENCES exams ON DELETE CASCADE,
  subject         TEXT NOT NULL,
  question_text   TEXT NOT NULL,
  options         JSONB NOT NULL,
  correct_answer  TEXT NOT NULL CHECK (correct_answer IN ('A','B','C','D')),
  justification   TEXT,
  image_url       TEXT,
  reading_id      UUID REFERENCES readings ON DELETE SET NULL,
  audio_id        UUID REFERENCES audios ON DELETE SET NULL,
  order_index     INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trg_questions_updated_at
  BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── profiles ────────────────────────────────────────────────
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email       TEXT NOT NULL,
  name        TEXT,
  phone       TEXT,
  role        TEXT DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── user_programs ───────────────────────────────────────────
CREATE TABLE user_programs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  program_id      UUID NOT NULL REFERENCES programs ON DELETE CASCADE,
  payment_status  TEXT DEFAULT 'free_trial' CHECK (payment_status IN ('free_trial', 'pending', 'paid')),
  enrolled_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, program_id)
);

-- ── exam_sessions ───────────────────────────────────────────
CREATE TABLE exam_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  exam_id          UUID NOT NULL REFERENCES exams ON DELETE CASCADE,
  answers_json     JSONB DEFAULT '{}',
  score            NUMERIC(5,2),
  total_correct    INTEGER DEFAULT 0,
  total_questions  INTEGER DEFAULT 0,
  time_used_seconds INTEGER DEFAULT 0,
  attempt_number   INTEGER DEFAULT 1,
  status           TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  started_at       TIMESTAMPTZ DEFAULT now(),
  finished_at      TIMESTAMPTZ,
  auto_saved_at    TIMESTAMPTZ
);

-- ── payments ────────────────────────────────────────────────
CREATE TABLE payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  program_id          UUID NOT NULL REFERENCES programs ON DELETE CASCADE,
  amount              NUMERIC(10,2) NOT NULL,
  currency            TEXT DEFAULT 'MXN',
  provider            TEXT DEFAULT 'mercadopago' CHECK (provider IN ('mercadopago', 'manual', 'free')),
  status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'refunded')),
  provider_reference  TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- Función helper: is_admin() — definida después de profiles
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════
-- ÍNDICES
-- ════════════════════════════════════════════════════════════

CREATE INDEX idx_questions_exam_id          ON questions(exam_id);
CREATE INDEX idx_questions_exam_id_subject  ON questions(exam_id, subject);
CREATE INDEX idx_exam_sessions_user_exam    ON exam_sessions(user_id, exam_id);
CREATE INDEX idx_user_programs_user_id      ON user_programs(user_id);
CREATE INDEX idx_programs_institution_id    ON programs(institution_id);

-- ════════════════════════════════════════════════════════════
-- TRIGGER: crear profile automáticamente al registrarse
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ════════════════════════════════════════════════════════════
-- FUNCIÓN: calcular_score
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION calcular_score(p_session_id UUID)
RETURNS VOID AS $$
DECLARE
  v_correct   INTEGER := 0;
  v_total     INTEGER := 0;
  v_exam_id   UUID;
  v_answers   JSONB;
BEGIN
  SELECT exam_id, answers_json
    INTO v_exam_id, v_answers
    FROM exam_sessions
   WHERE id = p_session_id;

  SELECT COUNT(*) INTO v_total
    FROM questions
   WHERE exam_id = v_exam_id;

  SELECT COUNT(*) INTO v_correct
    FROM questions q
   WHERE q.exam_id = v_exam_id
     AND v_answers->>q.id::text = q.correct_answer;

  UPDATE exam_sessions
     SET score           = CASE WHEN v_total > 0 THEN ROUND((v_correct::numeric / v_total) * 100, 2) ELSE 0 END,
         total_correct   = v_correct,
         total_questions = v_total,
         status          = 'completed',
         finished_at     = now()
   WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ════════════════════════════════════════════════════════════

-- Habilitar RLS en todas las tablas
ALTER TABLE institutions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams           ENABLE ROW LEVEL SECURITY;
ALTER TABLE readings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audios          ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_programs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments        ENABLE ROW LEVEL SECURITY;

-- ── Catálogos públicos: todos leen, solo admins modifican ──

-- institutions
CREATE POLICY "institutions_select" ON institutions
  FOR SELECT USING (true);
CREATE POLICY "institutions_admin_insert" ON institutions
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "institutions_admin_update" ON institutions
  FOR UPDATE USING (is_admin());
CREATE POLICY "institutions_admin_delete" ON institutions
  FOR DELETE USING (is_admin());

-- programs
CREATE POLICY "programs_select" ON programs
  FOR SELECT USING (true);
CREATE POLICY "programs_admin_insert" ON programs
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "programs_admin_update" ON programs
  FOR UPDATE USING (is_admin());
CREATE POLICY "programs_admin_delete" ON programs
  FOR DELETE USING (is_admin());

-- program_subjects
CREATE POLICY "program_subjects_select" ON program_subjects
  FOR SELECT USING (true);
CREATE POLICY "program_subjects_admin_insert" ON program_subjects
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "program_subjects_admin_update" ON program_subjects
  FOR UPDATE USING (is_admin());
CREATE POLICY "program_subjects_admin_delete" ON program_subjects
  FOR DELETE USING (is_admin());

-- exams
CREATE POLICY "exams_select" ON exams
  FOR SELECT USING (true);
CREATE POLICY "exams_admin_insert" ON exams
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "exams_admin_update" ON exams
  FOR UPDATE USING (is_admin());
CREATE POLICY "exams_admin_delete" ON exams
  FOR DELETE USING (is_admin());

-- readings
CREATE POLICY "readings_select" ON readings
  FOR SELECT USING (true);
CREATE POLICY "readings_admin_insert" ON readings
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "readings_admin_update" ON readings
  FOR UPDATE USING (is_admin());
CREATE POLICY "readings_admin_delete" ON readings
  FOR DELETE USING (is_admin());

-- audios
CREATE POLICY "audios_select" ON audios
  FOR SELECT USING (true);
CREATE POLICY "audios_admin_insert" ON audios
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "audios_admin_update" ON audios
  FOR UPDATE USING (is_admin());
CREATE POLICY "audios_admin_delete" ON audios
  FOR DELETE USING (is_admin());

-- questions
CREATE POLICY "questions_select" ON questions
  FOR SELECT USING (true);
CREATE POLICY "questions_admin_insert" ON questions
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "questions_admin_update" ON questions
  FOR UPDATE USING (is_admin());
CREATE POLICY "questions_admin_delete" ON questions
  FOR DELETE USING (is_admin());

-- ── Datos del usuario: cada quien ve lo suyo, admins todo ──

-- profiles
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (id = auth.uid() OR is_admin());
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid() OR is_admin());
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (true);

-- user_programs
CREATE POLICY "user_programs_select" ON user_programs
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "user_programs_insert" ON user_programs
  FOR INSERT WITH CHECK (user_id = auth.uid() OR is_admin());
CREATE POLICY "user_programs_update" ON user_programs
  FOR UPDATE USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "user_programs_delete" ON user_programs
  FOR DELETE USING (is_admin());

-- exam_sessions
CREATE POLICY "exam_sessions_select" ON exam_sessions
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "exam_sessions_insert" ON exam_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "exam_sessions_update" ON exam_sessions
  FOR UPDATE USING (user_id = auth.uid() OR is_admin());

-- payments
CREATE POLICY "payments_select" ON payments
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "payments_insert" ON payments
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "payments_update" ON payments
  FOR UPDATE USING (is_admin());
