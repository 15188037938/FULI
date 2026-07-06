const { sql } = require('./_db');

// ========== 工具函数 ==========

// 北京时间日期字符串（修复 Vercel UTC 时区问题）
function todayStr() {
  // Date.now() 是 UTC 时间戳，加8小时偏移后取日期
  const beijingTime = new Date(Date.now() + 8 * 3600 * 1000);
  const y = beijingTime.getUTCFullYear();
  const m = String(beijingTime.getUTCMonth() + 1).padStart(2, '0');
  const d = String(beijingTime.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function nowISO() {
  return new Date().toISOString();
}

// 获取客户端IP（Vercel 环境）
function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || '';
}

// ========== 处理入口 ==========
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: '仅支持 POST' });
  }

  const { action, data } = req.body || {};

  try {
    switch (action) {

      // ---------- 系统配置 ----------
      case 'getConfig': {
        const { rows } = await sql`SELECT value FROM system_config WHERE key = 'app_config'`;
        const config = rows[0]?.value || {
          signinPoints: 5,
          adminPassword: 'admin123',
          rechargeEnabled: true
        };
        return res.json({ ok: true, data: config });
      }

      case 'setConfig': {
        await sql`
          INSERT INTO system_config (key, value)
          VALUES ('app_config', ${JSON.stringify(data)})
          ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(data)}, updated_at = NOW()
        `;
        return res.json({ ok: true });
      }

      // ---------- 奖品配置 ----------
      case 'getPrizeConfig': {
        const DEFAULT_PRIZES = [
          { id:0, name:'100积分', weight:1,  color:'#f43f5e', points:100 },
          { id:1, name:'70积分',  weight:1,  color:'#f97316', points:70 },
          { id:2, name:'50积分',  weight:2,  color:'#eab308', points:50 },
          { id:3, name:'20积分',  weight:3,  color:'#22c55e', points:20 },
          { id:4, name:'10积分',  weight:5,  color:'#14b8a6', points:10 },
          { id:5, name:'5积分',   weight:8,  color:'#3b82f6', points:5 },
          { id:6, name:'1积分',   weight:60, color:'#8b5cf6', points:1 },
          { id:7, name:'谢谢参与', weight:20, color:'#6b7280', points:0 },
        ];
        const { rows } = await sql`SELECT value FROM system_config WHERE key = 'prize_config'`;
        return res.json({ ok: true, data: rows[0]?.value || DEFAULT_PRIZES });
      }

      case 'setPrizeConfig': {
        await sql`
          INSERT INTO system_config (key, value)
          VALUES ('prize_config', ${JSON.stringify(data)})
          ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(data)}, updated_at = NOW()
        `;
        return res.json({ ok: true });
      }

      // ---------- 抽奖说明 ----------
      case 'getLotteryNotice': {
        const { rows } = await sql`SELECT value FROM system_config WHERE key = 'lottery_notice'`;
        const val = rows[0]?.value;
        // 兼容两种存储格式：对象 {text:"..."} 或纯字符串
        const text = (typeof val === 'object' && val !== null) ? (val.text || '') : (typeof val === 'string' ? val : '');
        return res.json({ ok: true, data: { text } });
      }

      case 'setLotteryNotice': {
        // data 应该是纯字符串，统一存为 { text: "..." } 格式
        const noticeObj = (typeof data === 'string') ? { text: data } : data;
        await sql`
          INSERT INTO system_config (key, value)
          VALUES ('lottery_notice', ${JSON.stringify(noticeObj)})
          ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(noticeObj)}, updated_at = NOW()
        `;
        return res.json({ ok: true });
      }

      // ---------- 用户 ----------
      case 'ensureUser': {
        const { userId } = data;
        const { rows } = await sql`SELECT id FROM users WHERE fingerprint = ${userId}`;
        if (rows.length === 0) {
          await sql`INSERT INTO users (fingerprint) VALUES (${userId}) ON CONFLICT (fingerprint) DO NOTHING`;
        }
        return res.json({ ok: true });
      }

      // ---------- 签到 ----------
      case 'signin': {
        const { userId, deviceId, isEmulator } = data;
        const clientIP = getClientIP(req);

        // ========== 风控检查 ==========

        // 1. 同IP每天签到上限（默认2次）
        const { rows: ipCount } = await sql`
          SELECT COUNT(*) AS cnt FROM sign_ins
          WHERE client_ip = ${clientIP} AND sign_date = ${todayStr()}::DATE
        `;
        if (parseInt(ipCount[0]?.cnt || 0) >= 2) {
          return res.json({ ok: false, error: '签到过于频繁，请稍后再试（IP限制）' });
        }

        // 2. 同IP最近30秒内是否签到过（频率限制）
        const { rows: recentIP } = await sql`
          SELECT id FROM sign_ins
          WHERE client_ip = ${clientIP}
            AND signed_at > NOW() - INTERVAL '30 seconds'
          LIMIT 1
        `;
        if (recentIP.length > 0) {
          return res.json({ ok: false, error: '操作太频繁，请30秒后再试' });
        }

        // 3. 模拟器禁止签到
        if (isEmulator) {
          return res.json({ ok: false, error: '模拟器环境不支持签到，请使用真实设备' });
        }

        // 4. 检查今天是否已签到（基于设备指纹）
        const { rows: existing } = await sql`
          SELECT id FROM sign_ins WHERE user_id = ${userId} AND sign_date = ${todayStr()}::DATE
        `;
        if (existing.length > 0) {
          return res.json({ ok: false, error: '今天已经签到过了' });
        }

        // 获取签到积分配置
        const { rows: configRows } = await sql`SELECT value FROM system_config WHERE key = 'app_config'`;
        const config = configRows[0]?.value || { signinPoints: 5 };
        const earnedPoints = config.signinPoints || 5;

        // 签到发放兑换码：先抽取兑换码，再写入签到记录
        let signPrizeCode = null;
        let prizeCode = '';
        let prizeName = '';
        try {
          const { rows: availableCodes } = await sql`
            SELECT id, code, prize_name, prize_points
            FROM prize_codes
            WHERE used_at IS NULL AND prize_points = ${earnedPoints}
            ORDER BY RANDOM()
            LIMIT 1
          `;
          if (availableCodes.length > 0) {
            const code = availableCodes[0];
            signPrizeCode = { code: code.code, prizeName: code.prize_name, prizePoints: code.prize_points };
            prizeCode = code.code;
            prizeName = code.prize_name;

            // 写入兑换历史记录
            await sql`
              INSERT INTO exchange_history (user_id, code, prize_name, prize_points, source, ip_address)
              VALUES (${userId}, ${code.code}, ${code.prize_name}, ${code.prize_points}, 'signin', ${clientIP})
            `;

            // 删除兑换码
            await sql`DELETE FROM prize_codes WHERE id = ${code.id}`;
          }
        } catch (e) {
          console.error('签到发放兑换码失败:', e);
        }

        // 记录签到（带着风控信息一起写入）
        await sql`
          INSERT INTO sign_ins (user_id, sign_date, points_earned, prize_code, prize_name, client_ip, device_id, is_emulator, signed_at)
          VALUES (${userId}, ${todayStr()}::DATE, ${earnedPoints}, ${prizeCode}, ${prizeName}, ${clientIP}, ${deviceId || ''}, ${!!isEmulator}, ${nowISO()}::TIMESTAMPTZ)
        `;

        // 增加积分
        await sql`SELECT increment_points(${userId}, ${earnedPoints}, 'earn', '每日签到')`;

        // 增加免费抽奖次数
        await sql`SELECT increment_free_draws(${userId}, 1)`;

        const { rows: points } = await sql`SELECT balance FROM points WHERE user_id = ${userId}`;
        const { rows: freeDraws } = await sql`SELECT remaining FROM free_draws WHERE user_id = ${userId}`;

        return res.json({
          ok: true,
          data: {
            points: points[0]?.balance || earnedPoints,
            freeDraws: freeDraws[0]?.remaining || 1,
            earnedPoints,
            signPrizeCode
          }
        });
      }

      case 'getSignins': {
        const { userId } = data;
        const { rows } = await sql`
          SELECT
            id,
            user_id,
            sign_date::TEXT as sign_date,
            points_earned,
            prize_code,
            prize_name,
            signed_at
          FROM sign_ins
          WHERE user_id = ${userId}
          ORDER BY signed_at DESC
        `;
        return res.json({ ok: true, data: rows });
      }

      case 'getSigninToday': {
        const { userId } = data;
        const { rows } = await sql`
          SELECT id FROM sign_ins
          WHERE user_id = ${userId}
            AND sign_date::TEXT = ${todayStr()}
        `;
        return res.json({ ok: true, data: rows.length > 0 });
      }

      case 'getTotalSigninUsers': {
        const { rows } = await sql`SELECT COUNT(DISTINCT user_id) AS cnt FROM sign_ins`;
        return res.json({ ok: true, data: rows[0]?.cnt || 0 });
      }

      // ---------- 重置今日签到 ----------
      case 'resetTodaySignins': {
        const today = todayStr();
        const { rows } = await sql`
          DELETE FROM sign_ins WHERE sign_date = ${today}::DATE
          RETURNING user_id
        `;
        return res.json({ ok: true, data: { resetCount: rows.length } });
      }

      // ---------- 积分 ----------
      case 'getPoints': {
        const { userId } = data;
        const { rows } = await sql`SELECT balance FROM points WHERE user_id = ${userId}`;
        return res.json({ ok: true, data: rows[0]?.balance || 0 });
      }

      case 'getFreeDraws': {
        const { userId } = data;
        const { rows } = await sql`SELECT remaining FROM free_draws WHERE user_id = ${userId}`;
        return res.json({ ok: true, data: rows[0]?.remaining || 0 });
      }

      // ---------- 抽奖 ----------
      case 'draw': {
        const { userId, prizeName, points: prizePoints, costFree } = data;

        if (costFree) {
          await sql`SELECT increment_free_draws(${userId}, -1)`;
        } else {
          await sql`SELECT increment_points(${userId}, -1, 'spend', '转盘抽奖')`;
        }

        // 中奖后从奖品池抽取对应积分额度的兑换码
        let drawPrizeCode = null;
        let prizeCode = '';
        try {
          if (prizePoints > 0) {
            const { rows: availableCodes } = await sql`
              SELECT id, code, prize_name, prize_points
              FROM prize_codes
              WHERE used_at IS NULL AND prize_points = ${prizePoints}
              ORDER BY RANDOM()
              LIMIT 1
            `;
            if (availableCodes.length > 0) {
              const code = availableCodes[0];
              drawPrizeCode = { code: code.code, prizeName: code.prize_name, prizePoints: code.prize_points };
              prizeCode = code.code;

              // 写入兑换历史
              const clientIP = getClientIP(req);
              await sql`
                INSERT INTO exchange_history (user_id, code, prize_name, prize_points, source, ip_address)
                VALUES (${userId}, ${code.code}, ${code.prize_name}, ${code.prize_points}, 'lottery', ${clientIP})
              `;

              // 删除兑换码
              await sql`DELETE FROM prize_codes WHERE id = ${code.id}`;
            }
          }
        } catch (e) {
          console.error('抽奖发放兑换码失败:', e);
        }

        await sql`
          INSERT INTO draw_records (user_id, prize_name, prize_code, points_cost, is_free, drawn_at)
          VALUES (${userId}, ${prizeName}, ${prizeCode}, ${costFree ? 0 : 1}, ${!!costFree}, ${nowISO()}::TIMESTAMPTZ)
        `;

        const { rows: points } = await sql`SELECT balance FROM points WHERE user_id = ${userId}`;
        const { rows: freeDraws } = await sql`SELECT remaining FROM free_draws WHERE user_id = ${userId}`;

        return res.json({
          ok: true,
          data: {
            points: points[0]?.balance || 0,
            freeDraws: freeDraws[0]?.remaining || 0,
            prizeCode,  // 中奖获得的兑换码（可能为空）
            prizeName: drawPrizeCode?.prizeName || ''
          }
        });
      }

      case 'getDrawHistory': {
        const { userId } = data;
        const { rows } = await sql`
          SELECT * FROM draw_records WHERE user_id = ${userId} ORDER BY drawn_at DESC LIMIT 50
        `;
        return res.json({ ok: true, data: rows });
      }

      // ---------- 兑换码 ----------
      case 'getPrizeCodes': {
        const { rows } = await sql`
          SELECT * FROM prize_codes WHERE used_at IS NULL ORDER BY created_at
        `;
        return res.json({ ok: true, data: rows });
      }

      case 'getAllPrizeCodes': {
        const { rows } = await sql`
          SELECT * FROM prize_codes ORDER BY created_at
        `;
        return res.json({ ok: true, data: rows });
      }

      case 'addPrizeCodes': {
        const { codes } = data;
        if (!codes || codes.length === 0) {
          return res.json({ ok: false, error: '没有兑换码' });
        }

        for (const c of codes) {
          try {
            await sql`
              INSERT INTO prize_codes (code, prize_name, prize_points)
              VALUES (${c.code}, ${c.prizeName}, ${c.prizePoints})
            `;
          } catch (err) {
            if (err.code === '23505') continue; // 跳过重复
            throw err;
          }
        }

        return res.json({ ok: true, data: { count: codes.length } });
      }

      case 'usePrizeCode': {
        const { code, userId } = data;
        const { rows } = await sql`
          SELECT * FROM prize_codes WHERE code = ${code} AND used_at IS NULL
        `;

        if (rows.length === 0) {
          return res.json({ ok: false, error: '无效或已使用的兑换码' });
        }

        const found = rows[0];

        // 充值兑换码使用后直接删除，不留数据
        await sql`DELETE FROM prize_codes WHERE id = ${found.id}`;

        await sql`
          SELECT increment_points(${userId}, ${found.prize_points}, 'recharge', ${`兑换码: ${found.prize_name}`})
        `;

        return res.json({
          ok: true,
          data: {
            prizeName: found.prize_name,
            prizePoints: found.prize_points
          }
        });
      }

      case 'deletePrizeCode': {
        const { id } = data;
        await sql`DELETE FROM prize_codes WHERE id = ${id}`;
        return res.json({ ok: true });
      }

      // ---------- 兑换历史 ----------
            // ---------- 兑换历史（分页） ----------
      case 'getExchangeHistory': {
        const page = Math.max(1, parseInt(data?.page) || 1);
        const pageSize = Math.max(1, Math.min(200, parseInt(data?.pageSize) || 50));
        const offset = (page - 1) * pageSize;

        const { rows } = await sql`
          SELECT * FROM exchange_history
          ORDER BY exchanged_at DESC
          LIMIT ${pageSize} OFFSET ${offset}
        `;
        const { rows: countRows } = await sql`
          SELECT COUNT(*)::INT as total FROM exchange_history
        `;
        const total = countRows[0]?.total || 0;
        return res.json({
          ok: true,
          data: {
            records: rows,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
          }
        });
      }

      // ---------- 自定义链接 ----------
      case 'getLinks': {
        const { rows } = await sql`
          SELECT * FROM custom_links ORDER BY sort_order
        `;
        return res.json({ ok: true, data: rows });
      }

      case 'addLink': {
        const { name, url } = data;
        const { rows } = await sql`
          SELECT sort_order FROM custom_links ORDER BY sort_order DESC LIMIT 1
        `;
        const maxOrder = rows[0]?.sort_order || 0;
        await sql`
          INSERT INTO custom_links (name, url, sort_order)
          VALUES (${name}, ${url}, ${maxOrder + 1})
        `;
        return res.json({ ok: true });
      }

      case 'deleteLink': {
        const { id } = data;
        await sql`DELETE FROM custom_links WHERE id = ${id}`;
        return res.json({ ok: true });
      }

      // ---------- 管理后台统计 ----------
      case 'getAllUsersStats': {
        const { rows } = await sql`SELECT DISTINCT user_id FROM sign_ins`;
        return res.json({ ok: true, data: { totalSigninUsers: rows.length } });
      }

      // ---------- 兑换记录（分页）----------
      case 'getRedeemHistory': {
        const page = Math.max(1, parseInt(data?.page) || 1);
        const pageSize = Math.max(1, Math.min(200, parseInt(data?.pageSize) || 50));
        const offset = (page - 1) * pageSize;

        const { rows } = await sql`
          SELECT * FROM prize_codes
          WHERE used_at IS NOT NULL
          ORDER BY used_at DESC
          LIMIT ${pageSize} OFFSET ${offset}
        `;
        const { rows: countRows } = await sql`
          SELECT COUNT(*)::INT as total FROM prize_codes WHERE used_at IS NOT NULL
        `;
        const total = countRows[0]?.total || 0;
        return res.json({
          ok: true,
          data: {
            records: rows,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
          }
        });
      }

      default:
        return res.status(400).json({ ok: false, error: `未知 action: ${action}` });
    }
  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ ok: false, error: err.message || '服务器内部错误' });
  }
};
