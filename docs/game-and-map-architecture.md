# 游戏架构与地图数据处理方案

## 文档状态
- 版本：v1.0
- 更新日期：2026-11-22
- 状态：**设计阶段** — 本文定义架构接口与验收标准，实施进度见项目看板

## 1. 架构概览

### 1.1 核心目标
网上柳州是一个基于真实地理数据的 3D 浏览器游戏原型，使用 Three.js 渲染柳州市五星街周边的街区白模。当前 MVP 阶段专注于：
- 真实可验证的地理数据处理管线
- 坐标系统的准确转换与测试
- 可旋转观察的 3D 街区白模
- 移动端与桌面端的性能达标

### 1.2 系统分层
```
┌─────────────────────────────────────────────┐
│  表现层 (Presentation Layer)                │
│  - Three.js 场景管理                        │
│  - 相机控制（Orbit/First-Person）          │
│  - UI 信息叠加层                            │
└─────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────┐
│  游戏逻辑层 (Game Logic Layer)              │
│  - 场景状态管理                             │
│  - 输入处理（键盘/触屏）                    │
│  - 交互热点与信息查询                       │
└─────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────┐
│  数据层 (Data Layer)                        │
│  - 地图块管理（分块加载/卸载）              │
│  - 坐标转换系统                             │
│  - 几何体缓存                               │
└─────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────┐
│  资源与数据源 (Resources)                   │
│  - OpenStreetMap / Geofabrik 原始数据       │
│  - 预处理后的 JSON/GLB 地图块               │
│  - 数据许可与覆盖率元信息                   │
└─────────────────────────────────────────────┘
```

### 1.3 技术栈
- **渲染引擎**：Three.js r180
- **开发工具**：Vite + TypeScript 5.9
- **地理数据来源**：OpenStreetMap (ODbL) 或 Geofabrik 导出
- **坐标系统**：WGS84 (EPSG:4326) → 局部米制笛卡尔坐标
- **未来扩展**：Rapier (物理碰撞)、Colyseus (多人同步)

---

## 2. 模块接口设计

### 2.1 坐标转换系统 (`CoordinateSystem`)

#### 职责
将 WGS84 经纬度转换为游戏场景的局部米制坐标，并提供逆向转换能力。

#### 接口定义
```typescript
/**
 * 坐标转换系统
 * 推荐原点：五星街 (109.4086882, 24.3157756) - way/205513960
 * 轴约定：X = 东向，Y = 高程，Z = 北向（Three.js 右手坐标系）
 */
interface CoordinateSystem {
  /**
   * WGS84 经纬度转本地米制坐标
   * @param lon 经度（度）
   * @param lat 纬度（度）
   * @param alt 高程（米，可选，默认 0）
   * @returns {x, y, z} 本地坐标（米）
   */
  wgs84ToLocal(lon: number, lat: number, alt?: number): Vector3;

  /**
   * 本地坐标转 WGS84
   */
  localToWgs84(x: number, y: number, z: number): {lon: number, lat: number, alt: number};

  /**
   * 获取原点的 WGS84 坐标
   */
  getOrigin(): {lon: number, lat: number};

  /**
   * 计算两个 WGS84 点的距离（米）
   */
  haversineDistance(lon1: number, lat1: number, lon2: number, lat2: number): number;
}
```

#### 实现说明
- 使用 **Equirectangular approximation** 进行平面投影（适用于柳州市区 10km² 范围）
- 纬度 24.33° 时，1 经度 ≈ 102,000 米，1 纬度 ≈ 111,000 米
- **不使用** UTM 或 Mercator 投影以避免额外依赖
- 误差：10km 范围内 < 1 米

#### 测试验收
```typescript
// tests/coordinate-system.test.mjs
// synthetic fixture：使用简化坐标进行数学验证，不代表真实柳州距离
test('原点往返转换应保持一致 (synthetic)', () => {
  const system = new CoordinateSystem(109.4, 24.33);
  const local = system.wgs84ToLocal(109.4, 24.33);
  assert(Math.abs(local.x) < 0.1 && Math.abs(local.z) < 0.1);
  const wgs = system.localToWgs84(0, 0, 0);
  assert(Math.abs(wgs.lon - 109.4) < 0.00001);
});
```

---

### 2.2 地图块管理器 (`MapTileManager`)

