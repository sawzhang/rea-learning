# 第二十二轮：不同 owner 共享同一 reader

日期：2026-11-04（Asia/Shanghai）。固定 REA 6.4.0 / `c22111eca2c4bc84a084f12711f405b3e7422a40`。

## 源码依据与问题

`src/artifacts/ArtifactResourceScope.ts` 的 pending Set 保存 owner 对象，cleanup 的 reader 分支直接调用 owner.reader.close()，不按 reader 引用去重。release/重试仅在 close 成功后删除对应 owner。`src/artifacts/ArtifactReader.ts` 的 cleanupObservation 为普通错误附上该 wrapper 的 resource。

上一轮区分 owner 对象和资源名，本轮进一步让两个不同 wrapper（wrapper-A/B）引用同一个 reader。动态加载固定上游构建产物，自建 reader 仅操作内存 token。首次两次 release 都失败，确保两个 owner 保留；之后运行两轮 retryCleanup，每轮两位调用者立即接入 allSettled。

## 三种 close 策略的实际结果

| 策略 | 第一轮总调用数 | 第二轮总调用数 | 最终 token | 第二轮错误资源 |
| --- | --- | --- | --- | --- |
| 重复关闭成功返回 | 4 | 4 | released | 无 |
| 重复关闭抛错 | 4 | 5 | released | ['wrapper-B'] |
| 永久失败 | 4 | 6 | adapter-owner | ['wrapper-A','wrapper-B'] |

调用数包括两次初始失败。前两组第三次调用释放 token，第四次已经是重复 close；幂等适配器返回成功，两个 wrapper 均不再触发后续工作。严格适配器抛 already-released，B 在下一轮仍重试并再次失败，重复尝试共 2 次。永久失败组从未释放，两轮每次保留两个原因。

断言不同 owner、相同 reader 引用，每轮共享 Promise，token 释放事件只出现一次（永久失败为零）。观察：scope 的 owner 对象去重不自动变成 reader 实体去重。推断：共享实体的重复 close 策略会影响 pending owner 是否收敛。token 已释放不等于所有 wrapper 的清理确认都成功；反过来，pending 错误不能直接证明底层 token 仍占用。

私有 pending 不直接读取；B 保留由公开错误、下一轮调用与源码对照支持。适配器 resourceOwnership 只描述自建 token，不伪造 scope 私有 owner 快照。这里并未证明上游实际调用方会创建共享 reader wrapper，也未主张真实 reader.close 采用哪种策略。

## 可审计证据与 AST 边界

真实 CLI 先分析自建目标；独立 Node strict rejection 执行生成原始 V8 coverage。Evidence、stderr、结果与报告在忽略的 results/22-shared-reader。报告保留固定提交、TS/执行 JS 摘要、静态 observer 文件摘要，检查执行后摘要以及 Babel AST/V8 UTF-16 范围一致。

observer 与上一轮文本相同，实际 count=12；共享 cleanup 实体及其失败上下文改变，故不迁移旧覆盖率。保留旧文件摘要、旧 AST 未迁移全函数范围、目标 unknown/count=null。未读取旧 coverage，不编造历史计数；目标覆盖率是独立新观察。保留 semantic_unknowns，不把动态 import 当作静态图完整解析真实类的证明。

## 验证、未知及后续

npm run lab 与 npm run lab:shared-reader 通过；CI 增加本轮命令。验证 owner/reader 身份、实际调用数、重复 close、聚合原因数、错误资源、释放次数和 finally count。

未知包括真实 reader 的关闭契约、并发 close、共享 file-handle/analysis、wrapper 创建者的约束及实体交接。本实验不执行 OS 清理，不据此报告上游缺陷。后续可阅读并直接验证实际 ArtifactReader.close 的重复调用契约，选择受控文件目标，继续区分 wrapper 与实体生命周期。
