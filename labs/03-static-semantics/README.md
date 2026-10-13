# 实验 03：静态语义关系图

目标为自建 ESM 目录，不执行目标代码或发送网络请求：

- main.js：21 → input → double(value)，对象字段、动态 object[key] 和 fetch/await。
- object.js：独立的 settings.mode 静态读取，用作属性来源查询对照。

```bash
npm run lab:semantics
```

输出保存在 `results/03-static-semantics/`，包括应用 Evidence、六个查询的请求与结果以及 stderr 日志。

| 查询 | 种子与方向 | status | 节点 / 关系 | relevant unknowns |
|---|---|---|---|---:|
| literal-forward | literal 21 / forward-influence | ambiguous | 6 / 5 | 1 |
| literal-with-candidates | 同上，显式启用候选边 | ambiguous | 11 / 10 | 2 |
| property-backward | property mode / backward-provenance | found | 4 / 3 | 0 |
| endpoint-backward | invoice URL / backward-provenance | ambiguous | 2 / 1 | 0 |
| literal-missing | 不存在的字符串 / forward-influence | partial | 0 / 0 | 0 |
| local-callers | 实际 calls 关系目标 ID / callers | found | 2 / 1 | 0 |

所有查询 coverage 都为 partial；整个语义图为 63 个节点、46 条关系、17 项 unknown。这些数字是固定目标和上游提交的观察结果，脚本通过语义断言验证，不把全部数量写死为验收条件。

脚本验证：源 Evidence/graph 身份绑定、返回事实的 context 引用闭合、默认不遍历候选边、启用候选边后仍保留 candidate、局部调用关系可反向追踪、计算属性明确留有 dynamic-property，以及无种子命中时不把部分覆盖声称为 no-match。

练习：将 mode 改为动态属性，重跑并比较种子命中与 unknown；更改允许关系种类，观察同一种子在不同关系集合中的可达范围。不要把空结果直接解释为目标不存在该行为。

详见 [第三轮源码笔记](../../notes/05-static-semantics.md)。
