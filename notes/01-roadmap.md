# 学习路线

## 1. 跑通静态 JavaScript 分析

运行 `npm run lab`，阅读摘要，再打开完整 Evidence。找到目标身份、SHA-256、provider、operation、confidence、authority 和 limitations。

验收：能解释“分析了哪些文件”“结论来自哪里”“哪些行为没有被验证”。

## 2. 沿一个操作阅读源码

从 `upstream/scripts/rea.mjs` 进入 `src/cli.ts`，搜索 `analyze-javascript-application` 的注册位置；阅读 `src/cli/javascriptApplicationAnalysis.ts` 和 `src/application/javascript/JavaScriptApplicationService.ts`。

验收：画出原始输入 → schema → artifact inventory → AST → graph → Evidence → 输出的流程，并指出每一步由谁拥有。

## 3. 理解证据和图

阅读 `src/domain/evidence.ts`、`src/domain/javascript/javascriptApplicationAnalysis.ts`、`src/domain/javascript/javascriptApplicationGraph.ts`、`docs/javascript-application-workflows.md`。

验收：能区分文件观测、静态关系推断、运行时观测；能解释为什么静态可达性不能证明代码已经执行。

## 4. 对照 CLI 与 MCP

阅读 `src/main.ts`、`src/server/createServer.ts`，查找 JavaScript 工具注册，追到同一个 application service。阅读 `docs/mcp-contracts.md` 和 `docs/architecture.mermaid`。

验收：说明两个适配器各自负责什么，以及为什么业务逻辑放在共享应用层。

## 5. 扩展到原生分析和会话

先阅读 `docs/native-investigation.md`、`docs/ghidra-provider.md`，再读 `src/application/binary/SessionProviderRouter.ts`和 `src/application/binary/AnalysisProviderRegistry.ts`。此阶段需要单独准备原生 provider。

验收：解释多 provider 的选择、会话绑定、失败处理，以及清理失败为何必须保留资源归属信息。

每阶段记录：问题 → 源码位置 → 观察 → 推断 → 未知 → 下一次实验。优先通过小目标验证，不急于遍历全部平台模块。
