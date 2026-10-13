# 实验 11：异常与 try/finally 的映射边界

```bash
npm run lab:exceptions
```

六份真实 ESM 目标均执行 false/true 两次 evaluate，分别经 REA 静态分析并保存原始 V8 覆盖率。

| 目标 | 两次调用结果 | evaluate 外层 count | 旧 return 迁移 |
|---|---|---:|---|
| plain | ok / ok | 2 | 成功对照 |
| prefix-throw | ok / throw boom | 2 | 拒绝：前置调用可抛异常 |
| catch | ok / caught | 2 | 拒绝：异常完成上下文 |
| finally-normal | ok / ok，finally 事件两次 | 2 | 保守拒绝 |
| finally-return | override / override | 2 | 拒绝 |
| finally-throw | throw finally / throw finally | 2 | 拒绝 |

finally-return 和 finally-throw 的 try 内仍保留 `return 'ok'`，但它不是调用方收到的最终结果。同样的函数覆盖次数也不能说明两版本的完成类型相同。

脚本收集 AST return 的 try/catch/finally 上下文、同文本候选和前置语句类型。遇到未建模的异常完成结构时整个目标函数保持未知；原 return 和其原始覆盖率范围均保留。前置调用目标也不假定调用总会正常返回。

report 保存源码摘要、Evidence、静态函数 ID、原始嵌套 ranges、候选、拒绝理由与未知范围。源目标未迁移区间 count=null，覆盖率采集与历史迁移分开。原始覆盖率及完整 Evidence 位于 `results/11-exceptions/`，不提交。

详见 [第十一轮笔记](../../notes/13-exceptions.md)。
