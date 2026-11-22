# 网上柳州 · Windows 11 多 Agent 自动化开发系统

**交付类型：可复制运行的工程脚手架，非已在你的电脑/账号上安装的服务。**

本项目将 Claude Code（架构/设计）、Codex（工程实现）、Grok Build（外部数据研究）接入 GitHub Issues 队列。每个 Issue 独立 Git Worktree；完成后自动检查、提交开发分支、推送、创建 **Draft PR**；**永不自动合并 `main`**。

当前网页画面是 Three.js **演示白模，不是柳州真实地图**。真正地图数据须由首批 Issue 验证。

## 一、准备 Windows 环境

1. 用管理员权限打开 PowerShell，按需安装缺少的工具；已安装可跳过。完成后**关闭重开 PowerShell 7**。

```powershell
winget install --id Git.Git -e
winget install --id GitHub.cli -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Microsoft.PowerShell -e
winget install --id Anthropic.ClaudeCode -e
npm.cmd install -g @openai/codex
npm.cmd install -g @xai-official/grok
```

如果使用已有 Claude Code、Codex、Grok Build，**不要重复装**。Grok Build 官方另提供 PowerShell 安装脚本 `https://x.ai/cli/install.ps1`；建议优先通过官方 npm 包安装，并核对来源。

2. 打开 **PowerShell 7**（开始菜单搜索 PowerShell 7，或运行 `pwsh`）。分别检查：

```powershell
pwsh --version
git --version
gh --version
node --version
npm.cmd --version
claude --version
codex --version
grok --version
```

3. 分别在交互式终端里登录：

```powershell
gh auth login
claude
codex
grok
```

GitHub 登录选 GitHub.com、HTTPS、浏览器登录。Claude/Codex/Grok 根据提示登录你对应的会员账号。**会员订阅权限、CLI 可用额度、API 计费相互独立；不要为了完成本教程随意设置付费 API Key。**

4. **建议在非管理员权限的 PowerShell 7 下运行调度器。** 确认 Git 作者信息：

```powershell
git config --global user.name "你的GitHub昵称"
git config --global user.email "你绑定到GitHub的邮箱"
```

## 二、解压到本地项目目录

下载 ZIP，在文件资源管理器里解压，移动/重命名文件夹为：

```text
C:\Projects\liuzhou-online
```

PowerShell 7 中运行：

```powershell
cd C:\Projects\liuzhou-online
pwsh -NoProfile -File .\scripts\doctor.ps1
```

**期望结果**：Git、gh、node、npm、pwsh、claude、codex、grok 全部 `[OK]`。初次执行时 `Repository` 未初始化属于正常情况。

## 三、先验证网页基础工程

```powershell
npm.cmd install --ignore-scripts --no-audit --no-fund
npm.cmd test
npm.cmd run build
npm.cmd run dev
```

浏览器打开终端显示的本地网址（通常 `http://127.0.0.1:5173/`）。应看到“网上柳州”字样、网格白模、可拖动相机、FPS 状态。**这里的楼房是测试模型，不是柳州地标。**

`Ctrl+C` 停止 Vite 开发服务器。

## 四、创建私有 GitHub 仓库和首批 Issues

在仓库根目录执行：

```powershell
pwsh -NoProfile -File .\scripts\bootstrap.ps1 -CreateRepo -SeedIssues
```

该操作会：
- 将当前目录初始化为 Git 仓库并提交初始版本；
- 创建名为 `liuzhou-online` 的**私有** GitHub 仓库；
- 推送 `main` 初始提交；
- 创建 `agent:claude`、`agent:codex`、`agent:grok` 与 `state:*` 标签；
- 创建三项真实任务：Grok OSM 数据审计；Claude 地图架构；Codex 基于前两项的地图开发。

若你的 GitHub 账号已存在同名仓库，脚本不会自动覆盖它；请手动检查远端地址，避免误上传到旧项目。**不要在已经有重要文件的仓库直接执行本脚本。**

首批任务的依赖关系：

```text
Grok #研究任务 ─┐
              ├─(两个任务对应的 PR 经你批准合并，Issues 关闭)─> Codex #地图实现任务
Claude #架构任务┘
```

`bootstrap.ps1` 设计为第一次建仓使用，重复 `-SeedIssues` 可能产生重复 Issues，请勿重复执行。

## 五、执行 CLI 单项只读验收（强烈建议）

在 `C:\Projects\liuzhou-online` 分别运行：

