# Issue #1 · Grok 研究报告

我将独立核对五星街锚点、给定范围和 OSM 许可，再对照道路与建筑样例写成可复核报告。先从 OSM、Overpass、许可和广西相关公开来源取证。

# 柳州市五星街附近 OSM 道路与建筑审计

研究日期：2026-11-22。坐标系：OpenStreetMap 节点使用 WGS 84 地理坐标，十进制度，相当于 EPSG:4326。本报告统计的是数据库对象，不是实地测绘完整率。

数据署名：© OpenStreetMap contributors。数据库许可为 Open Database License (ODbL) 1.0。本报告引用 OSM 要素、标签和坐标，按 OSM 基金会版权页作为 Produced Work 署名，并附许可全文链接。Wiki 文档另按 Creative Commons Attribution-ShareAlike 2.0 使用。

## 1. 证据分层

两类证据分开记录。

调度器采集摘要（任务内给出的样本，本会话没有把它落成本地文件，也没有重算其 SHA-256）：

- URL：`https://api.openstreetmap.org/api/0.6/map?bbox=109.4062238,24.3135183,109.4111526,24.3180329`
- 采集时间：2026-11-22T03:36:38.700336+00:00
- 声称的 SHA-256：`ef3f504149ccb180dc9cdffd5de25a98e79a79a27f47ec9f67b705cb446e9a32`
- 锚点 way `205513960`（五星街），节点 `6038500119`，经度 109.4086882，纬度 24.3157756
- 方法：way 的对应标签值不是 `no`，至少一个顶点落在闭区间矩形内，按 way ID 计数，不含 relation
- 摘要计数：`highway` 47，`building` 34

独立复核（本会话于 2026-11-22 直接请求 OSM API；精确到秒的响应时刻未从 HTTP 头取得）：

- 再次读取 way `205513960` 的当前版本、完整节点和历史
- 再次请求同一 bbox 的 Map API
- 在返回的 XML 中按行把 `<tag>` 归入其所属 `<way>`，重数道路和建筑
- Geofabrik 广西摘录页、ODbL 文本、OSM 版权页和 OSM Wiki 已打开
- `overpass-api.de` 在本会话未能取回（解释器请求失败；直接抓取被运行环境判为非公网地址）。计数因此以 Map API 为准。Map API 的纳入规则与调度器方法一致
- `gxlib.org.cn` 站内检索没有找到五星街道路或建筑地理数据集。该站是广西壮族自治区图书馆站点，不是本次道路和建筑的测量来源

独立复核时，Map API 响应头中的 `<bounds>` 与上述 bbox 一致，生成器为 `openstreetmap-cgimap 2.1.1`。响应里读到的最新要素时间是 relation `21918991` 的 `2026-11-20T11:14:06Z`，早于调度器采集时刻。way `205513960` 仍是 version 4，时间戳 `2024-04-23T05:12:28Z`。道路 way 数和建筑 way 数与调度器摘要相同。这支持两次快照在这两个计数上一致，但不能代替对原始字节的 SHA-256 复算。

## 2. 范围与坐标系

锚点节点 `6038500119` 的当前坐标是北纬 24.3157756、东经 109.4086882，version 2，同一 changeset `150374770`（2024-04-23）。

矩形（西、南、东、北）：

`109.4062238, 24.3135183, 109.4111526, 24.3180329`

矩形中心按打印精度等于该节点：

- 经度中心 `(109.4062238 + 109.4111526) / 2 = 109.4086882`
- 纬度中心 `(24.3135183 + 24.3180329) / 2 = 24.3157756`

经差 0.0049288°，纬差 0.0045146°，面积约 0.0000223 平方度，远小于 Map API 常见的 0.25 平方度上限。Wiki 写明：Map 调用返回矩形内的节点，以及至少引用一个矩形内节点的 way；穿过矩形但没有任何节点落在矩形内的 way 不返回。返回的 way 还可以带上矩形外的节点。因此计数是“碰到矩形的 way ID”，不是裁剪后的道路长度，也不是完全落在矩形内的要素数。

500 m 是本地近似，不是投影坐标系里的正方形。在纬度 24.3157756° 用 WGS 84 椭球的独立近似：纬向约 110764 m/°，经向约 101503 m/°。据此矩形约南北 500.1 m、东西 500.3 m。椭球公式和四舍五入带来的不确定度约为 1 m。它不是实测距离，也不是等面积投影。

