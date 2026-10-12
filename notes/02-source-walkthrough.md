# 第一轮源码导读：静态 JavaScript 分析

以下说明基于本项目固定提交的实际源码。

## 入口与适配器

`scripts/rea.mjs` 先辨别 `mcp`、`mcp doctor` 和普通 CLI。MCP 路由在导入 Incur 前完成；普通 CLI 加载编译后的 `dist/cli-runtime/cli.js`，并单独处理输出参数与流式 JSON。源码克隆后必须先构建。

`src/cli/javascriptApplicationAnalysis.ts` 的 `runCliJavaScriptApplicationAnalysis` 创建 progress reporter 和 `ArtifactResourceScope`，调用共享的 `analyzeJavaScriptApplication`，随后关闭 scope。进度写 stderr，结果写 stdout，所以保存 JSON 时不能把两个流混在一起。

清理失败也成为结构化错误；即使分析成功，资源关闭失败仍需报告。它不是可忽略的日志。

## 应用流程

`src/application/javascript/JavaScriptApplicationService.ts`：

1. 用 `analyzeJavaScriptApplicationInputSchema.safeParse` 校验未知输入。
2. 校验通过后进入 `analyzeJavaScriptApplicationValidated`，检查取消信号并报告进度。
3. 调用 `reconstructJavaScriptArtifact`，传入调用方的路径、format、integrity_policy 和可选资源控制。
4. 校验结果元数据和结构图/语义图绑定。
5. 创建并哈希 Evidence，返回 `Result<Evidence, AnalysisError>`。

`src/application/javascript/JavaScriptArtifactReconstruction.ts` 解析路径与格式，建立 canonical artifact inventory，创建读取器，读取 JavaScript 文件并构建图。它接收资源 scope，不把进程和文件所有权隐含在局部变量中。

继续阅读的分支：`JavaScriptArtifactAnalysis.ts`、`JavaScriptArtifactGraphBuilder.ts`、`JavaScriptSemanticGraphBuilder.ts` 和 `src/artifacts/javascript/JavaScriptSourceAnalysis.ts`。

## Evidence 为什么比一段文字重要

`src/domain/evidence.ts` 定义严格 schema。Evidence 包含 `evidence_id`、`subject`、`provider`、`operation`、`parameters`、`normalized_result`、`confidence`、`authority`、`limitations`、位置和证据链接。

`confidence` 的取值是 observed / derived / inferred；`authority` 表示证据来源类别。两者回答不同问题，不能当作一个模糊分数。

`subject.digest.sha256` 绑定目标内容，图也有自身身份。后续追踪应使用已完成 Evidence 和其中实际返回的 ID，避免重新读取变化后的文件而混用旧结论。

## 图的边界

结构图描述应用工件和关系，语义图表达静态数据流、调用候选等关系。`docs/javascript-application-workflows.md` 明确区分静态推断、运行时观测与因果证明；动态调用和不能唯一确定的关系保留 unknown。

`inspect-analysis-view` 从保存的 Evidence 提取摘要或分页；`trace-application-feature` 从匹配种子出发遍历关系。投影视图和关系追踪是两种操作。

练习的分析能发现文本和静态模块关系，但不能据此声称订单请求成功、服务器接受了订单，或每条调用路径实际运行过。
