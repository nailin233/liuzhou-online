# 网上柳州 · M01 五星街原型技术架构（定稿 v1）

> 适用范围：里程碑 M01，「五星街周边 500 m × 500 m 来源可追溯白模」。
> 责任划分：本文由 Claude 维护，Codex 按第 12 节接口实现，Grok 负责第 3 节中标注「待核实」的数据项。
> 当前渲染仍是演示网格白模，不代表柳州现实场景。本文所有地理数值都是**约定与计算值**，不是已核实的现场数据。

---

## 0. 设计依据与未核实项

| 依据 | 位置 | 本文采用内容 |
|---|---|---|
| MVP 需求 | `docs/requirements.md` | 数据覆盖率验证、可测试坐标转换、缺失必须可见、暂不做多人 |
| Agent 规则 | `AGENTS.md` | 记录 URL / 许可 / 坐标系 / 缺失 / 验证方法；不得伪造 |
| 研究任务原始要求 | `scripts/bootstrap.ps1` 第 62 行 | 「500m × 500m」初始区域 |
| Issue #9 正文 | 调度器传入 | 原点 `(109.4086882, 24.3157756)`，X 东 / Y 上 / 北为 −Z |
| PR #7 研究成果 | **本 Worktree 中不存在**（`docs/research/` 只有 `.gitkeep`） | 仅沿用 Issue 转述的「约 500 m」约束；PR #7 中的覆盖率数字、建筑数量、许可结论本文**未引用**，合并后需按第 14 节核对 |

未核实项（实现前必须由 Grok 或人工确认，不得在 UI 或文档中写成事实）：

1. 原点坐标是否落在五星街步行街范围内（Issue 给定，未经本文核对）。
2. 区域内 OSM 建筑轮廓与道路的实际覆盖率。
3. 区域内 OSM 数据的绘制底图是否存在偏移（国内常见 GCJ-02 偏移问题，见第 3.4 节）。
4. 地形高差。M01 假定地面平坦（Y = 0），这是已知简化，不是测量结论。

---

## 1. 技术栈

- 浏览器：Vite 7 + TypeScript 5.9 + Three.js 0.180（与 `package.json` 一致）。
- 地理数据：OpenStreetMap，经 Overpass API 一次性下载后离线入库；不在运行时请求任何地图服务。
- 3D 数据：局部米制坐标，按 100 m 瓦片组织；地标可用 GLB 替换。
- M01 之后：Rapier 碰撞、Colyseus 房间同步（只预留接口，见第 10、11 节）。

---

## 2. 坐标系合约

### 2.1 定义

| 项 | 值 |
|---|---|
| 输入大地坐标 | WGS84（EPSG:4326），经度 `lon`、纬度 `lat`，单位度 |
| 原点 `O` | `lon0 = 109.4086882`，`lat0 = 24.3157756` |
| 本地坐标 | 以 `O` 为切点的局部东-北-天（ENU）平面，单位米 |
| 轴映射 | `X = East`，`Y = Up`，`Z = −North` |
| 高度 | `Y = 0` 为原点处地面；M01 不使用 DEM |

Three.js 是右手坐标系。ENU 到 Three 的映射矩阵列向量为 `E→(1,0,0)`、`N→(0,0,−1)`、`U→(0,1,0)`，行列式为 +1，属于纯旋转，**不产生镜像**。相机从 +Z 看向 −Z 时，画面上方是北、右侧是东，与常规地图朝向一致。

### 2.2 投影公式

500 m 范围内使用椭球局部切平面的线性近似（等距圆柱 + 原点纬度处的 WGS84 曲率半径），误差远小于 OSM 数据本身的精度：

```
a  = 6378137.0                 // WGS84 长半轴
f  = 1 / 298.257223563
e2 = f * (2 - f)
φ0 = lat0 * π / 180
W  = sqrt(1 - e2 * sin²φ0)
M  = a * (1 - e2) / W³          // 子午圈曲率半径
N  = a / W                      // 卯酉圈曲率半径

mPerDegLat = M * π / 180
mPerDegLon = N * cos φ0 * π / 180

x =  (lon - lon0) * mPerDegLon
z = -(lat - lat0) * mPerDegLat
y =  0（或建筑/道路层高度）
```

