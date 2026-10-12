# 实验 02：比较两个 JavaScript 应用版本

## 输入与运行

`v1/` 来自实验 01；`v2/` 只把 package 版本 1.0.0 改为 1.1.0，并将 main.js 中的请求路径 `/api/checkout` 改为 `/api/orders`。invoice.js 字节保持相同。

```bash
npm run lab:versions
```

脚本通过真实 CLI 分别分析两个目录，把完整 Evidence 写入 `results/02-version-comparison/`，然后以 `{left, right}` 调用 `compare-application-versions`。所有目标分析都保持静态读取。

## 四个比较场景

1. `forward.json`：v1 → v2，验证父 Evidence 身份、完整输入覆盖、端点新增/移除和 unchanged 实体。
2. `reverse.json`：v2 → v1，验证 added/removed 互换，以及 changed/unchanged 数量对称。
3. `same-evidence.json`：把同一 Evidence 同时作为左右输入，预期返回 distinct 校验错误。
4. `tampered-evidence.json`：修改右侧图节点标签但保留原 Evidence ID，预期被证据身份校验拒绝。

每次请求同时保留 `*-input.json`、结果 JSON 与 stderr 日志。拒绝场景返回结构化错误是预期成功，不能只靠进程退出码判断分析是否成功。

## 结果

| 分类 | v1 → v2 | v2 → v1 |
|---|---:|---:|
| unchanged | 2 | 2 |
| changed | 3 | 3 |
| added | 6 | 6 |
| removed | 6 | 6 |
| unknown | 0 | 0 |

结果的 matching：exact-content-digest 1、semantic-key 4、unmatched 12，其余匹配层级和 ambiguous 为 0。比较覆盖为 complete-within-inputs。

请结合 [源码笔记与结论](../../notes/04-version-comparison.md) 阅读，不能把 6 个 added 实体解释为 6 项业务功能。
