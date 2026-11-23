# 开发状态

## Milestone 0: 工程基础 ✅

- [x] GitHub 仓库与 Issue 队列
- [x] Agent 工作约定 (AGENTS.md, CLAUDE.md)
- [x] 文档体系 (docs/)
- [x] 自动化测试框架
- [x] 构建系统 (Vite + TypeScript)

## Milestone 1: 真实柳州地图 ✅（已实机验收通过）

- [x] 五星街 500 m OSM 基准审计与 34 栋 GLB 回归测试 (PR #5 / #13 / #18)
- [x] Overture Maps 2891 栋建筑 + 400 条连续道路（含恢复的 `primary` 主干道）+ 柳江/柳湖水系
- [x] `src/coordinate.ts` WGS84 ↔ 本地米制坐标实装（锚点 `node/6038500119`）
- [x] HUD / 指北针（可点击朝北）/ 6 项图例 / Overture + ODbL 署名 / 375×667 移动端零重叠

## Milestone 2: 角色系统 ✅（已实机验收通过）

- [x] 原创动漫风格第三人称角色（[AnimeCharacter.ts](src/AnimeCharacter.ts)：三阶赛璐璐 `MeshToonMaterial` + 墨线轮廓 + 动漫五官/刘海/马尾/围巾/背包 + 呼吸/步行/奔跑/跳跃/落地缓冲动画）
- [x] 3 套实时配色切换（`青绿` / `暖橙` / `亮白`，支持界面一键切换与 `aria-pressed` 状态同步）
- [x] 默认直接落地五星街步行模式 + `V` / 按钮一键切换鸟瞰总览（[PlayerController.ts](src/PlayerController.ts)：WASD/方向键相对相机移动 + Shift 奔跑 + Space 跳跃 + 鼠标拖动环绕跟踪镜头）
- [x] Rapier 3D 物理碰撞（[PhysicsWorld.ts](src/PhysicsWorld.ts)：`@dimforge/rapier3d-compat` 地面静态碰撞体 + 2891 栋建筑精确多边形外墙/屋顶 Trimesh BVH + `KinematicCharacterController` 贴墙滑动与重力落地）
- [x] **58/58** 自动化测试通过（Linux + Windows 双环境）+ `tsc --noEmit` + `vite build` + 浏览器实机复验通过（**180 FPS**、**Draw Calls 100** `< 200`、0 报错、桌面 1280×800 与移动端 375×667 零重叠）

## Milestone 3: 车辆系统 (下一步 — 可正式启动)
- [ ] 电动自行车 / 小汽车载具模型与物理驾驶
- [ ] 角色上车 / 下车无缝切换
- [ ] 道路行驶与建筑碰撞

## Milestone 4: 多人系统 (未开始)
## Milestone 5: 城市内容 (未开始)
