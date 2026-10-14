# 学习记录

## 2026-10-12：第一轮完成

基线：REA 6.4.0，`c22111eca2c4bc84a084f12711f405b3e7422a40`。

本机：macOS arm64，Node 26.10.0（满足上游 engines，但与 `.nvmrc` 的 24.18.0 不同），依赖安装与构建使用 npm 11.16.0。

已完成：

- 阅读入口分流、CLI JavaScript 适配器、应用服务、工件重建及 Evidence schema。
- 对照架构文档，整理共享应用层与 CLI/MCP 边界。
- 使用 lockfile 安装依赖，上游 `build:cached` 成功。
- 运行真实 CLI 的静态分析、摘要投影与特征追踪，三步均成功。

构建给出两条动态导入未产生独立 chunk 的警告，退出码为 0。

## 实验观察

目标目录包含 3 个相关文件，解析了 2 个 JavaScript 文件、85 个 AST 节点，解析失败为 0。

应用结构图有 11 个节点、13 条边。`main.js` 模块种子匹配了 2 个节点（asset 与 module），双向追踪得到 11 个节点、13 条边，没有 native handoff。

端点节点保留了 `https://example.invalid/api/checkout`，来源位置落在 `main.js` 的 fetch 语法范围。证据说明这是静态语法观测；本轮没有执行目标或发送请求。

摘要报告应用覆盖 complete，但语义覆盖 unknown，语义图保留 21 项 unknown。这证明“结构分析完整”不能推广为“知道所有运行时语义”。

`statistics.modules` 为 0，但图中存在 javascript-module 节点。`src/application/javascript/JavaScriptArtifactAnalysis.ts` 的计数来源是 `bundler_registrations` 中的 `modules.length` 总和，表示 bundler 注册模块数量，不是结构图中的所有模块节点数量。

## 已确认的 MCP 共用路径

`src/server/registerElectronTools.ts` 注册分析工具，并调用 `analyzeJavaScriptApplicationValidated`；CLI 使用同一应用服务的输入校验入口。两侧传入各自的资源和 progress/signal 上下文。

## 下一轮

1. 进一步阅读 AST 发现生产者，解释 bundler 模块与文件级模块的身份差异。
2. 按实验说明修改 URL，并保存两个 Evidence，运行版本比较。
3. 从语义 unknown 选择一项，定位产生它的分支与相关单元测试。
4. 对照 MCP 工具 schema 与 CLI 输入，整理接口差异。

验证范围：小型自建 JavaScript 目标的 CLI 静态工作流。原生 provider、运行时采集和真实 MCP 客户端连接尚未验证。

## 第二轮完成

版本比较实验及源码阅读已完成，见 [第二轮笔记](04-version-comparison.md)。第一轮 GitHub Actions 已通过；第二轮本地真实 CLI 验证通过，CI 由本轮推送触发。

## 第三轮完成

静态语义图与六种查询本地验证通过，见 [第三轮笔记](05-static-semantics.md)。第二轮 CI 已通过；本轮 CI 在推送后验证全部三个实验。

## 第四轮完成

受控 Node Inspector、静态语义对照及 reconciliation 实验已完成，见 [第四轮笔记](06-runtime-observation.md)。第三轮 CI 已通过；本轮 CI 在推送后验证四个实验。

## 第五轮完成

两个受控场景的函数与分支覆盖率对照已完成，见 [第五轮笔记](07-function-coverage.md)。第四轮 CI 已通过；本轮 CI 在推送后验证五个实验。

## 第六轮完成

真实多场景覆盖率合并与两项分支位置对照已完成，见 [第六轮笔记](08-coverage-merge.md)。第五轮 CI 已通过；本轮 CI 在推送后验证六个实验。

## 第七轮完成

三个真实源码版本、六次运行与跨版本拒绝实验完成，见 [第七轮笔记](09-cross-version-identity.md)。第六轮 CI 已通过；本轮 CI 在推送后验证七轮实验。

## 第八轮完成

四组跨版本函数映射与历史覆盖率投影完成，见 [第八轮笔记](10-function-migration.md)。第七轮 CI 已通过；本轮 CI 在推送后验证八轮实验。

## 第九轮完成

受限 AST return 区间投影、真实局部改动与三个解析负例完成，见 [第九轮笔记](11-ast-intervals.md)。第八轮 CI 已通过；本轮 CI 在推送后验证九轮实验。

## 第十轮完成

五份真实控制流目标与隐含 guard 对照完成，见 [第十轮笔记](12-fallthrough.md)。第九轮 CI 已通过；本轮 CI 在推送后验证十轮实验。

## 第十一轮完成

六份真实异常/finally 目标及覆盖率对照完成，见 [第十一轮笔记](13-exceptions.md)。第十轮 CI 已通过；本轮 CI 在推送后验证十一轮实验。

## 第十二轮完成

六份真实异步目标、十二次调用和 finally 时序验证完成，见 [第十二轮笔记](14-async-finally.md)。第十一轮 CI 已通过；本轮 CI 在推送后验证十二轮实验。

## 第十三轮完成

all/race 六个受控聚合过程与剩余任务归属对照完成，见 [第十三轮笔记](15-promise-ownership.md)。第十二轮 CI 已通过；本轮 CI 在推送后验证十三轮实验。

## 第十四轮完成

四份真实目标、十二个聚合过程及显式取消确认对照完成，见 [第十四轮笔记](16-cancellation.md)。第十三轮 CI 已通过；本轮 CI 在推送后验证十四轮实验。
