"""
从仓库内的 data/wuxing-street/map-wide.osm.gz 提取真实柳州土地利用（公园/绿地/体育场/商业广场）
与具名地标、桥梁、路牌信息。

数据来源：data/wuxing-street/map-wide.osm.gz (OSM API 0.6)
许可：ODbL 1.0 · © OpenStreetMap contributors
坐标系：EPSG:4326 -> 原点 node/6038500119 (+X 东 / +Y 上 / +Z 南)
"""
import gzip
import json
import math
import xml.etree.ElementTree as ET

PI = math.pi
R = 6378137.0
OLAT = 24.3157756
OLON = 109.4086882


def wgs84_to_local(lon: float, lat: float) -> list[float]:
    x = (lon - OLON) * PI / 180.0 * R * math.cos(OLAT * PI / 180.0)
    z = -(lat - OLAT) * PI / 180.0 * R
    return [round(x, 2), round(z, 2)]


def centroid(pts: list[list[float]]) -> list[float]:
    n = len(pts)
    return [round(sum(p[0] for p in pts) / n, 2), round(sum(p[1] for p in pts) / n, 2)]


with gzip.open("data/wuxing-street/map-wide.osm.gz") as f:
    root = ET.parse(f).getroot()

nodes: dict[str, tuple[float, float]] = {}
node_tags: dict[str, dict[str, str]] = {}
for n in root.findall("node"):
    nid = n.get("id")
    if not nid:
        continue
    nodes[nid] = (float(n.get("lat")), float(n.get("lon")))
    tags = {t.get("k"): t.get("v") for t in n.findall("tag")}
    if tags:
        node_tags[nid] = tags

ways: dict[str, tuple[list[str], dict[str, str]]] = {}
for w in root.findall("way"):
    wid = w.get("id")
    if not wid:
        continue
    refs = [nd.get("ref") for nd in w.findall("nd") if nd.get("ref") in nodes]
    tags = {t.get("k"): t.get("v") for t in w.findall("tag")}
    ways[wid] = (refs, tags)

# 1. 提取土地利用多边形（公园、树林、运动场、商业广场、河滩）
areas = []
for wid, (refs, tags) in ways.items():
    if len(refs) < 4 or refs[0] != refs[-1]:
        continue
    kind = None
    if tags.get("leisure") == "park":
        kind = "park"
    elif tags.get("natural") == "wood":
        kind = "wood"
    elif tags.get("leisure") in ("stadium", "pitch", "sports_hall"):
        kind = "pitch"
    elif tags.get("landuse") in ("retail", "commercial"):
        kind = "plaza"
    elif tags.get("natural") == "beach":
        kind = "beach"
    elif tags.get("landuse") == "religious":
        kind = "cultural"
    if not kind:
        continue

    pts = [wgs84_to_local(nodes[r][1], nodes[r][0]) for r in refs[:-1]]
    if len(pts) < 3:
        continue
    # 过滤完全在核心宽幅 1500m 外的超大块
    cx, cz = centroid(pts)
    if abs(cx) > 1400 or abs(cz) > 1600:
        continue
    areas.append({
        "id": f"way/{wid}",
        "name": tags.get("name") or "",
        "kind": kind,
        "center": [cx, cz],
        "points": pts,
    })

# 2. 提取真实地标（雕塑、公园、广场、桥梁、代表性高楼与商业地标）
landmarks = []
seen_names: set[str] = set()

PRIORITY_LANDMARKS = {
    "地王国际财富中心", "柳州博物馆", "华侨大厦", "工贸大厦", "东都大厦",
    "聚宝大厦", "中交大厦", "新大地商贸城", "金皇冠柏曼酒店", "柳州文化艺术中心",
    "柳侯公园", "马鞍山公园", "蟠龙山公园", "驾鹤小桃源", "柳州文庙",
    "柳州市体育场", "柳州市图书馆", "谷埠街国际商城", "银泰城",
    "文惠桥", "文昌桥", "红光大桥", "柳州五星", "人民广场", "兴隆大厦", "星河大厦",
}

# 2a. 雕塑 / 广场节点
for nid, tags in node_tags.items():
    name = tags.get("name")
    if name in ("柳州五星", "人民广场") and name not in seen_names:
        lat, lon = nodes[nid]
        x, z = wgs84_to_local(lon, lat)
        landmarks.append({
            "id": f"node/{nid}",
            "name": name,
            "kind": "sculpture" if name == "柳州五星" else "plaza",
            "position": [x, z],
            "heightHint": 6.0 if name == "柳州五星" else 14.0,
        })
        seen_names.add(name)

