-- ============================================================
-- Run this in: Supabase Dashboard → SQL Editor
-- Safe to run multiple times — drops existing policies first.
-- ============================================================
--
-- ⚠️  IMPORTANT — Fix "email rate limit exceeded" (429) errors:
--    Supabase free tier limits signup confirmation emails for the
--    ENTIRE PROJECT (not per address).  To remove this limit during
--    development, disable email confirmation:
--      Supabase Dashboard → Authentication → Settings
--      → toggle OFF "Enable email confirmations"
--    Users will then be signed in immediately without clicking a link.
-- ============================================================

-- ── invite_codes ───────────────────────────────────────────
-- Anonymous users cannot read the table directly (RLS blocks it),
-- but they can call the SECURITY DEFINER function below, which
-- runs with elevated privileges and only exposes whether a code
-- is valid — never the raw row data.

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Authenticated users (newly signed-up teacher) can mark a code as used.
DROP POLICY IF EXISTS "Authenticated users can use invite codes" ON invite_codes;
CREATE POLICY "Authenticated users can use invite codes"
  ON invite_codes FOR UPDATE TO authenticated
  USING  (is_used = false)
  WITH CHECK (used_by = auth.uid());

-- Function callable by anon: validates a code without exposing table data.
CREATE OR REPLACE FUNCTION validate_invite_code(code_input TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  SELECT id
  INTO   rec
  FROM   invite_codes
  WHERE  code       = UPPER(TRIM(code_input))
    AND  is_used    = FALSE
    AND  expires_at >= NOW()
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'id', NULL);
  END IF;

  RETURN jsonb_build_object('valid', true, 'id', rec.id);
END;
$$;

-- Revoke the default PUBLIC grant, then explicitly allow anon + authenticated.
REVOKE ALL ON FUNCTION validate_invite_code(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION validate_invite_code(TEXT) TO anon, authenticated;

-- ── Enable RLS (idempotent) ───────────────────────────────────

ALTER TABLE items_frames       ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_name_colors  ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_prefixes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_bonuses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_inventory     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_purchases     ENABLE ROW LEVEL SECURITY;

-- ── Shop catalogue (read-only for any authenticated user) ─────

DROP POLICY IF EXISTS "Authenticated users can read frames"      ON items_frames;
DROP POLICY IF EXISTS "Authenticated users can read name colors" ON items_name_colors;
DROP POLICY IF EXISTS "Authenticated users can read prefixes"    ON items_prefixes;
DROP POLICY IF EXISTS "Authenticated users can read bonuses"     ON shop_bonuses;

CREATE POLICY "Authenticated users can read frames"
  ON items_frames FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read name colors"
  ON items_name_colors FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read prefixes"
  ON items_prefixes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read bonuses"
  ON shop_bonuses FOR SELECT TO authenticated USING (true);

-- ── user_inventory ────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own inventory"   ON user_inventory;
DROP POLICY IF EXISTS "Users can insert own inventory" ON user_inventory;

CREATE POLICY "Users can view own inventory"
  ON user_inventory FOR SELECT TO authenticated
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert own inventory"
  ON user_inventory FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = profile_id);

-- ── user_purchases ────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own purchases"   ON user_purchases;
DROP POLICY IF EXISTS "Users can insert own purchases" ON user_purchases;
DROP POLICY IF EXISTS "Users can update own purchases" ON user_purchases;
DROP POLICY IF EXISTS "Users can delete own purchases" ON user_purchases;

CREATE POLICY "Users can view own purchases"
  ON user_purchases FOR SELECT TO authenticated
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert own purchases"
  ON user_purchases FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update own purchases"
  ON user_purchases FOR UPDATE TO authenticated
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can delete own purchases"
  ON user_purchases FOR DELETE TO authenticated
  USING (auth.uid() = profile_id);

-- ── profiles ──────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read all profiles.
-- This is intentional: the leaderboard displays names, avatars, and
-- scores for every student, so a broader read policy is required.
DROP POLICY IF EXISTS "Users can read own profile"              ON profiles;
DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile"            ON profiles;

CREATE POLICY "Authenticated users can read all profiles"
  ON profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── teachers ──────────────────────────────────────────────────
-- Own row: read/update (avatar_url, etc.). Without these policies,
-- RLS default-deny blocks UPDATE and the avatar never persists.

ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can read own row" ON teachers;
DROP POLICY IF EXISTS "Teachers can update own row" ON teachers;

