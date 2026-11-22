# Issue #8 · Grok 研究报告

我按 Issue #8 做增量核验：只查外部公开来源，用 OSM Map API 的实际返回复核五星街锚点、建筑、绿地、水系和地下要素，并核对 Mapforge、BlenderGIS 与 OSM 署名。不会改任何文件。

# Issue 8 增量核验：五星街水系、绿地、高度与工具

本报告只做增量核验，沿用 Issue #1 / PR #5 已指定的锚点，不替换前一版报告的其他结论。本次没有读到仓库内的前一版正文：公开的 GitHub Issue 页面返回无法访问。下面的数字全部来自 2026-11-22 读取的 OSM API 0.6 Map 响应，以及同日打开的官方许可页。

## 结论

- 锚点仍成立。way `205513960` 版本 4 是名为「五星街」的步行路中心线，不是建筑；node `6038500119` 版本 2 无标签，是该 way 的第 6 个节点，坐标落在指定 bbox 内。
- 同一次 Map 响应含 536 个 node、93 条 way、34 个 relation，XML 以 `</osm>` 结束，`<bounds>` 与请求框一致。响应没有触及 API 的 50,000 node 上限。
- 带 `building=*` 的对象有 34 条 way、0 个 node、0 个 relation。这 34 条全部首尾节点相同，节点引用数至少为 5（至少 4 个独立节点）。按 OSM「闭合 way + `building` 暗示 `area=yes`」的口径，它们是有效面积环。
- `height`、`building:levels`、`building:levels:underground`、`min_height`、`ele`、`building:part` 的出现次数都是 0。不能从这份提取换算建筑高度。
- 绿地：1 条闭合 `natural=wood`（way `1351248945`），1 个框内 `natural=tree`（node `12422900806`）。没有 `leisure=park`、`landuse=grass`、`landuse=forest`。
- 水系：点、线、面、relation 都是 0。没有 `natural=water`、`waterway=*`、`water=*`，也没有水系 multipolygon。
- 地下：6 条未闭合的 `highway=pedestrian` + `tunnel=yes` + `layer=-1`（1 条「人防地下街」、5 条「龙城地下街」）。7 条台阶没有 `tunnel` 或 `layer`。没有 `railway=subway`。9 个公共交通站台都是地面公交站，其中 4 条 way 只标了 `covered=yes`。
- 真实建筑覆盖率：这份 XML 具备计算 OSM 足迹面积的几何，但本报告没有计算百分比。在裁剪、重叠和完整性问题解决之前，不能把建筑 way 面积除以矩形面积称作真实覆盖率。

## 数据快照

| 项 | 值 |
| --- | --- |
| 读取日期 | 2026-11-22 |
| 实际返回 URL | `https://www.openstreetmap.org/api/0.6/map?bbox=109.4062238,24.3135183,109.4111526,24.3180329` |
| 生成器 | `openstreetmap-cgimap 2.1.1 (3066371 spike-06.openstreetmap.org)` |
| 许可头 | `copyright="OpenStreetMap and contributors"`，`attribution="http://www.openstreetmap.org/copyright"`，`license="http://opendatacommons.org/licenses/odbl/1-0/"` |
| 响应内最新元素时间 | relation `21918991` 版本 9，`2026-11-20T11:14:06Z`，changeset `192221512` |
| 行数 | 4681，末行 `</osm>` |
| `<bounds>` | `minlat="24.3135183" minlon="109.4062238" maxlat="24.3180329" maxlon="109.4111526"` |

直接请求 `api.openstreetmap.org` 时，本环境 DNS 解析到 `198.18.0.66`，请求被拦截。上表 URL 由 `www.openstreetmap.org` 返回同一套 cgimap XML。Wiki 写明 API v0.6 页面不是官方规范，行为以这次实际 XML 为准。Wiki 同时说明 Map 调用返回：框内 node；至少有一个节点在框内的 way，以及这些 way 在框外引用的 node；引用上述对象的 relation。relation 不递归展开，框外的成员 way 不会因为 relation 被带入。穿框但框内没有节点的 way 不会返回。

