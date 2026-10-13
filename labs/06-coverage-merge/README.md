# 实验 06：多场景覆盖率合并与分支对照

```bash
npm run lab:merge
```

脚本先重新执行第五轮采集器，生成 baseline 和 expanded 两个独立进程的真实 V8 覆盖率，不读取历史 report 作为新观测。复用第五轮目标和静态函数映射，随后把三个指定函数的完整范围列表交给本项目的合并器。

| 指标 | baseline | expanded | 合并 |
|---|---:|---:|---:|
| double 执行计数 | 1 | 2 | 3 |
| choose 执行计数 | 1 | 1 | 2 |
| unused 执行计数 | 0 | 1 | 1 |
| 指定函数覆盖 | 2/3 | 3/3 | 3/3 |
| choose 两个指定 return 分支位置覆盖 | 1/2 | 1/2 | 2/2 |

“分支位置”是本自建 fixture 明确指定的两个 return 语句位置，不是通用 AST 分支覆盖算法，不包括任意逻辑表达式、异常、循环或所有输入边界。

`scripts/merge-coverage.mjs` 要求相同源码摘要、Node 版本、UTF-16 单位、静态函数节点集合和函数边界。只接受每个场景都完整保留的指定函数 inventory；缺失记录不能补零。

对所有场景的区间边界分段，在每个原子区间内取各场景最内层包含区间的 count，然后累加。函数外层 count 单独累加；不对嵌套 ranges 直接求和。

自动验证包含：真实场景的执行计数和分支交替、合并顺序不变，以及拒绝重复 capture ID、摘要不一致、函数集合缺失、相互交叉的区间。后四项是针对已采集记录的受控输入变异负例，不代表运行了不同源码版本。

结果位于 `results/06-coverage-merge/report.json`，原始采集仍位于第五轮 results 目录。合并结果是调用方数据上的分析者推断，不冒充 REA runtime Evidence。

详见 [第六轮源码笔记](../../notes/08-coverage-merge.md)。
