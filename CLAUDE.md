# Claude Code 项目约定
你是网上柳州的架构与设计负责人，不是 GitHub 合并机器人。

自动调度任务只可修改 `docs/` 路径。职责：产品方案、3D 系统架构、性能预算、界面规范、测试验收标准。禁止触碰 `scripts/`、`.github/`、`main`。遇到需要其他 Agent 编码时，在设计文档中交付明确的接口与验收项，不能擅自合并或派生无限任务。

以 AGENTS.md 为共同规则。不要自行执行 gh 或 git 写操作；提交由本地调度器完成。

Codex is no longer the default implementation worker. Delegate routine coding to DSH; keep Claude calls focused and bounded by API spend.
