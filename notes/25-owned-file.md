# 第二十三轮：真实文件句柄的关闭确认

日期：2026-11-05（Asia/Shanghai）。固定 REA 6.4.0 / `c22111eca2c4bc84a084f12711f405b3e7422a40`。

## 源码学习与本轮选择

上一轮模拟了 reader 的重复关闭策略，本轮沿真实目录 reader 的清理链向下验证文件 owner。`src/artifacts/javascript/JavaScriptArtifactReader.ts` 的 directory 分支创建 DirectoryArtifactReader；`src/artifacts/DirectoryArtifactReader.ts` 的 open 创建 OwnedFileHandle，#closeFile 调用 owner.close 成功后才移除映射。

`src/filesystem/OwnedFileHandle.ts` 明确区分 open、closing、closed、failed。closed 返回成功 Promise，closing 复用 attempt，failed 保留原错误。若尚未确认 close 而 fd 已小于零，记录 sticky failure；#attemptClose 的失败在 fd 仍有效时恢复 open，否则转 failed。

为获得直接文件证据，本轮执行固定上游 OwnedFileHandle 构建产物，操作自建临时文件。没有执行完整 DirectoryArtifactReader，因此目录 reader 的上述链路仍是源码依据，不冒充运行验证。

## 三组实际结果

| 场景 | 两次 close | Promise 引用相同 | 最后 fd |
| --- | --- | --- | --- |
| owner 顺序关闭 | 都成功 | 否 | -1 |
| owner 同步发起两次关闭 | 都成功 | 是 | -1 |
| 原始 handle 先被外部关闭 | 都拒绝 | 否 | -1 |

第三组两次拒绝的 reason 是同一对象，消息为 File handle was invalidated before this owner confirmed its close。两次 reject Promise 不同，不影响 sticky error 身份。第一组第二次返回成功，与第二组共享进行中的 attempt 是不同规则。

每组初始 fd>=0，最终 fd=-1；目标通过 fs/promises 创建临时目录和受控文本，finally 关闭残余有效 handle，并只删除自己创建的临时目录。没有伪造 fd、注入系统 close 错误或访问用户文件。

观察：物理句柄失效和 owner 已确认成功关闭是两种证据。推断：不能仅凭 fd=-1 把所有清理失败标为成功，否则外部失效会抹掉 owner 的确认缺口。私有状态不直接读取，结论由公开结果、错误身份、fd 和源码对照支持。不从一次成功调用推断全部 OS 资源已释放。

## 静态证据、覆盖率和迁移

真实 REA CLI 先分析自建目标，再以独立 Node strict rejection 模式采集 V8 原始 coverage。报告保留固定提交、OwnedFileHandle.ts 和实际执行 JS 摘要、静态 observer 源文件摘要及执行后摘要，检查 Babel AST/V8 UTF-16 函数范围一致。Evidence、stderr、报告和原始 coverage 在忽略的 results/23-owned-file。

observer 与上一轮文本相同，本轮实际 count=6。上下文由模拟 reader wrapper 改为真实文件 owner 确认状态，不迁移历史覆盖率。保存旧文件摘要、旧 AST 全函数未迁移范围、目标 unknown/count=null。未加载旧 coverage，不编造旧计数；目标 count 是新执行事实。semantic_unknowns 原样保留，不声称静态图完整解析动态 import 的真实实现。

## 验证与限制

npm run lab、npm run lab:owned-file 通过；CI 增加本轮命令。断言初始/最终 fd、顺序/并发 Promise 身份、成功/拒绝、sticky reason 身份和 finally 次数。

未覆盖系统 close 真正失败后 fd 仍有效的重试、fd 已失效的失败分支、关闭期间读操作、完整 DirectoryArtifactReader 流关闭和跨平台句柄差异。下一轮可用受控 Handle 端口单独验证这两个失败分支，并明确它们是注入故障而非本轮真实文件证据。