矩形地面尺度用 WGS84（a = 6378137 m，f = 1/298.257223563）在中心纬度 24.3157756° 的子午圈、卯酉圈曲率换成局部平面：南北 0.0045146° 约 500.0 m，东西 0.0049288° 约 500.3 m，面积约 2.502×10⁵ m²。这是研究矩形的面积，不是建筑覆盖率。未做椭球多边形积分，500 m 尺度上的相对误差预计远小于 1%。

## 保留的锚点

way `205513960`：

- 版本 4，changeset `150374770`，时间 `2024-04-23T05:12:28Z`，用户 Genpoaoine
- 标签只有 `highway=pedestrian`、`name=五星街`、`name:en=St. Wu Xing`
- 10 个节点，首节点 `2154755026`，末节点 `2065206624`，不是闭合环
- `/way/205513960/full` 与 Map 响应第 734–748 行一致

| 顺序 | node | lat | lon | 是否在 bbox 内 |
| --- | --- | --- | --- | --- |
| 1 | 2154755026 | 24.3158597 | 109.4078037 | 是 |
| 2 | 2154755077 | 24.3159264 | 109.4080352 | 是 |
| 3 | 2154755022 | 24.3159227 | 109.4081525 | 是 |
| 4 | 6038500118 | 24.3159205 | 109.4083295 | 是 |
| 5 | 2154755153 | 24.3158673 | 109.4084925 | 是 |
| 6 | 6038500119 | 24.3157756 | 109.4086882 | 是 |
| 7 | 2154755085 | 24.3156640 | 109.4087846 | 是 |
| 8 | 2154755160 | 24.3155407 | 109.4088657 | 是 |
| 9 | 2154755102 | 24.3153096 | 109.4089728 | 是 |
| 10 | 2065206624 | 24.3148791 | 109.4090758 | 是 |

node `6038500119` 单独读取也是版本 2、同一 changeset、同一坐标，没有标签。它是路网形状点，不是 POI。

## 计数口径

一次 Map 响应当成一个全集。对象只要在 XML 里出现就计数，包括框外节点。

| 口径 | 规则 | 本次结果 |
| --- | --- | --- |
| 元素 | `<node id=`、`<way id=`、`<relation id=` | 536 / 93 / 34 |
| 建筑 | 任意元素的 `building=*` | 34 条 way；0 node；0 relation |
| 有效闭环 | way 的第一个 `<nd ref>` 等于最后一个，且引用数 ≥ 5 | 34/34 满足 |
| 高度 | `height`、`building:levels`、`building:levels:underground`、`min_height`、`ele` | 全文件 0 |
| 建筑部件 | `building:part` | 0 |
| 绿地 | `leisure=park/garden`、`landuse=grass/forest/recreation_ground`、`natural=wood/grassland`、`natural=tree` | 1 面 + 1 点 |
| 水系 | `natural=water`、`water=*`、`waterway=*`，以及 relation 的 `type=multipolygon/waterway` 带水体标签 | 点线面 relation 都是 0 |
| 地下道路 | `tunnel=yes` 或 `layer` 为负，且 `highway=*` | 6 条未闭合步行 way |
| 地下站台 | `public_transport=platform` 或 `highway=platform`，并且有 `location=underground`、`tunnel=yes` 或负 `layer` | 0 |

全文件 `<tag k=` 共 804 处。`building=*` 的值是：`commercial` 18、`yes` 13、`apartments` 2、`construction` 1。relation 的 `type` 是：`route` 且 `route=bus` 23 个，`route=foot` 1 个（relation `20441810`），`route_master` 5 个，`boundary` 4 个，`network` 1 个。没有 `type=multipolygon`。公交 relation 很大，是因为路线碰到了框内路或站，不代表这些路线的全部几何都在五星街。

`building` 在 Wiki 上暗示 `area=yes`，并且说明 `amenity=*` 本身不表示建筑。因此下面这些闭合 way 不进入建筑数：

