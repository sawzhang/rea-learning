# 实验 10：前置控制流与隐含 fallthrough guard

```bash
npm run lab:fallthrough
```

重新采集第五轮旧 choose 的真实 baseline 覆盖率，再分析并实际执行五份目标源码，每份都对输入 1、0、-1 运行 choose，同时独立保存 Node 原始覆盖率。

| 目标 | 实际变化 | 输出（1、0、-1） | 可迁移旧 return |
|---|---|---|---:|
| comment | 文件头注释 | positive / non-positive / non-positive | 2 |
| guard | >0 改为 >=0 | positive / positive / non-positive | 0 |
| early | 新增 value===0 提前返回 zero | positive / zero / non-positive | 0 |
| assignment | 判断前执行 value=-1 | non-positive / non-positive / non-positive | 0 |
| stop | 函数开头无条件 return stopped | stopped / stopped / stopped | 0 |

源 non-positive return 的上下文包含隐含 guard `value > 0` 为 false，因为前一个 if 的 consequent 会 return。不是简单地将它视为“没有 guard”。目标 guard/early 改变这条链；assignment 改变前置 effect；stop 后的旧语句不再作为可达候选收集。

仅支持顺序块、直接终止的 if 分支、return，以及记录前置声明/表达式的文本。未知循环等控制流阻断后续候选，保持 unknown，不推测条件。

report 保留源码摘要、Evidence ID、直接/隐含 guard、前置 effect、候选、拒绝理由、原覆盖区间及源目标补集。未迁移目标 count=null。成功迁移的计数仍是历史计数，不会与独立目标覆盖率混合。

结果位于 `results/10-fallthrough/`。详见 [第十轮笔记](../../notes/12-fallthrough.md)。
