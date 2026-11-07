# 文件关闭故障：可重试失败与持续失败

日期：2026-11-08（Asia/Shanghai）。上游固定 REA 6.4.0 / `c22111eca2c4bc84a084f12711f405b3e7422a40`。本轮接续[真实文件关闭确认实验](25-owned-file.md)，专门验证 close 自身拒绝之后的两条状态转移。

## 源码依据与受控目标

`src/filesystem/OwnedFileHandle.ts` 的 #attemptClose 在底层 close 拒绝时读取 fd：fd 非负则恢复 open，fd 为负则进入 failed 并保存原始原因。close 在 closing 时返回同一 attempt，进入 failed 后直接拒绝。上一轮的外部失效发生在 owner 开始尝试之前，不能验证这里的 catch 分支。

本轮加载同一个固定上游构建产物，注入只实现 fd 和 close 的对象。首次 close 总是抛同一个已知 Error；两组唯一的故障差异是抛出前是否将模拟 fd 从 42 改为 -1。后续底层调用若发生就成功并设 fd=-1。42 仅为模拟值，不是进程真实描述符。先同步发起两个 owner.close，再等待两者结果，随后顺序请求两次。

## 实测结果

| 首次拒绝后的 fd | 首次两位调用者 | 随后两次 owner.close | 底层总调用数 |
| --- | --- | --- | --- |
| 42 | 同一 Promise，均收到注入错误 | 第一次重试成功，第二次直接成功 | 2 |
| -1 | 同一 Promise，均收到注入错误 | 都拒绝，原因仍为同一注入错误对象 | 1 |

两组首次都只调用一次底层 close。fd 保持有效组直到实际重试成功才变为 -1；模拟失效组后续没有再次调用底层 close，也没有把原错误换成“外部提前失效”的错误。

观察支持：首次并发合并之后，是否再尝试取决于拒绝时观察的 fd。推断：报告应分别保留底层拒绝、是否还能重试和 owner 的成功确认；fd=-1 本身不能把拒绝改写成确认成功。私有状态由源码与公开结果推断，没有直接读取。实验未复现真实系统 close 失败，不说明具体平台的故障概率、文件是否已被系统释放或 fd 复用行为。

## 证据与迁移边界

先通过真实 REA CLI 静态分析自建 JS 目标，再独立执行 Node strict rejection 并采集 V8 coverage。保存 Evidence、静态 unknown、stderr、运行快照和原始 coverage 至被忽略的 `results/26-close-fault/`。报告记录上游提交、TS 源码及实际执行 JS 摘要；校验静态 observer 工件摘要和执行后源码摘要，以及 Babel AST 与 V8 的 UTF-16 函数范围一致。动态 import 不代表静态图已完整解析上游类。

observer 文本与真实文件实验相同，本轮实际调用 8 次；注入故障和重试上下文变化，历史覆盖率不迁移。报告保留源摘要及整段未迁移 AST 区间、目标整段 unknown/count=null；新计数单独保留，没有从旧结果回填。观察对象仅为该 observer，未对编译后的类做 TypeScript source map 反向覆盖率映射。

## 验证与未知

运行 `npm run lab`、`npm run lab:close-fault`；后者验证并发 Promise、原错误身份、失败时 fd、重试调用数和 observer finally 次数，并纳入 CI。未知包括真实系统 close 故障、fd 复用和 DirectoryArtifactReader 如何跨多个文件聚合关闭失败。可在后续用受控目录 reader 的公开接口验证部分成功后的再次关闭边界。