| way | 标签 | 闭合 |
| --- | --- | --- |
| 205654186 | `amenity=parking` | 是，9 个节点引用 |
| 205661085 | `amenity=parking`，`name=罗池停车场`，`parking=multi-storey` | 是，5 |
| 205661086 | `amenity=school`，公园路幼儿园 | 是，5 |
| 205661087 | `amenity=school`，公园路小学 | 是，11 |
| 205661088 | `amenity=parking` | 是，7 |
| 205661089 | `amenity=hospital`，柳州市红十字会医院 | 是，5 |
| 1350351745 | `amenity=parking` | 是，5 |
| 1351248941 | `landuse=construction` | 是，5 |
| 1524324821 | `landuse=retail`，`name=柳州市五星步行街` | 是，29 |

## 34 条建筑 way

「引用数」含重复的闭合节点。名称按 XML 原文，不改写。

| way | building | 名称 | 引用数 | 首尾节点 |
| --- | --- | --- | --- | --- |
| 205654183 | commercial | 华侨大厦 | 7 | 2156281873 |
| 205654194 | commercial | 聚宝大厦 | 5 | 2156281868 |
| 205654195 | yes | 东都大厦 | 9 | 2156281802 |
| 205654205 | commercial | 工贸大厦 | 13 | 2156281834 |
| 205656857 | commercial | 兴隆大厦 | 5 | 2156293992 |
| 205656859 | commercial | 星河大厦 | 13 | 2156293994 |
| 205657491 | commercial | 工行大厦 | 7 | 2156299099 |
| 205657492 | yes | 金惠商厦 | 5 | 2156299096 |
| 205657497 | yes | 金皇冠柏曼酒店 | 18 | 2156299097 |
| 205657498 | yes | 金运来大厦 | 10 | 2156299130 |
| 205658303 | yes | 瑞泰大厦 | 5 | 2156306667 |
| 205658307 | construction | 龙城大厦 | 5 | 2156306661 |
| 205661082 | yes | 中旅大厦 | 7 | 2156345426 |
| 205661092 | yes | 柳州市眼科医院行政办公楼 | 7 | 2156345390 |
| 205661093 | yes | 金长城大厦 | 9 | 2156345392 |
| 641119425 | commercial | 五星商贸大厦 | 7 | 6038500088 |
| 641119429 | commercial | （无 name） | 28 | 6038500120 |
| 641119432 | commercial | （无 name） | 19 | 6038500167 |
| 641119437 | commercial | 新华书店 | 8 | 6038500206 |
| 641119439 | commercial | （无 name） | 5 | 6038500213 |
| 641119441 | commercial | （无 name） | 5 | 6038500217 |
| 641119445 | commercial | （无 name） | 9 | 6038500233 |
| 641119449 | commercial | （无 name） | 5 | 6038500266 |
| 1044328353 | commercial | 五象百货 | 7 | 9609572062 |
| 1044328354 | commercial | 地王大厦 | 5 | 9609572079 |
| 1275168866 | yes | 柳州宾馆 | 6 | 6038500106 |
| 1275168894 | yes | 风晴港购物中心 | 14 | 11840485960 |
| 1275168895 | apartments | （无 name） | 9 | 11840485960 |
| 1275168896 | apartments | （无 name） | 10 | 11840485963 |
| 1351248938 | yes | 麦当劳 | 5 | 12501166135 |
| 1351248939 | yes | 肯德基 | 5 | 11840485975 |
| 1351248940 | commercial | 广惠大厦 | 9 | 12501166140 |
| 1351248943 | commercial | 淘园世家 | 9 | 12501166152 |
| 1362097344 | yes | （无 name） | 7 | 12611131314 |

未做的几何检查：相邻重复节点、零面积、自交、多边形方向。闭合只证明拓扑环，不证明简单多边形。

已看到、但未做面积相交的共点关系：

- 柳州宾馆 `1275168866` 与工贸大厦 `205654205` 共用 `6038500106`、`6038500108`、`6038500109`、`11840485894`。
- 麦当劳 `1351248938` 与东都大厦 `205654195` 共用 `12501166135`、`12501166137`、`2156281793`。
- 风晴港 `1275168894`、两栋 `apartments`（`1275168895`、`1275168896`）和肯德基 `1351248939` 互相共用节点。
- `landuse=retail` way `1524324821` 的节点序列包含商业 way `641119429` 的整圈（`6038500120`、`6038500145` 至 `6038500127`），并另有框外点。两块多边形不能直接相加。

