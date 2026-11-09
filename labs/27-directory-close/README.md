# 目录 reader 部分关闭与重试

运行 `npm run lab:directory-close`。真实 CLI 分析自建目标，再用固定上游 reader 打开三个临时文件，注入两次首次关闭拒绝。验证第一次仍尝试所有文件，第二次只重试失败项，第三次无需再关闭。

[中文笔记](../../notes/30-directory-close.md)记录证据、覆盖率迁移边界和限制。原始结果在 `results/27-directory-close/`。
