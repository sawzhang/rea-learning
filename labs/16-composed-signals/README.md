# 实验 16：组合信号与多取消源的一次性清理

```bash
npm run lab:composed
```

三份真实实现各运行五个场景：A-first、B-first、两个信号在注册前均 aborted、清理首次失败、清理永久失败。使用显式 abort 顺序与 microtask/checkpoint，不用随机延时。

| 实现 | 两个来源取消的 callback 数 | 首次清理尝试 | 普通场景重复释放尝试 |
|---|---:|---:|---:|
| composed | 1 | 1 | 0 |
| direct-guarded | 2 | 1 | 0 |
| direct-unguarded | 2 | 2 | 1 |

三者均仅一次 Promise settlement。composed 用 AbortSignal.any 并将 cleanup 放在一次性状态 guard 后；direct-guarded 直接监听两项，但同样用 guard 保护 cleanup；direct-unguarded 只保护 settlement，cleanup 在 guard 外，作为反例。

清理首次失败时：前两者保留 owner，等待明确 retry；反例的第二个取消回调变成了未显式请求的第二次清理。永久失败时都保留 resource ID/owner/released=false，显式重试也不会抹掉归属。

already-aborted 对照先 abort B 再 abort A，然后以 [A,B] 构造/注册。此 fixture 选定 A-reason；它不是记录所有来源的历史时间线。A-first/B-first 的实时取消则分别保留对应首个 reason。

所有资源仅为内存逻辑 token。原始 coverage、REA Evidence、事件、归属和 AST guard 记录保存在 `results/16-composed-signals/`。consumer 文本相同、外层 coverage count 同为 5，仍拒绝跨清理/信号策略迁移；完整保留源 ranges 与目标 unknown/count=null。

详见 [第十六轮笔记](../../notes/18-composed-signals.md)。
