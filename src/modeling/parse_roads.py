"""
从 data/wuxing-street/map.osm.gz 解析道路网络
输出 public/models/wuxing-street/roads.json
"""
import gzip, xml.etree.ElementTree as ET, json, math, os, sys

ORIGIN_LON = 109.4086882
ORIGIN_LAT = 24.3157756
R = 6378137.0

def lon_to_x(lon):
    return (lon - ORIGIN_LON) * math.pi / 180 * R * math.cos(ORIGIN_LAT * math.pi / 180)

def lat_to_z(lat):
    return -(lat - ORIGIN_LAT) * math.pi / 180 * R

# 道路类型分类（按 art-direction.md）
ROAD_CATEGORIES = {
    'secondary': 'major', 'tertiary': 'major', 'secondary_link': 'major', 'tertiary_link': 'major',
    'unclassified': 'minor', 'residential': 'minor', 'living_street': 'minor', 'service': 'service',
    'pedestrian': 'pedestrian', 'footway': 'path', 'cycleway': 'path', 'steps': None,
    'platform': None,  # 公交站台不渲染
}

ROAD_WIDTHS = {'major': 8.0, 'minor': 5.0, 'service': 3.0, 'pedestrian': 6.0, 'path': 2.0}

script_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(os.path.dirname(script_dir))
osm_path = os.path.join(root_dir, 'data', 'wuxing-street', 'map.osm.gz')
out_path = os.path.join(root_dir, 'public', 'models', 'wuxing-street', 'roads.json')

print(f"读取: {osm_path}")
with gzip.open(osm_path, 'rb') as f:
    tree = ET.parse(f)
osm = tree.getroot()

# 收集所有节点坐标
nodes = {}
for node in osm.findall('node'):
    nodes[node.get('id')] = (float(node.get('lat')), float(node.get('lon')))

# 收集道路
roads = []
skipped = 0
for way in osm.findall('way'):
    tags = {t.get('k'): t.get('v') for t in way.findall('tag')}
    highway = tags.get('highway')
    if not highway:
        continue
    category = ROAD_CATEGORIES.get(highway)
    if category is None:
        skipped += 1
        continue
    # 地下tunnel跳过渲染
    if tags.get('tunnel') == 'yes' or tags.get('layer', '0') == '-1':
        skipped += 1
        continue

    nd_refs = [nd.get('ref') for nd in way.findall('nd')]
    points = []
    for ref in nd_refs:
        if ref in nodes:
            lat, lon = nodes[ref]
            points.append([round(lon_to_x(lon), 4), round(lat_to_z(lat), 4)])

    if len(points) < 2:
        continue

    roads.append({
        'id': f"way/{way.get('id')}",
        'category': category,
        'width': ROAD_WIDTHS[category],
        'name': tags.get('name'),
        'points': points,
    })

out = {
    'source': 'data/wuxing-street/map.osm.gz',
    'license': 'ODbL 1.0',
    'attribution': '© OpenStreetMap contributors',
    'origin': {'lon': ORIGIN_LON, 'lat': ORIGIN_LAT},
    'roads': roads,
}

os.makedirs(os.path.dirname(out_path), exist_ok=True)
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print(f"道路: {len(roads)} 条  跳过: {skipped} 条")
print(f"输出: {out_path}")
