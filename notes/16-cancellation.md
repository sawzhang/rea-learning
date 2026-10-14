# 第十四轮：聚合、取消请求与任务终态

日期：2026-10-14。REA 固定 6.4.0 / `c22111eca2c4bc84a084f12711f405b3e7422a40`；本机 Node 26.10.0，Babel 8.0.4。

## 真实实验结构

allSettled、any、any-cancel、any-ignore 四份目标，各创建 A/B 两个受控 Promise，运行三个场景，共十二个聚合过程。resolve/reject 由驱动显式调用，用 setImmediate 检查已调度回调，而不依赖随机延迟。

createTask 拥有 pending/fulfilled/rejected 状态和 cleaned 标志，并订阅自己的 AbortController.signal。finish 只执行一次，移除 listener、记录模拟清理、完成 Promise。配合取消的 onAbort 安排 microtask 后 finish rejection；不配合的 onAbort 只记录 ignored，状态保持 pending。

这是模拟任务资源生命周期，不创建外部文件、socket 或进程资源。cleaned 的证据仅限该函数的状态和 listener 管理，不能泛化为 OS 清理成功。

## 静态源码导读

`src/domain/javascript/javascriptSemanticPromises.ts` 的 promiseCandidateDetails 明确将 all/allSettled 作为 aggregate，未涵盖 any。实际图对 allSettled 保留聚合节点，对 any 没有该聚合语义节点；报告保留 any-not-modeled-by-pinned-extractor，不据此声称运行时 any 不存在。

`src/application/javascript/JavaScriptSemanticGraphFlowProjection.ts` 根据 sourceResolution 建立 aggregates candidate/resolved 关系，并根据 assigned/awaited/returned 标 owns/awaits 等。它表达静态引用来源，不能认证调用方取消权限或清理 acknowledgement。已有 semantic_unknowns 完整保留。

学习脚本 `scripts/run-cancellation-lab.mjs` 分别解析 logic.js 和 main.js：保留聚合 CallExpression 方法/范围、consume 文本/范围，以及入口 cancel/cooperative 字面量。实际文件 SHA-256 和双方静态 Evidence 引用共同给出来源，不将单文件摘要冒充依赖闭包身份。

## 聚合结果对照

A 先拒绝、B 后成功：allSettled 等 B 完成后 fulfilled，包含 A rejected 和 B fulfilled；any 在 A 拒绝后仍 pending，B 成功后 fulfill B。

两项拒绝：allSettled 仍 fulfilled，保留两个 rejected records；any rejected AggregateError，并检查 errors 为 A-boom/B-boom 的输入顺序。不要把 JSON.stringify(Error) 的空对象当作没有错误，驱动显式投影 reason.message 与 error.errors。

A 先成功：any owner 已结束且进入 finally，但 B 快照仍 pending/cleaned=false；allSettled owner 仍等待。之后驱动必须继续处理剩余任务，不能把 owner 完成当作全任务终态。

## 取消请求与确认

any-cancel 在 owner A 成功之后 cb.abort。同步 snapshot 的 signalAborted=true、B pending、cleaned=false；下一检查点 B rejected、cleaned=true。事件顺序保留 cancel-request、abort-received、cleanup 和 rejected，能区分请求和确认。

any-ignore 相同阶段接收 abort，记录 ignored；检查点后仍 pending/cleaned=false。驱动最终主动 resolve B，才达到 fulfilled/cleaned=true。owner 一直保持 A，不由取消 acknowledgement 改写。

所有十二个聚合过程都等待 owner 与剩余任务处理，断言最终不再 pending，两个模拟清理标志均为 true，owner-finally 恰好一次。strict unhandled rejection 正常退出建立的是整个受控程序的处理结果；任务日志 handler 也安装了 rejection 分支，不能把无未处理拒绝单独归因于聚合器。

## 相同逻辑工件仍不足以迁移

四份 consume 文本都相同，外层函数 coverage count 都为 3。any、any-cancel、any-ignore 的 logic.js 字节完全相同；main.js 的 cancel/cooperative 字面量不同。

所以有三项明确拒绝：allSettled→any 的聚合策略不同；any→any-cancel 的入口取消策略不同；any-cancel→any-ignore 的任务合作策略不同。报告保留源原始 ranges、双方 Evidence 和目标 consume 整函数 unknown/count=null。拒绝并不是否認文本坐标可对齐，而是禁止把历史执行语义通过同文本或局部摘要直接转移。

新目标原始 coverage、生命周期状态和事件日志独立保存。实际新运行 count=3 不会回填历史 unknown；取消请求不被转换成零计数、不存在任务或已清理声明。

## 验证与后续

验证四次真实静态分析与四次 coverage、十二次聚合结果、AggregateError 输入顺序、abort 立即状态、下一检查点状态、ignored 后仍 pending、最终清理和相同工件/不同入口的身份反例。

未验证外部 I/O 的真正 abort、AbortSignal.timeout/any、already-aborted 信号、listener 竞争、重复取消、资源关闭失败、动态任务集合或永久 pending。本 fixture 在所有场景最终完成所有任务，不把 pending 永久遗弃。

后续优先测试 already-aborted、重复请求与清理失败，继续显式保存请求、终态、资源归属和未知，不用默认“取消成功”代替证据。
