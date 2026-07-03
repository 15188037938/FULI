/**
 * 福利大厅 - 每日自动重置 Cron 接口
 * 由 Vercel Cron 每天北京时间 00:00 自动调用
 * 
 * 功能：
 * 1. 记录昨日签到统计
 * 2. 清理30天前的兑换历史（可选）
 */

const { sql } = require('./_db');

module.exports = async (req, res) => {
  // 仅允许 GET 或 POST（Vercel Cron 发 GET 请求）
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const beijingMS = Date.now() + 8 * 3600 * 1000;
    const beijingDate = new Date(beijingMS).toISOString().slice(0, 10);
    const yesterday = new Date(beijingMS - 86400000).toISOString().slice(0, 10);

    // 1. 统计昨日签到人数
    const { rows: signinStats } = await sql`
      SELECT COUNT(DISTINCT user_id) AS cnt
      FROM sign_ins
      WHERE sign_date = ${yesterday}::DATE
    `;

    // 2. 统计昨日发放兑换码数量
    const { rows: exchangeStats } = await sql`
      SELECT COUNT(*) AS cnt, source
      FROM exchange_history
      WHERE exchanged_at >= ${yesterday}::TIMESTAMPTZ
        AND exchanged_at < ${beijingDate}::TIMESTAMPTZ
      GROUP BY source
    `;

    // 3. 清理 30 天前的兑换历史（可选，保留30天）
    // await sql`
    //   DELETE FROM exchange_history
    //   WHERE exchanged_at < NOW() - INTERVAL '30 days'
    // `;

    const result = {
      date: beijingDate,
      yesterdaySigninCount: signinStats[0]?.cnt || 0,
      yesterdayExchangeCount: exchangeStats.reduce((s, r) => s + parseInt(r.cnt), 0),
      exchangeBySource: exchangeStats.reduce((obj, r) => {
        obj[r.source] = parseInt(r.cnt);
        return obj;
      }, {})
    };

    console.log('[Cron] 每日重置完成:', result);

    return res.status(200).json({ ok: true, data: result });
  } catch (e) {
    console.error('[Cron] 每日重置失败:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
};
