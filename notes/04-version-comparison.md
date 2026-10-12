# 第二轮：JavaScript 应用版本比较

基线仍为 REA 6.4.0 / `c22111eca2c4bc84a084f12711f405b3e7422a40`。2026-10-12，在本机 Node 26.10.0 上完成真实 CLI 实验。

## 从入口追到纯比较函数

`src/cli/applicationCommands.ts` 通过 `registerJsonCommand` 注册 `compare-application-versions`，读取 JSON 或文件，校验 schema 后调用 `compareApplicationVersionsEvidenceValidated`。

`src/domain/javascript/javascriptApplicationVersionComparisonSchemas.ts` 定义完整左右 Evidence 和默认空的两侧 native observations。左右 Evidence ID 必须不同；同侧 native Evidence ID 必须唯一。“同一个证据与自己比较”被拒绝，不能用它作为 unchanged 对照实验。

`src/application/javascript/JavaScriptApplicationWorkflowService.ts` 再检查身份，调用 `parseApplicationGraphEvidence` 认证左右 Evidence，然后把 evidenceId、rootArtifactSha256、graph 和 native Evidence 交给领域函数。

`src/application/javascript/JavaScriptApplicationEvidenceGraph.ts` 验证 Evidence、operation、predicate、provider、authority/confidence，以及应用结果和图的绑定。实验改动右侧节点标签但保留 Evidence ID 后，得到 `Evidence semantic identifier does not match its record` 错误。这验证了摘要绑定能检测未重算身份的篡改；它不是数字签名，也不证明材料的外部真实性。

`src/domain/javascript/javascriptApplicationVersionComparison.ts` 的 `compareJavaScriptApplicationVersions` 依次匹配、分类、构建 change graph，再生成 summary、coverage、证据链接和 comparison_id。整个比较只消费保留的图，不重新读取目标或执行应用。

## 匹配不是按文件名做 diff

`src/domain/javascript/javascriptApplicationVersionKeys.ts` 依次尝试：

1. exact-content-digest（exact）
2. exact-module-source-digest（exact）
3. exact-node-identity（exact）
4. source-map-identity（high）
5. structural-fingerprint（medium）
6. semantic-key（medium）

每层按 key 分组，只有左右各一个候选时才配对并从剩余集合删除。多候选先保留；最终仍未唯一匹配的候选成为歧义。较低层不能覆盖已经建立的配对。

content digest 要求节点的 identity.strategy 为 content-digest；module source digest 需要唯一的 source_sha256 属性；结构匹配需要算法和摘要属性。semantic-key 显式排除 javascript-module，端点则以 endpoint_kind 与完整 value 组成 key。因此端点 URL 改变后成为一项 removed 和一项 added，而不是直接配成 changed。

## 分类与覆盖

`src/domain/javascript/javascriptApplicationVersionItems.ts`：

- 已匹配实体：content/location/properties 的观察变化可直接判 changed；完整图中的其他维度变化也可判 changed；完整且没有变化才判 unchanged，否则 unknown。
- 单侧实体：仍有歧义候选时为 unknown；没有候选时，只有对侧覆盖允许声明缺失，才判 added/removed。

`src/domain/comparisonSemantics.ts` 的 `absenceClaimable` 要求 complete、没有 truncated 且 omitted_count 为 0（或未提供）。目录未遍历完整时，“没找到”不能提升为“已删除”。本实验两侧完整，尚未通过真实 CLI 构造部分覆盖或歧义场景。

`src/domain/javascript/javascriptApplicationChangeGraph.ts` 构建跨版本变化图。最终 `JavaScriptApplicationWorkflowEvidence.ts` 把比较封装为 confidence=inferred、authority=analyst-inference 的新 Evidence，并链接来源证据。exact 的实体匹配并不把整个比较变成运行时事实。

## 实验观察与解释

正向和反向结果均为 unchanged 2、changed 3、added 6、removed 6、unknown 0。反向比较验证了数量对称，但数量对称本身不能证明每个实体都正确匹配。

- invoice.js 的 javascript-asset 按 exact-content-digest 匹配，为 unchanged。
- main.js 的 javascript-asset 按 semantic-key 匹配，为 changed，维度为 content/properties。
- package 节点和 package.json 工件也为 changed。
- electron-main 节点 main.js 为 unchanged。这是入口关系的分类，不代表 main.js 内容未变，也不证明目标是运行中的 Electron 应用。
- 旧、新 endpoint 没有配对，分别 removed/added。
- 若干 javascript-module 节点和 root 工件也分别 removed/added。

最值得注意的是：invoice.js 未修改，但其模块节点身份使用 artifact-local-key，key 包含 root artifact 摘要与路径。两版本根摘要不同，模块身份随之改变；这些节点又没有本轮匹配所需的 source_sha256/结构指纹属性，semantic-key 也排除该 kind，因此未配对。文件级 unchanged 与模块级 added/removed 可同时出现。

结论：输出分类描述已保留实体和可用身份依据下的比较，不能直接转换成业务功能增删、行为等价或回归证明。unknown=0 只针对此次结构比较；语义和运行时未知仍存在。

## 验证与下一轮

已通过：两个版本真实分析、正向/反向比较、源 Evidence 绑定、旧新端点分类、同 Evidence 拒绝和未重算摘要的篡改拒绝。初次检查误用 item.kind，查看实际输出与 schema 后修正为 item.node_kind，实验通过。

下一轮可增加重命名文件、重复候选、bundler 注册模块和部分覆盖目标，观察身份层级与 unknown 分类；再单独探索静态语义关系图。此次未验证 native providers，也未连接真实 MCP 客户端。
