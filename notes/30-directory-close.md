# 目录 reader：部分关闭成功后的重试

日期：2026-11-09（Asia/Shanghai）。固定 REA 6.4.0 / `c22111eca2c4bc84a084f12711f405b3e7422a40`，接续[单文件关闭故障实验](29-close-fault.md)。

## 源码与受控实验

`src/artifacts/DirectoryArtifactReader.ts` 的 open 将每个 OwnedFileHandle 加入 #files；#closeFile 仅在 owner.close 成功后删除该项。close 遍历所有文件和目录 owner，收集异常，最后用 AggregateError 保留原因，以当时仍登记的路径生成 cleanup.resources。`src/filesystem/OwnedFileHandle.ts` 在拒绝后 fd 仍有效时允许下一次调用重试。

本轮使用固定上游的 DirectoryArtifactReader 和 OwnedFileHandle 构建产物，从真实临时目录枚举三个自建文件，依次打开 a.js、b.js、c.js，不消费流。独立子进程通过临时包装 owner.close 记录派发顺序，在第一个与第三个 owner 的首次调用中替换底层 handle.close，使其在实际系统关闭前抛出。仍执行真实 owner 状态机；端口和原型在 finally 恢复。最终关闭 reader、销毁自建流并删除临时目录。

## 实测结果

| reader.close | 派发顺序 | 结果 | 仍登记的错误资源 |
| --- | --- | --- | --- |
| 首次 | a、b、c | 拒绝，保留两个注入原因 | a.js、c.js |
| 第二次 | a、c | 成功 | 无 |
| 第三次 | 无 | 成功 | 无 |

首次 a 失败后仍执行 b 和 c；b 的 fd 变为无效，a、c 保持有效。第二次只调用 a、c，两者 fd 均变为无效。断言公开错误资源的 basename、两条原始原因、派发轨迹与 fd 状态。私有 #files 没有被读取；成功项不再参与重试是从派发轨迹和源码得到的推断。注入异常发生在实际关闭之前，不代表真实系统调用曾失败。对目录句柄、流消费和关闭事件竞争、永久失效、并发 reader.close 不作结论。

## 证据与迁移边界

真实 CLI 静态分析自建 JS 目标；另以 Node strict rejection 执行并采集 V8 coverage。Evidence、stderr、原始 coverage、运行快照及报告保存在忽略的 `results/27-directory-close/`。报告保存固定提交与两份上游 TS/执行 JS 摘要，校验静态 observer 文件摘要、执行后摘要及 AST/V8 UTF-16 范围。静态 unknown 原样保留，动态 import 不证明图已完整解析上游类。

observer 文本与上一轮一致，但从单个模拟句柄切换到真实目录的聚合关闭，调用边界不同。拒绝迁移历史计数，保留旧文件摘要、旧 AST 整段未迁移区间与目标 unknown/count=null。新执行 observer count=3 单独保留。没有将编译后上游的覆盖率映射回 TypeScript。

运行 `npm run lab` 和 `npm run lab:directory-close`；后者纳入 CI。后续可检验流自动关闭与 reader.close 交错时，同一文件 owner 的进行中 attempt 是否共享。