OSM Wiki 的中国页面写明：OSM 不使用 GCJ-02；绘图时不应采用已被 GCJ-02 变换的数据或影像。中国内地许多在线地图使用 GCJ-02，百度地图再使用 BD-09。Wiki 同时把天地图高等级影像描述为接近 WGS 84 的 CGCS2000，并提醒其使用条款不允许描图。本审计没有把 OSM 坐标转换到 GCJ-02，也没有测量本街区的实际偏移。

## 3. 数据源、许可与署名

| 来源 | URL | 本报告中的用途 | 许可与署名 |
| --- | --- | --- | --- |
| OSM Map API 0.6 | https://api.openstreetmap.org/api/0.6/map?bbox=109.4062238,24.3135183,109.4111526,24.3180329 | 调度器样本与独立重数 | ODbL 1.0；© OpenStreetMap contributors。响应内许可链接为 http://opendatacommons.org/licenses/odbl/1-0/ |
| way 205513960 | https://api.openstreetmap.org/api/0.6/way/205513960/full 与 https://www.openstreetmap.org/way/205513960 | 锚点几何、标签、历史 | 同上 |
| 节点 6038500119 | https://www.openstreetmap.org/node/6038500119 | 锚点坐标 | 同上 |
| Map API 行为说明 | https://wiki.openstreetmap.org/wiki/API_v0.6 | 矩形纳入规则 | Wiki 文档 CC BY-SA 2.0 |
| 版权页 | https://www.openstreetmap.org/copyright | 署名要求 | 页面要求注明 OpenStreetMap 贡献者，并说明数据适用 ODbL |
| ODbL 1.0 全文 | https://opendatacommons.org/licenses/odbl/1-0/ | 许可条款 | 人类可读摘要 https://opendatacommons.org/licenses/odbl/summary/ 写明摘要本身没有法律效力 |
| 中国绘图说明 | https://wiki.openstreetmap.org/wiki/China | 坐标系、地址和译名惯例 | CC BY-SA 2.0 |
| Geofabrik 中国 / 广西 | https://download.geofabrik.de/asia/china.html 与 https://download.geofabrik.de/asia/china/guangxi.html | 区域摘录是否存在、滞后和许可；未用于计数 | 页脚：Geofabrik GmbH 处理，OpenStreetMap Contributors 创建，ODbL 1.0。公开 PBF 去掉用户名、用户 ID 和 changeset ID |
| 广西壮族自治区图书馆站 | https://www.gxlib.org.cn/ | 检索是否有可核对的道路建筑数据 | 未找到对应地理数据；不作为几何或计数来源 |

ODbL 下可以抽取、改编并制作 Produced Work。公开使用数据库或由其产生的作品时需要署名，并保持许可声明。改编后的数据库若公开使用，仍需以 ODbL 提供。本报告不发行衍生数据库。

Geofabrik 广西页在本次打开时显示：`guangxi-latest.osm.pbf` 约 53.6 MB，页面文字为“4 hours ago”修改、“contains all OSM data up to 6 hours ago”。这是相对时间，不是绝对时间戳。摘录比实时 API 滞后数小时，不能复现调度器那份 Map 响应的哈希。

## 4. 锚点：五星街 way 205513960

当前标签只有三项：`highway=pedestrian`，`name=五星街`，`name:en=St. Wu Xing`。没有 `source`、`surface`、`width`、`lit`、`lanes` 或 `oneway`。

10 个顶点由西北侧的解放南路交叉口到东南侧的中山东路 / 培新路交叉口：

| 顺序 | 节点 | 纬度 | 经度 |
| --- | --- | --- | --- |
| 1 | 2154755026 | 24.3158597 | 109.4078037 |
| 2 | 2154755077 | 24.3159264 | 109.4080352 |
| 3 | 2154755022 | 24.3159227 | 109.4081525 |
| 4 | 6038500118 | 24.3159205 | 109.4083295 |
| 5 | 2154755153 | 24.3158673 | 109.4084925 |
| 6 | 6038500119 | 24.3157756 | 109.4086882 |
| 7 | 2154755085 | 24.3156640 | 109.4087846 |
| 8 | 2154755160 | 24.3155407 | 109.4088657 |
| 9 | 2154755102 | 24.3153096 | 109.4089728 |
| 10 | 2065206624 | 24.3148791 | 109.4090758 |