```powershell
claude -p "只回答 CLAUDE_OK，不修改文件" --permission-mode dontAsk --permission-prompts none
codex exec "只回答 CODEX_OK，不修改文件"
grok --no-auto-update -p "只回答 GROK_OK，不修改文件" --tools "read_file,grep,list_dir" --output-format plain
```

成功标准：三个工具都能正常返回内容、没有认证失败。**本次调用可能消耗订阅额度**；如果任意一个失败，先检查对应 CLI 登录和订阅限制。

## 六、先干跑一次，保证不产生写操作

```powershell
node .\scripts\dispatcher.mjs --once
```

此为 `DRY-RUN`，只读取 GitHub Issues，显示预计任务分配，不创建 Worktree，不提交代码，不修改标签，不调用模型。应看到：

```text
DRY-RUN #<研究Issue号> -> grok
DRY-RUN #<架构Issue号> -> claude
Waiting #<实现Issue号>: dependency Issues remain open
```

如果未显示任务，检查 GitHub 标签和当前工作目录，执行 `gh issue list` 查看任务。

## 七、第一次真实自动化测试

在项目根目录运行：

```powershell
node .\scripts\dispatcher.mjs --live --once
```

调度器将同时启动一个 Grok 研究任务、一个 Claude 设计任务；由于依赖未满足，Codex 地图任务不会启动。它们使用隔离 Worktree，自动产生草稿 PR，**不会自动合并**。

可在仓库 Issues 和 Pull requests 页面查看：
- Issue 标签从 `state:ready` → `state:running` → `state:review`；
- 成功时每个任务会有 Draft PR；
- 失败时标签变为 `state:blocked`，Issue 留下错误信息；
- 每个本地 Worktree 位于 `C:\Projects\liuzhou-online-agent-worktrees\<agent>-issue-<编号>`；
- 本地日志在 `C:\Projects\liuzhou-online\.agent-runtime\logs\`。

**只有你**在 GitHub 阅读代码/报告、确认 CI 通过后，手动把 Draft PR 标记 Ready for review，点击 Merge。PR 正文中的 `Closes #编号` 使相关 Issue 在成功合并后关闭，Codex 的依赖才解除。

## 八、持续任务调度

```powershell
node .\scripts\dispatcher.mjs --live --watch
```

- 每隔 45 秒检查一次 GitHub Issues；
- 最多三个 Agent 并发，每个 Agent 同时只处理一个 Issue；
- 每轮启动最多六个任务，然后结束，需要你复核后再开启新一轮；
- 同一电脑通过 `.agent-runtime/dispatcher.lock` 防止启动两个调度器；
- `Ctrl+C` 请求停止继续派发并等待当前运行的任务完成。若任务卡住，可关闭终端并手动核查残留进程。

调整 `scripts/settings.json` 可改变 `pollSeconds`、`maxTaskMinutes`、`maxParallelAgents`、`maxTasksPerSession`。**注意该设置本身位于主仓库，修改它应由你审查后提交。**

### 可选：开机登录自动启动（先完成人工测试）

使用 Windows 任务计划程序：
1. 在开始菜单搜索“任务计划程序”，选择“创建任务”。
2. 常规：命名 `Liuzhou Agent Dispatcher`，以你自己的 Windows 账户运行，**不要勾选最高权限**。
3. 触发器：用户登录时，建议延迟 2 分钟。
4. 操作：“启动程序”。程序为 `pwsh.exe` 的实际完整路径（`(Get-Command pwsh).Source` 查看）；参数为：

```text
-NoProfile -NonInteractive -File "C:\Projects\liuzhou-online\scripts\start-watch.ps1"
```

5. 设置里不要允许多个同名任务同时运行；选“如果任务已在运行，则不启动新实例”。
6. Windows 登录后检查 GitHub Issue 标签及本地日志。个人电脑需保持开机并保持网络可用。

## 九、新增任务：直接使用 GitHub Issue

在 GitHub 网页创建 Issue，然后**只添加一个** Agent 标签，以及 `state:ready`：

- `agent:grok`：数据调查、开放地图素材、技术调研；
- `agent:claude`：设计、架构、验收文档；
- `agent:codex`：源码、测试、性能；
- `state:ready`：允许进入自动执行队列。

Issue 正文需写清：目标、输入、允许的输出文件、明确验收标准。需要前置任务时，在正文单独写一行：

```text
Depends-On: #12, #13
```