#### 职责
- 根据相机位置动态加载/卸载地图块
- 管理几何体的生命周期，避免内存泄漏
- 提供地图覆盖范围的查询

#### 接口定义
```typescript
interface MapTile {
  id: string;              // 例如 "tile_109.40_24.33"
  bounds: BoundingBox;     // WGS84 边界
  geometry: THREE.Group;   // Three.js 对象组
  source: string;          // 数据来源 URL
  license: string;         // 许可信息（ODbL 等）
  hasHeightData: boolean;  // 是否包含真实建筑高度
}

interface MapTileManager {
  /**
   * 根据相机位置更新可见地图块
   * @param cameraPosition 相机的本地坐标
   * @param loadRadius 加载半径（米）
   * @param unloadRadius 卸载半径（米）
   */
  update(cameraPosition: Vector3, loadRadius: number, unloadRadius: number): void;

  /**
   * 手动加载指定地图块
   */
  loadTile(tileId: string): Promise<MapTile>;

  /**
   * 卸载地图块并释放资源
   */
  unloadTile(tileId: string): void;

  /**
   * 获取已加载的地图块列表
   */
  getLoadedTiles(): MapTile[];

  /**
   * 检查某个 WGS84 坐标是否在已有数据覆盖范围内
   */
  isCovered(lon: number, lat: number): boolean;
}
```

#### 地图块组织
- 每个地图块覆盖约 500m × 500m 区域
- 文件格式：`tiles/tile_109.408_24.315.json` 或 `.glb`
- JSON 格式示例（使用附录 A 的真实边界）：
```json
{
  "id": "tile_109.408_24.315",
  "bounds": {"minLon": 109.4062238, "maxLon": 109.4111526, "minLat": 24.3135183, "maxLat": 24.3180329},
  "source": "https://api.openstreetmap.org/api/0.6/map?bbox=109.4062238,24.3135183,109.4111526,24.3180329",
  "license": "ODbL 1.0",
  "roads": [...],
  "buildings": [...],
  "hasHeightData": false
}
```

#### 验收标准
- 相机移动时，地图块加载延迟 < 500ms
- 卸载时调用 `geometry.traverse((obj) => obj.geometry?.dispose())`
- 单个地图块内存占用 < 10MB

---

### 2.3 相机控制器 (`CameraController`)

#### 职责
统一管理不同相机模式（观察模式、第一人称），处理键盘、鼠标、触屏输入。

#### 接口定义
```typescript
enum CameraMode {
  ORBIT = 'orbit',        // 轨道观察模式（默认）
  FIRST_PERSON = 'first', // 第一人称模式（未来）
}

interface CameraController {
  /**
   * 切换相机模式
   */
  setMode(mode: CameraMode): void;

  /**
   * 获取当前相机位置（本地坐标）
   */
  getPosition(): Vector3;

  /**
   * 设置相机焦点（平滑过渡）
   */
  focusOn(target: Vector3, duration?: number): void;

  /**
   * 每帧更新（处理输入、惯性）
   */
  update(deltaTime: number): void;
}
```

#### 轨道模式 (OrbitControls) 配置
- 仰角限制：5° ~ 85°（避免穿地和垂直俯视）
- 缩放范围：距目标 5m ~ 150m
- 平移速度：根据距离自适应（近距离慢，远距离快）
- 惯性阻尼：`dampingFactor = 0.08`

#### 触屏输入映射
- **单指拖动**：旋转相机（等同鼠标左键）
- **双指捏合**：缩放（等同滚轮）
- **双指平移**：平移焦点（等同鼠标右键）
- **双击**：聚焦到点击位置

#### 桌面键盘输入
- `WASD` / 方向键：平移焦点
- `Q / E`：旋转相机左/右
- `+/-`：缩放
- `Space`：重置到默认视角

---

### 2.4 场景状态管理 (`SceneState`)

#### 职责
管理游戏场景的全局状态，包括时间、天气、可见层、调试开关。

