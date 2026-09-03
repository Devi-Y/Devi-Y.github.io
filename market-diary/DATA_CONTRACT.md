# Market Diary 数据契约

## 当前 P0 边界

- `data/events.json` 是编辑标记为 `verified: true` 的事件层，可用于阅读、追问和内容生成；当前未结构化记录 `verifiedAt / verifiedBy`，因此还不是审计级核验记录。
- `data/candidates.json` 是完整自动候选池；`data/ai-candidates.json` 是送到前端的已加工候选子集。
- 自动候选无论信源等级多高，都不能自动变成 `verified`。
- `keyNumber`、`coreData` 与 `impact` 当前都是展示文本，不能解析后用于数值排序、收益判断或综合排名。
- 来源请求成功只说明链路可达；`count: 0` 必须显示为“本轮0条”，不能称为内容覆盖正常。
- `aiConfigured: false` 时，界面必须显示规则回退，不能称为模型分析。

## 当前允许的事件对照

只有下列字段可以直接并列：

- 市场与事件类型
- 事件 / 公告日期及相对当前时间
- 来源名称、信源层级与核验状态
- 影响对象，但必须标为编辑判断
- 下一核验项或内容动作

当前不设置“综合最佳”、奖牌或买卖结论。

## 数值比较的升级门槛

未来只有两条事实同时满足下列条件时，才允许比较数值大小：

```json
{
  "metricId": "revenue",
  "value": 96200000000,
  "unit": "USD",
  "period": "FY2027-Q2",
  "basis": "reported",
  "display": "962亿美元",
  "evidenceIds": ["source-1"],
  "verificationStatus": "verified"
}
```

比较键为 `metricId + unit + period + basis`。任一项不同或缺失时，界面显示“暂无同口径可比数据”。

## 后续结构化字段

正式接入行情、财务数据或提醒前，应补齐：

- `schemaVersion`
- `eventPhase`: `scheduled | occurred | updated | cancelled`
- 标准 ISO-8601 的 `occurredAt / scheduledAt / publishedAt`
- 稳定的实体 ID 与证券代码
- 每条事实到原始证据的引用
- `verifiedAt / verifiedBy / lastCheckedAt`
- 编辑评分版本与“热度为编辑判断”的机器可读标记

在这些字段和相应授权未完成前，市场页保持“事件市场视图”，不展示伪实时行情。
