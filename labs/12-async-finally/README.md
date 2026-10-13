# 实验 12：await、rejection 与异步 finally 时序

```bash
npm run lab:async
```

六份真实 ESM 目标各调用两次 evaluate（false、true），调用方逐次 await 并记录事件。每份目标独立经过 REA 静态分析与 Node 原始覆盖率采集，以 strict unhandled rejection 模式运行。

| 目标 | false 完成 | true 完成 | 历史迁移 |
|---|---|---|---|
| plain | fulfilled ok | fulfilled ok | 普通 async return 对照 |
| await-catch | fulfilled ok | fulfilled caught | unknown |
| returned-rejection | fulfilled ok | rejected boom | unknown |
| finally-normal | fulfilled ok | rejected boom | unknown |
| finally-return | fulfilled override | fulfilled override | unknown |
| finally-rejection | rejected cleanup | rejected cleanup | unknown |

所有 evaluate 外层函数 count 为 2。该计数不区分 fulfilled/rejected，也不能代替 await 后续区间的执行证明。

事件包含 caller-start、caller-pending、before/after-await、catch、finally-start/end、caller-fulfilled/rejected。断言相对顺序，不用墙钟时间或 sleep 推测异步时序。

returned-rejection 的 finally-start 出现在 caller-pending 前，await 清理使 finally-end 延后；它的 catch 不接收返回 Promise 后的 rejection。await-catch 则在 true 场景进入 catch。finally 中的 return 或 await rejection 分别改变最终完成结果。

AST 报告保留 await/return 区间与 try/catch/finally 上下文。遇到 suspension 或异常完成结构时拒绝历史迁移，保留旧 return、原嵌套覆盖区间及目标整函数 unknown/count=null。实际新运行数据与历史来源分开保存。

结果位于 `results/12-async-finally/`，详见 [第十二轮笔记](../../notes/14-async-finally.md)。
