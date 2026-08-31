# 牛牛市场雷达｜Market Diary

**AI 港美股财经情报与内容工作台**  
定位：**财经内容运营工作台**

## 核心问题

Market Diary 不回答“今天有多少新闻”，而是回答：

> **今天最值得做什么内容？为什么值得做？下一步做成什么？**

统一工作流：

**获取 → 初筛 → 去重 → AI加工 → Human Check → 内容决策 → 看板沉淀**

核心原则：**AI不是事实来源。AI已处理，不等于可以直接发布。**

## 五个页面

1. 今日雷达：优先展示3–5条S/A级内容机会
2. 事件详情：解释为什么重要、影响谁、AI具体做了什么
3. 我的关注：股票 / 人物 / 机构 / 主题演示关注
4. 每日精选：Morning Brief / Evening Brief / Week in Review
5. 内容工作台：从信息直接走到运营动作

面试Demo路径：**今日雷达 → 事件详情 → Human Check → 内容工作台**。

## 首页内容卡统一字段

- 优先级
- 一句话结论
- 为什么重要
- 影响对象
- 内容形式
- 一级信源
- Human Check状态

Human Check显性流程：**AI已处理 → 待核验 → 已核验**。

SHEIN案例作为纠错样例：曾将交易安排发布日与实际上市交易日混淆，回到HKEX核验后完成纠正。

## 信息源四层

- **FACT｜事实层**：SEC、HKEX、公司IR、Fed、BLS、中国/香港政府部门等一级信源
- **BUZZ｜热点层**：X、小红书，只做热点发现，不作为事实来源
- **PEOPLE｜人物层**：政界、投资界、金融界、商界重要人物公开信息
- **MONEY｜资金层**：13F、Form 4、13D/13G、HKEX权益披露等公开持仓/交易披露

统一判断原则：**信源权威度解决“能不能信”，内容优先级解决“值不值得做”。**

## 自动化与Source Health

GitHub Actions每小时运行。技术信息不抢首页，只下沉到**Source Health / 系统状态**：

1. `scripts/update-candidates.mjs`：多源抓取、失败降级、去重和基础相关性过滤；
2. `scripts/rank-candidates.mjs`：编辑排序闸门；
3. `scripts/collect-sec-watchlist.mjs`：公开披露监控并如实记录源状态；
4. `scripts/enrich-candidates.mjs`：结构化、分类、优先级和内容建议；
5. `data/source-health.json`：记录来源健康状态、最后更新时间和降级情况。

最近一次实跑记录：31个来源/路径，21个直接成功，9个自动降级，0个硬失败；X官方API未配置；SEC在GitHub Actions出口受限时明确展示“源受限”，不伪造数据。

## 笔试材料

- `DELIVERY.md`：最终统一口径的01–09正式交付逻辑
- `COMPETITORS.md`：中国大陆 × 中国香港 × 海外产品能力参考
- `data/case-studies.json`：4条“原始信息 → AI加工 → Human Check → 内容动作”真实样例

## 公开演示

https://devi-y.github.io/market-diary/

> 本项目与望岳（望潮）完全隔离，不修改其代码、页面、数据与部署配置。
