# 第三轮：JavaScript 静态语义关系图

学习基线：REA 6.4.0，提交 `c22111eca2c4bc84a084f12711f405b3e7422a40`。实验记录日期：2026-10-13。本机 Node 26.10.0。

## 生产与查询是不同阶段

`src/domain/javascript/javascriptSemanticAnalysis.ts` 从解析后的 AST 收集作用域、绑定、引用、调用和返回等 IR，并组合 derived semantics 与覆盖信息。语义分析处理语法和静态来源，不执行目标表达式来求运行结果。

`src/application/javascript/JavaScriptSemanticGraphBuilder.ts` 把各文件 IR 投影成节点和关系，组合值、对象、请求、Promise、资源、函数指纹等投影，并绑定应用图身份。它不是把结构图边简单改名：语义图有独立的 jsrg 身份、relation 和 unknown 数据。

`src/cli/applicationCommands.ts` 注册 trace-javascript-semantics，校验 `javascriptSemanticTraceSchemas.ts` 中的 `{application, query}`。`JavaScriptSemanticTraceService.ts` 先用 `parseApplicationGraphEvidence` 验证完整 Evidence，取出已经保留的 semanticGraph，再调用纯领域查询。没有语义图时返回输入错误，不把它解释为空图。

## 种子和遍历

`src/domain/javascript/javascriptSemanticQuerySchemas.ts` 接受 literal、property、endpoint、semantic-node、application-node、function fingerprint、event 和 boundary-field 种子。方向为 backward-provenance、forward-influence、callers、ownership；允许按 relation 种类筛选，候选边默认关闭。

`javascriptSemanticQueryIdentity.ts` 的 literal 查询严格匹配节点 properties.value；property 查询匹配 property-slot 的 properties.name；endpoint 查询匹配 request 的 properties.endpoint。标签只用于展示，不能靠猜标签来选 ID。

`javascriptSemanticQuery.ts` 先解析种子、构造邻接表，然后用队列和已访问集合遍历。forward 顺着关系走，backward 反向，callers 只反向走 calls，ownership 只采用所有权关系并双向走。默认跳过 resolution=candidate，显式 opt-in 才纳入；筛选关系并不把候选关系升级为 resolved。

实验中 21 的默认追踪保留 reads、defines、aliases、argument-to-parameter 等关系；本地 calls 关系从 call 节点指向 double 函数。callers 查询使用本次分析实际返回的 target_node_id，避免硬编码随内容变化的 ID。

## 证据上下文

`JavaScriptSemanticGraphEvidence.ts` 为节点语法观测标记 ast-static-analysis / observed / exact，为保守关系推断标记 static-relationship-inference / inferred，并保留不证明运行与因果流的限制。

wire format 把共享 provenance 存在 evidence_contexts，事实保留 evidence.context_id 与位置。`javascriptSemanticQuery.ts` 收集返回 nodes、relations、unknowns 引用的 context ID，再返回所需上下文子集。脚本检查每条返回事实都能在结果上下文表中解析来源。

单条 resolved 只说明在本次静态分析中身份可解析，不证明该调用真的执行，也不证明输入 21 在某次运行必然流到外部请求。

## unknown、status 与 coverage

`JavaScriptSemanticGraphFlowProjection.ts` 的 projectSemanticFrontiers 把 dynamic-call 映射到 call-flow、dynamic-property 映射到 object-flow，保留 reason、detail、相关 relation kinds 与源码位置。本实验明确保留 object[key] 的 dynamic-property；还有不支持的值表达式、未解析调用目标、await 来源、对象引用可能被调用修改等 unknown。

`javascriptSemanticQueryAssessment.ts` 分开决定 status 和 coverage：

- 图 unavailable → unsupported；相关 candidate 关系 → ambiguous。
- 没有种子（或期待的源/汇未找到）且覆盖不完整/有 unknown → partial；只有完整条件下才给 no-match。
- 有种子且没有候选歧义时，多个种子 ambiguous，单个 found。
- coverage 还考虑图整体覆盖、截断、相关 unknown 与候选关系，因此 found 可以同时是 partial。

本实验 property mode 为 found，相关 unknown 为 0，但 coverage 仍 partial；不存在的字面量没有命中，status 是 partial。这是结果语义，不是 CLI 执行失败。endpoint 的相关 unknown 为 0 仍可 ambiguous，因为候选关系也参与判断。

## 实验结论

图有 63 个节点、46 条关系、17 项 unknown。21 的默认查询为 6 节点/5 关系，启用候选边后为 11/10，均 ambiguous。静态 mode 属性来源为 4/3，局部调用者为 2/1，均 found。各查询覆盖均 partial。

初次用 total 属性作查询对照没有得到 property-slot，断言失败；没有据此修改 REA 或声称 total 不存在。加入独立 object.js 静态读取后，mode 属性槽与来源关系可查询。total 未形成槽的具体生产者原因尚未定位，不能仅凭目标中的 fetch 推断原因。

本轮验证的是保留图的静态可达性、证据绑定、候选边政策和 unknown 报告，没有验证业务结果、网络请求、运行时因果或所有权查询。下一轮可沿某项 unknown 的生产分支定位，再对比受控运行时观测。
