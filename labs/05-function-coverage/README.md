# 实验 05：函数执行覆盖率与静态语义图

```bash
npm run lab:coverage
```

本实验执行自建目标，用 Node `NODE_V8_COVERAGE` 在正常进程退出时生成 V8 原始覆盖率。它是调用方采集的数据，不冒充 REA passive Inspector Evidence，也不注入 reconciliation。

同一源码执行两种场景：baseline 只调用 double 和 choose；expanded 多调用一次 double 并调用 unused，且 choose 走另一分支。

| 函数 | baseline 计数 | expanded 计数 |
|---|---:|---:|
| double | 1 | 2 |
| choose | 1 | 1 |
| unused | 0 | 1 |

三项明确选定的函数覆盖率分别为 2/3 和 3/3；即使 expanded 达到 3/3，choose 仍有 count=0 的分支区间，不能称为全部分支覆盖。

脚本先由 REA 分析静态图，再运行两个独立子进程。每次使用全新覆盖率目录，避免旧文件或不同场景计数混合；两个进程均有超时且正常退出。对照限定 logic.js，排除脚本顶层与 Node 内建函数。

映射要求：准确文件 URL、静态工件 SHA-256 与执行前后源码摘要一致、函数范围按 UTF-16 code units 转换且唯一完全匹配，最后再核对函数名。源码含 🧪，不能用 UTF-8 字节偏移代替字符范围。

输出位于 `results/05-function-coverage/`，包括静态 Evidence、原始 coverage、静态 unused callers 查询及 report。原始覆盖率不是业务正确性证明；0 只说明此次采集未执行该函数，不证明永远不可达。

详见 [第五轮源码笔记](../../notes/07-function-coverage.md)。
