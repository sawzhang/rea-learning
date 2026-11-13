# 同一路径的两个文件 owner

2026-11-14（上海）。上游固定 REA 6.4.0 / c22111eca2c4bc84a084f12711f405b3e7422a40。复用[混合关闭实验](34-mixed-close.md)的临时目录与故障端口，但对同一 fixture.js entry 调用 open 两次。A 真正关闭后注入拒绝，B 首次在真正关闭前注入拒绝。不读取流，不模拟系统故障；owner 标签按首次派发顺序分配。

源码依据：`src/artifacts/DirectoryArtifactReader.ts` 的 open 为每次打开建立 OwnedFileHandle，以 owner 对象为 #files 的键，错误资源直接取剩余路径值；#closeFile 成功才删除该 owner。`src/filesystem/OwnedFileHandle.ts` 的拒绝分支按 fd 区分持续失败和可重试失败。

观察：记录到两个不同 owner 对象和两个不同 FileHandle 对象。第一次聚合保留两条相同 fixture.js 路径和两个不同注入原因；第二次 B 成功后只剩 A 的错误及一条路径；第三次仅派发 A。A 的 fd 首次已失效但继续拒绝，B 的 fd 直到重试成功才失效。

推断：资源路径可重复，不能直接充当打开句柄的身份。资源条目变化由公开结果、派发和源码支持，未读取私有映射。未知：路径别名或替换、自然流消费与关闭交错、真实系统调用故障；本轮不保证其它 reader 或错误汇总层保留重复项。

真实 CLI 分析自建 JS，另在 Node strict rejection 执行采集 V8。Evidence、静态 unknown、原始覆盖率、owner 对象数、错误和 fd 轨迹保存在 results/32-same-path/。报告保存固定提交与 TS/实际 JS 摘要，校验 observer 工件摘要及 AST/V8 UTF-16 区间。与上一轮 observer 字节相同，但从不同路径变为同路径多 owner，旧整段计数不迁移；保留旧摘要、整段未迁移区间、目标 unknown/count=null，独立记录本轮实际 3 次。未反推 TypeScript 覆盖率。

运行 `npm run lab:same-path` 与基线 `npm run lab`；专项检查纳入 CI。
