# Market Diary Insights

独立的、需管理员口令访问的 Market Diary 使用分析服务。

## 数据边界

- 只有前台访客明确同意后才接收数据。
- 接收随机浏览器 ID、会话 ID、页面枚举、白名单动作、公开事件 ID、粗粒度设备、来源域名和可选随机邀请码。
- 不接收姓名、手机号、提问、搜索词、关注、草稿、剪贴板、完整网址、IP 字段、原始 User-Agent、精确屏幕参数或精确位置。Vercel 作为网络托管商可能在基础设施层短暂处理连接信息，但应用不将其写入分析记录。
- 私有 Blob 只保存会话批次；定时任务删除 90 天前的会话。
- 管理接口使用 `ANALYTICS_ADMIN_TOKEN`，口令不放在前端代码、网址或 Git 仓库中。

## 环境变量

```text
BLOB_READ_WRITE_TOKEN=<由 Vercel Blob 自动连接>
ANALYTICS_ADMIN_TOKEN=<随机管理员口令>
CRON_SECRET=<随机定时清理口令>
ANALYTICS_ALLOWED_ORIGINS=https://devi-y.github.io
```

## 本地检查

```bash
npm install
npm test
node --check app.js
for file in api/*.js lib/*.js; do node --check "$file"; done
```

## 存储与规模边界

当前按浏览器会话累计、定时批量覆盖一个私有 Blob，适合低流量 MVP。Vercel Hobby 的 Blob 高级操作额度有限；进入正式运营或高流量阶段，应迁移到具备原子计数和索引的 Redis、Postgres 或专用事件分析数据库，并继续沿用同一隐私白名单。
