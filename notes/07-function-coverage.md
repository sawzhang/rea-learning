# 第五轮：函数覆盖率与静态语义对照

日期：2026-10-13。REA 基线 6.4.0 / `c22111eca2c4bc84a084f12711f405b3e7422a40`；本机 Node 26.10.0。

## 采集方式和权限边界

第四轮的 Inspector provider 只发送 Runtime.enable、Debugger.enable，不能回答函数执行次数。本轮独立使用 [Node 官方 NODE_V8_COVERAGE 文档](https://nodejs.org/api/cli.html#node_v8_coveragedir) 所描述的覆盖率输出：只给自建目标子进程设置环境变量，运行结束后读取原始 V8 JSON。

目标不访问外部网络，不运行第三方应用。每个场景新建独立输出目录，以避免把旧数据当作本次观测。进程正常退出是原始数据写出的前提；异常退出或超时不能当作成功采集。

结果分别保留静态 REA Evidence、调用方 V8 覆盖率和分析者对照 report。report 明确标注 analyst inference，不创建伪造的 REA Evidence，也不声称 REA passive observation 已验证函数执行。

## 相关源码导读

`src/browser/execution/CdpExecutionCapture.ts` 是 REA 浏览器执行采集路径：启用 Profiler，startPreciseCoverage，采集窗口结束时 takePreciseCoverage，再 stopPreciseCoverage。这与 Node passive Inspector 是不同能力。本轮没有运行浏览器 CDP 路径，只阅读它的覆盖率处理方式。

`src/browser/execution/CdpRuntimeProtocol.ts` 的 preciseCoverageSchema 定义 script、functionName、isBlockCoverage 和 ranges，每个区间包含 startOffset、endOffset、count。

`src/browser/execution/CdpPreciseCoverage.ts` 的 normalizePreciseCoverage 保留嵌套区间，不把所有 count 压平；校验 end >= start，若已保留源码则校验范围不超过 source.utf16_units，并明确 offset_units=utf16-code-units、end_offset=exclusive、source_bounds=verified/unknown。

这给实验映射提供了原则：保留原始嵌套 ranges；函数外层计数与内部零计数区间表达不同事实。不能把嵌套区间计数直接求和当作函数调用次数，也不能把范围长度直接相加当作完整分支百分比。

`src/application/javascript/JavaScriptSemanticGraphFingerprintProjection.ts` 把静态 callable 的 source_range、参数数量、规范化 AST、控制流和关系形状等指纹绑定到 function_node_id。指纹支持静态身份比较，不是运行计数。本轮使用 function 节点的 identity.artifact_sha256、module_path 和 source_range 与覆盖率记录关联。

## 映射实验

自建 logic.js 定义 double、choose、unused；文件注释含非 BMP 字符 🧪。REA source_range 使用行和列，脚本以 JavaScript 字符串 length 转成 UTF-16 偏移，再要求 V8 函数外层范围与静态范围完全相同且只有一个候选。

映射同时校验文件 URL 和文件字节摘要，名字仅作为额外断言。若只靠名称，会把同名函数误配；若把字节索引当作 UTF-16 偏移，含 emoji 的源码范围就会错位。当前仅验证直接 ESM 源码，没有转译、source map、eval、动态生成函数或进程内源码变化。

覆盖率 payload 本身不携带本实验使用的源码 SHA-256：执行前后摘要检查与不变的自建目标共同支持本轮对照，不能把它描述为 V8 提供的密码学源码认证。

## 观察

| 项目 | baseline | expanded |
|---|---|---|
| double 外层 count | 1 | 2 |
| choose 外层 count | 1 | 1 |
| unused 外层 count | 0 | 1 |
| 选定函数覆盖率 | 2/3 | 3/3 |
| choose 的零计数子区间 | 非正数路径 | 正数路径 |
| 目标输出 branch | positive | non-positive |

源码与静态图相同，输入和实际执行路径不同。unused 的静态函数节点两轮都存在，但只有 expanded 被执行。两个场景各自仍遗漏 choose 的一个分支；若要合并分支覆盖，还需按相同源码身份和区间语义处理，而不是简单合并外层计数。本轮没有实现跨场景区间归并。

静态 unused callers 查询为 found、coverage partial，保留一个函数节点、零条关系；expanded 的 V8 count 却为 1。因此静态查询没有返回 calls 边，不能证明函数未执行。该查询的 found 表示种子命中，不代表调用者已完整解析。

## 验证与局限

脚本验证两个目标输出、函数范围唯一映射、源码摘要一致、三函数预期计数、choose 保留零计数区间且两场景区间不同、静态查询来源绑定。raw coverage 全部留在忽略的 results 目录，不写入上游源码或更改 REA 协议。

结论：静态存在、脚本解析、函数执行和分支覆盖是四种不同事实；高函数覆盖率也不证明业务正确、全部分支覆盖或输入空间完整。后续可单独实现可信 source-map 映射，或分析覆盖率合并时区间重叠与源码身份变化。
