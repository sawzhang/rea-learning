# 第十九轮：active 操作退出与 close 准入边界

完成日期：2026-11-01（Asia/Shanghai）。延续此前选定的未完成轮次，本次只完成这一轮，不补做错过日期的实验。上游仍为 REA 6.4.0 / `c22111eca2c4bc84a084f12711f405b3e7422a40`。

## 源码依据

`src/artifacts/ArtifactResourceScope.ts` 的 run 在准入时先检查 #closed，等待 #draining 后再次检查。operation 放入 #active，并在 finally 移除。close 同步设置 #closed=true，然后调用 retryCleanup。#drainAndRetry 用 Promise.allSettled 等待 active 操作退出，再重试 pending owners。

这意味着等待操作结束不等于把其 rejection 作为 close 的失败结果传播；close 的清理错误来自 pending cleanup。`src/artifacts/ArtifactReader.ts` 的 cleanupObservation 则把失败资源名保留在 cleanup.resources。

## 自建受控目标

直接加载固定上游构建产物，先启动由 gate 挂起的 active 操作；在其运行期间 release 模拟 reader B，首次失败使其成为 pending owner。然后启动 retryCleanup、一个等待 drain 的 run、close，以及 close 之后的直接 run。所有 rejection 立即接入 allSettled，Node 使用 strict 模式。

checkpoint 快照确认 active gate 未打开时 B 只调用一次，close 未完成。打开 active gate 后，B 第二次 close 开始，并被另一个 gate 挂起；此时 close 仍未完成。最后打开清理 gate，保存各返回结果和事件。gate 决定推进，不依赖计时延迟。

## 三个实际结果

| active 操作 | B 重试 | close | 早先等待 drain 的 run | close 后直接 run |
| --- | --- | --- | --- | --- |
| 成功 | 成功 | 成功 | closed 错误 | closed 错误 |
| 失败 | 成功 | 成功 | closed 错误 | closed 错误 |
| 成功 | 失败 | cleanup 错误 | cleanup 错误 | closed 错误 |

三场景 retryCleanup 与 close 返回同一 Promise；新操作回调执行次数均为 0。事件顺序均为 active-exit 早于 B:start:2。操作失败单独保留 operation-failed，不被成功的 close 掩盖。清理失败时结果列出 resources=['B']，适配器仍记录 adapter-owner、released=false；成功时 released=true。

观察：等待中的 run 若在 await #draining 处收到 rejection，就不会到达第二次 closed 检查，因此其错误和关闭后直接调用不同。推断：诊断准入失败时须保留发生阶段，不能统一解释为同一种关闭错误。这是固定版本的实际行为，不推断其设计意图。

## 证据与 AST 映射边界

真实 CLI 先静态分析自建目标，Evidence、stderr、semantic_unknowns 与独立 V8 原始 coverage 保存在被忽略的 results/19-active-close。报告核对固定上游提交、TS 源码与执行 JS 摘要，静态 observer 节点源码摘要，以及 observer AST/V8 UTF-16 范围一致性；执行后再核对源码摘要。

observeCleanup 文本与第十八轮相同，本轮实际 count=6。调用上下文已变为 active 操作、等待 run 和 close 的交错，故不迁移历史覆盖率。保留旧文件摘要、旧 AST 全函数未迁移范围，以及目标整函数 unknown/count=null；本轮新 count 不填入旧历史。未加载旧 coverage 报告，不编造旧计数或精细区间对应。

静态图不是动态 import 的上游类已被完整解析的证明；事件来自自建 instrumentation。资源仅为内存适配器，不是实际 reader/provider 或 OS 句柄。私有 #active/#pending 不直接读取，行为由公开返回、适配器计数与源码对照支持。

## 验证与未知

运行 npm run lab 与 npm run lab:active-close，CI 增加本轮命令。检查等待阶段、错误路径、共享 Promise、未准入回调、资源归属与 coverage。尚未覆盖 active 操作永不退出、多 active 操作、cleanup 重入、清理中新增 owner、真实进程退出和 OS 资源释放。

下一步可验证清理期间新增 owner 与 Set 迭代边界；需要保持 owner 注册时机与 cleanup 完成结果分开，不把本轮单 owner 的结论推广到并发注册。
