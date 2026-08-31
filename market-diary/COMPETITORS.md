# Market Diary｜产品能力参考

> 目的不是“抄竞品”，而是回答：成熟财经产品已经解决了哪些信息效率问题，Market Diary应该学什么、不要学什么。

## 一、结论

Market Diary 不应该变成另一个新闻聚合器，也不应该和券商交易终端比行情/下单能力。

最值得组合的能力是：

**长桥的实时关注 + 老虎的事件订阅 + IBKR的持仓/自选相关性 + uSMART的周期Brief + 第一财经的内容加工 + 东方财富的定时AI任务 + 问财的自然语言查询。**

Market Diary 的差异化则保留在最后一公里：

> **不仅告诉用户“发生了什么”，还告诉内容运营“今天做不做、为什么做、下一步做成什么”。**

---

## 二、重点参考产品

| 产品 | 市场/类型 | 已验证的代表能力 | Market Diary 学什么 | V1/V2落地 |
|---|---|---|---|---|
| 富途牛牛 | 港美股券商 | 行情、资讯、自选、社区、IPO等综合入口 | 目标用户和内容使用场景对齐 | 笔试场景基准 |
| 长桥 Longbridge | 香港/海外券商 | Watchlist实时跟踪、毫秒级异动提醒；LongbridgeAI与金融日历 | “关注”不是收藏，而是持续监测 | 我的关注 + 未来事件提醒 |
| 老虎 Tiger Brokers | 香港/海外券商 | Topic Subscription把单篇新闻升级为事件追踪；AI Watchlist Analysis、Watchlist Daily Report | 从“新闻”升级成“事件”，支持订阅 | 主题关注 + Daily Brief |
| uSMART | 香港券商 | 股票晨报/晚报/周报、News Summary Bot、异常/情绪/数据提醒 | 周期性内容自动生成 | Morning / Evening / Week Review |
| AASTOCKS | 香港财经平台 | 港股本地资讯、公告、行情、公司事件 | 港股本地化密度和事件覆盖 | 港股源补充，不作为最终事实源 |
| 盈透 IBKR | 全球券商 | AI News Summaries按Portfolio/Watchlist相关性过滤；重要新闻自动标记；Connections/Investment Themes | “与我有关”优先于“全市场都有什么” | 关注匹配 + 影响对象关系 |
| 第一财经 | 中国大陆财经媒体 | 要闻速读、智解财经、火线解读、直播速览；投资日历 | 财经编辑加工方式，而非只做机器摘要 | 快讯/解读/用户教育/日历 |
| 东方财富·妙想 | 中国大陆财经平台 | AI定时任务可自动执行早报、复盘、机会扫描 | AI工作流要可重复执行 | GitHub Actions定时任务；未来用户自定义任务 |
| 同花顺·问财 | 中国大陆财经平台 | 自然语言查询金融数据/资讯，降低复杂筛选门槛 | 搜索和筛选最终应对话化 | V2自然语言检索 |
| AlphaSense / Koyfin | 海外专业工具 | 多源检索、引用回溯、Dashboard/Alerts | 专业工作台的信息密度和可追溯性 | 来源链 + 编辑工作台 |

---

## 三、官方能力依据

### 长桥 Longbridge

Longbridge Pro公开强调 Watchlist 实时追踪和毫秒级提醒，适合借鉴“我的关注 = 持续监听”而不是静态收藏。

- https://longbridge.com/desktop

### 老虎 Tiger Brokers

Tiger Trade 9.5.3 的 Topic Subscription 会围绕重大事件聚合新闻，并在出现重要更新时通知；9.5.0支持 AI Watchlist Analysis 和 Watchlist Daily Report。

- https://www.itiger.com/about/app/update

### uSMART

uSMART AI提供 Stock morning brief、evening brief、weekly brief 和 News Summary Bot，并通过多类数据/情绪信号帮助用户理解市场变化。

- https://www.usmart.hk/en/about-us/media-centre/detail/10203

### Interactive Brokers

IBKR AI News Summaries可按Portfolio/Watchlist中的市场、行业和证券过滤新闻并自动标记重要内容；AI Hub还包括Investment Themes、Connections和Ask IBKR。

- https://www.interactivebrokers.com/en/trading/news-summaries.php
- https://www.interactivebrokers.com/en/trading/ai-hub.php

### 第一财经

第一财经公开的AI能力包括“要闻速读、智解财经、火线解读、直播速览”，同时产品内还有投资日历等内容形态。

- https://www.yicai.com/news/102645909.html

### 东方财富·妙想

妙想2.0的定时任务可按设定时间自动执行早报、复盘、机会扫描等任务，说明AI财经工具正在从“用户问一次”走向“持续自动工作”。

- https://caifuhao.eastmoney.com/news/20260515142428319379790

---

## 四、竞品启发 → 产品动作

### 1. 新闻 → 事件

单篇新闻只是一次性阅读；同一事件会持续出现“传闻、官方确认、数据更新、市场反应、后续影响”。

**产品动作：** Market Diary以`event`为核心对象，未来同事件的信息进入一条时间线，而不是生成十条重复卡片。

### 2. 全市场 → 与我有关

用户真正需要的不是每天200条信息，而是“与你关注的股票、人物、行业和主题相关的变化”。

**产品动作：** 我的关注支持股票、人物、机构、行业/主题；事件自动匹配关注对象。

### 3. 信息流 → Brief

高频用户有固定使用节奏：盘前、盘中、盘后、周末。

**产品动作：** 同一信息池自动生成 Morning Brief、Evening Brief、Week in Review，不重复采集。

### 4. AI回答 → AI值班

一次提问只能节省一次时间；定时任务才能真正替代重复劳动。

**产品动作：** 当前GitHub Actions每小时自动运行，未来允许用户设置“每天8点生成关注股早报”等自定义任务。

### 5. 摘要 → 内容决策

多数财经AI产品服务投资决策；这道笔试要突出内容运营。

**产品动作：** 每条事件额外输出：用户价值、内容优先级、建议动作、内容方向、Human Check。

---

## 五、Market Diary不做什么

- 不与券商比交易执行和行情基础设施；
- 不把AI生成文本当成事实；
- 不把社媒讨论量当成可信度；
- 不为了“自动化”绕过SEC/HKEX等数据访问规则；
- 不为了显得AI能力强而堆很多模型和Agent；
- 不把所有官方信息都判成高优先级——**信源权威与内容重要性是两件事。**
