# 第十七轮：并发清理重试

运行 `npm run lab:inflight`。固定上游的真实 REA CLI 分析三份目标，然后各自在 Node strict rejection 模式下采集 V8 coverage。

- `coalesced`：同步返回共享 in-flight Promise。
- `async-wrapper`：共享底层清理，但 async 包装返回新的 Promise 引用。
- `uncoalesced`：每次请求各自启动清理，用作反例。

每个实现包含成功、一次失败、永久失败三种场景；显式 gate 控制同时到达的两位调用者，不依赖计时器猜测顺序。失败保留逻辑 owner，成功后验证后续请求不再操作资源。

证据生成至被忽略的 `results/17-cleanup-inflight/`：真实静态 Evidence、原始 coverage、事件日志、AST 区间与映射报告。报告保留未迁移源 ranges 和目标 unknown/count=null，不把目标新执行当成历史覆盖率。

详见 [中文源码笔记](../../notes/19-cleanup-inflight.md)。资源是内存 token，本实验不执行真实 OS 清理，也不直接执行上游 ArtifactResourceScope。
