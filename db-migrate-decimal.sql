-- =====================================================
-- 福利大厅 - 小数积分迁移脚本（仅用于已上线的旧数据库）
-- 适用场景：你之前用「INT 版 db-init.sql」初始化过 Vercel Postgres，
--           现在签到积分 / 兑换码要支持小数（如 0.5），需要把 INT 列改成 DECIMAL。
--
-- 使用方法：
--   1. 打开 Vercel 控制台 → Storage → 你的 Postgres 数据库 → 「Query」/ SQL 编辑器
--   2. 把本文件全部内容粘进去
--   3. 点 Run / 执行
--   4. 只需执行【一次】，成功后即可删除，无需重复跑
--
-- 说明：本脚本只做「改列类型 + 重建函数」，不会删除任何数据。
--       USING xxx::DECIMAL(10,2) 会把已有的整数值（如 5）无损转为小数（5.00）。
-- =====================================================

-- 1. 把各表的 INT 数值列改为 DECIMAL(10,2)，支持两位小数
ALTER TABLE sign_ins           ALTER COLUMN points_earned TYPE DECIMAL(10,2) USING points_earned::DECIMAL(10,2);
ALTER TABLE points             ALTER COLUMN balance       TYPE DECIMAL(10,2) USING balance::DECIMAL(10,2);
ALTER TABLE points             ALTER COLUMN total_earned  TYPE DECIMAL(10,2) USING total_earned::DECIMAL(10,2);
ALTER TABLE points             ALTER COLUMN total_spent   TYPE DECIMAL(10,2) USING total_spent::DECIMAL(10,2);
ALTER TABLE point_transactions ALTER COLUMN amount        TYPE DECIMAL(10,2) USING amount::DECIMAL(10,2);
ALTER TABLE prize_codes        ALTER COLUMN prize_points  TYPE DECIMAL(10,2) USING prize_points::DECIMAL(10,2);
ALTER TABLE exchange_history   ALTER COLUMN prize_points  TYPE DECIMAL(10,2) USING prize_points::DECIMAL(10,2);

-- 2. 重建 increment_points 函数：参数类型 INT -> DECIMAL(10,2)（否则传 0.5 会报函数不存在）
--    先删掉旧的 integer 版本（旧库才有，新库此句为 no-op）
DROP FUNCTION IF EXISTS increment_points(text, integer, text, text);

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

  -- 写入流水
  INSERT INTO point_transactions (user_id, amount, type, description)
  VALUES (p_user_id, p_amount, p_type, p_desc);
END;
$$ LANGUAGE plpgsql;

-- 3. 校验：以下查询应能看到相关列已是 numeric 类型（DECIMAL 在 PG 内部即 numeric）
--    若都能正常执行且无报错，说明迁移成功。
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('sign_ins','points','point_transactions','prize_codes','exchange_history')
  AND column_name IN ('points_earned','balance','total_earned','total_spent','amount','prize_points')
ORDER BY table_name, column_name;