这 10 个点都落在矩形内。用上一节的米/度近似，折线长度约 203 m。第 6 点沿折线约在 94 m 处，几何中点约在 101 m 处，是最接近中点的顶点，也是 10 个顶点里的第 6 个。端点直线距离约 169 m。这些是等矩形近似，不确定度约 1–2 m，不是测距成果。

历史：

- version 1，2013-02-14，用户 nepen：`highway=residential`，`name=五星街`，当时 8 个节点
- version 2，2018-05-11，用户 Kevin Z Wong：增加 `name:en=St. Wu Xing`
- version 3，2018-11-05，用户 user_7130456：插入节点 6038500118 和 6038500119
- version 4，2024-04-23，用户 Genpoaoine：`highway` 改为 `pedestrian`

共享节点显示出的连接：节点 2154755026 同时属于步行路解放南路 way `196166794`；节点 2065206624 同时属于中山东路 way `196166774` 和培新路 way `205513954`。

## 5. 道路

独立重数结果：Map 响应中带 `highway` 且值不是 `no` 的 way 为 47。没有看到 `highway=no`。调度器列出的 5 条样例，标签和名称都与当前 API 一致。

按 `highway` 值：

| 值 | way 数 |
| --- | ---: |
| pedestrian | 12 |
| steps | 7 |
| tertiary | 6 |
| secondary | 4 |
| platform | 4 |
| unclassified | 3 |
| service | 3 |
| living_street | 2 |
| cycleway | 2 |
| tertiary_link | 1 |
| secondary_link | 1 |
| residential | 1 |
| footway | 1 |
| 合计 | 47 |

其中 30 条有 `name`，17 条没有。名称去重后为 15 个字符串。同一条路被拆成多个 way，所以 47 不是 47 条街。

调度器样例：

| way | highway | name | 独立复核 |
| --- | --- | --- | --- |
| 196166774 | tertiary | 中山东路 | version 4，2018-05-11；另有 `oneway=yes`、`source=bing`、`name:en=Zhong Shan Dong Rd` |
| 196166777 | tertiary | 公园路 | version 10，2025-01-21；`oneway=yes`、`source=bing`、`name:en=Park Rd` |
| 196166790 | tertiary | 罗池路 | version 4，2018-05-11；`oneway=yes`、`source=bing`、`name:en=Luo Chi Rd` |
| 196166794 | pedestrian | 解放南路 | version 8，2022-03-26；本次读到的标签没有 `source` |
| 205513954 | tertiary | 培新路 | version 2，2013-02-15；`oneway=yes` |

全部 47 条 way：

| way | highway | name |
| --- | --- | --- |
| 196166774 | tertiary | 中山东路 |
| 196166777 | tertiary | 公园路 |
| 196166790 | tertiary | 罗池路 |
| 196166794 | pedestrian | 解放南路 |
| 205513954 | tertiary | 培新路 |
| 205513960 | pedestrian | 五星街 |
| 205513968 | tertiary_link | 中山西路 |
| 205519386 | living_street | 金鱼巷 |
| 205639714 | unclassified | 中山中路 |
| 205639717 | pedestrian | 无 name |
| 205639719 | pedestrian | 中山中路 |
| 205650894 | tertiary | 罗池路 |
| 205650897 | tertiary | 中山东路 |
| 205654192 | service | 无 name |
| 205659716 | unclassified | 无 name |
| 205661084 | living_street | 金鱼巷 |
| 205661091 | service | 罗池路东一巷 |
| 627315952 | secondary | 文惠路 |
| 643314543 | secondary | 龙城路 |
| 1275168860 | unclassified | 无 name |
| 1275168862 | secondary | 龙城路 |
| 1275168867 | pedestrian | 人防地下街 |
| 1275168868 | pedestrian | 龙城地下街 |
| 1275168869 | pedestrian | 龙城地下街 |
| 1275168870 | pedestrian | 龙城地下街 |
| 1275168871 | pedestrian | 龙城地下街 |
| 1275168872 | pedestrian | 龙城地下街 |
| 1275168873 | steps | 龙城地下街 |
| 1275168874 | steps | 龙城地下街 |
| 1275168876 | steps | 无 name |
| 1275168877 | steps | 无 name |
| 1275168878 | steps | 无 name |
| 1275168879 | steps | 无 name |
| 1275168880 | steps | 无 name |
| 1351248942 | pedestrian | 解放南路 |
| 1351248944 | secondary_link | 中山中路 |
| 1351248946 | cycleway | 无 name |
| 1351248947 | pedestrian | 中山西路 |
| 1351248948 | service | 无 name |
| 1351248949 | cycleway | 无 name |
| 1353081978 | residential | 景行路 |
| 1498940664 | footway | 无 name |
| 1502544591 | platform | 无 name |
| 1502544592 | platform | 无 name |
| 1575253123 | platform | 无 name |
| 1575253124 | platform | 无 name |
| 1580342264 | secondary | 文惠路 |