框外例子，说明「way 被返回」不等于「多边形全在框内」：

- 地王大厦节点 `9609572081` 为 24.3128172, 109.4083792，`9609572082` 为 24.3126959, 109.4077535，都在南边界 24.3135183 以南。
- 金皇冠柏曼酒店节点 `2156299097` 为 24.3185457, 109.4067941，在北边界 24.3180329 以北。金惠商厦节点 `2156299096` 为 24.3181291, 109.4083134，同样在北界外。
- way `641119449` 的节点 `6038500266` 为 24.3184361, 109.4081452，在北界外。

## 高度

Wiki 的 `height` 表示物体实际高度，默认单位是米，建筑取屋顶上沿到地形接触处最低点的最大高度，不含天线。`building:levels` 是地上层数，不含屋顶层和地下室。这两个键以及 `min_height`、`building:levels:underground`、`ele` 在本提取中都没有值。way `205657497` 的 `stars=4` 是酒店星级，和楼层无关。没有样本可以换算，本报告不假设层高。

## 绿地

- 面：way `1351248945`，唯一标签 `natural=wood`，20 个节点引用，首尾都是 `12501166171`。抽查该环使用的 node `12501166160`–`12501166178`，纬度约 24.31435–24.31448，经度约 109.40672–109.40687，都在 bbox 内。这是一小块林地，没有 `leisure=park` 或名称。
- 点：node `12422900806`，唯一标签 `natural=tree`，24.3178291, 109.4108146，在框内。
- 线：0。relation：0。
- `landuse=retail` 与 `landuse=construction` 不计入绿地。

## 水系

在 804 个标签和 34 个 relation 类型里，没有水体点、水体线、水体面或水体 relation。柳江是否在现实中位于这 500 m 框外，本次没有用其他地图验证。这里只能说：这一版 OSM Map 提取里没有水系对象。

## 地下道路与站台

地下步行路，全部未闭合，因此不是建筑环：

| way | 节点引用 | 名称 | 标签 |
| --- | --- | --- | --- |
| 1275168867 | 3 | 人防地下街 | `highway=pedestrian`，`tunnel=yes`，`layer=-1`，`lit=yes` |
| 1275168868 | 7 | 龙城地下街 | 同上 |
| 1275168869 | 3 | 龙城地下街 | 同上 |
| 1275168870 | 3 | 龙城地下街 | 同上 |
| 1275168871 | 3 | 龙城地下街 | 同上 |
| 1275168872 | 3 | 龙城地下街 | 同上 |

台阶 way `1275168873`、`1275168874`、`1275168876`、`1275168877`、`1275168878`、`1275168879`、`1275168880` 是 `highway=steps`。其中两条带名称「龙城地下街」。它们没有 `tunnel` 和 `layer`，不计入地下道路。

站台：

| 类型 | id | 名称 | 坐标或形状 | 地下标签 |
| --- | --- | --- | --- | --- |
| node | 5921700385 | 龙城路北 | 24.3171869, 109.4063818 | 无 |
| node | 6053818047 | 龙城路北 | 24.3171269, 109.4065707 | 无 |
| node | 6053818045 | 龙城路五星步行街 | 24.3161214, 109.4065250 | 无 |
| node | 6053818046 | 龙城路五星步行街 | 24.3152266, 109.4062611 | 无 |
| node | 14347774672 | 龙城路五星步行街 | 24.3149021, 109.4064850 | 无 |
| way | 1502544591 | （无 name） | 两点，`highway=platform`，`covered=yes`，`bus=yes` | 无 |
| way | 1502544592 | （无 name） | 同上 | 无 |
| way | 1575253123 | （无 name） | 同上 | 无 |
| way | 1575253124 | （无 name） | 同上 | 无 |

五个 node 都在框内，标签是 `highway=bus_stop` 加 `public_transport=platform`。四条 way 是有顶棚的公交站台线。全文件没有 `railway`、`subway`、`station`、`location=underground`。

