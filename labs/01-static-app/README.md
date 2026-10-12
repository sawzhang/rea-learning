# 实验 01：从代码到 Evidence

目标包含两个 ESM 文件：`main.js` 组装订单并声明 fetch 请求，`invoice.js` 计算总价。REA 静态读取该目录，不运行 checkout。

```bash
cd /Users/alex/code/rea-learning
npm run lab
```

结果：

- `results/application.json`：完整分析证据。
- `results/summary.json`：REA 生成的摘要。
- `results/trace.json`：以 `main.js` 模块为种子的双向特征追踪。
- `results/*-input.json`：摘要和追踪的真实请求。
- `results/*.stderr.log`：对应 CLI 的诊断和进度。

## 观察任务

1. 对照 `normalized_result.statistics` 与目标文件数量、解析失败数量。
2. 找到两个文件对应的模块、导入关系和 API 字符串；记录实际节点 ID。
3. 查看 trace 的种子是否命中、返回了哪些关系和 limitations。
4. 区分 Evidence 的总体 confidence 与各图关系自身的 authority。

## 修改任务

先将当前结果另存到 `results/baseline/`，再修改目标并重跑：

1. 把 checkout URL 的路径从 `/api/checkout` 改为 `/api/orders`，观察目标摘要与节点身份的变化。
2. 添加动态属性调用，检查 unknown/limitations，而非假定解析器知道目标函数。
3. 添加一个没有被 main 导入的文件，比较目录 inventory 与入口可达性的差别。

延伸练习：按照 `upstream/docs/javascript-application-workflows.md` 构造 `{left: EvidenceA, right: EvidenceB}`，调用 `compare-application-versions INPUT.json --json`。分析版本差异与证明行为等价是不同问题。

不要执行目标来验证网络请求；本实验的验收范围是静态分析、证据投影和图追踪。
