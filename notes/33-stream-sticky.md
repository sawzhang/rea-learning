# 共享关闭：句柄失效后的持续拒绝

2026-11-12（上海）。固定 REA 6.4.0 / c22111eca2c4bc84a084f12711f405b3e7422a40。接续[共享关闭故障](32-stream-close-fault.md)。沿用一个真实临时文件和显式 gate，这次在真实 FileHandle.close 成功之后由包装端口抛出注入错误，模拟 owner 收到拒绝时 fd 已失效。不是系统关闭失败。

源码依据：`src/filesystem/OwnedFileHandle.ts` 在拒绝时以 fd 是否小于零决定 failed 或 open，failed 后直接用原 cause 拒绝；`src/artifacts/DirectoryArtifactReader.ts` 的 #closeFile 成功才删除登记，流事件捕获拒绝，公开 close 聚合错误和剩余路径。

观察：reader 先进入、流先进入，两组都共享同一 attempt；放行前真实关闭次数为零。放行后 fd=-1，reader.close 拒绝，报告 fixture.js，聚合错误保留原始注入对象。再次 reader.close 仍报告同一文件和原始对象。owner 派发共三次，但端口进入和真实关闭均只有一次。子进程以 strict rejection 模式通过。

推断：物理关闭已发生，但 reader 仍无法确认成功；失败登记未移除由公开错误、后续派发和源码支持，未直接读取私有映射。未知：真实系统关闭故障、多个文件混合失效、自然流消费或取消的时序。

真实 CLI 静态分析自建 JS，独立运行采集 V8 覆盖率；Evidence、unknown、运行轨迹、摘要和原始覆盖率保留于 results/30-stream-sticky/。校验 observer 文件摘要及 AST/V8 的 UTF-16 范围。与上轮 observer 文本一致，但失败后的 fd 和重试结果不同，整段旧区间不迁移；报告保留旧摘要和区间、目标 unknown/count=null，单独记录本轮实际 4 次。未映射上游 TypeScript 覆盖率。

运行 `npm run lab:stream-sticky`；基线 `npm run lab`，本轮加入 CI。
