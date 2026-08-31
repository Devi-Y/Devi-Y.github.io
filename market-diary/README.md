# 牛牛市场雷达｜Market Diary

AI 港美股财经情报与内容工作台。

## 目标

把大量碎片化财经信息压缩成运营人员可直接使用的内容机会：

**获取 → 初筛 → 去重 → 核验 → 摘要 → 重要性判断 → 内容化 → 看板沉淀**

## 五个页面

1. 今日雷达
2. 事件详情
3. 我的关注
4. 每日精选
5. 内容工作台

## 信息源四层

- **事实 FACT**：SEC、HKEX、公司 IR、Fed、BLS、中国/香港政府部门等一级信源
- **热点 BUZZ**：X、小红书（只做热点发现，不作为事实来源）
- **人物 PEOPLE**：政界、投资界、金融界、商界重要人物公开信息
- **资金 MONEY**：13F、Form 4、13D/13G、HKEX 权益披露等公开持仓/交易披露

## 自动化

GitHub Actions 每小时运行一次：

1. `scripts/update-candidates.mjs` 抓取多类财经候选信息；
2. `scripts/enrich-candidates.mjs` 进行结构化、分类和优先级建议；
3. 未配置 AI 密钥时自动使用规则回退，避免自动化中断；
4. 候选信息只有回到一级信源核验后，才能进入正式雷达。

可选环境变量：

- `MARKET_DIARY_AI_KEY`
- `MARKET_DIARY_AI_BASE`
- `MARKET_DIARY_AI_MODEL`

AI 接口采用 OpenAI-compatible 形式，因此可替换不同模型服务。

## 公开演示

https://devi-y.github.io/market-diary/

> 本项目与望岳（望潮）完全隔离，不修改其代码、页面、数据与部署配置。
