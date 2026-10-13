# 第七轮：实际源码变更后的覆盖率拒绝合并

日期：2026-10-13。上游基线仍为 REA 6.4.0 / `c22111eca2c4bc84a084f12711f405b3e7422a40`；本机 Node 26.10.0。

## 从输入变异负例到真实版本实验

第六轮修改记录的 source_sha256 字段来测试拒绝规则，只证明合并器检查该字段。本轮提交三份实际目标源码，分别分析、执行、读取新 V8 coverage：v1 原始代码，v2 文件头新增注释，v3 将 double 的乘数 2 改为 3。共有六次独立进程运行，三个静态分析结果。

第五轮采集器增加可选 target/output/expected 参数；默认仍执行原第五轮。采集继续要求准确文件 URL、执行前后源码摘要一致、静态节点摘要一致、UTF-16 函数边界唯一对应。每个版本使用自己的图，不把旧节点 ID 硬套到新范围。

## 源码身份和覆盖率不是一个问题

`src/domain/evidence.ts` 对 semanticProjection 计算 evidence_id，解析时校验记录与标识一致。这检测证据内容身份，并非签名。Evidence ID 可能还随路径等语义字段改变，不能单独拿 ID 不同来证明源码字节不同；本轮直接计算 logic.js 文件字节 SHA-256。

`src/application/javascript/JavaScriptSemanticGraphFingerprintProjection.ts` 将 callable 的 source_range 和静态指纹绑定到 function 节点。静态规范化指纹回答结构关联问题，不等价于本次执行使用的字节身份。`src/browser/execution/CdpPreciseCoverage.ts` 保留 UTF-16 区间和嵌套 count，不通过同名函数自动实现跨版本映射。

本项目 `scripts/merge-coverage.mjs` 先拒绝不同 source_sha256，再检查 Node 版本、函数 inventory 与范围。运行时 count 是某次执行观测，源码摘要是合并所需身份前提，二者不能互相替代。本轮不改变上游协议，也不将 raw Node coverage 包装为 REA passive Evidence。

## 三个版本的观察

| 观察 | v1 | v2-comment | v3-behavior |
|---|---|---|---|
| double(21) | 42 | 42 | 63 |
| double 范围 | [41,85) | [58,102) | [41,85) |
| baseline 三函数 count（double/choose/unused） | 1/1/0 | 1/1/0 | 1/1/0 |
| 源码摘要 | f5821e… | a2ace1… | 1deba3… |
| 同版本双场景合并 | 通过 | 通过 | 通过 |
| 与 v1 跨版本合并 | 不适用 | 拒绝 | 拒绝 |

v2 注释使函数范围全部移动 17 个 UTF-16 单位。结果仍为 42，只说明本次受控输入输出相同，没有验证所有输入的行为等价；即使注释不改变目标行为，字节身份与原始偏移仍不同，不能直接混用旧范围。

v3 修改只占一个字符，三个函数名、外层范围与 baseline count 均和 v1 相同，但 double(21) 从 42 变成 63。实验明确断言名字、范围、计数相同，同时摘要和静态节点身份不同；仅靠名字和范围配对会遗漏这个实际版本差异。

对 v1 baseline 与 v2/v3 expanded 的实际覆盖记录调用合并器，均拒绝并报告 Source digest mismatch。相反，三个版本各自的 baseline+expanded 均合并成功，double 总次数 3、choose 2、unused 1。拒绝不是因为新版本不能采集或算法一律拒绝输入。

## 本轮验证和限制

验证通过：三个版本真实静态分析、六次运行输出与覆盖率映射；三个同版本正例；两个跨版本拒绝；v1/v3 同名同范围同计数的反例。没有修改已有 coverage 摘要来代替真实源码变化。

覆盖率 payload 本身不提供本实验的 SHA-256 认证，来源摘要由调用方对受控源码计算。合并器信任经过采集器校验的记录，不能抵御恶意伪造摘要或静态节点；此实验属于一致性检查，不是对抗性认证系统。

当前 source_sha256 只绑定所合并的 logic.js，不绑定整个应用依赖闭包：main.js 或运行环境变化但 logic.js 不变时，函数字节可以相同，而场景语义仍不同。本轮明确记录场景与 Node 版本；未声称相同工件摘要证明整个应用行为相同。

结论：同名、同偏移、同执行次数都不能替代源码身份；跨版本累计覆盖率应默认拒绝直接合并。下一轮可研究明确的跨版本函数映射，同时保留 unknown、映射依据和无法迁移的区间，而非绕过摘要检查。
