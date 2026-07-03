// ===========================================
// 福利大厅 - API 适配器
// 所有数据操作通过此模块与 Vercel Serverless 通信
// ===========================================

const API_URL = `${location.origin}/api/action`;

const API = {
  async call(action, data = {}) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, data })
      });
      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error || '请求失败');
      }
      return json.data;
    } catch (e) {
      console.error(`API error [${action}]:`, e);
      throw e;
    }
  },

  // ---------- 系统配置 ----------
  getConfig: () => API.call('getConfig'),
  setConfig: (data) => API.call('setConfig', data),

  // ---------- 奖品配置 ----------
  getPrizeConfig: () => API.call('getPrizeConfig'),
  setPrizeConfig: (data) => API.call('setPrizeConfig', data),

  // ---------- 抽奖说明 ----------
  getLotteryNotice: () => API.call('getLotteryNotice'),
  setLotteryNotice: (text) => API.call('setLotteryNotice', { text: text }),

  // ---------- 用户 ----------
  ensureUser: (userId) => API.call('ensureUser', { userId }),

  // ---------- 签到 ----------
  signin: (userId) => API.call('signin', { userId }),
  getSignins: (userId) => API.call('getSignins', { userId }),
  getSigninToday: (userId) => API.call('getSigninToday', { userId }),
  getTotalSigninUsers: () => API.call('getTotalSigninUsers'),
  resetTodaySignins: () => API.call('resetTodaySignins'),

  // ---------- 积分 ----------
  getPoints: (userId) => API.call('getPoints', { userId }),
  getFreeDraws: (userId) => API.call('getFreeDraws', { userId }),

  // ---------- 抽奖 ----------
  draw: (userId, prizeName, points, costFree) =>
    API.call('draw', { userId, prizeName, points, costFree }),
  getDrawHistory: (userId) => API.call('getDrawHistory', { userId }),

  // ---------- 兑换码 ----------
  getPrizeCodes: () => API.call('getPrizeCodes'),
  getAllPrizeCodes: () => API.call('getAllPrizeCodes'),
  addPrizeCodes: (codes) => API.call('addPrizeCodes', { codes }),
  usePrizeCode: (code, userId) => API.call('usePrizeCode', { code, userId }),
  deletePrizeCode: (id) => API.call('deletePrizeCode', { id }),

  // ---------- 兑换历史 ----------
  getExchangeHistory: () => API.call('getExchangeHistory'),

  // ---------- 自定义链接 ----------
  getLinks: () => API.call('getLinks'),
  addLink: (name, url) => API.call('addLink', { name, url }),
  deleteLink: (id) => API.call('deleteLink', { id }),

  // ---------- 管理后台 ----------
  getAllUsersStats: () => API.call('getAllUsersStats'),
};
