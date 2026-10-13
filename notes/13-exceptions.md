# 第十一轮：异常、catch 和 finally 的历史映射边界

日期：2026-10-13。REA 6.4.0 / `c22111eca2c4bc84a084f12711f405b3e7422a40`；本机 Node 26.10.0，锁定 Babel 8.0.4。

## 顺序 fallthrough 模型还缺少什么

第十轮按直接 return 推导后续否定条件。但前置调用可能抛出，catch 可能把 throw 改成正常返回，finally 还可能改变待完成的 return/throw。单靠 return 文本和函数执行 count 无法表达这些完成类型。

[ECMAScript TryStatement 运行语义](https://tc39.es/ecma262/multipage/ecmascript-language-statements-and-declarations.html#sec-try-statement-runtime-semantics-evaluation)使用 completion 处理 try/catch/finally：finally 正常完成时保留此前完成结果，finally 自己产生 abrupt completion 时由它决定结果。本轮用独立真实执行验证这些结果，不实现通用 completion 解释器。

## 相关源码与本项目规则

上游 `src/domain/javascript/javascriptSourceParser.ts` 将源码解析为 inert AST；`javascriptAstFingerprint.ts` 提供静态结构承诺，不提供运行时完成路径证明。`JavaScriptSemanticGraphFingerprintProjection.ts` 绑定函数 source_range 与静态节点，不能把 return 的语法出现升级为调用方收到返回值。

`src/browser/execution/CdpPreciseCoverage.ts` 保留 V8 嵌套区间 count 与 UTF-16 边界。函数外层 count 表示执行观测，不能代替最终 return/throw 值。本项目读取真正 Node coverage、校验函数范围唯一匹配和外层 count=2，同时单独保存 stdout 的 returned/threw 结果。

`scripts/run-exception-lab.mjs` 对六个真实目标各进行静态分析和一次独立覆盖率采集。AST 只展开 block/if/try，用 try/catch/finally 上下文标记 return，不进入嵌套函数。候选收集不是完成语义证明。

历史源为 plain 的 return。只有唯一同文本、无异常上下文且无前置语句的普通对照接受映射。带前置调用时拒绝并报告 prefix-call-may-throw；包含异常完成结构时拒绝并报告 exception-completion-context-unsupported。没有通过拼接条件或观察输出相同来强行迁移。

## 六个对照

plain：false/true 都返回 ok，外层 count=2，作为正例保留历史 return 区间；函数头尾仍为 unknown。

prefix-throw：mayThrow(false) 正常返回，mayThrow(true) 抛 boom；evaluate 两次都进入，所以函数 count=2，但第二次没有正常返回 ok。前置调用不能因语法简单就视为正常 fallthrough。

catch：false 返回 ok，true 的 throw 被 catch 转为 caught，函数 count 同样为 2。原 try return 的同文本候选不足以说明异常路径对应。

finally-normal：两次输出 ok，events 记录两次 finally。尽管受控结果与 plain 相同，本轮仍拒绝迁移，因为没有证明 finally 的调用在所有环境下正常完成；实际成功对照不是普遍无异常证明。

finally-return：try 内仍写 return ok，调用方两次收到 override。finally 的 return 改变最终完成结果。

finally-throw：try 内仍写 return ok，调用方两次捕获 finally 异常。函数计数为 2 不证明函数正常返回。

本轮没有依据函数外层 count 推断每个 return 的精确命中次数；原始嵌套范围保留供审计。实际返回结果来自目标 stdout，是独立对照，不伪造成 REA Inspector Evidence。

## 保留区间和未知项

报告保存 source_sha256、target_sha256、双方 Evidence、静态函数 ID、return 文本与上下文、同文本候选、原 coverage ranges 和拒绝原因。

五个拒绝目标均保留整函数 `[start,end)` unknown/count=null，旧 return 与原覆盖区间进入 unmigrated_source。plain 正例只保留 return 的历史区间，源目标头尾分别进入 unknown。未知不补零，也不删除后报告迁移完整。

这里采取整函数拒绝，是为了不把未实现的 completion 语义藏在局部文本映射后面；它并不声称 try 中所有语句都无法建立任何历史坐标对应。未来更强模型仍须区别坐标对应与目标执行事实。

## 验证与限制

验证六次静态分析、六次真实执行/coverage、函数范围和摘要一致、各目标两个输入结果，以及 finally-normal 的事件。plain 为成功对照，其余五个均拒绝历史迁移。

未覆盖异步 throw、Promise rejection、await/finally、嵌套异常、catch 绑定副作用、return 表达式求值异常或 try 内资源释放。调用方捕获错误使目标进程正常结束，不能将进程 exit=0 误认作函数都正常返回。

后续主动探索优先考虑 await/rejection 与 finally 的执行时序，并继续保留未建模上下文，而非仅凭同步测试结果放宽迁移。
