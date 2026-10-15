# 第十六轮：组合信号、多来源取消与清理职责

实验日期：2026-10-15。上游仍固定 REA 6.4.0 / `c22111eca2c4bc84a084f12711f405b3e7422a40`，本机 Node 26.10.0、Babel 8.0.4。

## 本轮选择与证据

上一轮已验证单个 controller 重复 abort 不会重复 settlement，但未验证多个来源。本轮三份真实源码、三个独立进程、十五个任务，组合不同信号策略与 cleanup guard 位置。每份分别完成 REA CLI 分析和 Node strict 模式 V8 coverage 采集，不升级上游、不安装新软件。

[Node 官方 AbortSignal.any 文档](https://nodejs.org/api/globals.html#static-method-abortsignalanysignals)说明组合信号随任一输入取消，reason 来自触发来源。同页区分 aborted 状态与 abort 事件、说明单一 controller 的事件只触发一次。多个来源仍各自拥有事件，不等于多个来源组成的业务任务只有一个回调。

本轮所有 resource 均为内存 token，ownership Map 只是模拟资源账本，不涉及真实 OS 句柄、文件或进程释放。事件和 state 快照是自建 instrumentation，V8 count 是调用方覆盖率，静态图是独立 REA Evidence。

## 三个实现隔离两个因素

composed：observedSignals=[AbortSignal.any(signals)]，注册一个 listener；已 aborted 时显式读取状态并调处理器。microtask 内若 state 非 pending 则立即 return，settlement 和 cleanup 位于同一一次性路径。

direct-guarded：直接注册 A/B 两个 listener，其他一次性处理与 composed 相同。两个来源在 microtask checkpoint 前先后取消，产生两个 callback，但第二项看到任务已终止，不再执行 cleanup。

direct-unguarded：同样直接注册两个 listener，但只把 reject/settlement 放进 if(state===pending)，cleanup 在 if 外。Promise settlement 仍一次，资源 cleanup 却可能两次。这是明确的反例实现，不是推荐设计。

最初只有 composed 与 direct-unguarded 会同时改变两个因素。补充 direct-guarded 后，能区分“信号组合减少回调”和“状态 guard 保护清理”的作用，不能把反例错误归因于直接监听信号本身。

## 上游源码对照

`src/artifacts/ArtifactResourceScope.ts` 的 release 仅在 cleanup 成功后从 #pending 删除 owner，失败则重新保留。retryCleanup 用 #draining 复用当前清理过程，避免同一个 scope 的并发重试自行扩散；close 停止新操作 admission 并等待 active operations。

这些是资源职责和清理重试的应用层规则，不是 AbortSignal 自带保证。`src/process/ProcessOwnership.ts` 将 cleaned:false 的失败信息与 ownership 验证保留，失败不会自动授权额外 signaling。

本 fixture 不运行这些 OS 清理实现，只对照其原则：取消事件数、Promise settlement 数和 cleanup 调用数须分别观察；失败保留归属，重试应有明确来源。

`src/domain/javascript/javascriptSemanticPromises.ts` 与 `JavaScriptSemanticGraphFlowProjection.ts` 处理静态 promise 关系，不能把 listener 或 owns 关系提升为清理恰好一次的证明。报告保留每份图的 semantic_unknowns，不伪造 AbortSignal.any 的静态生命周期语义。

## 五组场景的实际结果

A-first/B-first：驱动在同一同步阶段取消两项来源，再重复 abort 两个已取消 controller。三实现都 settlement=1，reason 分别 A/B。composed callback=1，两个 direct 实现 callback=2。

普通成功清理场景：composed/direct-guarded cleanupAttempts=1；direct-unguarded cleanupAttempts=2，第二次被 resource.released 检查识别为 duplicate-release-attempt，重复逻辑释放计数为 1。逻辑 token 只释放一次，并未制造实际 OS 双重关闭。

pre-aborted-both：驱动先取消 B，再取消 A，但注册/组合输入顺序为 [A,B]，本环境选择 A-reason。该结果验证了已经取消的输入构造时行为，不是两个来源真实历史先后的可靠记录。若要保留所有原因/时间，需调用方显式记录，不能从一个 reason 反推。

cleanup-once：前两个实现首次 cleanup 失败，first snapshot owned=true、released=false，只有显式 retry 后 attempts=2 并释放。反例首次失败后，第二个取消回调已进行 cleanup 第二次并成功；first snapshot owned=false，没有 explicit-cleanup-retry。这揭示第二个事件可意外充当重试，而“最终释放成功”隐藏了职责差异。

cleanup-permanent：composed/direct-guarded 首次尝试一次，再显式重试一次，共两次；direct-unguarded 首次两次加显式重试，共三次。三个实现都保留 owner/id/released=false，Promise 仍是最初的 rejected outcome。owner-finally 恰好一次不证明清理成功。

## AST 映射边界与保留记录

脚本 `scripts/run-composed-lab.mjs` 解析 observedSignals 的实际 AST，验证组合调用或直接 signals；解析 onAbort 中 queueMicrotask 回调的首个 IfStatement，验证 early ReturnStatement 与只包 settlement 的 BlockStatement 差异。完整 callback 文本、范围和 guard 文本随报告保存。

三份 consume 文本完全相同，真实函数 count 都为 5。两项历史迁移均保持 unknown：direct-unguarded→direct-guarded 的 cleanup placement 改变；direct-guarded→composed 的信号 composition 改变。各自保存双方 Evidence/AST、源原始嵌套 ranges 和目标整函数 UTF-16 unknown/count=null，不将新执行数据填进旧历史区间。

源码实际字节摘要与静态 function 节点摘要一致，V8 consumer 范围与 AST 完全匹配，采集后再次核对文件摘要。每个永久失败任务的逻辑 owner 留在对应结果中；结果文件被忽略，不提交本机完整 Evidence。

## 验证、限制与下一轮

通过三次真实静态分析/coverage、十五个任务的 reason、callback、settlement、cleanup、重复释放、显式重试及归属检查；本轮仅一个新学习轮次。

未覆盖原生异步 close、并发调用 retryCleanup、跨 worker 取消、timeout 信号、嵌套组合、创建阶段真正竞争、重复成功清理或多 owner 权限交接。信号 handler 和失败策略均为受控模型，不是通用任务管理器。

下一轮优先研究并发 cleanup retry 的共享 in-flight 结果和失败后 owner 保留，直接对照上游 #draining 规则，继续分开任务完成与资源确认。
