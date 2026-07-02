# 福利大厅 - 签到抽奖系统 v2

> 纯前端签到 + 转盘抽奖 + 兑换码管理系统。  
> **后端存储**：Vercel Postgres (Neon)  
> **部署平台**：Vercel

## 功能

- **签到**：每日签到送积分 + 免费抽奖次数
- **转盘抽奖**：Canvas 转盘，8 档奖品，概率由管理员自定义
- **兑换码充值**：输入兑换码增加积分余额
- **管理后台**：密码登录，配置签到积分、抽奖概率、奖品名称、兑换码管理

## 部署步骤（共 4 步，约 10 分钟）

### 第 1 步：推送代码到 GitHub

```bash
# 在项目目录执行
git add .
git commit -m "v2: 接入 Vercel Postgres 数据库持久化"
git push
```

### 第 2 步：在 Vercel 导入项目并启用 Postgres

1. 前往 [vercel.com](https://vercel.com) → **Add New Project**
2. 导入你的 GitHub 仓库
3. 点击 **Deploy**（先部署，再创建数据库）

4. 部署完成后，进入项目 Dashboard → **Storage** 选项卡
5. 点击 **Connect Database → Create New → Postgres**
6. 选择区域（选离你最近的），点击 **Create**
7. Vercel 会自动将 `POSTGRES_URL` 等环境变量注入到项目中
8. 点击 **Quickstart** 旁边的 **Open in PSQL**（或使用 Vercel CLI 连接）

### 第 3 步：初始化数据库表

在 Vercel Postgres Dashboard 中，打开 **SQL** 选项卡，将 `db-init.sql` 文件的全部内容粘贴进去执行。

> 如果通过命令行操作：
> ```bash
> # 使用 Vercel CLI 连接
> vercel env pull          # 拉取环境变量到本地
> psql $POSTGRES_URL -f db-init.sql  # 执行建表脚本
> ```

### 第 4 步：重新部署

Vercel 会自动重新部署，或者手动触发一次：
- 在 Vercel Dashboard → **Deployments** → 点击 **Redeploy**

完成后你的福利大厅就拥有了持久化的 PostgreSQL 数据库，所有数据清除浏览器缓存也不会丢失。

## 技术栈

- **前端**：HTML5 + CSS3 + Vanilla JS
- **转盘**：Canvas 动画
- **后端**：Vercel Serverless Functions (Node.js)
- **数据库**：Vercel Postgres (Neon)
- **部署**：Vercel

## 项目结构

```
FULI/
├── api/
│   ├── _db.js           # 数据库连接（@vercel/postgres）
│   └── action.js        # API 统一入口（处理所有数据操作）
├── index.html           # 福利大厅主页：签到 + 导航
├── lottery.html         # 幸运转盘：抽奖 + 充值
├── admin.html           # 管理后台：配置 + 兑换码管理
├── style.css            # 统一样式
├── api-client.js        # 前端 API 适配器
├── db-init.sql          # 数据库建表脚本
├── package.json
├── vercel.json
└── readme.md
```

## 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 安装 Vercel CLI
npm install -g vercel

# 3. 拉取环境变量（含 POSTGRES_URL）
vercel env pull

# 4. 启动本地开发服务器
vercel dev
```

## API 接口

所有数据操作通过统一的 `/api/action` 接口处理，请求方法为 `POST`，格式：

```json
{
  "action": "signin",
  "data": { "userId": "fp_xxx..." }
}
```

支持的 action 列表：

| action | 说明 |
|--------|------|
| `getConfig` / `setConfig` | 系统配置 |
| `getPrizeConfig` / `setPrizeConfig` | 奖品概率配置 |
| `getLotteryNotice` / `setLotteryNotice` | 抽奖说明 |
| `ensureUser` | 注册用户 |
| `signin` / `getSignins` / `getSigninToday` / `getTotalSigninUsers` | 签到 |
| `getPoints` / `getFreeDraws` | 积分/免费次数查询 |
| `draw` / `getDrawHistory` | 抽奖 |
| `getPrizeCodes` / `addPrizeCodes` / `usePrizeCode` / `deletePrizeCode` | 兑换码管理 |
| `getLinks` / `addLink` / `deleteLink` | 自定义链接 |
| `getAllUsersStats` | 管理后台统计 |