CREATE POLICY "Teachers can read own row"
  ON teachers FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Teachers can update own row"
  ON teachers FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── test_results ───────────────────────────────────────────────
-- Needed for the leaderboard (sum scores per student) and for
-- students to see their own past results.

ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read test results"  ON test_results;
DROP POLICY IF EXISTS "Students can insert own test results"       ON test_results;
DROP POLICY IF EXISTS "Students can update own test results"       ON test_results;

CREATE POLICY "Authenticated users can read test results"
  ON test_results FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Students can insert own test results"
  ON test_results FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update own test results"
  ON test_results FOR UPDATE TO authenticated
  USING  (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- ── tests ─────────────────────────────────────────────────────
-- Students must be able to read active tests; teachers must be
-- able to read/insert/update their own tests.

ALTER TABLE tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read active tests" ON tests;
DROP POLICY IF EXISTS "Teachers can read own tests"               ON tests;
DROP POLICY IF EXISTS "Teachers can insert own tests"             ON tests;
DROP POLICY IF EXISTS "Teachers can update own tests"             ON tests;

-- All authenticated users can read tests that are active
-- (students see them through the catalog / profile).
CREATE POLICY "Anyone authenticated can read active tests"
  ON tests FOR SELECT TO authenticated
  USING (is_active = true);

-- Teachers can also read their own inactive tests.
CREATE POLICY "Teachers can read own tests"
  ON tests FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

-- Teachers can create and update their own tests.
CREATE POLICY "Teachers can insert own tests"
  ON tests FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update own tests"
  ON tests FOR UPDATE TO authenticated
  USING  (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- ── group_tests ────────────────────────────────────────────────
-- Students need to read which test IDs are assigned to their group.

ALTER TABLE group_tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read group_tests" ON group_tests;
DROP POLICY IF EXISTS "Teachers can manage group_tests"          ON group_tests;

CREATE POLICY "Authenticated users can read group_tests"
  ON group_tests FOR SELECT TO authenticated
  USING (true);

-- Teachers (or admins) can assign/remove tests from groups.
CREATE POLICY "Teachers can manage group_tests"
  ON group_tests FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── buildings, courses, student_groups ───────────────────────────
-- Signup and teacher stats join these tables. If RLS is enabled
-- without SELECT, teachers get empty cascades and empty leaderboards.

ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read buildings" ON buildings;
DROP POLICY IF EXISTS "Authenticated users can read courses" ON courses;
DROP POLICY IF EXISTS "Authenticated users can read student_groups" ON student_groups;

CREATE POLICY "Authenticated users can read buildings"
  ON buildings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read courses"
  ON courses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read student_groups"
  ON student_groups FOR SELECT TO authenticated USING (true);

-- test_attempts: если на таблице уже включён RLS, добавьте SELECT для authenticated
-- (иначе статистика по студенту не увидит попытки). Не включайте RLS на test_attempts
-- без политик INSERT для студентов — иначе пройденные тесты не сохранятся.

-- ── RPC (SECURITY DEFINER): лидерборд и статистика у преподавателя ─────────────
-- Прямой SELECT по profiles под RLS часто возвращает 0 строк для teacher-JWT,
-- тогда как у student-JWT политики дают полный список. Эти функции вызываются
-- только для auth.uid() IS NOT NULL и обходят RLS при чтении, сохраняя фильтр
-- «не инкогнито» и «не staff» внутри SQL.
-- Выполните этот блок в SQL Editor после остальных политик.

CREATE OR REPLACE FUNCTION public.qf_leaderboard_profiles()
RETURNS SETOF public.profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.*
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND (p.incognito_mode IS DISTINCT FROM true)
    AND lower(trim(coalesce(p.role, ''))) NOT IN ('teacher', 'admin', 'moderator');
$$;

CREATE OR REPLACE FUNCTION public.qf_profiles_for_building(p_building_id bigint)
RETURNS SETOF public.profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.*
  FROM public.profiles p
  INNER JOIN public.student_groups sg ON sg.id = p.group_id
  INNER JOIN public.courses c ON c.id = sg.course_id AND c.building_id = p_building_id
  WHERE auth.uid() IS NOT NULL
    AND (p.incognito_mode IS DISTINCT FROM true)
    AND lower(trim(coalesce(p.role, ''))) NOT IN ('teacher', 'admin', 'moderator');
$$;

CREATE OR REPLACE FUNCTION public.qf_students_in_group(p_group_id bigint)
RETURNS SETOF public.profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.*
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.group_id = p_group_id
    AND (p.incognito_mode IS DISTINCT FROM true)
    AND lower(trim(coalesce(p.role, ''))) NOT IN ('teacher', 'admin', 'moderator');
$$;

DROP FUNCTION IF EXISTS public.qf_profile_by_id(uuid);

CREATE FUNCTION public.qf_profile_by_id(p_id uuid)
RETURNS SETOF public.profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.*
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id = p_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.qf_leaderboard_profiles() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qf_profiles_for_building(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qf_students_in_group(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qf_profile_by_id(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.qf_leaderboard_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.qf_profiles_for_building(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qf_students_in_group(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qf_profile_by_id(uuid) TO authenticated;

-- ── test_questions / test_question_options ─────────────────────────────
-- Students need SELECT to load assigned tests' questions.
-- Teachers need full management for questions/options of their own tests.

ALTER TABLE test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_question_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read active test questions" ON test_questions;
DROP POLICY IF EXISTS "Teachers can manage own test questions" ON test_questions;
DROP POLICY IF EXISTS "Authenticated users can read question options" ON test_question_options;
DROP POLICY IF EXISTS "Teachers can manage own question options" ON test_question_options;

CREATE POLICY "Authenticated users can read active test questions"
  ON test_questions FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Teachers can manage own test questions"
  ON test_questions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM tests t
      WHERE t.id = test_questions.test_id
        AND t.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tests t
      WHERE t.id = test_questions.test_id
        AND t.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can read question options"
  ON test_question_options FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM test_questions q
      WHERE q.id = test_question_options.question_id
        AND q.is_active = true
    )
  );

CREATE POLICY "Teachers can manage own question options"
  ON test_question_options FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM test_questions q
      JOIN tests t ON t.id = q.test_id
      WHERE q.id = test_question_options.question_id
        AND t.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM test_questions q
      JOIN tests t ON t.id = q.test_id
      WHERE q.id = test_question_options.question_id
        AND t.teacher_id = auth.uid()
    )
  );

-- ── user_question_responses ──────────────────────────────────────────────
-- Students write detailed answers for their own test_result rows.
-- Teachers and students can read responses for analytics/review screens.

ALTER TABLE user_question_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read question responses" ON user_question_responses;
DROP POLICY IF EXISTS "Students can insert own question responses" ON user_question_responses;

CREATE POLICY "Authenticated users can read question responses"
  ON user_question_responses FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Students can insert own question responses"
  ON user_question_responses FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM test_results tr
      WHERE tr.id = user_question_responses.test_result_id
        AND tr.student_id = auth.uid()
    )
  );

-- ── Legacy tests repair (safe backfill) ──────────────────────────────────
-- Run this block once after deploying the new test builder.
-- It fixes old rows created before the new schema wiring:
-- 1) sets default values in tests
-- 2) activates old questions where is_active is NULL
-- 3) recalculates tests.questions_count from test_questions
-- 4) fixes option positions where NULL