## 能否计算真实建筑覆盖率

可以据此算出一版「OSM 已绘制建筑足迹 / 研究矩形」的比值，因为 34 条建筑 way 都闭合，而且 Map 响应带有这些 way 引用的全部 node 坐标。本报告没有做这个除法，所以没有覆盖率百分比。

还不能把它叫做真实建筑覆盖率，原因是：

1. 没有与影像、竣工图或不动产轮廓对照，OSM 缺绘和多绘都未知。
2. 医院、两所学校、多层停车场和其他停车场是闭合场所，但没有 `building=*`。Wiki 规定这些标签不自动等于建筑，不能直接加进分子，也不能假定它们不是建筑。
3. `building=construction` 的龙城大厦是否计入已建成足迹，需要单独规定。
4. 上文的共点建筑和 `landuse=retail` 可能重叠。直接求和会重复计算。
5. 至少地王大厦、金皇冠柏曼酒店、金惠商厦和 way `641119449` 越过矩形边界，必须先裁剪。
6. 没有内环 multipolygon，庭院即使存在也没有被挖空。
7. 没有高度，结果只可能是平面覆盖率。
8. 自交和零面积还没有检查。

建议的后续计算式是：把 34 条环投影到同一 CRS，裁到 bbox，做多边形 union，再除以 2.502×10⁵ m²。在完成 union 和独立对照之前，分子不应发布。

## Mapforge、BlenderGIS 与 OSM 署名

三个名字对应三个项目。

**Mapforge（mapforge.org）** 是 OSM Wiki 上的 Web GIS，作者 Digitaltom，源码 `mapforge-org/mapforge`。仓库 `LICENSE` 写明 Copyright (c) 2024 Thomas Schmidt，Affero General Public License 3.0；完整文本在仓库 `docs/agpl-3.0.txt`，另有其他许可证文件见 `docs/credits.md`。Wiki 功能表写明：导入 GeoJSON、GPX、KML，用 Overpass 加 OSM 图层，MapLibre 底图，可看 3D 地形；Upload to OSM 为 no。服务条款页（Last updated: September 6, 2026）列出 OSM 数据适用 ODbL，Overpass 为 fair use 且数据仍是 ODbL，并要求保留地图角标。它不是测量仪器，也不验证建筑闭合或层高。

**Mapsforge（mapsforge.org，`github.com/mapsforge/mapsforge`）** 是另一个项目：Android 与桌面矢量地图库和 Osmosis map-writer。官方 README 写库主体为 LGPL-3.0，并放弃 LGPL-3.0 第 4(d)、4(e) 条的重组链接要求；仓库同时标有 GPL-3.0 文件。它消费 OSM 数据生成 `.map`，不替代 Map API 质检。发布地图仍要保留 OSM 署名。

**mapforge-software.com** 是另一套付费桌面地图软件，和以上两者无关。

**BlenderGIS** 以 `github.com/domlysz/BlenderGIS` 的 master `README.md` 和 `LICENSE` 为准。`LICENSE` 是 GNU GPL 3.0 全文。README 写最低 Blender 2.83；可导入 Shapefile、栅格、GeoTIFF DEM 和 OpenStreetMap XML；场景已有地理参考时可以用 Get OSM 拉取建筑和道路；SRTM 通过 OpenTopography，该服务自 2022 年起要免费注册的 API key。官方 OSM import wiki（页面编辑于 2020-03-15）写：数据许可是 ODbL，使用、复制、分发或改编时须署名 OpenStreetMap 及其贡献者；未地理参考的场景会把 XML 投到对应 UTM 带。GPL 约束的是插件程序。GPL 第 2 节写明，运行作品的输出只有在输出本身构成 covered work 时才适用 GPL。导入后的 OSM 几何仍是 ODbL 数据，不因经过 Blender 而变成 GPL。BlenderGIS 不提供本次这种闭合、层高和覆盖率核验。本次没有运行 Blender，也没有调用 OpenTopography。

