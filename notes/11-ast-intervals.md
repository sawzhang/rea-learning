# 第九轮：局部函数修改后的 AST 区间映射

日期：2026-10-13。上游固定 REA 6.4.0 / `c22111eca2c4bc84a084f12711f405b3e7422a40`；本机 Node 26.10.0，解析器从上游锁定依赖解析 Babel 8.0.4。

## 从整函数相同到语句对应

第八轮函数文本不同时拒绝整个函数迁移。本轮在保留该结论的基础上，用一个单独实验研究更小粒度的历史坐标对应：只映射有直接 AST 依据的 ReturnStatement，函数其他区间保持 unknown。没有放宽原合并器的摘要校验，也没有修改第八轮脚本。

目标为真实文件：double 中新增局部声明，choose 正分支返回字面量修改。源覆盖来自重新运行的第七轮 v1 baseline；目标经真实 REA 静态分析，并独立执行一次 baseline。

## 相关源码

`src/domain/javascript/javascriptSourceParser.ts` 是 REA 的 inert parser 边界，按源路径决定 TypeScript/JSX 等插件并处理解析失败。学习脚本直接从 upstream/package.json 的模块解析路径取得锁定 Babel parser，仅解析本实验 ESM 子集，不自称复用了上游的全部 parser 策略。

`src/application/javascript/JavaScriptSemanticGraphFingerprintProjection.ts` 将源范围和函数节点绑定到静态指纹。局部修改会改变整函数指纹，本轮不把整函数指纹相同作为必要条件；以唯一名称和精确参数文本建立明确的分析者对应 anchor，confidence 仍为 inference。

`src/browser/execution/CdpPreciseCoverage.ts` 的原始区间语义依然适用：UTF-16 code units、结束位置 exclusive、嵌套计数覆盖外层。源 ReturnStatement 可能跨覆盖率区间边界，所以必须先切分，而非把函数 count 直接赋给语句。

## 受限 AST 映射算法

`scripts/run-ast-lab.mjs`：

1. 分别解析源和目标，选取导出的顶层 FunctionDeclaration。
2. 本自建目标中函数名与参数文本须唯一对应；该 anchor 不证明跨版本函数身份或行为等价。
3. 只遍历 BlockStatement 与 IfStatement，收集 ReturnStatement。if 记录直接 guard 文本及 consequent/alternate；不进入嵌套函数、循环、switch 或 try。
4. 用完整 return 文本与 guard 栈组成 key，源、目标各一个候选才接受。文本变化、直接 guard 变化、重复候选均不强行对应。
5. 核对源真实覆盖率外层范围与 AST 函数范围、静态函数节点摘要与实际文件摘要。
6. 将源语句范围按覆盖率全部边界切分；每段选择最内层包含区间的 count，再按语句内部 UTF-16 delta 投影到目标。
7. 将每个源/目标函数范围扣除已映射语句后的补集完整保留，不把结构头尾、修改语句或新增声明隐藏掉。

这不是通用树编辑距离算法。它甚至不会迁移相同函数的 header/braces；严格的补集输出明确展示哪些坐标没有依据。

## 实验结果

double 的未改动 return 对应成功，历史 count=1；新增 adjustment 声明进入目标 unknown。choose 的 positive-v2 语句无法对应，源旧正分支与目标新正分支均位于未迁移补集；未修改的 non-positive return 对应成功，历史 count=0。unused return 同样对应，历史 count=0。共三个 return 映射。

历史零只表示旧版 baseline 未执行该区间，不能声明新版未执行。新版独立 stdout 报告 result=42、branch=positive-v2，这与旧版历史覆盖是两份不同来源；脚本没有因为结果相同就推断函数所有区间等价。

负例解析实际字符串变体：把直接 if 条件 > 改为 >=，相同正分支 return 不再匹配；重复 non-positive return 产生两个候选；将 return 放进 while 后因不支持上下文不再收集。三个负例只做解析与对应校验，未运行或产生运行时 coverage。

## 保留依据和未知

mappings 保存双方 Evidence ID、函数节点 ID、文本 SHA-256、直接 guard、source_range、target_range、分段 historical_count 与 not-established 的目标执行状态。unmapped_source 同时保存原始嵌套 coverage ranges 和不对应区间；unknown_target 保存补集区间、count=null、status=unknown。

源和目标补集涵盖了整函数除对应语句外的所有坐标，未知不是默认为零。报告保留旧原始覆盖，便于追查未对应部分，但不会将原始函数范围无条件套到新版函数。

## 边界与后续主动探索

直接 if guard 检查并未解决完整控制流或数据流等价。前置 return、赋值、闭包、外部依赖或异常路径变化仍可影响语句执行；同文本映射只支持历史坐标投影，不支持目标执行或语义等价结论。尤其 if 后的 return 并未建模隐含的否定 guard，保持此限制，不能将本轮映射当作程序证明。

本轮没有做目标函数覆盖率采集，只保留目标 stdout；没有泛化到 source maps、编译代码或 partial AST。后续优先探查前置控制流变化与隐含 fallthrough guard，验证当前局部文本策略的边界，再考虑更强控制上下文约束。
