# 第二十一轮：owner 对象身份与同名资源摘要

日期：2026-11-03（Asia/Shanghai）。固定 REA 6.4.0 / `c22111eca2c4bc84a084f12711f405b3e7422a40`。

## 源码依据

`src/artifacts/ArtifactResourceScope.ts` 用 Set 保存 owner 对象，release 失败添加对象，成功删除对象。#drainAndRetry 为每个失败 owner 保留 cause，但生成 cleanup.resources 时对资源字符串再次用 Set 去重。`src/artifacts/ArtifactReader.ts` 的 cleanupObservation 为普通错误附上 owner.resource。因此 owner 数、失败原因数与资源名数需要分别验证。

## 三组真实执行

自建目标动态加载固定上游构建产物，使用永久失败的内存 reader.close 适配器。每组先 release 两次，再运行两轮 retryCleanup；每轮两位调用者同步请求并立即接入 allSettled。没有修改上游、安装软件或操作 OS 资源。

| 输入 | 每轮实际重试 owner 数 | AggregateError 原因数 | cleanup.resources |
| --- | --- | --- | --- |
| 同一个 owner 对象 release 两次 | 1 | 1 | ['shared'] |
| 两个 owner 对象、相同资源名 | 2 | 2 | ['shared'] |
| 两个 owner 对象、不同资源名 | 2 | 2 | ['shared','other'] |

同一对象两次 release 仍实际调用 close 两次；去重只体现在之后 pending 重试，不是 release 自身合并。两轮结束同对象调用数为 4；两对象各为 3（各含一次初始 release）。每轮两位调用者共享 Promise。所有适配器保留 adapter-owner，所有原因保留具体 owner-A/owner-B 标签。

观察：两个同名 owner 都被重试，两个原因都保留，但资源摘要只有一个名字。推断：cleanup.resources.length 不能作为未释放 owner 数或清理尝试次数；上层展示可同时保留聚合原因与自己的 owner ID。未推断这种摘要设计是否适用于所有调用方。

私有 pending Set 未直接读取；去重判断由后续调用次数与源码共同支持。账本是自建适配器状态，不是实际 REA reader/provider 或 OS 所有权快照。

## 静态证据与映射

先用真实 CLI 分析自建目标，再独立 Node strict rejection 执行并采集 V8 coverage。Evidence、stderr、原始 coverage、结果和报告保存在忽略的 results/21-owner-identity。报告核对固定提交、上游源码及执行 JS 摘要、静态 observer 文件摘要、执行后摘要，以及 Babel AST 与 V8 UTF-16 函数范围。

observeCleanup 与第二十轮文本相同，本轮实际 count=12。但 owner 身份与错误基数上下文改变，故拒绝历史覆盖率迁移：保留旧文件摘要、旧 AST 全函数未迁移范围、目标整函数 unknown/count=null。未加载旧 coverage，不伪造旧计数，目标 count 为独立新执行。静态 semantic_unknowns 原样保留，不声称动态 import 的真实类在静态图中已完整解析。

## 验证与未知

npm run lab 与 npm run lab:owners 验证通过，CI 添加本轮命令。断言实际调用数、同对象/不同对象关系、每个聚合原因、去重资源名、失败账本、共享 Promise 和 finally count。

未知包括两个 wrapper 共享同一 reader、资源名动态变化、同对象成功后再次 release、并发 release 与 retry、真实资源别名。下一轮可验证多个 owner wrapper 指向同一个 cleanup 实体的边界：对象去重并不自动等于底层资源去重。
