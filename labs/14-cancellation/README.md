# 实验 14：allSettled/any、显式取消与清理确认

```bash
npm run lab:cancellation
```

四份真实目标各执行三个显式驱动场景，保存 REA Evidence、原始 V8 coverage 和任务生命周期快照。

| 场景 | allSettled | any |
|---|---|---|
| A 拒绝，B 随后成功 | 等两项终态，返回输入顺序的 settled records | 首个拒绝后仍 pending，随后返回 B |
| 两项拒绝 | fulfilled，含两个 rejected records | rejected AggregateError，errors 按 A/B 输入顺序 |
| A 成功，B 尚未结束 | 等待 B | 返回 A，B 仍 pending/未清理 |

any-cancel 在 A 获胜后显式 cb.abort；立即快照为 signalAborted=true，但 B 仍 pending、cleaned=false。下一检查点，配合的 B 拒绝并确认清理。any-ignore 收到同一信号却保持 pending，最后由驱动正常完成 B。两者 owner 结果仍是 A。

cleaned 是 fixture 的模拟清理标志及 abort listener 移除，不代表真实文件、网络或 OS 资源释放。实验检查任务终态、清理确认和 owner 结果，不能把“发出 abort”当作完成证明。

固定 REA 将 allSettled 提取为 aggregate，未将 any 提取为 aggregate；静态 unknown 保持完整。AST 同时记录 logic.js 聚合方法和 main.js 的 cancel/cooperative 策略。相同 consumer 文本甚至相同 logic.js 字节，也不能消除外部入口策略差异。

历史迁移对照分别拒绝 allSettled→any、any→any-cancel、any-cancel→any-ignore，保留源 coverage 与目标整函数 unknown/count=null。结果位于 `results/14-cancellation/`，详见 [第十四轮笔记](../../notes/16-cancellation.md)。
