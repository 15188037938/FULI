// API 适配器 - 替换 localStorage，通过 Vercel Serverless 存取数据
// 部署后把 API_URL 改成你的 Vercel 地址
const API_URL = 'https://fuli-api.vercel.app/api/action';

const API = {
  async call(action, data) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, data })
      });
      return await res.json();
    } catch (e) {
      console.error('API error:', e);
      return { ok: false, error: '网络错误' };
    }
  },

  // 配置
  getConfig: () => API.call('getConfig'),
  setConfig: (data) => API.call('setConfig', data),

  // 奖品配置
  getPrizeConfig: () => API.call('getPrizeConfig'),
  setPrizeConfig: (data) => API.call('setPrizeConfig', data),

  // 抽奖说明
  getLotteryNotice: () => API.call('getLotteryNotice'),
  setLotteryNotice: (data) => API.call('setLotteryNotice', data),

  // 奖品兑换码
  getPrizeCodes: () => API.call('getPrizeCodes'),
  addPrizeCodes: (codes) => API.call('addPrizeCodes', codes),
  usePrizeCode: (id, userId) => API.call('usePrizeCode', { id, userId }),
  deletePrizeCode: (id) => API.call('deletePrizeCode', { id }),

  // 签到
  signin: (userId, points) => API.call('signin', { userId, points }),
  getSignins: (userId) => API.call('getSignins', { userId }),
  getSigninToday: (userId) => API.call('getSigninToday', { userId }),
  getTotalSigninUsers: () => API.call('getTotalSigninUsers'),

  // 积分
  getPoints: (userId) => API.call('getPoints', { userId }),
  updatePoints: (userId, points) => API.call('updatePoints', { userId, points }),

  // 抽奖
  draw: (userId, prizeName, costFree) => API.call('draw', { userId, prizeName, costFree }),

  // 充值
  recharge: (userId, code) => API.call('recharge', { userId, code }),

  // 链接
  getLinks: () => API.call('getLinks'),
  addLink: (name, url) => API.call('addLink', { name, url }),
  deleteLink: (id) => API.call('deleteLink', { id }),
};
