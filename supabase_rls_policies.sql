-- ============================================================
-- Run this in: Supabase Dashboard → SQL Editor
-- Safe to run multiple times — drops existing policies first.
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

-- ── profiles (allow updating sp_coins and active item ids) ────

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
