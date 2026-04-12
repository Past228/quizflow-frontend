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

CREATE POLICY "Users can view own purchases"
  ON user_purchases FOR SELECT TO authenticated
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert own purchases"
  ON user_purchases FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = profile_id);

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
