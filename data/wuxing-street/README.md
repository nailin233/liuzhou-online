# 五星街建筑白模

`map.osm.gz` 保存了本批次使用的 OSM Map API 原始 XML。范围按西、南、东、北依次为 `109.4062238, 24.3135183, 109.4111526, 24.3180329`。HTTP 响应时间为 2026-11-22 11:08:46 UTC。解压后 SHA-256 为 `36859fd8619e1b1413399c2c51c05b66fd69fa4254efeddc38182c563f9d33c2`。[下载地址](https://www.openstreetmap.org/api/0.6/map?bbox=109.4062238,24.3135183,109.4111526,24.3180329)

数据署名 © OpenStreetMap contributors，许可 ODbL 1.0。[OSM 版权页](https://www.openstreetmap.org/copyright) · [许可全文](https://opendatacommons.org/licenses/odbl/1-0/)

本批次纳入快照中的 34 条闭合建筑 way，保留跨边界建筑的完整轮廓。OSM 的建筑覆盖程度和实地几何精度仍待独立测量。所有 way 均缺少 `height` 和 `building:levels`。清单以 `height: null` 保留这一状态，以 `modelHeight: 3` 记录显示高度。

输入坐标系为 WGS84（EPSG:4326）。局部坐标以节点 6038500119（109.4086882°E，24.3157756°N）为原点，使用半径 6378137 m 的局部等距圆柱近似，东西方向乘以原点纬度的余弦。每个 GLB 使用米制坐标，X 向东、Y 向上、Z 向南，底面面积质心位于模型原点。加载器将模型放在清单的 `position` 处。

## 离线生成与验证

在工作树根目录使用 PowerShell 执行以下命令。生成阶段使用 Blender 5.3.0 和仓库内的快照。

```powershell
& 'J:\SteamLibrary\steamapps\common\Blender\blender.exe' --background --factory-startup --python-exit-code 1 --python src/modeling/generate_wuxing.py
npm test
npm run build
```

输出为 `public/models/wuxing-street/buildings/way-<id>.glb` 和同级街区目录下的 `manifest.json`。清单保留 OSM ID、版本、标签、坐标偏移、三角形数和各文件 SHA-256。回归测试通过 Three.js 的 GLTFLoader 读取每个文件，核对快照中的底面顶点、质心、屋顶面积、朝向、材质和三角形预算。1 mm 是数值转换容差。

运行 `npm run dev`，在终端显示的本地地址后加 `/?view=buildings` 查看整批模型。GLB 包含纯色 PBR 立面、屋顶和向内 0.16 m 的洋红描边。预览中的 Three.js 着色器按米制世界坐标绘制 45° 立面斜纹，条宽 0.6 m，重复周期 1.8 m。