# 2b. 具名大厦、桥梁与公园
for wid, (refs, tags) in ways.items():
    name = tags.get("name")
    if not name or name not in PRIORITY_LANDMARKS or name in seen_names:
        continue
    pts = [wgs84_to_local(nodes[r][1], nodes[r][0]) for r in refs]
    if not pts:
        continue
    cx, cz = centroid(pts)
    if abs(cx) > 1250 or abs(cz) > 1450:
        continue
    kind = "building"
    h_hint = 32.0
    if tags.get("bridge") == "yes":
        kind = "bridge"
        h_hint = 16.0
    elif tags.get("leisure") == "park":
        kind = "park"
        h_hint = 18.0
    elif tags.get("landuse") in ("religious", "commercial") or tags.get("leisure") == "stadium":
        kind = "cultural"
        h_hint = 20.0
    elif tags.get("height"):
        try:
            h_hint = float(tags["height"].replace("m", "").strip())
        except ValueError:
            pass
    landmarks.append({
        "id": f"way/{wid}",
        "name": name,
        "kind": kind,
        "position": [cx, cz],
        "heightHint": round(h_hint, 1),
    })
    seen_names.add(name)

# 补入 manifest-overture 中的地王国际财富中心（若未在 map-wide way 命名中命中）
with open("public/models/wuxing-street/manifest-overture.json", encoding="utf-8") as f:
    ov = json.load(f)["buildings"]
for b in ov:
    name = (b.get("tags") or {}).get("name") or ""
    if name and (name in PRIORITY_LANDMARKS or "地王" in name) and name not in seen_names:
        cx, _, cz = b["position"]
        if abs(cx) <= 1250 and abs(cz) <= 1450:
            landmarks.append({
                "id": b["id"],
                "name": name,
                "kind": "skyscraper" if (b.get("modelHeight") or 0) > 100 else "building",
                "position": [round(cx, 2), round(cz, 2)],
                "heightHint": max(float(b.get("modelHeight") or 3.0), 34.0),
            })
            seen_names.add(name)

# 2c. 核心真实路牌点位（从 roads.json 选取核心主干道与五星街中段）
with open("public/models/wuxing-street/roads.json", encoding="utf-8") as f:
    roads = json.load(f)["roads"]

STREET_SIGN_NAMES = {
    "五星街", "解放南路", "中山东路", "中山西路", "龙城路",
    "广场路", "屏山大道", "滨江东路", "培新路", "五一路", "曙光中路",
}
street_signs = []
placed_roads: set[str] = set()
for r in roads:
    rname = r.get("name")
    if not rname or rname not in STREET_SIGN_NAMES or rname in placed_roads:
        continue
    pts = r["points"]
    if len(pts) < 2:
        continue
    # 优先选离五星街原点 (0,0) 最近的一段中点放路牌
    best_pt = None
    best_yaw = 0.0
    best_d = 1e9
    for i in range(len(pts) - 1):
        x1, z1 = pts[i]
        x2, z2 = pts[i + 1]
        mx, mz = (x1 + x2) / 2, (z1 + z2) / 2
        d = math.hypot(mx, mz)
        if d < best_d and d < 750:
            best_d = d
            dx, dz = x2 - x1, z2 - z1
            seg = math.hypot(dx, dz) or 1.0
            # 偏移到路边
            nx, nz = -dz / seg, dx / seg
            off = r["width"] / 2 + 1.15
            best_pt = [round(mx + nx * off, 2), round(mz + nz * off, 2)]
            best_yaw = round(math.atan2(dx, dz), 3)
    if best_pt:
        street_signs.append({
            "id": r["id"],
            "name": rname,
            "position": best_pt,
            "yaw": best_yaw,
        })
        placed_roads.add(rname)

landuse_out = {
    "source": "data/wuxing-street/map-wide.osm.gz",
    "license": "ODbL 1.0",
    "attribution": "© OpenStreetMap contributors",
    "origin": {"lon": OLON, "lat": OLAT, "node": "6038500119"},
    "areas": areas,
}
with open("public/models/wuxing-street/landuse.json", "w", encoding="utf-8") as f:
    json.dump(landuse_out, f, ensure_ascii=False, separators=(",", ":"))

landmarks_out = {
    "source": "data/wuxing-street/map-wide.osm.gz + manifest-overture.json",
    "license": "ODbL 1.0",
    "attribution": "© OpenStreetMap contributors · Overture Maps Foundation",
    "origin": {"lon": OLON, "lat": OLAT, "node": "6038500119"},
    "landmarks": landmarks,
    "streetSigns": street_signs,
}
with open("public/models/wuxing-street/landmarks.json", "w", encoding="utf-8") as f:
    json.dump(landmarks_out, f, ensure_ascii=False, indent=2)

print(f"Extracted {len(areas)} landuse areas -> public/models/wuxing-street/landuse.json")
print(f"Extracted {len(landmarks)} landmarks & {len(street_signs)} street signs -> public/models/wuxing-street/landmarks.json")
for lm in landmarks[:15]:
    print("  LM:", lm["name"], lm["kind"], lm["position"], f"h={lm['heightHint']}")
for ss in street_signs:
    print("  SIGN:", ss["name"], ss["position"])