反算：`lon = lon0 + x / mPerDegLon`，`lat = lat0 - z / mPerDegLat`。

参考值（本文手算，用于测试容差设计，实现时必须由代码计算并与 GeographicLib 或 pyproj 的结果交叉核对）：

- `mPerDegLat ≈ 110 762.8 m`
- `mPerDegLon ≈ 101 501.8 m`

### 2.3 精度要求

- 往返误差：`unproject(project(p))` 与 `p` 的差在 1e-9 度以内。
- 与严格 ENU（GeographicLib `LocalCartesian`）相比，区域内任意点水平误差 < 0.05 m。
- 运行时坐标使用 `Float32Array`。500 m 范围内 float32 分辨率约 3e-5 m，无需相对原点重定位。
- 若未来扩展到全城（> 5 km），本节公式需替换为严格 ENU 或 UTM 49N（EPSG:32649）再平移，届时另立决策记录。

---

## 3. 数据源与许可

### 3.1 唯一来源

| 项 | 值 |
|---|---|
| 来源 | OpenStreetMap |
| 获取方式 | Overpass API 公共实例 `https://overpass-api.de/api/interpreter`，一次性 POST 请求，遵守其使用政策（单次、低频、离线缓存） |
| 许可 | ODbL 1.0（`https://www.openstreetmap.org/copyright`） |
| 署名 | 画面内常驻显示 `© OpenStreetMap contributors`，链接到版权页 |
| 费用 | 无。不使用任何需要 Key 或付费的地图 API |

不在 M01 使用：高德、百度、腾讯、天地图等国内地图服务（需要 Key、条款限制再分发、坐标系为 GCJ-02/BD-09）、Google/Bing 卫星图、商业建筑数据集。Geofabrik 区域提取包可作为备选来源，使用前由 Grok 核实其中国区域包的范围与更新时间。

### 3.2 裁剪区与下载区

| 区域 | 本地范围 | 经纬度范围（由第 2.2 节参考值换算） |
|---|---|---|
| 裁剪区（显示区） | `x, z ∈ [−250, 250]` m，500 m × 500 m | lon `109.4062252 – 109.4111512`，lat `24.3135185 – 24.3180327` |
| 下载区（含 50 m 缓冲） | `x, z ∈ [−300, 300]` m | lon `109.4057326 – 109.4116438`，lat `24.3130671 – 24.3184841` |

实现中裁剪边界必须用第 2.2 节公式在代码中计算，上表数字只用于人工核对。缓冲区用于取全跨越边界的道路与建筑多边形。

### 3.3 Overpass 查询（下载区）

```
[out:json][timeout:60][bbox:24.3130671,109.4057326,24.3184841,109.4116438];
(
  way["highway"];
  way["building"];
  way["building:part"];
  relation["type"="multipolygon"]["building"];
  way["natural"="water"];
  relation["type"="multipolygon"]["natural"="water"];
  way["waterway"];
  way["leisure"="park"];
  way["landuse"];
);
out body;
>;
out skel qt;
```

原始响应原样保存，记录 SHA-256 与下载时间（UTC）。后续每次构建都从原始文件离线生成，保证结果可复现。

### 3.4 坐标偏移风险

OSM 要求使用 WGS84，但国内部分要素可能曾按带偏移的底图绘制。需求中「实际街道路网与公开地图抽样比较」若对照国内地图，对方坐标为 GCJ-02，直接叠加会出现数百米级偏差。比较流程：

1. 只比较拓扑与形状（路口数量、交叉关系、街道走向），不直接比较绝对坐标；或
2. 将对照点由人工记录为 GCJ-02，再用公开的近似换算公式转为 WGS84 后比较，并在报告中注明换算有误差。
3. 结论写入 `docs/research/`，标明样本数量、方法与偏差统计，不得只写「一致」。

---

## 4. 文件布局

`scripts/` 目录保留给调度器，Codex 不得写入。数据管线代码放在新目录 `tools/geo/`。

