# 第十二轮：异步完成与 finally 执行时序

日期：2026-10-13。REA 固定 6.4.0 / `c22111eca2c4bc84a084f12711f405b3e7422a40`；本机 Node 26.10.0，锁定 Babel 8.0.4。

## 真实目标与对照来源

六份目标分别完成 REA 静态分析、两次真实 async 函数调用以及 Node V8 coverage 采集。main 逐次 await false/true 场景，捕获 rejection 为输出数据，进程正常结束不等于函数都 fulfilled。

使用 --unhandled-rejections=strict，拒绝把未处理异常默认为实验成功。采集记录源文件摘要、静态函数节点和 exact UTF-16 外层范围，并校验正常退出后的源码摘要不变。

事件数组是自建目标 instrumentation，不是 REA passive Inspector 观测。raw coverage 是调用方独立采集，历史映射报告为分析者推断；三类来源不混合 authority。

## 源码导读

`src/application/javascript/JavaScriptSemanticGraphFlowProjection.ts` 的 projectSemanticPromises 将 awaited-expression 投影为 task，把 Promise 操作保留为 promise；source_resolution 不完整时留下 unknown。

同文件的 projectPromiseCreation 和所有权/来源投影保留 candidate/resolved 区别。静态 await/task 关系不能证明某次运行 fulfillment、rejection 或最终结果。`javascriptSemanticQueryAssessment.ts` 的 status 与 coverage 依然需要分别解释。

`src/inspector/V8InspectorProvider.ts` 只启用 Runtime/Debugger，不提供本轮事件日志或函数覆盖率。`src/browser/execution/CdpPreciseCoverage.ts` 的嵌套 count 与 UTF-16 规则仍适用，但本轮读取的是自建 Node 的 coverage 文件。

脚本 `scripts/run-async-lab.mjs` 收集 AwaitExpression、ReturnStatement 和 TryStatement 范围，展开 try/catch/finally 祖先上下文并避免进入嵌套函数。凡包含 await 或异常完成结构，均不授权历史 return 迁移；普通 async return 仅作为历史对照，不宣称已经实现通用 async 语义映射。

## 六份目标的完成结果

plain：两个输入都 fulfilled ok，普通 async return 的源语句保留作对照。

await-catch：false await resolve 后返回 ok；true await rejection 进入本函数 catch，最终 fulfilled caught。两个场景都等待正常 finally 清理后才完成。

returned-rejection：try 返回 Promise，没有在 try 中 await 其 rejection；本函数 catch 两次都不执行，true 最终 rejected boom。try 中的 return 先进入 finally，finally 内 await 将后续清理延期。

finally-normal：try await 结果在 false 返回 ok、true 抛 boom；正常完成的异步 finally 保留原完成类型，调用方分别 fulfilled/rejected。

finally-return：finally await 正常清理后 return override，两个输入都 fulfilled override，包括 try await 原本 rejection 的 true 场景。

finally-rejection：finally 的 await reject cleanup，finally-end 未执行；两个输入最终都 rejected cleanup，而不是原 ok 或 boom。

## 相对时序验证

每个场景从 caller-start 开始，evaluate 返回 pending Promise 后记录 caller-pending，最后记录 caller-fulfilled/rejected。通过事件位置断言最终完成发生在 caller-pending 之后。

await-catch 与 finally 三个 await 源目标先遇到 try 内 await，因此 finally-start 出现在 caller-pending 之后。正常 finally-end 在 finally-start 与调用方完成之间。

returned-rejection 的 finally-start 在 evaluate 返回 pending Promise 前执行，而清理 await 之后的 finally-end 出现在 caller-pending 后。这展示了异步函数同步前段与 suspension 后续的区别。其 rejection 不触发 catch，仍由调用方 await 捕获。

finally-rejection 没有 finally-end。事件数组能验证本受控目标的顺序，不能推广成所有调度器、并发任务或任意环境的时序规则；本轮没有墙钟耗时结论。

## 覆盖率与未知区间

所有 evaluate 外层 count 为 2，但最终完成类型不同。不要将 count=2 解释成 try return 两次成功交付，或 await 后全部语句都执行。原始嵌套 ranges 完整保留，本轮不实现对每个 continuation 的跨版本执行映射。

报告保存源码摘要、Evidence ID、静态函数 ID、AST 范围/上下文、源原始 coverage、独立事件与输出。五种受阻目标的旧 return 及原覆盖区间保留为 unmigrated_source，目标整函数范围 count=null、unknown。plain 对照保留历史 count，同时其函数范围仍 unknown，不将对照扩展成完整可迁移状态。

拒绝原因 async-suspension-or-exception-completion-unmodeled 明确说明能力边界，而不是说函数没有执行。没有因为某个目标实际 fulfilled ok 就删除未知项，也没有拿实际目标覆盖数据覆盖历史迁移记录。

## 验证与后续边界

验证六次静态分析、六次独立采集、十二次调用输出、函数 count、source identity、相对事件顺序、catch 是否出现，以及 finally rejection 后清理日志未出现。

未验证 return await 与裸 return 在无 try 情况下的所有差异、并发交错、Promise.all/race、取消、长时间 pending、外部 I/O、嵌套 async finally 或事件循环阶段。后续探索优先测试并发与任务所有权，同时坚持本地事件和静态 candidate 的分离。
