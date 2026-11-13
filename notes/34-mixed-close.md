# 目录清理中的混合关闭结果

2026-11-13（上海），固定 REA 6.4.0 / c22111eca2c4bc84a084f12711f405b3e7422a40。接续[句柄失效实验](33-stream-sticky.md)。三个临时文件：a 真正关闭后注入拒绝，b 正常关闭，c 首次在真正关闭前注入拒绝。未注入系统调用故障。

观察：首次报告 a、c 两个失败资源及对应原因；第二次派发 a、c，只剩 a 报错；第三次仅派发 a，仍报告原注入原因的消息。b 首次及 c 第二次的 fd 失效伴随成功；a 的 fd 首次即失效，但每轮仍拒绝。

推断依据：`src/filesystem/OwnedFileHandle.ts` 在拒绝后按 fd 区分可重试和持续失败；`src/artifacts/DirectoryArtifactReader.ts` 的 #closeFile 只在成功后移除登记，close 继续遍历其他 owner 并聚合剩余路径。未读取私有字段；持续失败并未阻止 c 重试成功。未知：实际 OS 拒绝、流消费中的并发调度、跨进程资源归属。

真实 CLI 分析自建 JS；独立 Node strict rejection 执行采集 V8。Evidence、静态 unknown、原始覆盖率、错误归属与 fd 轨迹在 results/31-mixed-close/。报告固定上游提交和 TS/执行 JS 摘要，校验 observer 工件摘要与 AST/V8 UTF-16 范围。observer 文本与上一轮相同，但调用场景变为三文件混合聚合，整段旧区间不迁移，保留源摘要和区间及目标 unknown/count=null；本轮实测 3 次单列。未反推 TypeScript 覆盖率。

运行 `npm run lab:mixed-close` 与基线 `npm run lab`，前者纳入 CI。