```
tools/geo/
  fetch-osm.mjs          # 仅人工运行：执行 3.3 查询，写 data/raw，打印 SHA-256
  build-m01.mjs          # 离线：raw → processed，纯函数驱动，可在 node --test 中调用
src/geo/
  projection.ts          # 第 2 节
  clip.ts                # 第 5 节
  classify.ts            # OSM 标签 → kind / 宽度 / 高度规则
  tiles.ts               # 第 6 节
src/world/
  roads.ts  buildings.ts  ground.ts  landmarks.ts
src/ui/
  hud.ts  legend.ts  attribution.ts  compass.ts
data/raw/osm/
  m01-<YYYYMMDD>.overpass.json
  SOURCE.md              # URL、查询、下载时间、SHA-256、许可、署名
data/processed/m01/
  manifest.json
  features.geojson
public/models/landmarks/ # 可选 GLB，见第 8 节
```

`data/raw` 是否入库由用户决定。按 ODbL，经过处理后公开分发的数据库须以 ODbL 提供并署名；仓库为私有时同样保留署名信息。

---

## 5. 构建管线

```
Overpass JSON ──parse──> OSM 元素 ──组装──> 要素（way / multipolygon）
   ──classify──> kind + 属性 + 来源标记
   ──project──> 本地米制
   ──clip──> 裁剪区内要素
   ──tile──> 按瓦片分组
   ──emit──> features.geojson（WGS84） + manifest.json（统计）
运行时：fetch features.geojson → project → 网格生成 → 按瓦片×材质合并 → 场景
```

规则：

- `features.geojson` 遵循 RFC 7946，坐标保持 WGS84 经纬度，不写入本地米制。投影只在一个模块（`projection.ts`）内发生。
- 管线是纯函数：相同 raw 输入产出逐字节相同的输出（属性排序固定、数字保留 7 位小数）。
- 多边形组装可用 `osmtogeojson`（引入前由 Codex 核对其许可）或自实现 way 环拼接。不能组装成闭合环的要素记入 `manifest.stats.dropped`，并列出 OSM ID。

### 5.1 裁剪

| 要素 | 规则 | 理由 |
|---|---|---|
| 道路（折线） | 在本地米制中用 Liang–Barsky 算法裁到 `[−250, 250]²`，被裁断的端点标 `clipped: true` | 道路是连续网络，必须截断 |
| 建筑（多边形） | **质心**在裁剪区内则整栋保留，不切割多边形；否则丢弃 | 切割会产生现实中不存在的墙面 |
| 水体 / 绿地 / 用地 | 用 Sutherland–Hodgman 裁剪到边界 | 只作地面着色，切割不会伪造立面 |

### 5.2 道路

分类与默认宽度（无 `width` 标签时使用，标记 `widthSource: "default"`）：

| `highway` | kind | 默认宽度 m | 渲染层 Y |
|---|---|---|---|
| trunk / primary | `road.major` | 14 | 0.05 |
| secondary | `road.major` | 12 | 0.05 |
| tertiary | `road.minor` | 10 | 0.05 |
| residential / unclassified / living_street | `road.minor` | 7 | 0.05 |
| service | `road.service` | 4.5 | 0.05 |
| pedestrian | `road.pedestrian` | 8 | 0.06 |
| footway / path / steps / cycleway | `road.path` | 2.5 | 0.06 |
| 其他 | `road.other` | 4 | 0.05 |

- 有 `width` 标签时解析为米（支持 `"8"`、`"8 m"`），`widthSource: "osm"`；解析失败按默认值并记录警告。
- 网格：折线沿法向外扩为带状，拐角用斜接，斜接长度超过宽度 2 倍时改为斜切，避免尖刺。
- 道路自交与重叠不做布尔合并，靠层高与 `polygonOffset` 防止闪烁。
- `tunnel=yes` 的路段默认不渲染，`bridge=yes` 抬升 Y = 0.3，并计入统计。
- M01 不生成车道线、斑马线、红绿灯：OSM 区域内这类数据未核实，不能虚构。

### 5.3 建筑

高度判定按优先级取第一个可用值：

| 优先级 | 来源标签 | 计算 | `heightSource` |
|---|---|---|---|
| 1 | `height` | 解析米；`'` / `ft` 结尾按英尺换算 | `osm.height` |
| 2 | `building:levels` | `levels × 3.0 m`，有 `roof:levels` 时加 `roof:levels × 1.5 m` | `osm.levels` |
| 3 | 无 | 按缺失处理，见第 7 节 | `missing` |

