# 第二十一轮：owner 身份与同名摘要

运行 `npm run lab:owners`。真实 CLI 分析后，执行固定上游 ArtifactResourceScope，对照同对象、不同对象同名、不同对象不同名三场景。

永久失败适配器保留独立 owner 标签，检查重试次数、AggregateError 原因和 cleanup.resources 去重。原始证据在忽略的 results/21-owner-identity。

[中文笔记](../../notes/23-owner-identity.md)保留 AST 未迁移范围与未知；实验不涉及 OS 资源。
