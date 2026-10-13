# 第四轮：受控运行时观测与静态语义图对照

日期：2026-10-13。基线仍为 REA 6.4.0 / `c22111eca2c4bc84a084f12711f405b3e7422a40`，本机 Node 26.10.0。

## 先明确观测的能力

本轮不是给语义图增加函数执行计数。REA 的 V8 Inspector provider 是 passive attach：观测脚本解析与上下文，不提供函数调用、import 调用者、事件处理器执行或因果流。

实验脚本拥有并启动自建目标，目标在 attach 前完成 double(input) 并输出 42，然后保持存活。stdout 是受控 fixture 的独立对照材料，不是 REA 的 Inspector Evidence。unused 没有被入口调用，但与 double 一起定义在已加载的 logic.js。

## CLI → provider → Evidence

`src/cliJavaScriptRuntimeCommands.ts` 注册 list-javascript-runtime-targets 和 observe-javascript-runtime。请求明确提供 loopback endpoint、target ID、runtime kind 与 observation_ms。

`src/application/javascript/JavaScriptRuntimeObservationService.ts` 通过 observation port 调用 provider，再用 JavaScriptRuntimeObservationEvidence 封装结果。它不负责启动目标。

`src/inspector/V8InspectorEndpoint.ts` 与 `V8InspectorProvider.ts` 重新发现目标并验证精确 ID、端点和目标类型。Node discovery 没有报告 attached 时保留 null；角色 node 来自调用方声明，结果标为 caller-declared-unverified，不能当作 OS PID 认证。

`V8InspectorProvider.ts` 建立 WebSocket 后只发送 Runtime.enable、Debugger.enable，接收脚本与上下文事件并等待捕获窗口，结束时关闭自己的连接。未发送 Runtime.evaluate、getScriptSource、断点或 resume。本轮实际目标仍存活的断言验证了目标生命周期归实验脚本所有。

`V8InspectorCaptureProjection.ts` 校验、去重和排序元数据，保留 bounded capture 与 unknown。scriptParsed 说明脚本在观测上下文被解析，不能说明其中所有函数执行。观察窗口缺失也不是全局缺失。

## 对齐的是结构工件，不是运行时语义证明

`src/application/javascript/JavaScriptRuntimeReconciliationService.ts` 校验输入并调用纯领域 reconciliation，不重新执行目标。

`src/domain/javascript/javascriptRuntimeReconciliationCaptureParsing.ts` 将 Inspector 捕获投影为可比运行时实体。`javascriptRuntimeReconciliationMatching.ts` 区分内容与位置匹配：有被捕获源码摘要时可以尝试内容身份；只有唯一授权位置时使用 artifact-path，confidence medium。Inspector 的 cdp_hash 不应直接当成捕获源码字节的 SHA-256 证明。

本实验目标位于静态 input root 下，无需显式 runtime_mappings 即可使用自动文件位置映射。main.js、logic.js 各有一个 medium / unique-location-match，cross-layer observed_as 仍为 inferred。位置对应不能排除运行时文件与静态分析时字节变化；本实验没有修改目标文件，也没有验证 digest mismatch 场景。

reconciliation 输出组合 JavaScript Application Graph 与 load states；独立的静态 semantic trace 从原始 application Evidence 查询。它没有把语义 calls/argument-to-parameter 自动升级成运行时执行事实。

## 实验结果

- fixture stdout 报告 result=42；受控代码调用 double，没有调用 unused。
- REA 捕获 main.js 和 logic.js，没有捕获 unloaded.js 的本地 script。
- 静态语义图仍含 unused 函数；输入 21 的 forward-influence 查询 found，4 个节点、3 条关系，coverage partial。
- reconciliation 匹配两个本地工件、两个 module 为 resident-in-loaded-asset，多个实体 unknown；总 coverage partial。
- unloaded.js 工件 load state 为 unknown，没有把观测缺失升级为 not-observed 或全局 unloaded。
- 重复使用同一对保留 Evidence 得到相同 reconciliation Evidence ID。重新启动目标会改变 target ID，因此不要求不同运行得到同一个 runtime Evidence ID。

首次直接把 21 写作调用实参时，该 fixture 的语义图没有 literal 节点，查询断言失败。改为显式 const input=21 后，生产者保留了字面量来源，可进行语义对照。尚未定位该直接实参缺失的具体生产分支，不能把它概括为所有实参字面量均不支持。

## 结论和后续

loaded / resident / unknown 是工件关联状态，found / partial 是静态查询状态，42 是受控目标输出。三个来源回答不同问题：同一个脚本包含已调用和未调用函数，脚本存在证据无法区分它们。

本轮验证 loopback Inspector、真实 CLI、来源身份、位置映射、静态语义查询、重复输入确定性与 caller-owned 清理。未验证函数执行 coverage、跨版本字节不一致、Electron 角色、浏览器运行时或 native provider。下一轮可引入受控 coverage 数据或记录目标分支输出，对照函数是否执行，同时保持其与 REA 被动观测的证据区别。
