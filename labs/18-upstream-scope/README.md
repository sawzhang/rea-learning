# 第十八轮：真实 ArtifactResourceScope 多 owner 清理

运行 `npm run lab:scope`。先用真实 CLI 静态分析自建目标，再加载固定上游构建产物，通过受控 reader.close 适配器验证 A 成功、B 失败后的重试与 close。

两种场景：B 暂时失败和永久失败。显式 gate 控制 B，保留共享 Promise、错误资源名、适配器归属和 V8 coverage。结果写入被忽略的 `results/18-upstream-scope/`。

[中文源码笔记](../../notes/20-upstream-scope.md)区分真实 scope 执行、模拟 close、私有状态推断和无法迁移的 AST 区间。实验不操作真实 OS 资源。