- `min_height` 或 `building:min_level × 3.0` 作为底部高度（骑楼、架空层、`building:part`）。
- 同一建筑有 `building:part` 时，只渲染 part，外轮廓 `building=*` 不再拉伸，避免体块重叠。
- 每层 3.0 m 是**估算约定**，UI 中以「按层数估算」显示，不能称为实测。
- 网格：外环 + 内环（洞）三角化（`THREE.ShapeUtils` / earcut），侧墙按边生成，顶面平顶。M01 不生成屋顶形状（`roof:shape` 只记录不渲染）。
- 环方向统一：外环逆时针、内环顺时针（在 X–(−Z) 平面判断），保证法线朝外。

---

## 6. 瓦片

- 瓦片边长 100 m，裁剪区分为 5 × 5 = 25 块。
- 索引：`ix = floor((x + 250) / 100)`，`iz = floor((z + 250) / 100)`，取值 0–4；`x` 或 `z` 恰为 250 时归入 4。
- ID：`t{ix}_{iz}`，例如原点所在瓦片为 `t2_2`。
- 归属：建筑按质心、道路按每段折线中点（裁剪后可能拆成多段）。
- 每块瓦片每种材质合并为一个 `BufferGeometry`，并保留 `featureIndex` 顶点属性（`Uint32`）或分段表，以便拾取时反查 OSM ID。
- M01 一次加载全部 25 块。瓦片的作用是限制单块网格大小、便于按视锥剔除，以及为 M02 的流式加载与 GLB 烘焙预留结构。

---

## 7. 缺失数据的显示

需求第 4 条：缺失必须可见。M01 的处理：

| 缺失类型 | 处理 | 画面表现（见 `art-direction.md` 第 4 节） |
|---|---|---|
| 建筑无高度 | 拉伸到 3.0 m 占位高度，`heightSource: "missing"` | 斜纹材质 + 洋红描边；图例与 HUD 计数 |
| 道路无宽度 | 默认宽度 | 不单独标色，拾取信息中显示「默认宽度」 |
| 多边形无法组装 | 不渲染 | 计入 `manifest.stats.dropped`，HUD 提示数量 |
| 区域内无建筑数据 | 不补楼 | 地面保持空白；HUD 显示覆盖统计 |

禁止：随机建筑、复制邻近楼高、按街区平均值推算高度并以实测外观显示。

`manifest.json` 统计示例（字段为合约，数字由实际数据产生）：

```json
{
  "schema": "lzol.m01.manifest/1",
  "origin": { "lon": 109.4086882, "lat": 24.3157756, "datum": "WGS84" },
  "axes": "x=east,y=up,z=-north",
  "clipHalfSizeM": 250,
  "tileSizeM": 100,
  "source": {
    "name": "OpenStreetMap",
    "endpoint": "https://overpass-api.de/api/interpreter",
    "license": "ODbL-1.0",
    "attribution": "© OpenStreetMap contributors",
    "fetchedAtUtc": "<ISO 8601>",
    "rawSha256": "<hex>"
  },
  "stats": {
    "buildings": 0,
    "heightFromTag": 0,
    "heightFromLevels": 0,
    "heightMissing": 0,
    "buildingParts": 0,
    "roadsClipped": 0,
    "roadLengthM": 0,
    "dropped": []
  }
}
```

---

## 8. GLB 扩展

### 8.1 地标替换（M01 预留，可不交付模型）

`public/models/landmarks/manifest.json`：

```json
[
  {
    "osm": "way/<id>",
    "file": "way-<id>.glb",
    "author": "<作者>",
    "license": "<CC-BY-4.0 等>",
    "sourceUrl": "<来源>",
    "basis": "<建模依据：照片 / 测绘 / 估计>",
    "yawDeg": 0
  }
]
```

GLB 合约：

- glTF 2.0 二进制，单位米，+Y 向上（glTF 规范本身即 Y 上、右手系，Three 的 `GLTFLoader` 直接兼容，无需翻转）。
- 模型原点位于该 OSM 轮廓质心的地面处；`yawDeg` 为绕 Y 轴的修正角。
- 加载成功后隐藏对应 OSM 拉伸体；加载失败回退到拉伸体，并在控制台告警。
- 没有许可信息或 `basis` 的模型不得加载。
- 面数与贴图预算见 `art-direction.md` 第 7 节。

