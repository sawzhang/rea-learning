# 共享关闭后的持续失败

运行 `npm run lab:stream-sticky`。对照两种流与 reader 交错顺序，在真实文件关闭之后注入拒绝，验证错误持续保留且无第二次底层调用。见[中文笔记](../../notes/33-stream-sticky.md)，原始结果在 results/30-stream-sticky/。