这些依赖 Issue **必须关闭**才能启动；建议通过 PR 合并自动关闭，保证上游成果已经进入 main。

调度器只处理当前登录的 GitHub 操作人本人创建的 Issue，避免外部 Issue 注入未经授权的任务。

## 十、失败恢复

| 现象 | 检查 | 修复 |
|---|---|---|
| `gh auth` 失败 | `gh auth status` | `gh auth login` 重新授权 |
| 某 CLI 登录失败 | 手动运行 `claude`/`codex`/`grok` | 按 CLI 提示登录；确认计划额度 |
| `state:blocked` | `.agent-runtime/logs/issue-N-*.log` 与 Issue 评论 | 修复故障后将标签改成 `state:ready` 重试；原 Worktree 会尝试复用 |
| 工作区分支不匹配 | `git worktree list` | 保留更改并手动核查，勿直接删除目录 |
| `dispatcher.lock` 存在 | 任务管理器确认没有运行中的 dispatcher | 确认没有进程后手动删除 `.agent-runtime/dispatcher.lock` |
| `Codex` 构建失败 | 查看日志中 npm/test/build 报错 | 原分支保留，修复后再试 |
| PR 已推送但创建失败 | `gh pr list --head <分支>` | 手动补建 Draft PR，不要盲目重跑已经 commit 的任务 |
| GitHub CI 失败 | PR → Checks | 修复并更新该分支，重新运行检查；不要批准不通过的代码 |

手动查看 Worktree：

```powershell
git worktree list
gh issue list --state open
gh pr list
```

## 十一、安全边界（一定要读）

- **没有启用自动合并**：源代码不包含 `gh pr merge`；调度器只创建 Draft PR。
- **权限隔离是工程约束，不是强安全虚拟机**。CLI 和本地测试可能执行代码。务必只对自己信任的私有仓库运行；要处理外部贡献代码，建议升级到 Windows Sandbox、Hyper-V/虚拟机或隔离容器执行。
- Codex 写入限定工作区；Grok 的工具仅允许网页搜索/抓取，不能用文件工具读取本地文件；研究结果由受信任的 PowerShell 包装器写文件；Claude 的非交互工具受到允许列表限制。调度器在 Git 提交前再检查变更文件路径。
- 不会自动把日志、认证 token 上传 GitHub；`.agent-runtime` 被 `.gitignore` 忽略。
- 代码自动运行时无法保证无恶意行为：`npm run build` 可执行项目脚本。因此本系统适合由你主导的实验性项目，不适合在存放个人敏感资料的电脑上无监督运行。
- GitHub 私有仓库的分支保护/Rulesets 受 GitHub 计划影响。若你的计划不支持私有分支强制保护，则“人工合并”由脚本不合并 + 你的操作纪律实现，**不等于 GitHub 服务器强制禁止所有直接推送**。
- 当前调度器使用当前用户的 GitHub CLI 身份，**不具备独立的最小权限机器人 GitHub 身份**。如需真正的生产级强制保护，另建权限受限的 GitHub App/机器用户和隔离 runner。
- Grok 联网搜到的网页是**不可信数据**。Agent 的规则和调度器的文件范围限制优先于网页中的指令；自动化工具仍可能被提示注入误导，重要结论需要人工复核。
- 每轮最多六个任务不是对账单额度的硬限制。会员用量按各服务规则扣减，`maxTaskMinutes` 是最大运行时间而非成本上限。

## 十二、项目源码和扩展方向

```
liuzhou-online/
  scripts/
    bootstrap.ps1         # 初始 GitHub 仓库、标签、任务创建
    doctor.ps1            # 环境检查
    dispatcher.mjs        # Issue 队列、依赖、Worktree、日志、PR 管理
    worker.ps1            # 三个 CLI 的调用包装器
    verify.ps1            # Codex 任务自动 npm 检查
    start-watch.ps1       # Windows 登录任务入口
    settings.json         # 并发、轮询和执行上限
  docs/                   # 研究、架构、决策
  src/                    # Three.js 初始场景（非柳州地图）
  tests/                  # 工程 smoke tests
  .github/workflows/ci.yml
  AGENTS.md
  CLAUDE.md
```

### 进阶

初版先运行「每次最多六项」的本地调度。等真实地理数据源、CLI 额度和 GitHub 审核机制经过验证后，再考虑 Issue 自动依赖图、PR 自动复审、隔离执行器及成本计量仪表板；不推荐一开始就放开持续自我派发的无限循环。
