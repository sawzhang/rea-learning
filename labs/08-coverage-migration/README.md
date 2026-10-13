# 实验 08：跨版本函数映射与历史覆盖率迁移

```bash
npm run lab:migration
```

先重新运行第七轮三版本的真实静态分析与六次覆盖率采集，再从 v1 baseline 向不同目标版本投影。新增 v4/v5 目标只进行静态分析，不运行、不声称它们实际执行。

| 目标 | 实际改动 | 可迁移函数 | 无法迁移 |
|---|---|---:|---|
| v2-comment | 文件头注释 | 3 | 无；范围平移 +17 |
| v3-behavior | double 乘数 2 → 3 | 2 | double：无相同完整指纹 |
| v4-duplicate | 增加 unusedTwin，形成重复指纹 | 2 | unused：两个候选 |
| v5-rename | unused 改名 unusedRenamed | 2 | 指纹候选唯一，但函数文本不同 |

函数映射采用双方 complete、相同算法的 fingerprint，且要求源、目标各唯一候选。只有函数文本完全相同，才能将每个原始 UTF-16 区间平移到新范围；不做字符串相似度或编辑距离推测。

report 保留双方 Evidence ID、源码摘要、函数 ID、指纹、候选、匹配依据、偏移、原始区间及历史 count。无法迁移的源区间完整保留；目标未接收历史覆盖的位置保留整函数范围，count=null、status=unknown，而非补零。

结果位于 `results/08-coverage-migration/report.json`。历史计数只表示旧版本场景，迁移不证明目标版本执行，也不绕过第六轮合并器的源码摘要拒绝规则。

详见 [第八轮源码笔记](../../notes/10-function-migration.md)。
