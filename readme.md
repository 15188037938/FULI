# 福利大厅 - 签到抽奖系统

纯前端签到 + 转盘抽奖 + 兑换码管理系统。双击 HTML 即可运行，无需服务器。

## 功能

- **签到**：每日签到送免费抽奖次数，兑换码从奖品池自动发放
- **转盘抽奖**：Canvas 转盘，8 档奖品，概率由管理员自定义
- **兑换码充值**：输入兑换码增加积分余额
- **管理后台**：密码登录，配置签到积分、抽奖概率、奖品名称、兑换码管理

## 文件

| 文件 | 说明 |
|------|------|
| index.html | 福利大厅主页：签到 + 导航 |
| lottery.html | 幸运转盘：抽奖 + 充值 |
| admin.html | 管理后台：配置 + 兑换码管理 |
| style.css | 统一样式 |

## 部署到 GitHub Pages

1. 在 GitHub 创建新仓库
2. 推送代码：
```bash
git remote add origin https://github.com/你的用户名/仓库名.git
git branch -M main
git push -u origin main
```
3. 在仓库 Settings > Pages 中，Source 选 `main` 分支，根目录，保存
4. 访问 `https://你的用户名.github.io/仓库名/`

## 技术栈

- HTML5 + CSS3 + Vanilla JS
- Canvas 转盘动画
- localStorage 数据持久化
- 零依赖，零构建
