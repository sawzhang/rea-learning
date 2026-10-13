# 第十轮：前置控制流与隐含 fallthrough 条件

日期：2026-10-13。REA 固定 6.4.0 / `c22111eca2c4bc84a084f12711f405b3e7422a40`，本机 Node 26.10.0。

## 第九轮留下的问题

第九轮仅记录 return 的直接 if guard。原函数先 `if(value>0) return positive`，随后 `return non-positive`；第二条语句虽然没有直接 if 祖先，但实际只有前一条件不成立才到达。改变前一个条件，会改变第二条语句的执行范围，即使 return 文本保持不变。

本轮不改写第九轮记录，而新增独立实验，展示更强上下文约束与保留的限制。重新采集旧版真实 V8 baseline，分析五份实际目标并分别运行输入 1、0、-1；每个目标还保存新的 raw coverage，保持独立来源。

## 源码阅读与能力边界

`src/domain/javascript/javascriptSourceParser.ts` 是上游 inert AST 解析边界；本项目从上游锁定 Babel 8.0.4 获取 parser，仅处理 ESM 自建目标。

`src/domain/javascript/javascriptAstFingerprint.ts` 和 `JavaScriptSemanticGraphFingerprintProjection.ts` 提供静态结构/控制形状相关指纹，并非语句执行路径的完整证明。`src/domain/javascript/javascriptSemanticQueryAssessment.ts` 将查询 status 与覆盖范围分别评估，静态结果 found 不应当作运行时完整性。

`src/browser/execution/CdpPreciseCoverage.ts` 保留嵌套区间计数和 UTF-16 范围。本轮继续按最内层范围获取源 return 内的历史计数；新增 fallthrough 分析属于学习项目的有限模型，不声称 REA 已提供该迁移 API。

## 有限顺序控制模型

`scripts/run-fallthrough-lab.mjs` 用 sequence 按顺序处理函数体：

- return：记录当前 guard 链与前置 effect，然后停止；后续源码作为 after-unconditional-return 未知范围保留。
- if 的 consequent 直接 return，且没有 else：收集 true 分支 return，然后给后续语句增加 `{test, outcome:false, basis:fallthrough-after-returning-consequent}`。
- if 两个分支都直接 return：收集两个对应上下文并停止后续可达候选。
- 表达式或声明：记录原始文本作为 prefix effect commitment，后续 return 的映射 key 包含它。
- 不支持的前置控制或未直接终止的分支：停止保守收集，保留 unsupported unknown；不把缺失控制模型当作没有影响。

只接受 ReturnStatement 或仅含一条 return 的 BlockStatement 作为直接终止分支。模型不执行表达式、不证明副作用，也不是完整 CFG 构造器。分支文本和 effect 文本都精确比较，偏保守，可能拒绝实际可等价的修改。

## 映射依据

源、目标选择本 fixture 唯一的 choose 函数；返回语句以“完整文本 + 按序直接/隐含 guard 链 + 按序前置 effect 文本”形成 key。双方唯一候选才对应。报告保留旧、新语句上下文和 text candidates，让人能看清“文本相同但上下文不同”的拒绝。

成功对应的源语句按 V8 range 边界分段，再以 UTF-16 位移投影历史 count。所有未对应源范围保留原 coverage，并保存函数补集；目标补集 count=null、unknown。实际目标 stdout 和 raw coverage 分开保存，不将目标新运行的计数当作历史映射授权。

## 五份真实源码对照

注释版函数内部上下文不变，两个 return 映射成功；旧 baseline 正数 return count=1、非正数 return count=0 仍只是历史状态。

条件版 value>=0 使正分支直接 guard 与负分支隐含 guard 均改变，两个 return 都拒绝。实际输入 0 从 non-positive 变为 positive，直接说明旧负分支历史零不能投影成新版执行结论。

early 版本新增 value===0 的提前返回；后续正分支上下文增加该条件为 false，负分支也增加新 fallthrough 条件。两个原 return 文本没变，但上下文链不同，均拒绝。实际输入 0 返回 zero。

assignment 版本在 if 前写 value=-1，两个 return 的前置 effect 与源不同，均拒绝；三个输入都返回 non-positive。仅比较 guard 文本会漏掉这个变化。

stop 版本在开头直接 return stopped，原两条 return 没进入可达候选；目标仍保留后续语句的原始范围与 parser unknown，不把它们删除后宣称映射完整。三个输入都返回 stopped。

额外实际解析的 while 字符串变体阻断后续候选，验证 unsupported-prefix-control；该字符串负例未独立执行。五份仓库文件则均实际分析、运行和采集。

## 验证与未知项

已验证 comment 2 项成功，另外四个版本各 0 项成功、2 项拒绝；隐含 guard 为 false、受控输出、目标静态节点摘要和执行后文件摘要均检查一致。源/目标区间补集完整保留；未知既不补零，也不依赖实际输出相同来抹掉。

仍未验证：异常终止、try/finally、循环 CFG、break/continue、异步调度、短路逻辑、闭包变化或依赖行为。相同 prefix 文本可能在不同环境下产生不同效果，文本 commitment 不是数据流等价证明；本轮历史投影仍不能声明目标执行。

后续主动探索将优先针对未知的异常/finally 控制和可能抛出的前置调用，继续用实际目标输出与独立 coverage 做对照，而不扩展未经验证的迁移权限。