UPDATE tests
SET
  attempts_allowed = COALESCE(attempts_allowed, 1),
  time_limit_minutes = COALESCE(time_limit_minutes, 20),
  is_active = COALESCE(is_active, true),
  updated_at = now()
WHERE
  attempts_allowed IS NULL
  OR time_limit_minutes IS NULL
  OR is_active IS NULL;

UPDATE test_questions
SET is_active = true
WHERE is_active IS NULL;

UPDATE test_question_options
SET position = 0
WHERE position IS NULL;

UPDATE tests t
SET
  questions_count = q.cnt,
  updated_at = now()
FROM (
  SELECT test_id, COUNT(*)::int AS cnt
  FROM test_questions
  GROUP BY test_id
) q
WHERE t.id = q.test_id;

UPDATE tests
SET
  questions_count = 0,
  updated_at = now()
WHERE id NOT IN (SELECT DISTINCT test_id FROM test_questions);

-- Optional diagnostic check:
-- SELECT
--   t.id,
--   t.title,
--   t.questions_count AS stored_questions_count,
--   COUNT(q.id) AS actual_questions_count
-- FROM tests t
-- LEFT JOIN test_questions q ON q.test_id = t.id
-- GROUP BY t.id, t.title, t.questions_count
-- ORDER BY t.id DESC;