15 条 way 带 `source=bing`：196166774、196166777、196166790、205513968、205639714、205639717、205639719、205650894、205650897、627315952、643314543、1275168862、1351248944、1351248947、1580342264。五星街本身没有 `source=bing`。

按方法计入“道路”的对象里，有台阶、地下街、人行道、自行车道和公交站台。4 条 `highway=platform` 同时有 `public_transport=platform`，其中 1502544592、1575253123、1575253124 还有 `bus=yes` 和 `covered=yes`。金鱼巷 way `205661084` 另有 `service=alley`。

矩形外顶点的例子：文惠路 `627315952` 含节点 2063089378（24.3149876, 109.4126489），位于东边界以东；龙城路 `643314543` 含节点 2063024788（24.3132518, 109.4062347），位于南边界以南。两条路都因为至少一个顶点在矩形内而被整条计入。

另有 18 个带 `highway` 的节点，不进入 47 这个 way 计数：公交站 5、人行横道 9、信号灯 4。三个公交站节点的名称是“龙城路五星步行街”（XML 约第 360、366、663 行），另有名称“龙城路北”。

## 6. 建筑

独立重数：带 `building` 且值不是 `no` 的 way 为 34。没有 `building=no`。响应中的 34 个 relation 都没有 `building` 标签，因此“排除 relation”这一步没有在本快照里漏掉已存在的建筑 relation。relation 主要是公交路线和行政区边界。

按值：`commercial` 18，`yes` 13，`apartments` 2，`construction` 1。25 条有名称，9 条没有。抽查过的建筑 way 首尾节点相同，是闭合环；没有对全部 34 条做几何有效性检验，也没有计算面积。

调度器样例：

| way | building | name | 独立复核中的其他标签 |
| --- | --- | --- | --- |
| 205654183 | commercial | 华侨大厦 | version 4，2018-11-05；`addr:city=liuzhou`，`addr:district=Cheng Zhong`，`addr:province=Guangxi`，`addr:street=解放南路`，`addr:housenumber=97`，`name:en=The Chinese Building` |
| 205654194 | commercial | 聚宝大厦 | version 3，2018-05-11；地址为公园路 79，行政区写法同上；`name:en=Ju Bao Building` |
| 205654195 | yes | 东都大厦 | version 4，2025-01-14；`shop=mall`，`name:en=Dong Du shopping mall`；没有读到 addr |
| 205654205 | commercial | 工贸大厦 | version 5，2024-04-23；龙城路 2；`shop=mall`，`name:en=Liuzhou Shopping centre` |
| 205656857 | commercial | 兴隆大厦 | version 3，2024-04-23；`name:en=Xing Long Building`；没有读到 addr |

全部 34 条：

| way | building | name |
| --- | --- | --- |
| 205654183 | commercial | 华侨大厦 |
| 205654194 | commercial | 聚宝大厦 |
| 205654195 | yes | 东都大厦 |
| 205654205 | commercial | 工贸大厦 |
| 205656857 | commercial | 兴隆大厦 |
| 205656859 | commercial | 星河大厦 |
| 205657491 | commercial | 工行大厦 |
| 205657492 | yes | 金惠商厦 |
| 205657497 | yes | 金皇冠柏曼酒店 |
| 205657498 | yes | 金运来大厦 |
| 205658303 | yes | 瑞泰大厦 |
| 205658307 | construction | 龙城大厦 |
| 205661082 | yes | 中旅大厦 |
| 205661092 | yes | 柳州市眼科医院行政办公楼 |
| 205661093 | yes | 金长城大厦 |
| 641119425 | commercial | 五星商贸大厦 |
| 641119429 | commercial | 无 name |
| 641119432 | commercial | 无 name |
| 641119437 | commercial | 新华书店 |
| 641119439 | commercial | 无 name |
| 641119441 | commercial | 无 name |
| 641119445 | commercial | 无 name |
| 641119449 | commercial | 无 name |
| 1044328353 | commercial | 五象百货 |
| 1044328354 | commercial | 地王大厦 |
| 1275168866 | yes | 柳州宾馆 |
| 1275168894 | yes | 风晴港购物中心 |
| 1275168895 | apartments | 无 name |
| 1275168896 | apartments | 无 name |
| 1350351745 | yes | 麦当劳 |
| 1351248938 | yes | 肯德基 |
| 1351248939 | commercial | 广惠大厦 |
| 1351248943 | commercial | 淘园世家 |
| 1362097344 | yes | 无 name |