### 8.2 瓦片烘焙（M02 可选）

若运行时生成耗时超出第 9 节预算，可将每块瓦片烘焙为 `data/processed/m01/tiles/t{ix}_{iz}.glb`：

- 每个 mesh 名为 `<tileId>:<kind>`；OSM 要素元数据放在 `mesh.extras.features`（数组，按 `featureIndex` 对齐），不注册自定义扩展。
- 可选 `EXT_meshopt_compression`；引入前确认 `three/addons` 中的解码器可离线打包。

---

## 9. 性能预算与测试

### 9.1 预算（裁剪区全部加载、默认视角）

| 指标 | 预算 | 测量方式 |
|---|---|---|
| 帧率 | 1920×1080，集成显卡上 ≥ 50 FPS 中位数；独显 ≥ 60 | HUD + 第 9.3 节手工协议 |
| Draw calls | ≤ 150 | `renderer.info.render.calls` |
| 三角形 | ≤ 600 000 | `renderer.info.render.triangles`；生成阶段可在 Node 中统计 |
| 几何体数 | ≤ 200 | `renderer.info.memory.geometries` |
| 阴影贴图 | 1 张 2048² | 代码审查 |
| `features.geojson` | ≤ 5 MB 未压缩 | 构建输出 |
| 首帧时间（本地 `vite preview`） | ≤ 3 s | `performance.mark` 记录「数据到达」「网格完成」「首帧」 |
| 网格生成耗时 | ≤ 500 ms | 同上 |
| JS 包（gzip） | ≤ 400 KB | `vite build` 输出 |

### 9.2 自动化测试（`npm test`，Node 内运行，不依赖 WebGL）

| 编号 | 内容 | 判定 |
|---|---|---|
| T-PROJ-1 | 原点投影 | `project(lon0, lat0)` = `(0, 0)`，误差 < 1e-9 m |
| T-PROJ-2 | 东向 | `project(lon0 + 0.001, lat0)`：`x ∈ [101.4, 101.6]`，`|z| < 1e-6` |
| T-PROJ-3 | 北向为 −Z | `project(lon0, lat0 + 0.001)`：`z ∈ [−110.9, −110.6]`，`|x| < 1e-6` |
| T-PROJ-4 | 无镜像 | 投影一个逆时针（东→北→西）三角形，在 X–(−Z) 平面上有向面积 > 0 |
| T-PROJ-5 | 往返 | 裁剪区内 1 000 个确定性伪随机点，往返误差 < 1e-9 度 |
| T-PROJ-6 | 曲率常数 | `mPerDegLat`、`mPerDegLon` 与固定期望值相差 < 0.5 m（期望值由实现者用 GeographicLib 生成并记录在测试注释中） |
| T-CLIP-1 | 道路裁剪 | 穿越边界的线段端点落在 `±250` 上，误差 < 1e-6 m |
| T-CLIP-2 | 建筑质心规则 | 质心在内、轮廓跨界的建筑整栋保留；质心在外的被丢弃 |
| T-TILE-1 | 瓦片索引 | `(−250,−250)→t0_0`，`(0,0)→t2_2`，`(250,250)→t4_4` |
| T-H-1 | 高度解析 | `"12"`, `"12 m"`, `"12.5m"` → 12 / 12 / 12.5；`"40'"` → 12.192；`"abc"` → 无效 |
| T-H-2 | 优先级 | 同时有 `height` 和 `building:levels` 时取 `height`；只有 levels=5 → 15 m，`osm.levels` |
| T-H-3 | 缺失 | 无高度标签 → `heightSource: "missing"`，渲染高度 3.0 |
| T-DET-1 | 可复现 | 同一 raw 文件构建两次，`features.geojson` SHA-256 相同 |
| T-SRC-1 | 署名 | `manifest.source.license === "ODbL-1.0"`，attribution 非空 |
| T-BUDGET-1 | 三角形预算 | 由 `features.geojson` 生成的全部网格三角形数 ≤ 600 000 |
| T-NOFAKE-1 | 无虚构 | 场景中每个建筑网格段都能反查到 `osm` ID；不存在无来源要素 |

