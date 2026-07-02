const { sql } = require('@vercel/postgres');

// @vercel/postgres 自动从环境变量 POSTGRES_URL 读取连接信息
// 在 Vercel 上开启 Vercel Postgres 后会自动注入
// 本地开发需在 .env 中配置 POSTGRES_URL

module.exports = { sql };
