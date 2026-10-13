# 实验 07：真实跨版本覆盖率身份校验

```bash
npm run lab:identity
```

三份提交到仓库的真实源码各自完成 REA 静态分析和两个独立场景的 V8 覆盖率采集，不修改已有 coverage 的摘要字段来伪造版本。

| 版本 | logic.js 实际变化 | double(21) | double UTF-16 范围 |
|---|---|---:|---|
| v1 | 第五轮原始源码 | 42 | [41,85) |
| v2-comment | 文件头新增一行注释 | 42 | [58,102) |
| v3-behavior | `value * 2` 改为 `value * 3` | 63 | [41,85) |

每个版本 baseline/expanded 内部合并均成功，累计 double=3、choose=2、unused=1。将 v1 baseline 与任一新版本 expanded 合并，均得到 `Source digest mismatch` 拒绝。

v1 与 v3 的三个函数名、外层范围、baseline 调用计数都相同；这仍不构成源码身份。v2 对本次输入结果相同，也不允许跳过摘要校验。若要跨版本迁移覆盖率，需要额外的明确映射和证明，本实验不实现该能力。

脚本复用第五轮采集器的新参数：目标目录、输出目录、预期主计算结果；无参数时第五轮行为不变。每个版本重新采集原始 coverage，并用其自己的静态图和 UTF-16 范围映射。

输出位于 `results/07-cross-version-identity/`，每个版本保留完整静态 Evidence、原始覆盖率与对照 report。总 report 保存各版本来源摘要、Evidence ID、函数范围和拒绝结果。

详见 [第七轮中文源码笔记](../../notes/09-cross-version-identity.md)。
