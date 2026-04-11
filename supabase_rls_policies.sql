-- ============================================================
-- Run this in: Supabase Dashboard → SQL Editor
-- Safe to run multiple times — drops existing policies first.
-- ============================================================

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
