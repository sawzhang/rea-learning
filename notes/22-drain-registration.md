# 第二十轮：drain 期间新增 owner 与迭代边界

完成日期：2026-11-02（Asia/Shanghai）。固定 REA 6.4.0 / `c22111eca2c4bc84a084f12711f405b3e7422a40`，不升级上游。

## 源码问题

`src/artifacts/ArtifactResourceScope.ts` 的 #pending 是 Set。release 失败执行 #pending.add(owner)，不检查 #draining 或 #closed；#drainAndRetry 直接 for-of #pending，在每次 cleanup 中 await，成功才 delete，失败收集后继续。因此需要验证：一次 drain 是否只处理启动时的 owner 快照。

本轮不依据通用容器直觉作结论，直接动态加载固定上游构建产物，使用自建 reader.close 适配器验证。失败资源由 `src/artifacts/ArtifactReader.ts` 的 cleanupObservation 保留。

## 受控过程和观察

A 首次 release 失败。两位调用者同时 retryCleanup，A 第二次 close 挂在显式 gate。checkpoint 确认 callsA=2、callsC=0，再选择在 gate 打开前或 drain 完成后调用 C 的 release。C 首次总是失败，后续按场景成功或持续失败。所有 rejection 立即接入 allSettled，Node strict 模式运行。

| 场景 | 第一轮结束 C 调用数 | 下一轮结束 C 调用数 | 最后 C 归属 |
| --- | --- | --- | --- |
| A 挂起时加入 C | 2 | 2 | released |
| drain 完成后加入 C | 0（尚未 release） | 2 | released |
| A 挂起时加入、C 持续失败 | 2 | 3 | adapter-owner |

调用数包含 C 首次 release。第一种情况下，同一次 drain 在 A 恢复后继续尝试新加入 C，C 第二次成功；下一轮没有再次调用已成功的 A/C。第二种在第一轮结束快照之后才 release C，第二轮才重试。第三种两轮均失败，cleanup.resources 精确为 ['C']，A 成功不再重试，C released=false。

每轮两位调用者共享同一个 Promise，两轮之间 Promise 引用不同。A 总调用数保持 2。观察支持：这个固定实现的 drain 不是启动时 owner 的封闭快照。推断：报告 drain 成败时需要同时保留 owner 加入时机，不能把 drain 开始时资源清单当作完整处理集合。

## 可审计证据和映射边界

真实 CLI 先分析自建目标；独立 V8 coverage 与事件日志记录实际执行。生成的 Evidence、stderr、原始 coverage、报告保存在忽略的 results/20-drain-registration。报告核对固定提交、上游 TS 和执行 JS 摘要、静态 observer 节点文件摘要及执行后源码摘要；V8 范围须等于 Babel AST 的 UTF-16 范围。

observeCleanup 与上一轮完整文本相同，本轮实际 count=12。但调用场景由 active/close 变为 owner 加入时机，历史覆盖率不迁移。保留旧文件摘要、旧 AST 全函数未迁移范围、目标整函数 unknown/count=null；没有读取旧 coverage，不伪造旧计数。目标新 count 是独立执行证据，不能补进旧历史。

图的 semantic_unknowns 原样保留。动态 import 不代表静态分析完整解析上游类。#pending 私有集合不直接读取；owner 保留由错误、后续调用及适配器状态与源码共同支持。适配器仅模拟内存资源，不证明真实 reader 或 OS 资源释放。

## 验证、未知和后续

运行 npm run lab、npm run lab:registration；CI 添加本轮。断言覆盖加入阶段、共享与新一轮 Promise、精确调用数、成功 owner 不重试、失败归属及 observer finally。

尚未覆盖 drain 即将完成时的微任务竞争、持续新增造成不收敛、同 owner 删除再加入、close 后 release、新旧 owner 使用相同 resource 字符串、真实系统资源。没有把 gate 控制的三个交错推广为所有调度顺序。下一步可验证 owner 对象身份与 resource 字符串去重的区别，以及清理错误的资源摘要能否表达多个同名 owner。
