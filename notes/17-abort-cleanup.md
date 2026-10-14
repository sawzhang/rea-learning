# 第十五轮：预先取消、重复请求和失败资源归属

日期：2026-10-14。REA 固定 6.4.0 / `c22111eca2c4bc84a084f12711f405b3e7422a40`；本机 Node 26.10.0，Babel 8.0.4。

## 受控实现与来源

safe 和 listener-only 真实文件仅在 listener 注册后检查 controller.signal.aborted 的代码上不同。safe 运行 already-aborted、repeat、cleanup-once、cleanup-permanent 四项，listener-only 运行 already-aborted 一项。两进程均使用 strict unhandled rejection、真实 V8 coverage 和独立 REA 静态分析。

任务拥有一个记录 id、owner、released 的逻辑资源 token，存入 ownership Map；cleaned 的等价条件是成功清理后 released=true、Map 不再保留该 id。不是文件、进程或 socket 资源。本轮故意让永久失败的 token 留在报告，不声称真实系统资源泄漏。

## 上游清理源码导读

`src/artifacts/ArtifactResourceScope.ts` 明确说明 retain failed cleanup。其 release/retryCleanup/close 流程保留清理失败的同一 owner，并允许后续尝试。关闭 scope 需要等待 active operations，清理不完整会报告资源，而非抹去归属信息。

`src/process/ProcessOwnership.ts` 的 ProcessCleanupFailure 保留 cleaned=false、reason、failures/unverified。失败诊断不会扩大额外的 signaling authority，资源有效性与所有权也不是同一个事实。

本 fixture 借鉴“失败后保留 owner”原则，没有执行进程 ownership sweep。`createTask` 的 cleanupAttempts 模拟首次或永久失败，成功才移除 listener、标 released 并删除 ownership；失败留下原 owner。报告中的资源权限不能用于操作真实进程。

## already-aborted 边界

listener-only 在信号已经 aborted 后才注册 listener，首个检查点仍 pending、abortCallbacks=0。再次 controller.abort 后依然没有新回调。驱动随后通过单独 forceStop 入口结束任务，并明确记录 forced-stop；不能把这次结束归因于重复 abort。

safe 注册 listener 后显式检查 signal.aborted，安排同一取消处理；第一个检查点任务已 rejected，清理一次，所有权释放。立即 initial snapshot 仍可 pending，因为处理在 microtask 中进行；信号状态与任务处理完成仍需分开。

该结果限于本受控实现与 Node 环境；未测试注册/检查之间的复杂跨线程竞争或其他宿主。

## 重复取消

repeat 场景连续调用 abort 三次，断言 abortCallbacks=1、settlements=1、cleanupAttempts=1。任务的状态检查保证已非 pending 时不重复 settlement。没有把“Promise 多次 resolve/reject 会被忽略”当作清理幂等性证明，显式检查了本实现的清理次数。

本轮只验证同一 controller 的重复 abort，没有泛化到多个取消源、重复 forceStop、重复 cleanup-after-success 或恶意回调。

## settlement 与清理失败

取消处理先标任务 rejected 并拒绝 Promise，然后尝试 cleanup。cleanup-once 首次失败，snapshot 已有 rejected outcome，但 owned=true、released=false、attempts=1。owner-finally 也会执行，仍不证明资源释放。

显式 retry 成功，attempts=2、owned=false、released=true；Promise outcome 不变。清理重试不重新 settlement，也不把旧取消结果升级为 fulfilled。

cleanup-permanent 重试后仍失败，attempts=2、owned=true、released=false；retained 列表保存 resource id 和 owner。任务逻辑终态不消除原所有权，需要后续处理，而不能静默删除 token。报告持久保留该失败，不在本机创建真实残留资源。

## AST 映射边界

脚本用 Babel 解析 createTask 中的 aborted-check IfStatement，保存准确范围/文本，验证 safe 存在、listener-only 不存在。两份 consume 文本完全相同，但其等待的任务是否结束、何时清理、能否重试由外部实现决定。

迁移拒绝依据为 already-aborted-and-cleanup-ownership-policy-unmodeled。保留源 consumer 原嵌套 coverage ranges、双方 Evidence 和目标整个 consumer 范围 count=null、unknown。source count=1 与 target count=4 来自不同实际场景，不合并为跨版本历史覆盖。

静态图 unknown 完整保留；AST 中看到 listener 或 finally 不能证明终态与资源确认。事件日志、V8 coverage、静态 Evidence 和 ownership snapshot 四类来源保持独立。

## 验证与后续

通过两次静态分析、两次真实采集、五项生命周期实验、函数范围和文件摘要一致、already-aborted 状态差异、重复取消计数、两类清理重试，以及永久失败归属保留。

未验证真实 close syscall 失败、OS 权限、任务竞争、多 owner、重试退避、重复成功清理或 cancellation reason 的传播。后续优先验证组合信号和多取消源下的一次性清理职责，继续保留失败归属与未知。
