-- 在 Supabase SQL Editor 中执行以下全部语句

-- 1. 应用配置表
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'
);

INSERT INTO config (key, value) VALUES ('app_config', '{"signinPoints":5,"adminPassword":"admin123","rechargeEnabled":true}')
ON CONFLICT (key) DO NOTHING;

-- 2. 奖品兑换码表
CREATE TABLE IF NOT EXISTS prize_codes (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  prize_name TEXT NOT NULL DEFAULT '',
  prize_points INTEGER DEFAULT 0,
  used BOOLEAN DEFAULT false,
  used_by TEXT,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prize_codes_name_used ON prize_codes(prize_name, used);
CREATE INDEX IF NOT EXISTS idx_prize_codes_code ON prize_codes(code);

-- 3. 签到记录表
CREATE TABLE IF NOT EXISTS signins (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  points INTEGER DEFAULT 0,
  code TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signins_user_date ON signins(user_id, date);

-- 4. 抽奖记录表
CREATE TABLE IF NOT EXISTS draw_history (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  prize TEXT NOT NULL,
  points INTEGER DEFAULT 0,
  code TEXT,
  cost_free BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. 用户积分表
CREATE TABLE IF NOT EXISTS user_points (
  user_id TEXT PRIMARY KEY,
  balance INTEGER DEFAULT 0,
  free_draws INTEGER DEFAULT 0
);

-- 6. 自定义链接表
CREATE TABLE IF NOT EXISTS custom_links (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- 7. 启用 Row Level Security 但允许所有操作（公开站点）
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
ALTER TABLE prize_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE signins ENABLE ROW LEVEL SECURITY;
ALTER TABLE draw_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_links ENABLE ROW LEVEL SECURITY;

-- 允许 anon 用户读写所有表（公开福利站，无用户认证）
CREATE POLICY "Allow all" ON config FOR ALL USING (true);
CREATE POLICY "Allow all" ON prize_codes FOR ALL USING (true);
CREATE POLICY "Allow all" ON signins FOR ALL USING (true);
CREATE POLICY "Allow all" ON draw_history FOR ALL USING (true);
CREATE POLICY "Allow all" ON user_points FOR ALL USING (true);
CREATE POLICY "Allow all" ON custom_links FOR ALL USING (true);