**OSM 导出署名。** 数据许可是 Open Data Commons Open Database License 1.0。2026-11-22 打开的版权页要求两件事：显示 OpenStreetMap 署名；说明数据以 ODbL 提供。分发数据时要写上许可证名称和链接；不能放链接时印出 `https://www.openstreetmap.org/copyright`。OSMF 署名指南由理事会于 2021-06-25 通过。指南写明它不是法律文本，和法律文本冲突时以 ODbL 为准。指南接受的文字包括 “© OpenStreetMap contributors” 和 “© OpenStreetMap”；数据库须在 readme 或元数据中放署名和 ODbL 链接；可交互地图通常放在地图一角，并链到版权页。Map API 与瓦片服务不是免费的第三方地图 API，见 OSMF 的 API Usage Policy 和 Tile Usage Policy。

可复制署名：

```text
© OpenStreetMap contributors
https://www.openstreetmap.org/copyright
Open Database License 1.0
https://opendatacommons.org/licenses/odbl/1-0/
```

本次提取若再分发，保留响应头里的 copyright、attribution、license 三项目。以上是许可页摘要，不是法律意见。

## 可复制核验

```bash
curl -fsS -A "liuzhou-online-research/issue-8" \
  -o wuxing-map.xml \
  "https://www.openstreetmap.org/api/0.6/map?bbox=109.4062238,24.3135183,109.4111526,24.3180329"

curl -fsS -A "liuzhou-online-research/issue-8" \
  "https://www.openstreetmap.org/api/0.6/way/205513960/full"

curl -fsS -A "liuzhou-online-research/issue-8" \
  "https://www.openstreetmap.org/api/0.6/node/6038500119"
```

然后在 `wuxing-map.xml` 中核对：`<bounds>` 与上表一致；`</osm>` 存在；way `205513960` 的 10 个 `<nd ref>` 与本报告相同；每个 `building` way 的首个 `<nd ref>` 等于最后一个；`height` 与 `building:levels` 的计数为 0；`natural=water` 与 `waterway` 的计数为 0。请使用明确的 User-Agent，并遵守 OSMF API 使用政策。这个 bbox 约 0.000022 平方度，低于 Wiki 所记 0.25 平方度上限。

## 未验证项

- 没有打开 Issue #1、PR #5 或 `docs/geodata-audit.md` 的正文，因此没有逐句对照前一版数字。
- 没有做多边形面积、union、自交和零面积测试。
- 没有用影像或官方建筑普查核对完整性。
- 没有验证柳江在框外的真实位置。
- 台阶是否物理上连接地下街，只缺标签，本次无法从 XML 判定。
- BlenderGIS 当前 release 版本号没有从 Releases 页面读到，只确认了 master README 和 GPL-3.0 许可证文件。
- Map API 是编辑接口的实时库，稍后编辑会使同一 URL 的结果变化。复现时以新的响应时间为准。

## 已完成、方法、风险与待办

已完成：用 OSM API 0.6 的实际 Map XML 复核指定锚点、建筑闭环、高度键、绿地、水系和地下道路/站台；写明计数口径；说明为何现在不能发布真实覆盖率；核对 Mapforge、Mapsforge、BlenderGIS 的官方范围和许可证，以及 OSM ODbL 署名。没有修改文件，没有调用付费 API，没有提交 git。

方法：读取 `www.openstreetmap.org` 上的 `/api/0.6/map`、`/way/205513960/full` 和 `/node/6038500119`，再按元素和标签计数，并逐条核对 34 条建筑 way 的首尾节点。许可页来自 OSM 版权页、OSMF 署名指南、两个 GitHub 仓库的 LICENSE/README，以及 OSM Wiki。

风险：Map 提取包含框外节点和整条公交 relation，若把 relation 成员或未裁剪建筑直接求和，覆盖率会错。共点建筑和零售用地可能重叠。学校、医院、停车场没有 `building` 标签，建筑分子可能偏低。数据新到 2026-11-20 的元素时间，不是不动产登记底图。

待办：Codex 整合 `docs/geodata-audit.md` 时保留前一版报告；若要覆盖率，先做裁剪和 union，并单独记录 construction 与无 `building` 标签的闭合场所；不要把 Mapforge 和 Mapsforge 写成同一个许可证。
