# 第八轮：跨版本函数映射与迁移边界

日期：2026-10-13。REA 基线仍为 6.4.0 / `c22111eca2c4bc84a084f12711f405b3e7422a40`，本机 Node 26.10.0。

## 映射和合并是不同操作

第七轮证明不同源码摘要不能直接合并。本轮保持此规则，额外生成明确的函数映射和历史区间投影。即使投影成功，也不把历史 count 当作目标版本执行事实，不把目标摘要伪装成源摘要后交给合并器。

采集仍复用第七轮真实三版本、六个场景；源覆盖限定 v1 baseline。另增加实际重复函数目标 v4 与实际改名目标 v5，读取它们的 REA 静态图作为目标映射候选。这两个版本没有做运行时采集，其执行保持 unknown。

## 上游指纹源码

`src/application/javascript/JavaScriptSemanticGraphFingerprintProjection.ts` 将 IR 指纹与确切 function_node_id、source_range、证据上下文绑定。

`src/domain/javascript/javascriptSemanticGraphSchemas.ts` 定义 complete/partial/unavailable 指纹状态、算法和 components。`javascriptSemanticGraph.ts` 的 createJavaScriptSemanticFingerprint 对 components 计算 fingerprint_sha256，而 fingerprint_id 还绑定函数节点和算法。因此跨版本比较使用算法 + components 摘要，不直接要求 fingerprint_id 相同。

components 包含参数数量、规范化 AST、控制流、关系形状、字面量集合与 effects。complete 表示指纹生产状态，不表示整个程序语义完整，也不是行为等价证明。

`src/domain/javascript/javascriptApplicationVersionKeys.ts` 按唯一候选建立配对，重复候选不会强行合并。本实验借鉴唯一匹配原则，但直接使用 semantic graph 的函数指纹；没有调用结构图版本比较并冒称它给出了这些函数迁移结果。

## 本项目的两层门槛

`scripts/run-migration-lab.mjs`：

1. 每个版本读取实际 logic.js，计算摘要并核对每个静态函数的 artifact_sha256。
2. 按行列转为 UTF-16 范围，保留确切函数字符串；源覆盖外层范围必须与源函数一致。
3. 用双方 complete、同算法的指纹找候选，源和目标均必须唯一。
4. 映射函数仍须文本完全相同；否则拒绝范围投影，不对文本差异猜测对应关系。
5. 相同文本意味着函数内部坐标可采用统一 delta 平移，逐个保留原始嵌套区间及 count。source_range 和 target_range 分开保存，count 字段称 historical_count。

匹配依据保存算法、摘要、源状态、所有候选目标 ID、双方 Evidence ID；成功时增加函数字符串 SHA-256、范围映射说明和 inferred confidence。所有输出仍是分析者投影，不制造 REA runtime Evidence。

## 四组实验结果

注释版的三个函数指纹和函数文本不变，只改变文件级摘要与位置。三个映射通过，区间平移 +17 个 UTF-16 单位，原 count 不变。历史 zero 也保留为历史 zero，不宣称目标该位置未执行。

行为变更版的 double 指纹改变，旧 double 的整个原始覆盖区间进入 unmigrated，目标 double 的范围 count=null。choose 与 unused 文本不变，两个映射通过。

重复版 unused 与 unusedTwin 的指纹相同，源 unused 有两个候选。即使一个目标名称与旧名称一致、文本也相同，本实验仍不靠名称打破身份歧义；保留两个候选并拒绝迁移。两个目标函数均保留 unknown 范围。

改名版 unusedRenamed 形成唯一同指纹候选，说明名称变化没有改变该静态规范化指纹。但函数字符串不同，本轮保守策略拒绝迁移，保留 reason=function-text-differs。这验证了“函数映射候选”不自动授权“范围覆盖迁移”。

## 未迁移数据与局限

unmigrated 保存源 ID、name、reason、basis 和全部原 ranges；target_without_migrated_coverage 保存目标 ID、name、start/end、count=null 和 unknown。未知不能默认为零，也不能删除后报告迁移完整。

相同函数文本也不能证明外部闭包、调用输入、依赖、环境和副作用相同。本轮仅建立历史坐标对应，没有证明行为等价或目标版本执行。报告里的目标执行字段明确为 not-established-by-migration；目标真实采集是另一份独立证据，未与历史 count 混合。

source sha 由受控采集器计算，coverage 本身并不提供源码签名。实验未覆盖 partial 指纹实际目标、source map、代码生成、移动函数改变闭包、跨 Node 版本或跨应用依赖身份。也未实现部分编辑后的局部区间对齐；函数文本有差异时整函数拒绝更容易审计。

## 验证

重新执行真实采集，核对源码摘要与 source ranges；断言注释版 3 项、行为版 2 项、重复版 2 项、改名版 2 项迁移。检查无匹配、两个候选及文本不同三种拒绝依据，并保存未迁移区间与目标未知范围。

下一轮可在确切 source-map 或可审计 AST 对应基础上研究部分函数迁移，同时保留无法对应的区间和未知；不能单凭指纹相同直接转移目标执行事实。
