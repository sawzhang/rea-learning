# 文件关闭故障与重试

运行 `npm run lab:close-fault`。先执行真实 REA CLI，再加载固定上游 OwnedFileHandle，对比同一注入错误在 fd 有效和失效时的后续重试结果。

输入只模拟 fd 与 close，未使用实际系统文件句柄。结果在 `results/26-close-fault/`；[中文笔记](../../notes/29-close-fault.md)记录证据与未迁移区间。
