// Supabase 数据库接口层
// 使用前将下方 SUPABASE_URL 和 SUPABASE_KEY 替换为你的实际值
const SUPABASE_URL = 'https://xxxxxxxxxxxx.supabase.co';
const SUPABASE_KEY = 'eyJhbGci...你的anon_key';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const DB = {
  // ========== 配置 ==========
  async getConfig() {
    const { data } = await sb.from('config').select('value').eq('key', 'app_config').single();
    return data?.value || { signinPoints: 5, adminPassword: 'admin123', rechargeEnabled: true };
  },
  async setConfig(value) {
    await sb.from('config').upsert({ key: 'app_config', value }, { onConflict: 'key' });
  },

  // ========== 抽奖概率 ==========
  async getPrizeConfig() {
    const { data } = await sb.from('config').select('value').eq('key', 'prize_config').single();
    return data?.value || null;
  },
  async setPrizeConfig(value) {
    await sb.from('config').upsert({ key: 'prize_config', value }, { onConflict: 'key' });
  },

  // ========== 抽奖说明 ==========
  async getLotteryNotice() {
    const { data } = await sb.from('config').select('value').eq('key', 'lottery_notice').single();
    return data?.value || '';
  },
  async setLotteryNotice(text) {
    await sb.from('config').upsert({ key: 'lottery_notice', value: text }, { onConflict: 'key' });
  },

  // ========== 奖品兑换码 ==========
  async getPrizeCodes() {
    const { data } = await sb.from('prize_codes').select('*').order('id', { ascending: false });
    return data || [];
  },
  async getAvailablePrizeCode(prizeName) {
    const { data } = await sb.from('prize_codes').select('*').eq('prize_name', prizeName).eq('used', false).limit(1).single();
    return data || null;
  },
  async usePrizeCode(id, userId) {
    await sb.from('prize_codes').update({ used: true, used_by: userId, used_at: new Date().toISOString() }).eq('id', id);
  },
  async deletePrizeCode(id) {
    await sb.from('prize_codes').delete().eq('id', id);
  },
  async addPrizeCode(code, prizeName, prizePoints) {
    await sb.from('prize_codes').insert({ code, prize_name: prizeName, prize_points: prizePoints });
  },
  async addPrizeCodesBatch(codes) {
    await sb.from('prize_codes').insert(codes);
  },
  async findPrizeCodeByCode(code) {
    const { data } = await sb.from('prize_codes').select('*').eq('code', code).single();
    return data || null;
  },

  // ========== 签到 ==========
  async getSigninToday(userId) {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await sb.from('signins').select('*').eq('user_id', userId).eq('date', today).limit(1);
    return data?.[0] || null;
  },
  async addSignin(userId, points, code) {
    await sb.from('signins').insert({ user_id: userId, points, code });
  },
  async getSigninsToday(userId) {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await sb.from('signins').select('*').eq('user_id', userId).eq('date', today).order('created_at', { ascending: false });
    return data || [];
  },
  async getTotalSigninUsers() {
    const { count } = await sb.from('signins').select('*', { count: 'exact', head: true });
    return count || 0;
  },

  // ========== 用户积分 & 免费次数 ==========
  async getUserPoints(userId) {
    const { data } = await sb.from('user_points').select('*').eq('user_id', userId).single();
    return data || { balance: 0, free_draws: 0 };
  },
  async updateUserPoints(userId, balance, freeDraws) {
    await sb.from('user_points').upsert({ user_id: userId, balance, free_draws: freeDraws }, { onConflict: 'user_id' });
  },

  // ========== 抽奖记录 ==========
  async addDrawRecord(record) {
    await sb.from('draw_history').insert(record);
  },
  async getDrawsToday(userId) {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await sb.from('draw_history').select('*').eq('user_id', userId).gte('created_at', today).order('created_at', { ascending: false });
    return data || [];
  },

  // ========== 自定义链接 ==========
  async getCustomLinks() {
    const { data } = await sb.from('custom_links').select('*').order('sort_order');
    return data || [];
  },
  async addCustomLink(name, url) {
    await sb.from('custom_links').insert({ name, url });
  },
  async deleteCustomLink(id) {
    await sb.from('custom_links').delete().eq('id', id);
  },

  // ========== 管理员会话 ==========
  async getAdminSession() {
    const s = localStorage.getItem('sl_admin_session');
    if (!s) return null;
    try { const d = JSON.parse(s); return (Date.now() - d.loggedAt < 3600000) ? d : null; } catch { return null; }
  },
  async setAdminSession() {
    localStorage.setItem('sl_admin_session', JSON.stringify({ loggedAt: Date.now() }));
  },
  async clearAdminSession() {
    localStorage.removeItem('sl_admin_session');
  }
};
