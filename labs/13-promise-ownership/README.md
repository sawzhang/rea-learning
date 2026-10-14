# 实验 13：Promise.all/race 与任务所有权边界

```bash
npm run lab:concurrency
```

两份真实目标只有聚合策略不同，consume 函数文本完全相同。任务 A/B 使用显式 resolve/reject 句柄，由实验驱动控制顺序，不靠随机定时器制造竞争。setImmediate 作为本 fixture 的检查点，快照保留第一项完成后及全部任务处理后的结果与事件。

| 场景 | all 第一个检查点 → 最终结果 | race 第一个检查点 → 最终结果 |
|---|---|---|
| B-first | pending → [A,B] | B → B |
| A-reject-first | rejected A-boom → 不变 | rejected A-boom → 不变 |
| A-win-B-late-reject | pending → rejected B-late | A → A |

all/race 的 owner 都可能在剩余任务完成前进入 finally。本实验随后仍显式完成剩余任务并排空事件，验证“聚合完成”不等于“所有任务结束”。所有子进程使用 strict unhandled rejection，并为任务显式安装日志处理器；因此不将成功退出单独当作 race 已处理一切拒绝的证明。

固定 REA 版本将 all 识别为 aggregate，但不将 race 提取为 aggregate：脚本保留 race-not-modeled-by-pinned-extractor，而不是伪造关系或宣称 runtime 不存在 race。

AST 报告保留 Promise 调用方法、输入标识符、范围和 consume 文本。外部聚合策略变化使相同 consume 的历史覆盖仍不可直接迁移；保留源嵌套 ranges 与目标整函数 unknown/count=null。

结果位于 `results/13-promise-ownership/`，详见 [第十三轮笔记](../../notes/15-promise-ownership.md)。
