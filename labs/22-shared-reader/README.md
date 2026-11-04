# 第二十二轮：共享 reader 的清理边界

运行 `npm run lab:shared-reader`。真实 CLI 分析后，执行固定上游 ArtifactResourceScope，让两个不同 owner 引用同一受控 reader。

对照重复 close 成功、重复 close 抛错和永久失败，保存 token 状态、失败 wrapper、原始 coverage 与迁移 unknown。结果在忽略的 results/22-shared-reader。

[中文笔记](../../notes/24-shared-reader.md)。这是内存适配器，不代表实际 reader 的关闭契约或 OS 清理结果。