-- Leaderboard cache fields on profiles (fast reads, deterministic sorting).
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS leaderboard_points integer NOT NULL DEFAULT 0;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS completed_tests_count integer NOT NULL DEFAULT 0;

WITH best_scores AS (
  SELECT
    tr.student_id,
    tr.test_id,
    MAX(COALESCE(tr.score, ROUND(COALESCE(tr.percentage, 0))::int, 0)) AS best_score
  FROM test_results tr
  WHERE tr.status = 'completed'
  GROUP BY tr.student_id, tr.test_id
),
aggregated AS (
  SELECT
    student_id,
    COALESCE(SUM(best_score), 0)::int AS leaderboard_points,
    COUNT(*)::int AS completed_tests_count
  FROM best_scores
  GROUP BY student_id
)
UPDATE profiles p
SET
  leaderboard_points = COALESCE(a.leaderboard_points, 0),
  completed_tests_count = COALESCE(a.completed_tests_count, 0)
FROM aggregated a
WHERE p.id = a.student_id;

UPDATE profiles p
SET
  leaderboard_points = 0,
  completed_tests_count = 0
WHERE NOT EXISTS (
  SELECT 1 FROM test_results tr
  WHERE tr.student_id = p.id AND tr.status = 'completed'
);

-- ── RPC: atomic test submit (RLS-safe) ───────────────────────────────────
-- Uses auth.uid() internally and updates:
--   1) test_results
--   2) user_question_responses
--   3) profiles.sp_coins
-- This avoids client-side RLS conflicts for multi-step completion flow.

CREATE OR REPLACE FUNCTION public.qf_submit_test_result(
  p_test_id integer,
  p_score integer,
  p_max_score integer,
  p_percentage numeric,
  p_started_at timestamptz,
  p_completed_at timestamptz,
  p_coins integer,
  p_responses jsonb DEFAULT '[]'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_result_id integer;
  v_item jsonb;
  v_curr_coins integer;
  v_points integer := 0;
  v_completed_tests integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO test_results (
    test_id,
    student_id,
    score,
    max_score,
    percentage,
    started_at,
    completed_at,
    status
  )
  VALUES (
    p_test_id,
    v_uid,
    p_score,
    p_max_score,
    p_percentage,
    p_started_at,
    p_completed_at,
    'completed'
  )
  RETURNING id INTO v_result_id;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_responses, '[]'::jsonb))
  LOOP
    INSERT INTO user_question_responses (
      test_result_id,
      question_id,
      selected_option_id,
      is_correct,
      points_earned,
      question_difficulty
    )
    VALUES (
      v_result_id,
      (v_item->>'question_id')::uuid,
      NULLIF(v_item->>'selected_option_id', '')::uuid,
      COALESCE((v_item->>'is_correct')::boolean, false),
      COALESCE((v_item->>'points_earned')::numeric, 0),
      COALESCE((v_item->>'question_difficulty')::numeric, 0)
    );
  END LOOP;

  SELECT sp_coins INTO v_curr_coins
  FROM profiles
  WHERE id = v_uid
  FOR UPDATE;

  SELECT
    COALESCE(SUM(best_score), 0)::int,
    COUNT(*)::int
  INTO
    v_points,
    v_completed_tests
  FROM (
    SELECT
      tr.test_id,
      MAX(COALESCE(tr.score, ROUND(COALESCE(tr.percentage, 0))::int, 0)) AS best_score
    FROM test_results tr
    WHERE tr.student_id = v_uid
      AND tr.status = 'completed'
    GROUP BY tr.test_id
  ) s;

  UPDATE profiles
  SET
    sp_coins = COALESCE(v_curr_coins, 0) + COALESCE(p_coins, 0),
    leaderboard_points = COALESCE(v_points, 0),
    completed_tests_count = COALESCE(v_completed_tests, 0)
  WHERE id = v_uid;

  RETURN v_result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.qf_submit_test_result(integer, integer, integer, numeric, timestamptz, timestamptz, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qf_submit_test_result(integer, integer, integer, numeric, timestamptz, timestamptz, integer, jsonb) TO authenticated;