地址只覆盖一部分建筑。已读到的街道门牌包括：华侨大厦解放南路 97、聚宝大厦公园路 79、星河大厦公园路 72、工贸大厦龙城路 2、工行大厦龙城路 28、金皇冠柏曼酒店龙城路 32、龙城大厦龙城路 25、眼科医院行政办公楼中山东路 42。`addr:city` 写为 `liuzhou`，`addr:district` 写为 `Cheng Zhong`，`addr:province` 写为 `Guangxi`。OSM 中国地址示例使用中文省、市、区名称。本次检索没有见到 `building:levels`、`height` 或 `addr:postcode`。

同一矩形里还有闭合设施 way，没有 `building` 标签，所以不进入 34：罗池停车场 `205661085`（`amenity=parking`，`parking=multi-storey`）、公园路幼儿园 `205661086`、公园路小学 `205661087`、柳州市红十字会医院 `205661089`（中山东路 43），以及至少一个未命名停车场。多层停车、学校和医院因此可能已经画出轮廓，却不在建筑计数里。

## 7. 名称所指并不只是一条 way

way `205513960` 的名称是“五星街”，折线约 203 m，两端接解放南路与中山东路。另一条闭合 way `1524324821`（version 1，2026-05-29）的标签是 `landuse=retail`、`name=柳州市五星步行街`，没有 `highway`。它与未命名商业建筑 `641119429` 共用一组节点。节点 `2065206730`（24.3145261, 109.4081378，在矩形内）位于解放南路上，标签为 `tourism=artwork`、`artwork_type=sculpture`、`name=柳州五星`。

Map 响应还包含行政区 relation `4586929`：`name=城中区`，`admin_level=6`，`division_code=450202`，`wikidata=Q1070053`，`wikipedia=zh:城中区 (柳州市)`。另有 `admin_level=8` 的边界 way“城中中南边界”“城中公园边界”，以及名称分别为城中街道、公园街道、中南街道的边界 relation。Map API 返回 relation，是因为它引用了已纳入的成员，不是点在多边形内的判定。锚点是否位于城中区境内，本报告没有做点面检验。建筑地址标签把区写成 Cheng Zhong。

检索到的公开网页把“五星商业步行街 / 五星街”描述为柳州市城中区的商业步行区域，并点名工贸、东都、五象、地王、龙城地下商业街等，与 OSM 中的工贸大厦、东都大厦、五象百货、地王大厦、龙城地下街同名或近名。这些网页只作名称和区位旁证，没有提供可与 OSM 顶点比对的测量坐标：

- 城中区人民政府门户转载，2024-09-14：http://www.czq.gov.cn/sjzt/jczt/ztzl/cyczjpdkj/dkgwfw/t19700101_3522370.shtml
- 新浪财经转载的交通管理通告，页面日期 2026-11-19，提到城中区五星商业街区：https://finance.sina.com.cn/roll/2026-11-19/doc-inizfqem6351790.shtml?from=pcsearch

百科和游记里的长度、人流量、门牌“解放南路 88 号”口径不一致。本报告不把它们当作测量值。OSM 这条名为五星街的 way，短于上述网页所描述的整片五星商圈。

## 8. 缺失、质量问题和不确定点

