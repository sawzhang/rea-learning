# 第十七轮：并发 cleanup retry 与共享 in-flight

实验日期：2026-10-16。固定 REA 6.4.0，提交 `c22111eca2c4bc84a084f12711f405b3e7422a40`。没有升级上游或安装依赖。

## 源码依据

上游 `src/artifacts/ArtifactResourceScope.ts` 的 retryCleanup 在 #draining 已存在时直接返回它，否则把 #drainAndRetry().finally(...) 存入 #draining。finally 清空引用，允许之后明确发起新一轮。release 失败将 owner 留在 #pending；清理成功才删除 owner。#drainAndRetry 先等待 active 操作，再尝试 pending owners，失败组织为 ArtifactReaderFailure。

这是应用层共享工作和保留资源归属的规则，不能仅凭 Promise settlement 推断清理成功。此轮只运行自建模型，上述上游行为依据源码阅读，不冒充真实 reader 或系统资源清理验证。

`src/domain/javascript/javascriptSemanticPromises.ts` 与 `JavaScriptSemanticGraphFlowProjection.ts` 的静态关系不能独自证明同一轮调用共享 Promise 或 cleanup 恰好一次。真实 CLI 的 semantic_unknowns 原样留在本机报告。

## 对照设计

三份实际源码保留相同 observeCleanup 函数，分别采用同步共享返回、async 包装共享返回、无共享返回。每份完成独立 CLI 分析、进程执行和 V8 coverage。每个场景同步调用 retryCleanup 两次，在 setImmediate checkpoint 读取状态，再显式打开 gate；不使用时间长短判断并发。

资源为 scope-1 持有的内存 token；attempt、active、最大并发、重复释放尝试、事件及 owner 快照来自自建 instrumentation。V8 count 仅记录函数执行，不代表逻辑 token 已释放。

## 实际观察

| 实现 | 同一轮 Promise 引用相同 | 成功场景清理次数 | 最大并发 | 一次失败场景首次两位结果 |
| --- | --- | --- | --- | --- |
| coalesced | 是 | 1 | 1 | 都失败 |
| async-wrapper | 否 | 1 | 1 | 都失败 |
| uncoalesced | 否 | 2 | 2 | 一位失败、一位成功 |

前两份在首次失败后 owned=true、released=false；明确发起下一轮才进行第二次清理并释放。无共享实现的第二次并行清理已成功，因此没有明确重试也可能最终释放。成功场景的反例还记录一次 duplicate-release 尝试，token 检查阻止重复逻辑释放。

永久失败时，共享实现两轮共 2 次清理，无共享实现共 4 次；所有实现保留 owner=scope-1、released=false。每轮收尾 active=0、gated=0、inFlight=false；后续轮次使用新 Promise。成功后的重复请求不增加清理次数。

observeCleanup 的 finally 每次调用一次，覆盖率外层 count 分别为 14、14、12。反例 count 较少源于一次失败场景没有明确重试轮次，不能据此声称覆盖率更差或资源管理更正确。

## AST 映射与无法迁移区间

脚本 `scripts/run-inflight-lab.mjs` 解析 retryCleanup 的实际 async 标志、完整文本和 UTF-16 区间；验证三份 observer 文本完全一致。静态节点文件摘要必须匹配实际源码，执行后再次检查摘要；V8 函数范围与 AST observer 范围必须一致。

uncoalesced→coalesced：底层工作共享策略与失败结果改变；coalesced→async-wrapper：底层工作相同，但 Promise 引用策略改变。两条历史映射均保守保留 unknown，保存双方 Evidence ID、AST、原始源 ranges，以及目标整函数 count=null 的未知区间。独立目标覆盖率保留为新观察，不填入旧历史。

推断：函数文本相同不足以迁移上下文相关覆盖率；Promise 引用不同也不足以推断底层工作重复。映射拒绝是本实验的审慎策略，不是声称任何工具都无法证明更细粒度等价。

## 验证与未知

通过九个受控场景、三次真实 CLI 分析、三次 strict rejection coverage 执行，检查共享工作、失败传播、下一轮恢复、重复释放保护和归属保留。基线命令 `npm run lab` 与本轮命令加入验证，CI 增加本轮命令。

尚未覆盖多个 owner、清理期间新资源加入、重入 retryCleanup、实际异步 reader.close、进程终止或 OS 句柄。下一轮可直接用受控 close 适配器执行固定上游 ArtifactResourceScope，核对共享失败与多 owner 部分成功的边界；保持适配器观察和真实资源结论分开。
