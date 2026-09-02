# 牛牛市场雷达｜Market Diary

一个面向港美股财经内容运营的轻量工作台：先判断今天最值得做什么，再把已核验事件快速转成可直接使用的快讯、解读或社区讨论稿。

## 核心闭环

**今天先做什么 → 为什么值得做 → 直接怎么写 → 依据是什么 → 还需核验什么**

产品保持三条明确边界：

- AI/规则负责聚合、去重、结构化和内容建议，不作为事实来源。
- `data/events.json` 是已核验内容层；自动候选不会直接晋级首页。
- `data/candidates.json` / `data/ai-candidates.json` 是待核验线索层，只能生成核验清单。

## 四个入口

1. **今日**：一次只看一个重点事件；支持按钮、方向键和移动端上下滑切换。
2. **问一下**：用自然语言找事件，并按快讯、解读、社区讨论三种格式生成结构化内容。
3. **内容池**：把已核验内容与自动候选分开搜索、筛选和查看。
4. **我的**：本机保存关注、草稿、已核验更新时间和自动来源运行状态。

旧链接仍兼容：`#workbench` 继续作为核心工作台入口，`#watchlist` 自动映射到“我的”。

## 证据与隐私

- 每份可生成内容固定展示关键事实、编辑判断、风险边界、一级/辅助信源和下一步。
- 待核验候选不生成可发布成稿。
- 关注与草稿只写入当前浏览器的 `localStorage`。
- 当前版本没有第三方访客追踪，不发送访客标识、浏览记录或个人关注。

## 自动化

GitHub Actions 每小时更新候选池、AI/规则加工结果、来源健康和 SEC 观察数据。候选更新与人工核验内容更新时间在 UI 中分开显示。

主要脚本：

- `scripts/update-candidates.mjs`：多源采集、时间窗、降级和初步去重。
- `scripts/rank-candidates.mjs`：按影响、时效和内容价值排序。
- `scripts/collect-sec-watchlist.mjs`：公开披露观察。
- `scripts/enrich-candidates.mjs`：AI 加工；无密钥时使用规则回退。
- `scripts/test-frontend.mjs`：前端结构、隐私边界和数据契约检查。

## 本地运行与检查

```bash
python3 -m http.server 4173 --directory .
node --check market-diary/app.js
node --check market-diary/sw.js
node market-diary/scripts/test-frontend.mjs
```

打开 `http://127.0.0.1:4173/market-diary/#workbench`。

## 当前技术边界

GitHub Pages 不能安全保存模型密钥，因此自然语言匹配与成稿输出只使用已经进入站点的结构化数据。若未来需要开放式实时问答，必须增加受控后端代理，不能把 API Key 放到浏览器。

公开演示：<https://devi-y.github.io/market-diary/>

> 本项目与望岳（望潮）保持代码、数据与部署隔离。
