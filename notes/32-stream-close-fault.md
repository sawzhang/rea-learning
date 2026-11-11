# 两路共享关闭失败后的错误与重试

2026-11-11（上海）。固定 REA 6.4.0，提交 c22111eca2c4bc84a084f12711f405b3e7422a40。接续[成功交错实验](31-stream-close.md)，沿用真实临时文件和显式 gate，在首次放行后、调用真正的 FileHandle.close 前注入同一个 Error。

源码依据：`src/artifacts/DirectoryArtifactReader.ts` 的 open 注册流 close 监听器，并捕获 #closeFile 的拒绝；公开 close 则收集失败原因及仍登记的资源。#closeFile 仅在 owner.close 成功后删除登记。`src/filesystem/OwnedFileHandle.ts` 在 closing 时共享 attempt；拒绝后 fd 仍有效时允许重试。

观察：reader 先进入或流先进入，两组均派发两次同一 owner，取得同一 Promise，仅进入一次底层端口。流的 close 事件在放行前完成；公开 reader.close 拒绝，报告 fixture.js，聚合错误内的原始原因与注入对象相同。此时 fd 仍有效，真正的 close 调用为零。再次 reader.close 成功，只有一次新派发，真正的 close 共一次，fd=-1。独立子进程在 strict rejection 模式成功退出。

推断：共享的是关闭尝试；两条调用路径对失败的暴露方式不同。依据监听器的捕获和公开错误，不能把流事件解释为资源关闭确认。登记是否删除从公开错误和重试派发推断，未读私有映射。未知：真实系统 close 失败、失败时 fd 已失效、自然消费或 abort 时的竞争。

真实 CLI 静态分析自建目标，另以 Node 执行两组受控场景。Evidence、静态 unknown、stderr、原始 V8 coverage 和运行轨迹留在 results/29-stream-close-fault/。报告保留固定提交、两份上游 TS 和实际 JS 摘要，核对 observer 工件摘要与 AST/V8 UTF-16 区间。observer 与上轮文本相同，但此次共享尝试拒绝并触发重试，旧计数不迁移。保留源整段未迁移区间和目标 unknown/count=null，新执行的 4 次单独记录，不对上游做 TypeScript source map 反推。

运行 `npm run lab:stream-close-fault`；基线为 `npm run lab`，本轮纳入 CI。
