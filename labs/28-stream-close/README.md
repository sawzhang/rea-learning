# 流事件与 reader.close 的交错

运行 `npm run lab:stream-close`。真实 CLI 分析自建目标，再用固定上游 reader 打开临时文件，控制 destroy 和 reader.close 的顺序，检查 owner attempt 身份、实际关闭次数与最终 fd。

原始结果在 `results/28-stream-close/`；[中文笔记](../../notes/31-stream-close.md)记录源码依据、迁移边界与未知项。
