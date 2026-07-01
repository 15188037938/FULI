const { kv } = require('@vercel/kv');

// 统一的 API 端点，接受 POST { action, data }
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const { action, data } = req.body || {};

    switch (action) {
      // ========== 配置 ==========
      case 'getConfig':
        return res.json(await kv.get('config') || { signinPoints: 5, adminPassword: 'admin123', rechargeEnabled: true });
      case 'setConfig':
        await kv.set('config', data);
        return res.json({ ok: true });

      // ========== 奖品配置 ==========
      case 'getPrizeConfig':
        return res.json(await kv.get('prize_config') || null);
      case 'setPrizeConfig':
        await kv.set('prize_config', data);
        return res.json({ ok: true });

      // ========== 抽奖说明 ==========
      case 'getLotteryNotice':
        return res.json(await kv.get('lottery_notice') || '');
      case 'setLotteryNotice':
        await kv.set('lottery_notice', data);
        return res.json({ ok: true });

      // ========== 奖品兑换码 ==========
      case 'getPrizeCodes': {
        const codes = await kv.get('prize_codes') || [];
        return res.json(codes);
      }
      case 'addPrizeCodes': {
        const codes = await kv.get('prize_codes') || [];
        codes.push(...data);
        await kv.set('prize_codes', codes);
        return res.json({ ok: true, added: data.length });
      }
      case 'usePrizeCode': {
        const codes = await kv.get('prize_codes') || [];
        const idx = codes.findIndex(c => c.id === data.id);
        if (idx >= 0) {
          codes[idx].used = true;
          codes[idx].used_by = data.userId;
          codes[idx].used_at = now;
          await kv.set('prize_codes', codes);
          return res.json({ ok: true, code: codes[idx].code });
        }
        return res.json({ ok: false, error: 'not found' });
      }
      case 'deletePrizeCode': {
        const codes = await kv.get('prize_codes') || [];
        await kv.set('prize_codes', codes.filter(c => c.id !== data.id));
        return res.json({ ok: true });
      }

      // ========== 签到 ==========
      case 'signin': {
        const signins = await kv.get('signins') || {};
        const uid = data.userId;
        if (!signins[uid]) signins[uid] = [];
        const todayRecord = signins[uid].find(s => s.date === today);
        if (todayRecord) return res.json({ ok: false, error: '今天已签到' });

        // 从奖品池取码
        const codes = await kv.get('prize_codes') || [];
        const availIdx = codes.findIndex(c => !c.used && c.prize_name === '1积分');
        if (availIdx < 0) return res.json({ ok: false, error: '兑换码耗尽' });

        const code = codes[availIdx];
        codes[availIdx].used = true;
        codes[availIdx].used_by = uid;
        codes[availIdx].used_at = now;
        await kv.set('prize_codes', codes);

        signins[uid].push({ date: today, time: now, points: data.points, code: code.code });
        await kv.set('signins', signins);

        // 增加免费次数
        const points = await kv.get('points') || {};
        if (!points[uid]) points[uid] = { balance: 0, free_draws: 0 };
        points[uid].free_draws = (points[uid].free_draws || 0) + 1;
        await kv.set('points', points);

        return res.json({ ok: true, code: code.code, points: data.points });
      }
      case 'getSignins': {
        const signins = await kv.get('signins') || {};
        const records = signins[data.userId] || [];
        return res.json(records.filter(r => r.date === today));
      }
      case 'getSigninToday': {
        const signins = await kv.get('signins') || {};
        return res.json((signins[data.userId] || []).find(s => s.date === today) || null);
      }
      case 'getTotalSigninUsers': {
        const signins = await kv.get('signins') || {};
        return res.json(Object.keys(signins).length);
      }

      // ========== 用户积分 ==========
      case 'getPoints': {
        const points = await kv.get('points') || {};
        return res.json(points[data.userId] || { balance: 0, free_draws: 0 });
      }
      case 'updatePoints': {
        const points = await kv.get('points') || {};
        points[data.userId] = data.points;
        await kv.set('points', points);
        return res.json({ ok: true });
      }

      // ========== 抽奖 ==========
      case 'draw': {
        const points = await kv.get('points') || {};
        const uid = data.userId;
        if (!points[uid]) points[uid] = { balance: 0, free_draws: 0 };
        const p = points[uid];

        if ((p.free_draws || 0) > 0) {
          p.free_draws -= 1;
        } else if (p.balance >= 1) {
          p.balance -= 1;
        } else {
          return res.json({ ok: false, error: '积分不足' });
        }

        // 中奖则从奖品池取码
        let code = null;
        if (data.prizeName && data.prizeName !== '谢谢参与') {
          const codes = await kv.get('prize_codes') || [];
          const availIdx = codes.findIndex(c => !c.used && c.prize_name === data.prizeName);
          if (availIdx >= 0) {
            code = codes[availIdx].code;
            codes[availIdx].used = true;
            codes[availIdx].used_by = uid;
            codes[availIdx].used_at = now;
            await kv.set('prize_codes', codes);
          }
        }

        await kv.set('points', points);
        return res.json({ ok: true, code, balance: p.balance, free_draws: p.free_draws });
      }

      // ========== 充值兑换 ==========
      case 'recharge': {
        const codes = await kv.get('prize_codes') || [];
        const idx = codes.findIndex(c => c.code === data.code && !c.used);
        if (idx < 0) return res.json({ ok: false, error: '无效兑换码' });

        const code = codes[idx];
        codes[idx].used = true;
        codes[idx].used_by = data.userId;
        codes[idx].used_at = now;
        await kv.set('prize_codes', codes);

        const points = await kv.get('points') || {};
        if (!points[data.userId]) points[data.userId] = { balance: 0, free_draws: 0 };
        points[data.userId].balance = (points[data.userId].balance || 0) + (code.prize_points || 0);
        await kv.set('points', points);

        return res.json({ ok: true, points: code.prize_points, name: code.prize_name });
      }

      // ========== 自定义链接 ==========
      case 'getLinks': {
        return res.json(await kv.get('links') || []);
      }
      case 'addLink': {
        const links = await kv.get('links') || [];
        links.push({ id: Date.now(), name: data.name, url: data.url });
        await kv.set('links', links);
        return res.json({ ok: true });
      }
      case 'deleteLink': {
        const links = await kv.get('links') || [];
        await kv.set('links', links.filter(l => l.id !== data.id));
        return res.json({ ok: true });
      }

      default:
        return res.status(400).json({ error: '未知操作: ' + action, body: req.body });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack });
  }
};
