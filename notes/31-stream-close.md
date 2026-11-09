# 流关闭与目录 reader.close 的交错

日期：2026-11-10（Asia/Shanghai）。固定 REA 6.4.0 / `c22111eca2c4bc84a084f12711f405b3e7422a40`，接续[目录部分关闭实验](30-directory-close.md)。

## 源码与受控场景

`src/artifacts/DirectoryArtifactReader.ts` 的 open 注册流 close 监听器，异步调用 #closeFile 并捕获拒绝；reader.close 遍历文件映射时也调用 #closeFile。该方法等待 owner.close，再删除成功项。`src/filesystem/OwnedFileHandle.ts` 在 closing 状态返回原 attempt。

本轮使用真实目录 reader 打开一个自建临时文件，不读取流；调用 destroy 触发 close 事件。在独立进程包装 owner.close，记录 owner 对象及原方法返回的 Promise。第一次触及底层端口时用显式 gate 延迟真正的 FileHandle.close，先后顺序由端口启动信号和流 close 事件控制，不靠计时。对照 reader 先进入和流先进入两组；finally 恢复端口及原型，清理自建资源。

## 实测与推断

| 顺序 | owner 调用 | 同 owner / 同 attempt | gate 放行前真实 close 调用 | 最终真实 close 调用 |
| --- | --- | --- | --- | --- |
| reader → 流 | 2 | 是 / 是 | 0 | 1 |
| 流 → reader | 2 | 是 / 是 | 0 | 1 |

两次派发发生时 fd 仍有效，只有一次进入受控端口；放行后 fd=-1，reader.close 成功，再次 reader.close 没有新的 owner 派发。流 close 事件在 gate 放行前已发生，因此它本身不能确认底层句柄已关闭。两条路径共享的是同一 owner 的 attempt，未声称两个外层调用共享 Promise。私有映射移除由源码和后续未派发推断，未直接读取。

未知：自然读完、读错或 abort 时的流时序，底层 close 拒绝后两条路径各自暴露的错误，以及多个文件并行关闭。本轮没有注入故障、访问用户文件或测量真实调度频率。

## 证据与迁移

真实 CLI 分析自建 JS 目标；另在 Node strict rejection 执行并采集 V8 coverage。完整 Evidence、stderr、运行轨迹、原始覆盖率与报告留在 `results/28-stream-close/`。报告固定上游提交与两份 TS/实际加载 JS 摘要，校验静态 observer 工件、执行后摘要以及 Babel AST/V8 的 UTF-16 范围。保留静态 unknown；不推定动态 import 上游关系已被完整解析。

observer 与上一轮文本一致，但由多文件失败聚合改为同一文件的两路交错，拒绝迁移旧计数。保留旧摘要与整段未迁移 AST、目标整段 unknown/count=null；本轮实际 4 次单独记录，不用旧覆盖率填补未知，也未做上游 TypeScript source map 反推。

运行 `npm run lab` 和 `npm run lab:stream-close`，后者进入 CI。后续可沿相同 gate 验证 shared attempt 拒绝时，流事件的捕获与 reader 的错误报告如何分流。