#### 接口定义
```typescript
interface SceneState {
  // 时间系统
  timeOfDay: number;        // 0-24，当前时刻（小时）
  timeSpeed: number;        // 时间流逝速度（1 = 实时，60 = 1分钟/秒）

  // 可见层控制
  layers: {
    buildings: boolean;     // 建筑白模
    roads: boolean;         // 道路网络
    grid: boolean;          // 参考网格
    labels: boolean;        // 地名标签
  };

  // 调试选项
  debug: {
    showCoordinates: boolean; // 显示鼠标位置的 WGS84 坐标
    showTileBounds: boolean;  // 显示地图块边界
    showFPS: boolean;         // 显示 FPS
  };

  // 数据覆盖状态
  dataCoverage: {
    verified: boolean;      // 是否已验证数据覆盖率
    missingAreas: string[]; // 缺失数据的区域标识
  };
}
```

#### 状态持久化
- 使用 `localStorage` 保存用户偏好（相机位置、图层开关）
- 键名：`liuzhou_online_state_v1`

---

## 3. 地图数据处理管线

### 3.1 数据源与许可

#### 优先数据源
1. **OpenStreetMap** (https://www.openstreetmap.org)
   - 许可：ODbL 1.0（要求署名与相同方式共享）
   - **已验证样本**：五星街周边 bbox（见附录 A）
   - 下载方式：OSM API 或 Geofabrik 导出

2. **Geofabrik** (https://download.geofabrik.de/asia/china.html)
   - 提供广西/中国区域的 OSM 数据 PBF 文件
   - 更新频率：每日

#### 许可合规要求
- 在 UI 中显示数据来源：`"地图数据 © OpenStreetMap contributors, ODbL"`
- 在本文档附录 A 记录所有数据文件的下载 URL、时间戳和哈希
- 禁止将 OSM 数据用于生成专有格式后二次闭源分发

### 3.2 数据下载与验证流程

#### 步骤 1：定义覆盖区域
使用实际已验证的五星街 OSM 数据范围（见本文档附录 A）：
```javascript
// scripts/data/config.mjs
export const TARGET_AREA = {
  name: '柳州五星街周边',
  center: {lon: 109.4086882, lat: 24.3157756},  // 五星街 (way/205513960) 中心点
  bounds: {
    minLon: 109.4062238,
    maxLon: 109.4111526,
    minLat: 24.3135183,
    maxLat: 24.3180329,
  },
};
```

#### 步骤 2：下载原始数据
```bash
# 使用 Overpass API 下载指定边界框的数据
# 脚本示例：scripts/data/download-osm.mjs
curl -o data/raw/liuzhou-wuxingjie-sample.osm \
  "https://api.openstreetmap.org/api/0.6/map?bbox=109.4062238,24.3135183,109.4111526,24.3180329"
```

**已验证样本**（2026-11-22 检索）：
- **way/205513960** "五星街" 位于 (109.4086882, 24.3157756)
- bbox 内 OSM way 统计：47 条 highway，34 个 building
- 重要道路样例：中山东路 (way/196166774)、公园路 (way/196166777)、罗池路 (way/196166790)
- 重要建筑样例：华侨大厦 (way/205654183)、聚宝大厦 (way/205654194)

**未验证覆盖率**：OSM way 数量不等于实际道路覆盖百分比；需现场对照或高分辨率卫星图验证。

#### 步骤 3：验证数据存在性
```javascript
// tests/data-coverage.test.mjs
test('五星街主干道应存在', () => {
  const roads = loadOSMData('data/raw/liuzhou-wuxingjie-sample.osm').roads;
  const wuxingjie = roads.find(r => r.id === 'way/205513960');
  assert(wuxingjie, '未找到五星街 (way/205513960)');
  assert(wuxingjie.name === '五星街', '五星街名称不匹配');
});

test('样本范围应包含至少 30 个建筑', () => {
  const buildings = loadOSMData('data/raw/liuzhou-wuxingjie-sample.osm').buildings;
  assert(buildings.length >= 30, `仅找到 ${buildings.length} 个建筑（预期 ≥30）`);
});
```

#### 步骤 4：转换为游戏格式
```javascript
// scripts/data/convert-to-tiles.mjs
// 将 OSM XML 转换为 JSON 地图块
// - 提取 way[highway] 为道路线段
// - 提取 way[building] 为建筑轮廓多边形
// - 应用坐标转换到本地米制（原点：五星街）
// - 按 500m 网格分块
```

输出示例（使用附录 A 的真实数据）：
```json
{
  "id": "tile_109.408_24.315",
  "bounds": {"minLon": 109.4062238, "maxLon": 109.4111526, "minLat": 24.3135183, "maxLat": 24.3180329},
  "source": "https://api.openstreetmap.org/api/0.6/map?bbox=109.4062238,24.3135183,109.4111526,24.3180329",
  "license": "ODbL 1.0",
  "roads": [
    {"id": "way/205513960", "name": "五星街", "type": "tertiary", "points": [[x1,z1], [x2,z2], ...]},
    {"id": "way/196166774", "name": "中山东路", "type": "tertiary", "points": [[x1,z1], [x2,z2], ...]},
  ],
  "buildings": [
    {"id": "way/205654183", "name": "华侨大厦", "type": "commercial", "outline": [[x1,z1], [x2,z2], ...], "height": null},
    {"id": "way/205654194", "name": "聚宝大厦", "type": "commercial", "outline": [[x1,z1], [x2,z2], ...], "height": null},
  ],
  "hasHeightData": false
}
```

### 3.3 缺失数据处理

#### 高程数据
**现状**：OSM 建筑数据通常不包含 `building:levels` 或准确的高度。

**处理策略**：
1. 如果 `building:levels` 存在，使用 `height = levels × 3.5m`
2. 否则，使用默认高度：
   - 住宅：4 层 × 3.5m = 14m
   - 商业：2 层 × 4m = 8m
   - 工业/仓库：1 层 × 6m = 6m
3. 在 UI 中标注：`"建筑高度为估算值"`

#### 地形高程
**现状**：MVP 阶段不引入 DEM（数字高程模型）。

**处理策略**：
- 地面高程统一设为 Y = 0
- 未来可引入 SRTM 或 ASTER GDEM 数据（30m 分辨率）

#### 数据缺失区域
如果某个地图块没有数据，必须：
1. 在该区域显示半透明网格占位符
2. UI 提示：`"此区域暂无可用数据"`
3. 在 `docs/data-sources.md` 中记录缺失原因

---

## 4. 坐标系统与轴约定

### 4.1 Three.js 坐标系
- **X 轴**：向东（正方向）
- **Y 轴**：向上（正方向）
- **Z 轴**：向北（正方向）
- 右手坐标系

### 4.2 WGS84 到本地坐标映射
```
经度 (lon)  → X 轴 (东向)
纬度 (lat)  → Z 轴 (北向)
高程 (alt)  → Y 轴 (上向)
```

### 4.3 参考原点
**实际验证点**：
```javascript
const ORIGIN = {
  lon: 109.4086882,   // 五星街 (way/205513960, node/6038500119)
  lat: 24.3157756,
  alt: 0,
};
```

**纯数学测试原点**（synthetic fixture，仅用于单元测试）：
```javascript
const TEST_ORIGIN = {
  lon: 109.4,   // 简化测试原点
  lat: 24.33,
  alt: 0,
};
```

### 4.4 单位换算
- 游戏内所有距离单位：**米**
- 相机 FOV：55°（默认）
- 近裁剪面：0.1m，远裁剪面：250m

### 4.5 测试用例
```typescript
// 以下测试使用 synthetic fixtures（简化坐标），不代表真实地理
test('东向移动约 1000 米应增加 X 坐标 (synthetic)', () => {
  const system = new CoordinateSystem(109.4, 24.33);  // 测试用简化原点
  const start = system.wgs84ToLocal(109.4, 24.33);
  const east = system.wgs84ToLocal(109.4 + 0.01, 24.33); // 约 1020 米
  assert(east.x - start.x > 1000);
  assert(Math.abs(east.z - start.z) < 10);
});

test('北向移动约 1000 米应增加 Z 坐标 (synthetic)', () => {
  const system = new CoordinateSystem(109.4, 24.33);  // 测试用简化原点
  const start = system.wgs84ToLocal(109.4, 24.33);
  const north = system.wgs84ToLocal(109.4, 24.33 + 0.009); // 约 1000 米
  assert(north.z - start.z > 990);
  assert(Math.abs(north.x - start.x) < 10);
});

// 真实地理测试（需要实际 OSM 数据）
test('五星街到中山东路的距离应小于 500 米', () => {
  const system = new CoordinateSystem(109.4086882, 24.3157756);  // 五星街为原点
  const wuxingjie = system.wgs84ToLocal(109.4086882, 24.3157756);  // way/205513960
  const zhongshan = system.wgs84ToLocal(109.4071234, 24.3165432);  // way/196166774 近似坐标
  const distance = Math.sqrt((wuxingjie.x - zhongshan.x)**2 + (wuxingjie.z - zhongshan.z)**2);
  assert(distance < 500, `实际距离 ${distance.toFixed(0)}m 超过预期`);
});
```

---

## 5. 移动端性能预算

### 5.1 目标设备
- **最低配置**：iPhone 12 / 小米 11（Adreno 650 / A14 GPU）
- **目标帧率**：30 FPS（稳定），60 FPS（理想）
- **分辨率**：720p ~ 1080p（根据 devicePixelRatio 自适应）

### 5.2 性能指标

| 指标                     | 桌面端          | 移动端         |
|--------------------------|-----------------|----------------|
| 初始加载时间             | < 2 秒          | < 3 秒         |
| 地图块加载延迟           | < 300ms         | < 500ms        |
| 三角形数（单帧可见）     | < 500K          | < 200K         |
| Draw Calls               | < 100           | < 50           |
| GPU 内存占用             | < 500MB         | < 200MB        |
| devicePixelRatio 限制    | min(DPR, 2)     | min(DPR, 1.5)  |

### 5.3 优化策略

#### 几何体合并
- 同类型建筑合并为单个 `BufferGeometry`（使用 `BufferGeometryUtils.mergeGeometries`）
- 道路线段合并为 `LineSegments`

#### LOD（细节层次）
- 近距离（< 50m）：显示完整建筑轮廓
- 中距离（50-150m）：使用简化的盒子模型
- 远距离（> 150m）：不渲染小型建筑

#### 材质优化
- 使用 `MeshBasicMaterial` 替代 `MeshStandardMaterial`（移动端）
- 禁用阴影（初期）
- 使用顶点颜色代替纹理

#### 视锥剔除
- 利用 Three.js 内置的 `frustumCulled = true`
- 超出相机视野的地图块不渲染

### 5.4 性能监控
```typescript
// src/performance-monitor.ts
export class PerformanceMonitor {
  getFPS(): number;
  getDrawCalls(): number;
  getTriangleCount(): number;
  getMemoryUsage(): {geometries: number, textures: number};
}
```

在开发模式下，按 `Ctrl+Shift+P` 显示性能面板。

---

## 6. 验收标准

### 6.1 功能验收
- [ ] 坐标转换系统通过所有单元测试
- [ ] 加载真实的五星街 OSM 数据（至少包含 10 条道路和 50 个建筑）
- [ ] 相机可通过鼠标/触屏控制旋转、缩放、平移
- [ ] 地图块可根据相机位置动态加载/卸载
- [ ] 显示数据来源和许可信息

### 6.2 性能验收
- [ ] 桌面端 Chrome 稳定 60 FPS
- [ ] iPhone 12 Safari 稳定 30 FPS
- [ ] 初始加载时间 < 3 秒（3G 网络）
- [ ] 单个地图块加载延迟 < 500ms

### 6.3 数据合规验收
- [ ] 本文档附录 A 记录所有数据文件的来源 URL、时间戳和哈希
- [ ] UI 页脚显示 `"© OpenStreetMap contributors, ODbL"`
- [ ] 验证脚本 `tests/data-coverage.test.mjs` 通过
- [ ] 缺失数据区域有明确的 UI 提示
- [ ] 不得声称未经现场验证的覆盖率百分比

### 6.4 代码质量验收
- [ ] `npm test` 通过
- [ ] `npm run build` 无 TypeScript 错误
- [ ] 所有公共接口有 JSDoc 注释
- [ ] 关键算法有单元测试（坐标转换、距离计算）

---

## 7. 未来扩展计划

### 7.1 物理系统（Rapier）
- 角色与建筑的碰撞检测
- 重力与跳跃
- 需要为建筑生成简化的碰撞体（Convex Hull）

### 7.2 多人同步（Colyseus）
- 玩家位置同步（100ms 延迟）
- 房间系统（每房间最多 50 人）
- 服务器端权威验证

### 7.3 地标 GLB 模型
- 柳州标志性建筑（如五星商厦、柳州大剧院）使用自定义 GLB 模型
- 替换默认白模
- 模型需在 Blender 中优化（< 5000 三角形/模型）

### 7.4 地形高程
- 引入 SRTM DEM 数据
- 使用 `THREE.PlaneGeometry` + Displacement Map 生成地形
- 分辨率：30m/像素

---

## 8. 风险与限制

### 8.1 数据风险
- **OSM 数据质量**：柳州市区的 OSM 数据可能不完整，需人工补充
- **许可合规**：必须严格遵守 ODbL 许可，禁止闭源分发

### 8.2 技术风险
- **移动端性能**：复杂场景可能无法达到 30 FPS，需持续优化
- **坐标精度**：Equirectangular 投影在大范围（> 10km）误差增大

### 8.3 项目风险
- **数据获取延迟**：Overpass API 可能超时，需准备备用下载方案
- **跨平台兼容性**：iOS Safari 的 WebGL 支持有限，需专门测试

---

## 9. 参考资料

### 9.1 外部文档
- [OpenStreetMap Wiki - Map Features](https://wiki.openstreetmap.org/wiki/Map_features)
- [Three.js Documentation](https://threejs.org/docs/)
- [Overpass API User Manual](https://wiki.openstreetmap.org/wiki/Overpass_API)

### 9.2 内部文档
- `docs/requirements.md` - MVP 需求定义
- `docs/architecture.md` - 技术架构概览
- `docs/decisions.md` - 技术决策记录
- `docs/visual-spec.md` - 视觉规范（本文档的配套文档）
- **本文档附录 A** - 数据来源与验证记录

---

## 10. 变更记录
- **v1.0 (2026-11-22)**：初始版本，定义核心接口与验收标准

---

## 附录 A：数据来源与验证记录

### A.1 已验证 OSM 样本
**检索时间**：2026-11-22T03:36:38+00:00  
**数据源**：https://api.openstreetmap.org/api/0.6/map?bbox=109.4062238,24.3135183,109.4111526,24.3180329  
**SHA256**：`ef3f504149ccb180dc9cdffd5de25a98e79a79a27f47ec9f67b705cb446e9a32`

#### 锚点道路
- **ID**：way/205513960
- **名称**：五星街
- **中心节点**：node/6038500119 (109.4086882, 24.3157756)

#### 统计数据
| 类型     | 数量 | 样例                                                                                                                                |
|----------|------|-------------------------------------------------------------------------------------------------------------------------------------|
| highway  | 47   | way/196166774 中山东路, way/196166777 公园路, way/196166790 罗池路, way/196166794 解放南路, way/205513954 培新路                      |
| building | 34   | way/205654183 华侨大厦, way/205654194 聚宝大厦, way/205654195 东都大厦, way/205654205 工贸大厦, way/205656857 兴隆大厦               |

**方法说明**：
- 计数方式：具有非空 tag 值的 OSM way，至少一个顶点在 bbox 内
- 不包含 relation；way 按 ID 去重
- **未验证覆盖率**：way 数量不代表实际道路或建筑的现场完整性

#### 许可
- **许可协议**：ODbL 1.0
- **署名要求**：© OpenStreetMap contributors
- **要求**：所有衍生作品必须标注来源并以相同许可共享

### A.2 未来扩展数据源
以下数据源尚未集成，仅为规划参考：

#### 高程数据
- **SRTM DEM**：30m 分辨率，公共领域
- **ASTER GDEM**：30m 分辨率，需注意使用条款

#### 3D 地标
- **Sketchfab**：需逐个模型确认许可（CC-BY、CC0 优先）
- **自制模型**：需在 Blender 中优化至 < 5000 三角形

### A.3 数据质量声明
1. **已验证**：已通过 API 检索并计算 SHA256 的数据
2. **未验证覆盖率**：OSM 数据可能不完整；未与现场或高分辨率卫星图对照
3. **估算高度**：建筑高度多数为默认值（住宅 14m，商业 8m），非实测
4. **禁止伪造**：不得用随机生成数据填充缺失区域

### A.4 数据更新流程
1. 从 OSM API 或 Geofabrik 下载原始数据
2. 记录 URL、时间戳、SHA256 哈希
3. 运行 `scripts/data/verify-osm.mjs` 验证数据结构
4. 转换为游戏格式并记录元信息
5. 更新本附录和 `docs/data-sources.md`（如创建）

