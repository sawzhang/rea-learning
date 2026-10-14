# 第十三轮：并发交错、rejection 与任务所有权

记录日期：2026-10-14。上游固定 REA 6.4.0 / `c22111eca2c4bc84a084f12711f405b3e7422a40`；本机 Node 26.10.0，Babel 8.0.4。

## 受控任务，不是计时竞赛

all/race 两份目标各运行三个场景，共六个聚合过程、十二个子任务。createTasks 建立两个 deferred Promise 并保留 resolve/reject 句柄；驱动先完成一个任务，await setImmediate 检查状态，再完成另一个任务，最后等待 owner 并排空事件。

场景分别为 B 先 fulfill、A 先 reject、A 先 fulfill 后 B reject。所有顺序由驱动显式选择，没有墙钟阈值或随机延时。事件数组来自自建 instrumentation，原始 V8 coverage 也是调用方采集，均不冒充 REA passive Inspector Evidence。

## 源码导读：固定版本的提取边界

`src/domain/javascript/javascriptSemanticPromises.ts` 的 promiseCandidateDetails 识别 unshadowed Promise constructor、resolve/reject、then/catch/finally、await；聚合分支只将 all/allSettled 识别为 aggregate，没有 race。

`src/application/javascript/JavaScriptSemanticGraphFlowProjection.ts` 的 projectPromiseSources 为 aggregate 和来源建立 aggregates 关系，按 sourceResolution 标 candidate/resolved；projectPromiseOwnership 根据 awaited/assigned/returned 标 awaits/owns 等静态关系。

这些关系是静态来源与归属信息，不是对调用方取消权限、清理责任或任务最终完成状态的认证。对象返回、属性 await、回调和跨函数来源可能仍 unresolved，报告完整保留 semantic_unknowns。

首轮对 all/race 都要求存在 aggregate 的断言失败。检查真实输出和 producing boundary 后发现 race 的固定版本提取缺口；修正实验为保留真实能力差异，未修改上游、补造 race 图边或把缺边视为行为不存在。

## AST 与同文本反例

两份源文件实际只有 Promise.all/Promise.race 的方法变化。AST 解析保存 CallExpression 范围、方法和输入数组标识符 a/b，以及 consume 函数文本和范围；明确断言两份 consume 文本相同。

consume 都 await tasks.aggregate，并在 finally 记录 owner-finally。实际 consume 外层 count 均为 3，但聚合完成时机与值不同。单独的函数文本、外层 count 或局部 await AST 不绑定 createTasks 的聚合策略和任务集合，不能自动授权跨版本历史区间迁移。

report 将源 consume 原嵌套覆盖范围完整保留，目标整个 consume 范围 count=null、unknown；拒绝依据为 aggregation-policy-and-task-completion-ownership-differ，同时保存双方 Evidence、摘要和 AST 策略记录。本轮没有把新运行 count 套到旧迁移结果。

## 六个聚合过程的结果

B-first：all 第一个检查点仍 pending，随后 A 完成，结果为 [A,B]，与实际完成先后不同；race 第一个检查点已 fulfill B，A 随后仍完成。

A-reject-first：两个 owner 均先 rejected A-boom 并执行 finally，之后 B 才 fulfill。结果没有改变，但剩余任务日志仍存在；owner finally 不是所有任务已经结束的证明。

A-win-B-late-reject：all 首次仍 pending，后来 rejected B-late；race 已 fulfill A，B 后来 reject，race 结果仍为 A。late task 仍被驱动处理，没有通过“winner 已完成”丢弃它。

每个过程 owner-finally 恰好一次且在 owner 完成事件前。owner 先结束的场景，第二项任务的 fulfillment/rejection 事件在 owner 之后。驱动最后排空本 fixture 所有事件，不把早期快照当作生命周期完整证据。

## 任务归属与清理

createTasks 保留任务句柄，consume 负责 await 聚合，驱动负责完成两个任务并等待 owner。聚合器输出不是任务取消协议；本 fixture 没有实现 AbortController 或外部资源取消。

各任务都安装 fulfilled/rejected 日志处理器，聚合与 owner 也有 rejection 路径处理。在 strict 模式正常退出仅证明本受控程序没有未处理 rejection，不能归因于 race 的内部 handler 单独提供了全部处理，也不能推广到任意 detached task。

本轮主动保留剩余任务的结果与事件，避免把“race 结束”解释为“输家不再运行”。任务所有权在这里是明确的调用方职责分配，与静态 owns 关系的意义不同。

## 验证与保留的未知

通过两次真实静态分析、两次独立进程 coverage、六个聚合状态快照、剩余任务终态、finally 次数、输入顺序、准确源码摘要和 AST 相同 consumer 检查。all 聚合节点存在，race 提取缺口保持显式状态，所有 semantic unknown 均保存。

未知区间不补零，source coverage 不删除，真实目标执行数据与历史迁移 authority 分开。未验证一般并发调度、空 iterable、thenable、Promise.allSettled/any、动态任务集合、取消、外部资源或永久 pending。setImmediate 检查点只为本 fixture 的显式 settled Promise 链提供检查机会，不声称它等待任意异步任务。

后续探索优先测试 allSettled/any 和显式取消，继续区分聚合结果、任务终态和资源清理责任。
