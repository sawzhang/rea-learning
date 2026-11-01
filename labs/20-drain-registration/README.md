# 第二十轮：drain 中新增 owner

运行 `npm run lab:registration`。先真实 CLI 静态分析，再执行固定上游 ArtifactResourceScope，用 A gate 控制 C 的失败 release 发生阶段。

三个场景：期间加入、之后加入、期间加入且持续失败。保留调用次数、共享 Promise、失败归属、原始 coverage 和 AST unknown，结果在忽略的 results/20-drain-registration。

[中文笔记](../../notes/22-drain-registration.md)。资源为自建内存适配器，不涉及 OS 清理。
