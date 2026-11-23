# 开发状态

## Milestone 0: 工程基础 ✅

- [x] GitHub 仓库与 Issue 队列
- [x] Agent 工作约定 (AGENTS.md, CLAUDE.md)
- [x] 文档体系 (docs/)
- [x] 自动化测试框架
- [x] 构建系统 (Vite + TypeScript)

## Milestone 1: 真实柳州地图 ✅（已实机验收通过）

### 数据基础
- [x] 五星街 500 m OSM 数据审计 (Grok, PR #5)
- [x] 水系/高度/地下数据核验 (Grok, PR #13)
- [x] 架构与坐标系设计 (Claude, PR #7)
- [x] 美术规范定稿与宽幅/Overture 补充规范 (`docs/art-direction.md`, `docs/geodata-audit.md`)

### 实现
- [x] Blender MCP 验证与 34 栋 OSM 基准 GLB 白模 (Codex, PR #17 / #18)
- [x] 宽幅 OSM + Overture Maps 融合数据加载（2891 栋建筑 = 240 OSM + 2651 ML；非索引分批合批，修正 Z 轴朝向与 `[top, side]` 材质组，#22）
- [x] OSM 道路网络连续条带渲染与按类合批（400 条道路，已恢复 73 条 `primary` 主干道，#22）
- [x] 柳江水系与柳湖/罗池闭合水体渲染（修正法线朝向与 Z 轴镜像，抬高避开地面共面，#22）
- [x] 光照与相机边界（ACESFilmic + PCFSoft 宽幅阴影 + 宽幅雾距 + 防钻地/防拉远全黑，#22）
- [x] HUD / 指北针（可点击重置朝北、每帧平滑更新、不遮挡顶栏）/ 6 项图例 / Overture + ODbL 常驻署名 / 移动端 375×667 零重叠（#23）
- [x] `src/coordinate.ts` WGS84 ↔ 本地米制坐标转换实装（锚点 `node/6038500119`，#23）

### 测试与实机复验（2026-11-23）
- [x] **55/55** 自动化测试通过（含坐标、非索引建筑合并/朝向、道路连续条带/合批与主干道、水体法线/朝向单测）
- [x] TypeScript `tsc --noEmit` 0 错误，`npm run build` 成功
- [x] 浏览器实机复验通过（0 控制台报错，**Draw Calls 29** `< 200`，**180 FPS**，直接加载 `Overture 2891`，桌面 1280×800 与移动端 375×667 UI 零重叠）
- [ ] 待补遗留项（非 M1 阻断，可并入 M2/后台审计）：Overture 原始 GeoJSON SHA-256 与 Zenodo 8174931 独立许可交叉核验

## Milestone 2: 角色系统 (下一步 — 可正式启动)
- [ ] 第三人称角色控制
- [ ] WASD 移动 + 跳跃
- [ ] 摄像机跟随
- [ ] Rapier 碰撞（地面 + 建筑）

## Milestone 3: 车辆系统 (未开始)
## Milestone 4: 多人系统 (未开始)
## Milestone 5: 城市内容 (未开始)
