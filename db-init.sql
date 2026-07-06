-- =====================================================
-- 福利大厅 - 数据库初始化脚本
-- 适用于 Vercel Postgres (Neon)、Supabase 等任何 PostgreSQL
-- 在 Vercel Postgres Dashboard → SQL 中执行即可
-- =====================================================

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  fingerprint TEXT UNIQUE NOT NULL,
  nickname TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 系统配置表（key-value 存储）
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 签到记录表
CREATE TABLE IF NOT EXISTS sign_ins (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  sign_date DATE NOT NULL DEFAULT CURRENT_DATE,
  points_earned DECIMAL(10,2) NOT NULL DEFAULT 5,
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, sign_date)
);

-- 4. 积分表
CREATE TABLE IF NOT EXISTS points (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_earned DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_spent DECIMAL(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 免费抽奖次数表
CREATE TABLE IF NOT EXISTS free_draws (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  remaining INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 积分流水表
CREATE TABLE IF NOT EXISTS point_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  type TEXT CHECK(type IN ('earn', 'spend', 'recharge')),
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 抽奖记录表
CREATE TABLE IF NOT EXISTS draw_records (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  prize_name TEXT NOT NULL,
  points_cost INT DEFAULT 0,
  is_free BOOLEAN DEFAULT false,
  drawn_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 兑换码表
CREATE TABLE IF NOT EXISTS prize_codes (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  prize_name TEXT NOT NULL,
  prize_points DECIMAL(10,2) NOT NULL DEFAULT 0,
  used_by TEXT,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. 自定义链接表
CREATE TABLE IF NOT EXISTS custom_links (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. RPC: 增加积分
CREATE OR REPLACE FUNCTION increment_points(
  p_user_id TEXT,
  p_amount DECIMAL(10,2),  p_type TEXT,
  p_desc TEXT DEFAULT ''
)
RETURNS void AS $$
BEGIN
  INSERT INTO points (user_id, balance, total_earned, total_spent, updated_at)
  VALUES (p_user_id, GREATEST(0, p_amount), GREATEST(0, p_amount), GREATEST(0, -p_amount), NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    balance = GREATEST(0, points.balance + p_amount),
    total_earned = CASE WHEN p_amount > 0 THEN points.total_earned + p_amount ELSE points.total_earned END,
    total_spent = CASE WHEN p_amount < 0 THEN points.total_spent + ABS(p_amount) ELSE points.total_spent END,
    updated_at = NOW();

  -- 写入流水
  INSERT INTO point_transactions (user_id, amount, type, description)
  VALUES (p_user_id, p_amount, p_type, p_desc);
END;
$$ LANGUAGE plpgsql;

-- 11. RPC: 增加免费抽奖次数
CREATE OR REPLACE FUNCTION increment_free_draws(
  p_user_id TEXT,
  p_amount INT
)
RETURNS void AS $$
BEGIN
  INSERT INTO free_draws (user_id, remaining, updated_at)
  VALUES (p_user_id, GREATEST(0, p_amount), NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    remaining = GREATEST(0, free_draws.remaining + p_amount),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 12. 索引
CREATE INDEX IF NOT EXISTS idx_sign_ins_user_date ON sign_ins(user_id, sign_date);
CREATE INDEX IF NOT EXISTS idx_draw_records_user ON draw_records(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_prize_codes_code ON prize_codes(code);
CREATE INDEX IF NOT EXISTS idx_prize_codes_used ON prize_codes(used_at);

-- 13. 迁移：如果表已存在且字段为 INT，改为 DECIMAL 以支持小数积分
ALTER TABLE sign_ins ALTER COLUMN points_earned TYPE DECIMAL(10,2) USING points_earned::DECIMAL(10,2);
ALTER TABLE points ALTER COLUMN balance TYPE DECIMAL(10,2) USING balance::DECIMAL(10,2);
ALTER TABLE points ALTER COLUMN total_earned TYPE DECIMAL(10,2) USING total_earned::DECIMAL(10,2);
ALTER TABLE points ALTER COLUMN total_spent TYPE DECIMAL(10,2) USING total_spent::DECIMAL(10,2);
ALTER TABLE point_transactions ALTER COLUMN amount TYPE DECIMAL(10,2) USING amount::DECIMAL(10,2);
ALTER TABLE prize_codes ALTER COLUMN prize_points TYPE DECIMAL(10,2) USING prize_points::DECIMAL(10,2);

-- 重建函数（参数类型改为 DECIMAL）
CREATE OR REPLACE FUNCTION increment_points(
  p_user_id TEXT,
  p_amount DECIMAL(10,2),
  p_type TEXT,
  p_desc TEXT DEFAULT ''
)
RETURNS void AS $$
BEGIN
  INSERT INTO points (user_id, balance, total_earned, total_spent, updated_at)
  VALUES (p_user_id, GREATEST(0, p_amount), GREATEST(0, p_amount), GREATEST(0, -p_amount), NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    balance = GREATEST(0, points.balance + p_amount),
    total_earned = CASE WHEN p_amount > 0 THEN points.total_earned + p_amount ELSE points.total_earned END,
    total_spent = CASE WHEN p_amount < 0 THEN points.total_spent + ABS(p_amount) ELSE points.total_spent END,
    updated_at = NOW();

  INSERT INTO point_transactions (user_id, amount, type, description)
  VALUES (p_user_id, p_amount, p_type, p_desc);
END;
$$ LANGUAGE plpgsql;
