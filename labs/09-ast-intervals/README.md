# 实验 09：函数局部修改后的 AST 区间投影

```bash
npm run lab:ast
```

目标实际源码在第七轮 v1 基础上改动：double 内新增 `const adjustment=0`，choose 正分支的返回值改为 positive-v2。脚本重新采集旧版真实覆盖率，分析实际新版，然后按受限 AST 对应投影旧版 baseline 覆盖区间。

| return 语句 | 对应结果 | 历史 count |
|---|---|---:|
| double: return value * 2 | 文本相同且唯一 | 1 |
| choose: return positive | 文本改变，不能对应 | 未迁移 |
| choose: return non-positive | 文本相同且唯一 | 0 |
| unused: return value + 100 | 文本相同且唯一 | 0 |

映射基于唯一函数名与完全相同参数文本的分析者 anchor，再匹配 ReturnStatement 完整文本及直接 if guard/分支角色。只进入 BlockStatement 与 IfStatement；循环、try、switch、嵌套函数等不在本轮能力内。

保存所有源码摘要、双方 Evidence 与节点 ID、语句文本摘要、guard、源目标范围和历史 count。源/目标函数范围扣除已对应 return 后的剩余区间，完整保留为 unknown；目标不对应区间 count=null，不能补零。

独立运行新版 baseline 输出 result=42、branch=positive-v2。这份 stdout 不会反向覆盖迁移报告，也不证明所有映射语句已执行。

额外控制为实际解析的源码字符串变体：直接 if 条件改变、重复 return、return 进入 while，都被拒绝对应；这些变体没有执行或重新采集覆盖率。实验不是通用 AST diff 或跨版本运行时事实迁移器。

详见 [第九轮源码笔记](../../notes/11-ast-intervals.md)。
