# 第十八轮：真实作用域与多 owner 部分清理

实验日期：2026-10-17（Asia/Shanghai）。上游固定 REA 6.4.0 / `c22111eca2c4bc84a084f12711f405b3e7422a40`。

## 从模型到真实类

上一轮只运行模拟 scope。本轮动态加载固定上游构建产物 `dist/artifacts/ArtifactResourceScope.js`，执行其真实 release、retryCleanup、run、close。自建目标的 reader.close 适配器只模拟内存资源和失败，不宣称执行真实 reader、文件句柄或 OS 清理。

源码依据为 `src/artifacts/ArtifactResourceScope.ts`：release 失败将 owner 加入 #pending；#drainAndRetry 顺序尝试 owners，成功删除，失败继续收集；retryCleanup 用 #draining 合并并发请求；close 先关闭 admission 再复用 retryCleanup。`src/artifacts/ArtifactReader.ts` 的 cleanupObservation 为普通错误附上 owner.resource，构造的 ArtifactReaderFailure.cleanup 保留失败资源名。

## 受控过程与实际结果

两种场景都先用 release 使 A、B 各失败一次，进入待清理状态。之后每轮两位调用者同步请求 retryCleanup。B 的 close 由显式 gate 挂起，checkpoint 后读取适配器快照，再打开 gate。没有依赖等待若干毫秒判断行为。

| 场景 | 第一轮 | 第二轮 | close 后总调用 A/B | 最后 B 归属 |
| --- | --- | --- | --- | --- |
| B 暂时失败 | A 成功，B 失败 | 只重试 B，成功 | 2 / 3 | 已释放 |
| B 永久失败 | A 成功，B 失败 | 只重试 B，仍失败 | 2 / 4 | adapter-owner |

调用次数包含最初 release。永久失败场景最后 close 另尝试 B 一次，因此 B 总数为 4。A 在初次 retry 成功后，后续 retry 和 close 均不再调用 A.close。

所有 retry 波次两位调用者得到同一 Promise。失败时 reason 对象也相同，cleanup.resources 精确为 ['B']；A 已成功不会被加入这份失败归属。暂时失败恢复后 run 的操作执行一次，close 后再 run 被拒绝；永久失败场景不发起额外 run，以免触发隐含重试，close 后 run 同样拒绝。

观察来自适配器计数、事件、公开返回结果和错误。#pending 为私有状态，没有直接读取；“成功 owner 被移除、失败 owner 被保留”由源码与后续调用相互支持。适配器账本不是 REA 私有状态快照，也不是 OS 资源所有权证明。

## 静态证据、覆盖率与映射

真实 REA CLI 先分析自建目标，保存 Evidence 和 semantic_unknowns。动态 import 指向运行时构建产物，不把静态图当作已完整解析该类的证明。独立 Node strict rejection 执行生成原始 V8 coverage；observeCleanup 的 AST 区间与 coverage 完全匹配，函数 count=8，finally 事件每个场景 4 次。

报告记录固定提交、上游 TS 源码摘要、执行的 JS 模块摘要、自建源码摘要及 Evidence ID；静态函数节点摘要须与实际文件相同，执行后再次核对。源码和构建产物的摘要记录便于审计，不声称两个摘要相同或仅靠摘要证明编译等价；CI 通过 setup 构建固定上游。

与上一轮 coalesced 的 observer 对照，本轮 observer 返回内容改变，scope 也改为真实多 owner 实现。因此不迁移旧覆盖率；保存旧源码摘要、旧 AST 全函数未迁移范围、目标整函数 unknown/count=null。此轮不加载旧运行报告，不编造历史计数或精细区间对应。目标 count=8 是新执行事实。

## 验证与下一步

`npm run lab` 和 `npm run lab:scope` 通过，CI 加入本轮命令。断言覆盖初次 release 失败、共享 Promise/错误、部分成功后不重复清理 A、精确失败资源 B、恢复 admission、关闭后拒绝及永久失败归属。

推断：一次 drain 失败不等于所有资源均未清理；后续重试应针对仍保留的 owner。未知包括 active 操作与 close 交错、清理期间新增 owner、重入、真实 reader/provider 故障和进程终止。后续优先验证 active 操作退出与 close admission 的边界，不把本轮的串行适配器结果推广到所有 cleanup 实现。
