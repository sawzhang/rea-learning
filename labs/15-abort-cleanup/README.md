# 实验 15：already-aborted、重复取消与清理失败

```bash
npm run lab:abort
```

两份真实实现只有注册 listener 后是否检查 `signal.aborted` 的差异。safe 运行四个场景，listener-only 运行 already-aborted 反例；均采集 REA Evidence、原始 V8 coverage 和生命周期快照。

| 场景 | 第一个检查点 | 最终清理/归属 |
|---|---|---|
| safe already-aborted | rejected | 一次清理，归属释放 |
| listener-only already-aborted | pending，无 abort callback | 再 abort 仍 pending；独立 forceStop 后释放 |
| safe 三次 abort | 一次 callback、一次 settlement | 一次清理 |
| 清理首次失败 | rejected，但 owned=true | retry 成功，第二次清理后释放 |
| 清理永久失败 | rejected，但 owned=true | retry 失败，保留 resource ID/owner/released=false |

资源是内存中的逻辑 token，不涉及真实 OS 资源。Promise 结束、owner-finally 执行和进程正常退出不证明清理成功。永久失败 token 完整保存到 report，不补造 released 状态。

脚本保留 AST already-aborted 检查范围、相同 consumer 文本、原覆盖区间、源码摘要、双方 Evidence 和清理重试记录。新目标 consumer 的历史迁移保持 unknown/count=null。

结果位于 `results/15-abort-cleanup/`。详见 [第十五轮笔记](../../notes/17-abort-cleanup.md)。
