# 实验 04：受控运行时观测与静态语义对照

```bash
npm run lab:runtime
```

该实验会执行本目录自建的 Node 目标。目标只计算 double(21)、输出 JSON 并等待关闭，不发送网络请求。Inspector 使用 `127.0.0.1:0` 自动分配端口；脚本读取实际端口后查询精确 target ID，不连接已有应用。

## 三种证据

| 来源 | 能说明什么 | 不能说明什么 |
|---|---|---|
| 静态 semantic graph | input 的静态来源、函数存在、保留关系可达性 | 这次运行执行了所有关系 |
| REA Inspector | main.js、logic.js 在上下文中被解析；上下文元数据 | double/unused 函数执行次数或 import 因果边 |
| 自建目标 stdout | 受控目标报告计算结果 42；代码没有调用 unused | REA 已独立观测到函数调用 |

目标保留三个文件：main.js 导入 logic.js；logic.js 同时定义 double 和未调用的 unused；unloaded.js 没有被入口导入。

## 自动验证

1. 静态分析目标目录，再由实验脚本启动 Node。
2. 等待 Inspector 地址与 fixture-ready；执行 list/observe CLI，观测窗口 200 ms。
3. 确认两个目标脚本存在，unloaded.js 不在捕获的 file scripts 中；capture 没有截断。
4. 用已有静态与运行时 Evidence reconciliation，确认两个 artifact-path / medium 匹配及双来源链接。
5. 确认 unloaded.js 的静态 load state 是 unknown；不将本窗口没观察到解释为全局不存在。
6. 对静态 literal 21 做 forward-influence 查询，并核对来源 Evidence。
7. 重复 reconciliation，确认相同保留输入产生相同 Evidence ID。
8. 确认 REA 没有结束目标；finally 由实验脚本发送 SIGTERM，必要时 SIGKILL，并等待退出。

输出位于 `results/04-runtime-observation/`：完整分析、targets、runtime、reconciled、semantic-trace Evidence、请求、精简 report 和目标日志。生成结果不会提交到仓库。

本机 Node 26.10.0：目标结果 42；runtime 捕获 107 个脚本（含 Node 内建脚本），其中两个本地目标脚本匹配；静态 literal 查询 found、4 节点/3 关系、coverage partial；reconciliation 为 partial。Node 版本和捕获窗口会影响内建脚本数量，脚本不固定该计数。

详见 [第四轮笔记](../../notes/06-runtime-observation.md)。
