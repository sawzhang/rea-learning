# 第二十三轮：真实 OwnedFileHandle 关闭确认

运行 `npm run lab:owned-file`。先真实 CLI 分析，再加载固定上游 OwnedFileHandle，对自建临时文件验证顺序 close、并发 close 和外部提前关闭。

保存真实 fd、Promise/错误身份、coverage 和迁移 unknown，结果在忽略的 results/23-owned-file。finally 只清理目标自建临时目录。

[中文笔记](../../notes/25-owned-file.md)区分物理失效、owner 确认和未执行的目录 reader 链路。
