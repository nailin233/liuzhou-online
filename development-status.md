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

## Milestone 2+: 都市昼夜画风与柳州实景细节精细化（Phase A+）✅（已实机验收通过）

- [x] 24H 动态天空穹顶、低模白云与太阳阴影跟随（[SkyAtmosphere.ts](src/SkyAtmosphere.ts)：`晴日 10:25` / `日落 17:55` / `夜景 21:30` / `数据检视 AUDIT` 一键切换）
- [x] 多层城建天际线与精细立面（[WuxingBuildings.ts](src/WuxingBuildings.ts)：漫游模式按真实占地/业态/大厦名生成多层楼高 + 临街彩色底商雨棚橱窗 + 带框窗格 + 38m+ 玻璃幕墙 + 夜景暖灯；「数据检视」瞬切 3m 缺失占位与洋红斜纹）
- [x] 真实柳州公园、体育场与商业广场（[LanduseLayer.ts](src/LanduseLayer.ts) + `landuse.json`：柳侯公园、马鞍山公园、蟠龙山公园、驾鹤小桃源、柳州市体育场、五星步行街广场等 56 块真实 OSM 面）
- [x] 真实柳州路牌、雕塑与地标浮标（[LandmarksAndSigns.ts](src/LandmarksAndSigns.ts) + `landmarks.json`：「五星街」等 10 块中国蓝白路牌、「柳州五星」雕塑、地王国际财富中心/华侨大厦/工贸大厦/柳州博物馆/文惠桥/文昌桥/红光大桥等 28 处地标）
- [x] 柳州街头高密度细节（[StreetProps.ts](src/StreetProps.ts)：三簇饱满粉花洋紫荆 + 绿荫行道树 + 发光路灯 + 蓝白机非隔离护栏 + 路口白色斑马线，全 `InstancedMesh` 仅 7 Draw Calls）
- [x] `C` 三视角切换、`R` 脱困、`H` 抖音一键纯净录屏模式与磨砂玻璃 HUD
- [x] **59/59** 自动化测试通过、`tsc --noEmit` & `vite build` 通过、浏览器实机 **178 FPS / Draw Calls 136**（鸟瞰 197，`< 200` 预算）/ 0 报错

## Milestone 3: 车辆系统 (下一步 — 可正式启动)
- [ ] 电动自行车 / 小汽车载具模型与物理驾驶
- [ ] 角色上车 / 下车无缝切换
- [ ] 道路行驶与建筑碰撞

## Milestone 4: 多人系统 (未开始)
## Milestone 5: 城市内容 (未开始)