1. 47 和 34 是标签计数。调度器方法已经写明“Map coverage is not surveyed completeness”。商业步行街的店铺密度不能从 34 个建筑轮廓推出。
2. 计数包含公交站台、台阶和地下街，也包含伸出矩形的整条 way。若产品定义的“道路”只指地面车行道，口径要先收窄再计数。
3. 穿过矩形却没有内部顶点的 way 不会出现。Overpass 未能用来估计这一差额。
4. 17 条道路 way 和 9 条建筑 way 没有 `name`。6 条无名称建筑只有 `building=commercial`。
5. 学校、医院和立体停车场没有 `building` 标签。没有读到 `building:levels`。
6. 15 条道路标了 `source=bing`。Wiki 警告不要使用 GCJ-02 影像描图。本会话没有测量这些几何相对 WGS 84 的位移，因此只把 `source=bing` 记为几何风险，不给出偏移米数。
7. 英文名与 OSM 中国译名惯例不一致。五星街的 `name:en` 是 `St. Wu Xing`。华侨大厦的英文是 `The Chinese Building`，工贸大厦的英文是 `Liuzhou Shopping centre`。地址使用拼音或英文行政区，而不是 Wiki 示例中的中文行政区。
8. 龙城路 way `643314543` 为 `highway=secondary`、`lanes=1`、`maxspeed=60`、`oneway=yes`、`source=bing`。文惠路两条 way 都有 `horse=permissive` 和 `source=bing`。这些是标签组合，不是现场限速或通行调查。
9. “五星街”“柳州市五星步行街”“龙城路五星步行街”同时存在，分别落在步行 way、零售用地和公交站上。
10. 没有 GNSS、竣工图或不动产测量。`gxlib.org.cn` 不能补上这层核对。城中区政府页面能核对商业区名称，不能核对轮廓顶点。
11. 调度器给出的 SHA-256 未在本会话复算。独立响应与调度器样本的字节是否相同，仍然未知。已核对的是同一 URL、同一锚点版本，以及相同的 47 和 34。
12. OSM 是可编辑实时库。2026-11-17 仍有道路版本写入，2026-11-20 仍有 relation 版本写入。本报告只对 2026-11-22 这次读取负责。

## 9. 复核方法

1. 打开 `way/205513960/full` 和 `/history`，确认名称、`pedestrian`、10 个节点，以及锚点坐标等于矩形中心。
2. 用同一 bbox 重新下载 Map API。以 `<way id>` 的行号为界，把其后的 `highway`、`building`、`name` 归到该 way。way 起点行号之前的标签归前一个对象。节点上的 `highway` 单独排除。
3. 用 Wiki 的 Map API 说明核对纳入规则，并用矩形外节点证明“整 way 计数”与“路段完全位于矩形内”不同。
4. 打开版权页、ODbL 1.0、Geofabrik 广西页和 Wiki 中国页，记录许可、摘录滞后和 GCJ-02 风险。
5. 对 `gxlib.org.cn` 只做站内检索。对政府门户和新闻页只使用检索摘要，不把摘要中的长度当作测量。

没有运行软件测试套件，没有改动仓库，没有把 Map 响应保存为本地文件。

## 10. 结论与待办

2026-11-22 的独立 Map API 复核与调度器摘要一致：以五星街 way `205513960` 的中间顶点 `6038500119` 为中心，约 500 m × 500 m 的 WGS 84 经纬矩形内，按“至少一个顶点在矩形内、标签值不是 `no`、按 way ID、不含 relation”计数，道路类 way 为 47，建筑类 way 为 34。五星街当前是约 203 m 的 `highway=pedestrian`，10 个顶点都在矩形内，自 2024-04-23 起版本未变。

已完成的是实时数据库审计和许可核对。测试方法是第二次 API 读取加 XML 归类计数。Geofabrik 只确认了广西 ODbL 摘录的存在和小时级滞后。

风险：计数会被站台、台阶、地下街和伸出矩形的长路抬高；建筑轮廓明显少于商圈口述中的店铺规模；`source=bing` 与 GCJ-02 影像风险未被测距证实或排除；SHA-256 未复算；Overpass 本次不可用。

待办：

- 保存原始 Map 响应并复算 SHA-256 `ef3f504149ccb180dc9cdffd5de25a98e79a79a27f47ec9f67b705cb446e9a32`
- 在 Overpass 可用时，用“至少一个节点在矩形内”和“way 与矩形相交”两种口径各计一次
- 对锚点做城中区及街道边界的点面判断
- 若要验证几何，使用允许用于 OSM 的 WGS 84 或已说明偏移的影像，并做实地或授权测量；不要把 GCJ-02 底图直接当成误差结论
- 后续编辑再处理无名称建筑、设施轮廓缺 `building`、英文名和地址用字；那不属于本次只读审计
