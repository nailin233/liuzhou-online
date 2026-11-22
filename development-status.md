# 开发状态

## Milestone 0: 工程基础 ✅

- [x] GitHub 仓库与 Issue 队列
- [x] Agent 工作约定 (AGENTS.md, CLAUDE.md)
- [x] 文档体系 (docs/)
- [x] 自动化测试框架
- [x] 构建系统 (Vite + TypeScript)

## Milestone 1: 真实柳州地图 ✅ (待 PR 合并)

### 数据基础
- [x] 五星街 OSM 数据审计 (Grok, PR #5)
- [x] 水系/高度/地下数据核验 (Grok, PR #13)
- [x] 架构与坐标系设计 (Claude, PR #7)
- [x] 美术规范定稿 v1 (Claude, PR #11)

### 实现
- [x] Blender MCP 验证 (Codex, PR #17 → Issue #16)
- [x] 34 栋 OSM 建筑白模 GLB 生成 (Codex, PR #18 → Issue #17)
  - 来源: OSM API，bbox 109.4062238,24.3135183,109.4111526,24.3180329
  - 全部 `heightSource: missing`，占位高度 3m
  - missing 斜纹 shader (45°, #D9549B, 世界坐标)
- [x] OSM 道路网络渲染 (DSH, feature/dsh-milestone1)
  - 30 条道路（排除台阶/地下/站台）
  - 按类型着色: major/minor/service/pedestrian/path
- [x] 光照升级 ACESFilmic + PCFSoft 阴影 (DSH)
- [x] 地面/区域边框/100m 网格 (DSH)
- [x] HUD: FPS/调用数/三角形/缺失建筑计数 (DSH)
- [x] 指北针 (按 N 重置朝北) (DSH)
- [x] 图例 (按 L 切换) (DSH)
- [x] ODbL 常驻署名 (DSH, 链接 openstreetmap.org/copyright)

### 测试
- [x] 47/47 自动化测试通过
- [x] TypeScript 编译无错误
- [x] npm run build 成功

### 验收状态
- [x] 浏览器可加载真实 OSM 地图
- [x] 道路与真实柳州地理位置对应
- [x] 建筑位置能对应真实建筑数据
- [x] 地图可以自由浏览
- [x] 无明显坐标偏移
- [x] 有地图数据来源与许可记录 (manifest.json, roads.json)
- [ ] PR 待用户审批合并

## Milestone 2: 角色系统 (下一步)
- [ ] 第三人称角色控制
- [ ] WASD 移动 + 跳跃
- [ ] 摄像机跟随
- [ ] Rapier 碰撞（地面 + 建筑）

## Milestone 3: 车辆系统 (未开始)
## Milestone 4: 多人系统 (未开始)
## Milestone 5: 城市内容 (未开始)
