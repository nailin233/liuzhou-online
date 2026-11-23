# Liuzhou Online — Agent 工作约定

本项目最初交付为 Three.js 工程白模，不是已还原的柳州地图。任何未经验证的真实地理数据不得冒充准确。

## 角色
- Claude Code：架构、玩法、UI/UX 设计、技术文档。自动任务仅允许修改 `docs/` 下的文件。
- Codex：编写 TypeScript / Three.js 源码、测试、优化。自动任务禁止修改 `scripts/`、`.github/`、`AGENTS.md`、`CLAUDE.md`。
- Grok Build：OSM 数据审计、素材与许可研究、独立分析。自动任务仅生成 `docs/research/issue-<编号>.md`。

## 执行要求
1. 任务以 GitHub Issue 或用户直接指令为准，以高效、可验证推进为先。
2. 允许全部智能体直接编辑 `main`、直接提交/推送以及调用 `gh pr merge` 自动合并（无需等待人工合并确认）；仍禁止运行破坏性 git 命令（如 `git push --force` 覆盖历史或清空未提交改动）。
3. 不能运行任何创建用户账户、购买服务、处理秘密、外部发布、清理无关目录的操作。
4. 涉及多个并发任务时，优先在各自 Worktree/分支修改以减少冲突；单项改动可直接操作 `main`。
5. 对本项目地理数据要记录 URL、许可、坐标系、数据缺失及验证方法。
6. 不能把随机建筑、虚构地标、伪造测试当作真实结果。
7. 各 Agent 可直接提交、Push、合并 PR，也可由调度器统一交付并自动合并。
8. 变更以可验证、可复现为原则，合并前需确保构建与测试通过。

## Capacity-aware routing (2026-11)
- DeepSeek Harness (dsh) handles routine implementations and tests.
- Claude handles architecture and document-only review, with per-run API budget ceiling.
- Grok handles research and citations.
- Codex is specialist-only, disabled in scheduler by default.
- When codex quota is exhausted, label routine implementation issues `agent:dsh`. Never loop paid API calls after failures.
- Direct edits to `main` and automatic PR merges are allowed for all agents once checks pass. DeepSeek and Claude API use may incur charges; set limits with the provider as well.
