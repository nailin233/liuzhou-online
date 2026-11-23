# 柳州地理数据审计

> 本文档按 `AGENTS.md` 第 5 条记录项目已入库地理数据的来源、许可、坐标系、数据缺失与验证状态。未核实项一律标注「待核验/缺失」，不得冒充准确。

## 1. 统一坐标系与投影口径

- **源坐标系**：WGS84（EPSG:4326），不采用 GCJ-02 / BD-09 偏移坐标。
- **本地锚点**：OSM `node/6038500119`（五星街 `way/205513960` 第 6 节点），经度 `109.4086882°E`，纬度 `24.3157756°N`。
- **本地笛卡尔坐标**：单位米（`m`），轴向 `[+X 东, +Y 上, +Z 南]`（右手系，北为 `-Z`）。
- **转换公式**：等距圆柱局部近似（地球半径 `R = 6378137 m`）：
  - `x = (lon - 109.4086882) * π / 180 * R * cos(24.3157756°)`
  - `z = -(lat - 24.3157756) * π / 180 * R`
- **待修缺陷**：前端 `src/coordinate.ts` 仍为占位骨架（参见 Issue #23），实际转换目前仅存在于 Python 预处理脚本中。

---

## 2. 已入库数据集台账

### 2.1 五星街 500 m × 500 m OSM 基准快照（已核验）
- **原始快照**：`data/wuxing-street/map.osm.gz`
- **URL**：`https://www.openstreetmap.org/api/0.6/map?bbox=109.4062238,24.3135183,109.4111526,24.3180329`
- **HTTP 响应时间**：`2026-11-22T11:08:46Z`
- **解压后 SHA-256**：`36859fd8619e1b1413399c2c51c05b66fd69fa4254efeddc38182c563f9d33c2`
- **许可与署名**：ODbL 1.0 · `© OpenStreetMap contributors`（[版权页](https://www.openstreetmap.org/copyright) / [许可全文](https://opendatacommons.org/licenses/odbl/1-0/)）
- **产物**：`public/models/wuxing-street/manifest.json` + 34 个 `buildings/way-*.glb`
- **审计报告**：见 `docs/research/issue-1.md`、`docs/research/issue-8.md`、`data/wuxing-street/README.md`
- **已知缺失**：34 栋建筑全部缺少 `height` 与 `building:levels`（统一 `heightSource: "missing"`, `modelHeight: 3.0 m`）；500 m 范围内无水系。
- **验证方法**：`tests/wuxing-buildings.test.mjs` 对 34 个 GLB 逐一校验快照 SHA-256、底面节点偏差 `< 1 mm`、屋顶面积、质心与材质。

### 2.2 宽幅 2 km × 2.8 km OSM 数据（PR #20 引入，部分溯源待补登）
- **原始快照**：`data/wuxing-street/map-wide.osm.gz`（bbox `109.3990, 24.3050, 109.4190, 24.3300`）
- **来源 URL**：`https://www.openstreetmap.org/api/0.6/map?bbox=109.3990,24.3050,109.4190,24.3300`
- **许可与署名**：ODbL 1.0 · `© OpenStreetMap contributors`
- **产物**：
  - `public/models/wuxing-street/manifest-wide.json`：240 栋建筑（`osm.height`: 2、`osm.levels`: 1、`missing`: 237）
  - `public/models/wuxing-street/roads.json`：当前 332 条道路（注意：`src/modeling/regen_roads_wide.py` 漏掉了 `primary`/`primary_link` 共 73 条主干道如屏山大道、广场路，已建 Issue #22 修复）
  - `public/models/wuxing-street/waterways.json`：11 条水系要素（含柳江 5 条中心线折线 `way/678871684` 等，以及柳湖 `way/205515117`、罗池 `way/1274445931` 等闭合水体）
- **缺失与待核验项**：
  - `map-wide.osm.gz` 缺少精确到秒的 HTTP 下载时间与原始解压 SHA-256 记录（待补登）；
  - 柳江仅以中心线折线 + 默认 50 m 宽条带示意，未采纳真实河道多边形岸线；
  - 237/240 栋建筑缺少真实高度。

### 2.3 Overture Maps 建筑融合数据（PR #21 引入，溯源与许可交叉核验待补齐）
- **产物**：`public/models/wuxing-street/manifest-overture.json`（bbox `109.3990, 24.3050, 109.4190, 24.3300`）
- **声明来源**：`Overture Maps 2026-11-18.0 + OpenStreetMap`（`https://overturemaps.org/`）
- **要素统计**：合计 2891 栋建筑，其中 OSM 来源 240 栋、东亚卫星 ML 识别来源 2651 栋（脚本标注为 `Zenodo 8174931`）；高度分布：`osm.height` 2 栋、`osm.levels` 1 栋、`missing` 2888 栋。
- **声明许可与署名**：`ODbL 1.0` · `© OpenStreetMap contributors · Overture Maps Foundation`
- **缺失与待核验项（阻断完全溯源）**：
  1. `src/modeling/convert_overture.py` 依赖的 `data/overture/liuzhou-buildings.geojson` 已被 `.gitignore` 忽略且未记录可复现的拉取命令、精确下载时间与 SHA-256；
  2. `Zenodo 8174931` 数据集的独立许可条款、署名要求以及与 ODbL 1.0 的兼容性尚待独立核验；
  3. 2651 栋 ML 建筑轮廓的实地几何位置偏差与误检率尚未抽样测量；
  4. 2888/2891 栋建筑无真实高度数据（统一 3 m 斜纹占位）。

---

## 3. 合规边界检查
- `.gitignore` 已排除 `data/scrape/`、`data/overture/`、`data/*.pbf`；禁止将第三方商业地图抓取数据合入仓库或用于渲染。
- 实机抽样核对方法：启动预览后按 `N` 置北，与 `openstreetmap.org` 同 bbox 对比五星街、中山中路、柳江、柳湖、罗池的相对方位（须确保建筑与闭合水体无南北镜像、道路无旋转错位）。

## 更新日志
- 2026-11-22：创建审计文档骨架；Grok 完成 500 m 基准快照审计（Issue #1 / #8）。
- 2026-11-23：按 M1 实机验收结果同步宽幅 OSM 与 Overture Maps 数据台账及缺失/待核验项（Issue #24）。
