# 牛牛市场雷达｜Market Diary

AI 港美股财经情报与内容工作台。

## 目标

把大量碎片化财经信息压缩成运营人员可直接使用的内容机会：

**获取 → 初筛 → 去重 → 核验 → 摘要 → 重要性判断 → 内容化 → 看板沉淀**

## 五个页面

1. 今日雷达
2. 事件详情
3. 我的关注（股票 / 人物 / 机构 / 主题，可编辑）
4. 每日精选（Morning Brief / Evening Brief / Week in Review）
5. 内容工作台

## 信息源四层

- **事实 FACT**：SEC、HKEX、公司 IR、Fed、BLS、中国/香港政府部门等一级信源
- **热点 BUZZ**：X、小红书（只做热点发现，不作为事实来源）
- **人物 PEOPLE**：政界、投资界、金融界、商界重要人物公开信息
- **资金 MONEY**：13F、Form 4、13D/13G、HKEX 权益披露等公开持仓/交易披露

## 自动化

GitHub Actions 每小时运行一次，并在采集脚本变更时自动冒烟测试：

1. `scripts/update-candidates.mjs`：多源抓取、失败降级、去重和基础相关性过滤；
2. `scripts/rank-candidates.mjs`：编辑排序闸门，避免“信源权威 = 事件重要”；
3. `scripts/collect-sec-watchlist.mjs`：重点标的公开披露监控，并如实记录源连接状态；
4. `scripts/enrich-candidates.mjs`：结构化、分类、优先级和内容建议；
5. 数据源健康度写入 `data/source-health.json` 并直接展示在内容工作台。

可选环境变量：

- `MARKET_DIARY_AI_KEY`
- `MARKET_DIARY_AI_BASE`
- `MARKET_DIARY_AI_MODEL`
- `X_BEARER_TOKEN`

AI 接口采用 OpenAI-compatible 形式；未配置AI密钥时自动使用规则回退，避免自动化中断。

## 当前实跑状态

最近一次采集实跑：

- 31个来源/路径；
- 21个直接成功；
- 9个直连受限后自动降级；
- 0个硬失败；
- X官方API暂未配置；
- 社媒候选全部限制在事实核验闸门之外；
- SEC在GitHub Actions出口出现403，因此明确展示“源受限”，不伪造持仓数据。

## 笔试材料

- `DELIVERY.md`：按笔试题目的01–09结构整理正式交付逻辑
- `COMPETITORS.md`：中国大陆 × 中国香港 × 海外产品能力参考
- `data/case-studies.json`：4条真实“原始信息 → AI加工 → Human Check → 内容动作”样例

## 公开演示

https://devi-y.github.io/market-diary/

> 本项目与望岳（望潮）完全隔离，不修改其代码、页面、数据与部署配置。