测试夹具使用手写的小型 Overpass JSON（几条路、几栋楼，含跨界与缺失高度的样例），放在 `tests/fixtures/`。夹具是合成数据，文件头注释注明「合成，非柳州真实数据」。

### 9.3 手工性能协议

1. `npm run build && npm run preview`，Chrome 最新稳定版，窗口 1920×1080，关闭其他标签页。
2. 依次切换相机书签 1、2、3（第 10.1 节），每个停留 10 s，记录 HUD 中位 FPS、draw calls、三角形数。
3. 结果写入 `docs/perf/m01-<日期>.md`，附 CPU / GPU 型号、驱动、浏览器版本。没有测量就不写数字。

---

## 10. 控制

### 10.1 M01：观察模式（OrbitControls）

| 输入 | 行为 |
|---|---|
| 左键拖动 | 绕目标旋转 |
| 右键拖动 / Shift + 左键 | 平移 |
| 滚轮 | 缩放 |
| `R` | 重置到默认视角 |
| `N` | 朝北：方位角归零（相机在目标 +Z 侧，看向 −Z） |
| `1` `2` `3` | 相机书签：鸟瞰全区、原点 45° 斜视、街道高度视角（目标高 1.6 m） |
| `H` | 高亮 / 取消高亮缺失高度建筑 |
| `L` | 显示 / 隐藏图例 |
| 单击建筑或道路 | 信息卡：OSM 类型与 ID、kind、高度及来源、宽度及来源 |

约束：`minDistance = 5`，`maxDistance = 900`，`maxPolarAngle = 85°`，目标点限制在 `[−300, 300]²` 内；`enableDamping = true`。相机 `near = 0.5`，`far = 2000`。

默认视角：目标 `(0, 0, 0)`，相机 `(220, 260, 320)`，北在画面上方偏右（相机位于东南侧，看向西北）。

### 10.2 M01 之后：第三人称

- 玩家为胶囊体：半径 0.3 m，总高 1.7 m；步行 1.4 m/s，跑步 4.0 m/s。
- 相机跟随距离 4 m，高度 1.8 m，带碰撞回缩。
- 碰撞（Rapier）：建筑以拉伸棱柱为静态碰撞体，地面为平面；`missing` 高度建筑同样生成碰撞体（3 m），防止穿模。
- 控制：`WASD` 移动，`Shift` 跑，鼠标转视角，`Tab` 切回观察模式。

---

## 11. 人物、车辆与多人（仅预留接口，不在 M01 开发）

需求「暂不开发」列表包含多人、AI NPC、真实人物。以下只定义接口，便于 M01 代码不留死角。

```ts
// src/entities/types.ts（预留）
export interface EntityState {
  id: string;              // 会话内唯一
  kind: 'player' | 'ebike' | 'car' | 'scaleProp';
  position: [number, number, number];  // 本地米制，第 2 节坐标
  yaw: number;             // 弧度，0 = 朝北（−Z），顺时针为正
  velocity?: [number, number, number];
}
```

- `yaw` 约定：0 朝 −Z（北），π/2 朝 +X（东）。与 Three 的 `rotation.y` 关系：`rotation.y = −yaw`。实现时以单元测试锁定。
- 尺寸参照：人 1.7 m；电动自行车约 1.8 m × 0.7 m × 1.1 m，限速 25 km/h（GB 17761-2018 对电动自行车最高设计车速的规定）；小汽车 4.5 m × 1.8 m × 1.5 m。
- M01 可放置**比例参照物**（灰色胶囊人、简单方块车），标签写「比例参照」，不代表真实人物、车辆或交通流。
- 多人（Colyseus）预留：一个 `manifest.origin` 对应一个区域房间；服务端权威，20 Hz 状态同步，客户端 100 ms 插值；位置量化到 0.01 m。房间 ID 由原点经纬度与 schema 版本生成。上线前需单独评审账号、隐私与内容安全。

---

## 12. Codex 实现接口

