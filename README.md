# REA 源码学习项目

从一个可重复的小实验出发，学习 REA 如何把应用文件转成可追溯的分析证据，以及 CLI/MCP 如何共用这一流程。

上游：https://github.com/morluto/rea

学习基线：2026-10-12，版本 `6.4.0`，提交 `c22111eca2c4bc84a084f12711f405b3e7422a40`。`upstream/` 是固定提交的 Git submodule，学习笔记与练习在外层保存。

## 开始学习

```bash
git clone --recurse-submodules https://github.com/sawzhang/rea-learning.git
cd rea-learning
npm run setup
npm run lab
npm run lab:versions
npm run lab:semantics
npm run lab:runtime
npm run lab:coverage
npm run lab:merge
npm run lab:identity
npm run lab:migration
npm run lab:ast
```

实验分析 `labs/01-static-app/target`，保存完整 Evidence、摘要、模块特征追踪与 stderr 日志到 `results/`。分析过程中不执行目标代码；目标的示例 URL 使用 `.invalid` 域名。

如果需要重建上游：

```bash
cd upstream
# 上游 .nvmrc 固定 Node 24.18.0；packageManager 固定 npm 11.16.0
HUSKY=0 npx --yes npm@11.16.0 ci
npx --yes npm@11.16.0 run build:cached
```

当前运行环境和验证结果见 [学习记录](notes/03-progress.md)。

## 阅读顺序

1. [学习路线](notes/01-roadmap.md)：五个阶段及验收问题。
2. [第一轮源码导读](notes/02-source-walkthrough.md)：输入、应用流程、证据和资源回收。
3. [实验说明](labs/01-static-app/README.md)：运行、观察、修改与局限。
4. [学习记录](notes/03-progress.md)：本轮已完成内容及下一步。

## 第二轮学习

[版本比较实验](labs/02-version-comparison/README.md)固定两个目标版本，执行正向/反向比较与证据校验负例；[中文源码笔记](notes/04-version-comparison.md)解释匹配层级、覆盖约束和分类局限。

## 第三轮学习

[静态语义关系图实验](labs/03-static-semantics/README.md)查询字面量影响、属性来源、端点与调用者，对照候选边和 unknown；[中文源码笔记](notes/05-static-semantics.md)解释 provenance 上下文及 status/coverage 的区别。

## 第四轮学习

[受控运行时观测实验](labs/04-runtime-observation/README.md)启动自建 Node 目标，以 loopback Inspector 观测脚本，再与静态工件及语义查询对照；[中文源码笔记](notes/06-runtime-observation.md)说明脚本存在、路径关联和函数执行的不同证据边界。

## 第五轮学习

[函数执行覆盖率实验](labs/05-function-coverage/README.md)在相同源码上运行两种场景，按摘要和 UTF-16 范围映射到静态函数节点；[中文源码笔记](notes/07-function-coverage.md)区分函数计数、嵌套分支范围和静态关系缺失。

## 第六轮学习

[多场景覆盖率合并实验](labs/06-coverage-merge/README.md)保留嵌套区间计数语义，比较单场景与合并后的指定分支覆盖；[中文源码笔记](notes/08-coverage-merge.md)解释源码身份、分段继承和负例拒绝。

## 第七轮学习

[真实跨版本覆盖率身份实验](labs/07-cross-version-identity/README.md)执行原版、注释版和同长度行为变更版，验证同版本成功与跨版本拒绝；[中文源码笔记](notes/09-cross-version-identity.md)解释同名同范围为何不等于源码身份。

## 第八轮学习

[跨版本函数映射与迁移实验](labs/08-coverage-migration/README.md)保留完整指纹依据、候选与未迁移区间，仅对相同函数文本投影历史覆盖；[中文源码笔记](notes/10-function-migration.md)解释映射、迁移和目标执行事实的边界。

## 第九轮学习

[局部 AST 区间映射实验](labs/09-ast-intervals/README.md)只投影唯一对应的 return 历史区间，完整保留修改、新增和其他未知范围；[中文源码笔记](notes/11-ast-intervals.md)解释映射依据和控制流限制。

## 目录

- `upstream/`：上游源码与独立 Git 历史。
- `notes/`：中文学习笔记。
- `labs/`：小型目标与练习。
- `scripts/run-lab.mjs`：通过真实 CLI 完成分析、摘要和追踪。
- `results/`：本机生成的分析结果，不纳入外层版本管理。

后续升级上游前先记录当前提交和学习结果；命令与结构均以当前克隆的源码为准。

## 验证与许可

GitHub Actions 会在 Linux / Node 24.18.0 上构建固定版本上游并执行真实 CLI 实验。本机已通过的验证与 CI 是否通过分别记录，见学习记录。

本项目新增笔记与练习使用 MIT 许可；上游源码保留其自身许可。项目与 REA 上游无官方隶属关系。
