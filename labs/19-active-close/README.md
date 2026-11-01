# 第十九轮：active 操作与 close

运行 `npm run lab:active-close`。真实 CLI 分析自建目标，独立 Node strict coverage 执行固定上游 ArtifactResourceScope，显式 gate 控制 active 操作退出及 B 清理完成。

三场景区分操作失败、清理失败、等待中的 run 和关闭后直接 run。保留资源归属、事件、AST 未迁移范围与 unknown；结果在被忽略的 results/19-active-close。

[中文笔记](../../notes/21-active-close.md)。资源为受控适配器，不涉及 OS 句柄。
