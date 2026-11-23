# Agent 任务交接记录

本文档记录各 Agent 之间的任务依赖、交付状态与工作交接。

## 交接原则
1. 变更须可验证、可复现，合入前须通过构建、自动化测试及实机验收。
2. 所有引用的地理数据必须记录来源 URL、许可、坐标系、缺失项与验证方法。
3. 多 Agent 并发改动时通过独立 Worktree/分支与互不重叠的文件边界避免冲突。
4. 外部付费 Agent 失败后不得循环重试，先定位根因再决定恢复策略。

---

## 已合入 `main` 的历史交付（截至 `953a927`）

| PR / 提交 | 来源 | 交付内容 | 状态 |
|---|---|---|---|
| PR #5 (`aa1ae0b`) | Grok | 五星街 500 m OSM 道路与建筑审计 (`docs/research/issue-1.md`) | 已合并 |
| PR #7 (`d1d213c`) | Claude | 坐标与地图管线架构设计 (`docs/architecture.md`) | 已合并 |
| PR #13 (`66c0185`) | Grok | 水系/绿地/高度/地下增量核验 (`docs/research/issue-8.md`) | 已合并 |
| PR #11 (`65151d8`) | Claude | M01 美术与界面规范定稿 v1 (`docs/art-direction.md`) | 已合并 |
| PR #6 (`2fb3c22`) | Codex | Three.js 基础场景与视口测试 | 已合并 |
| PR #15 (`2af5c25`) | DSH | 集成 DeepSeek Harness (DSH) 与调度器配置 | 已合并 |
| PR #17 (`e433984`) | Codex | Blender MCP 验证与测试模型 | 已合并 |
| PR #18 (`4bc7889`) | Codex | 五星街 34 栋 OSM 建筑白模 GLB + 回归测试 | 已合并 |
| PR #19 (`fc6277f`) | DSH | M1 基础场景（道路、光照、地面、HUD、指北针、图例、ODbL 署名） | 已合并 |
| PR #20 (`abcd1a7`) | DSH | 宽幅 2 km×2.8 km OSM 数据（240 栋建筑 + 柳江水系 + 332 条道路） | 已合并 |
| PR #21 (`f3cc639`) | DSH | Overture Maps 整合（2891 栋建筑 = 240 OSM + 2651 ML） | 已合并 |
| PR #25 (`881c0fb`) | 运维 | 允许 `PUBLIC` 仓库运行本地调度器 | 已合并 |
| PR #26 (`09cafd4`) | 运维 | 更新 `AGENTS.md`/`CLAUDE.md`/`settings.json` 放宽主干编辑与自动合并规则 | 已合并 |
| `953a927` | 运维 | 修复 `scripts/dispatcher.mjs` 并发 `prepareWorktree` `.git/config` 锁竞争 | 已合入 |

---

## 当前阶段交接（Milestone 2 角色系统已通过，可开启 Milestone 3）

> **M2 门禁结论**：**已通过（PASSED，2026-11-23）**，58/58 自动化测试通过（Linux + Windows），实机复验 0 报错 / **180 FPS** / **Draw Calls 100** / 2891 栋 Rapier 碰撞体生效 / 3 套动漫角色配色与步行↔鸟瞰切换正常 / 375px 移动端 0 重叠，**正式放行进入 Milestone 3（车辆系统）**。

## 历史收口记录（Milestone 1 实机验收收口）

> **M1 门禁结论**：**已通过（PASSED，2026-11-23）**，55/55 自动化测试通过，实机复验 0 报错 / Draw Calls 29 / 180 FPS / 桌面与 375px 移动端零重叠，**正式放行进入 Milestone 2（角色系统）**。

| Issue | 负责人 | 文件边界 | 核心交付 | 状态 |
|---|---|---|---|---|
| **#22** | 冲刺收口（DSH 缺 `DEEPSEEK_API_KEY`） | `WuxingBuildings.ts`, `RoadNetwork.ts`, `WaterNetwork.ts`, `SceneManager.ts`, `lighting.ts`, `regen_roads_wide.py`, `roads.json`, `tests/` | 修复 4 项 P0：Overture 非索引合并与 Z 轴镜像/材质组、道路连续条带合批与 400 条主干道、水体 `+Y` 法线与抬高/镜像、首屏雾距与相机极角/距离上限 | ✅ 已完成并复验通过 |
| **#23** | 冲刺收口（同上） | `MapHUD.ts`, `style.css`, `main.ts`, `coordinate.ts`, `tests/` | 修复指北针遮挡与点击事件、375 px 移动端零重叠、Overture 署名与 6 项图例、加载失败提示，实装 `coordinate.ts` 及单测 | ✅ 已完成并复验通过 |
| **#24** | Claude → 验收回收修正 | `docs/**/*.md` | 对齐宽幅地图与 Overture 美术规范、地理数据台账、交接与复验通过状态 | ✅ 已完成 |

---

## Agent 能力与成本护栏

- **DSH**：常规 TypeScript / Three.js 修复、功能开发与回归测试。
- **Claude Code**：架构设计、规范与文档审查（单次预算受 `claudeMaxBudgetUsd: 0.75` 约束；失败后不自动重试）。
- **Grok Build**：外部数据源与许可独立核验，输出 `docs/research/issue-<N>.md`。
- **Codex**：复杂重构或疑难专项，调度器默认关闭（`enableCodex: false`）。

## 更新日志
- 2026-11-22：创建交接记录文档。
- 2026-11-23：同步至 `main`（PR #19–#26 后）真实状态，登记 M1 验收阻塞项与 #22/#23/#24 交接。