```ts
// src/geo/projection.ts
export const ORIGIN: { lon: number; lat: number };      // 109.4086882, 24.3157756
export const M_PER_DEG_LAT: number;
export const M_PER_DEG_LON: number;
export function project(lon: number, lat: number): { x: number; z: number };
export function unproject(x: number, z: number): { lon: number; lat: number };

// src/geo/clip.ts
export const CLIP_HALF_SIZE_M = 250;
export function clipPolyline(pts: [number, number][]): { pts: [number, number][]; clipped: boolean }[];
export function keepBuilding(ringXZ: [number, number][]): boolean;   // 质心规则

// src/geo/classify.ts
export type HeightSource = 'osm.height' | 'osm.levels' | 'missing';
export function parseLength(v: string | undefined): number | null;   // 米，支持 m / ft / '
export function buildingHeight(tags: Record<string, string>):
  { height: number; minHeight: number; source: HeightSource };
export function roadClass(tags: Record<string, string>):
  { kind: string; width: number; widthSource: 'osm' | 'default' } | null;

// src/geo/tiles.ts
export const TILE_SIZE_M = 100;
export function tileId(x: number, z: number): string;                 // "t{ix}_{iz}"

// src/world/*.ts
export function buildRoadMeshes(features: FeatureCollection): Map<string, THREE.Mesh[]>;
export function buildBuildingMeshes(features: FeatureCollection): Map<string, THREE.Mesh[]>;
export function pickFeature(hit: THREE.Intersection): FeatureInfo | null;
```

要求：

- `src/geo/` 不依赖 Three.js，可在 Node 测试中直接导入（用 `tsx` 或先编译，由 Codex 选择并写入 `package.json`）。
- 现有 `tests/project.test.mjs` 断言 `src/main.ts` 含「不是柳州真实地图」。接入真实数据后，该文案应改为说明数据来源与缺失情况，测试同步修改为检查署名与缺失提示存在。此改动需在 PR 中说明。

---

## 13. M01 验收清单

| # | 验收项 | 验证方法 |
|---|---|---|
| A1 | `npm test`、`npm run build` 通过 | CI |
| A2 | 第 9.2 节测试全部存在并通过 | CI 输出中可见测试名 |
| A3 | `data/raw/osm/SOURCE.md` 含 URL、查询、UTC 时间、SHA-256、许可、署名 | 人工审查 |
| A4 | 画面常驻 `© OpenStreetMap contributors` | 截图 |
| A5 | 按 `N` 后，画面上北下南、左西右东；指北针指向 −Z | 截图与 OSM 官网同区域对照 |
| A6 | 至少 5 个路口与 OSM 官网（`openstreetmap.org`）同位置形状一致 | 截图对照表，写入 `docs/research/` |
| A7 | 缺失高度建筑全部以斜纹样式显示，HUD 计数等于 `manifest.stats.heightMissing` | 截图 + 数值对照 |
| A8 | 拾取任一建筑可显示 OSM ID，ID 可在 OSM 官网打开 | 抽查 5 个 |
| A9 | 第 9.1 节预算由第 9.3 节协议实测，并记录 | `docs/perf/` 文件 |
| A10 | 场景中无来源不明的建筑、地标或文字 | T-NOFAKE-1 + 人工审查 |

---

## 14. 风险与待办

| 风险 | 影响 | 缓解 |
|---|---|---|
| PR #7 内容未在本 Worktree，本文未核对其结论 | 区域、覆盖率可能与研究结论不一致 | PR #7 合并后，对照其 bbox 与本文第 3.2 节；如不一致以研究结论为准并修订本文 |
| 五星街 OSM 建筑高度标签可能大量缺失 | 画面大部分是 3 m 斜纹占位 | 如实显示；覆盖率低时考虑经许可的补测或人工标注流程（另立 Issue） |
| GCJ-02 偏移 | 抽样比较出现系统性偏差 | 按第 3.4 节只比较形状，或明确记录换算误差 |
| 地面平坦假设 | 沿江或坡地区域建筑底部悬空或埋入 | M02 评估 SRTM 30 m（公有领域）或其他免费 DEM，先由 Grok 核实许可 |
| Overpass 公共实例限流或宕机 | 无法下载 | 一次下载后离线保存；备选 Geofabrik 提取包 |
| 每层 3.0 m 估算 | 商业建筑层高偏低 | UI 明确「估算」；数值可配置 |
