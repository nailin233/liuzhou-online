"""
将 Overture Maps GeoJSON 转换为项目 manifest 格式
输出：public/models/wuxing-street/manifest-overture.json

Overture 数据来源：
  OSM 建筑 (240) + 东亚 ML 建筑 (2651) = 2891 栋
许可：ODbL 1.0（因含 OSM 数据）
"""
import json, math, sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

PI = math.pi
ORIGIN_LON = 109.4086882
ORIGIN_LAT  = 24.3157756
R = 6378137.0

def wgs84_to_local(lon, lat):
    x = (lon - ORIGIN_LON) * PI/180 * R * math.cos(ORIGIN_LAT * PI/180)
    z = -(lat - ORIGIN_LAT) * PI/180 * R
    return round(x, 2), round(z, 2)

def centroid_and_outline(coords_ring):
    """外环节点 → 质心 + 本地坐标轮廓"""
    # 去掉闭合点
    pts = coords_ring[:-1] if coords_ring[0] == coords_ring[-1] else coords_ring
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    local_outline = [list(wgs84_to_local(p[0], p[1])) for p in pts]
    lx, lz = wgs84_to_local(cx, cy)
    return lx, lz, local_outline

src_path = "data/overture/liuzhou-buildings.geojson"
out_path = "public/models/wuxing-street/manifest-overture.json"

print(f"读取 {src_path} ...")
with open(src_path, encoding='utf-8') as f:
    geojson = json.load(f)

features = geojson['features']
print(f"总特征数: {len(features)}")

buildings = []
skipped = 0

for feat in features:
    props = feat.get('properties') or {}
    geom  = feat.get('geometry') or {}

    gtype = geom.get('type')
    coords = geom.get('coordinates')

    # 只处理 Polygon（MultiPolygon 取最大环）
    if gtype == 'Polygon' and coords:
        outer = coords[0]
    elif gtype == 'MultiPolygon' and coords:
        # 取面积最大的子多边形
        outer = max(coords, key=lambda p: len(p[0]))[0]
    else:
        skipped += 1
        continue

    if len(outer) < 4:
        skipped += 1
        continue

    # 坐标转换
    try:
        cx, cz, outline_local = centroid_and_outline(outer)
    except Exception:
        skipped += 1
        continue

    # 高度来源判断
    h    = props.get('height')
    lvl  = props.get('num_floors')
    if h and h > 0:
        height_source = 'osm.height'
        model_height  = round(float(h), 1)
    elif lvl and lvl > 0:
        height_source = 'osm.levels'
        model_height  = round(float(lvl) * 3.5, 1)
    else:
        height_source = 'missing'
        model_height  = 3.0

    # 数据来源标记
    sources = props.get('sources') or []
    source_datasets = [s.get('dataset', '') for s in sources]
    is_ml = any('zenodo' in d for d in source_datasets)
    is_osm = any('OpenStreetMap' in d for d in source_datasets)

    buildings.append({
        'id':           feat.get('id') or f"overture-{len(buildings)}",
        'overtureId':   feat.get('id'),
        'tags': {
            'name':     props.get('names', {}).get('primary', '') if props.get('names') else '',
            'building': props.get('subtype', 'yes'),
            'class':    props.get('class', ''),
        },
        'position':      [cx, 0.0, cz],
        'outline_local': outline_local,
        'heightSource':  height_source,
        'height':        h,
        'num_floors':    lvl,
        'modelHeight':   model_height,
        'sourceType':    'osm' if is_osm else 'ml',
        'file':          '',  # 程序化生成，无 GLB
    })

# 统计
osm_count = sum(1 for b in buildings if b['sourceType'] == 'osm')
ml_count  = sum(1 for b in buildings if b['sourceType'] == 'ml')
h_count   = sum(1 for b in buildings if b['heightSource'] == 'osm.height')
l_count   = sum(1 for b in buildings if b['heightSource'] == 'osm.levels')
m_count   = sum(1 for b in buildings if b['heightSource'] == 'missing')

print(f"\n建筑统计:")
print(f"  总计: {len(buildings)}")
print(f"  OSM 来源:  {osm_count}")
print(f"  ML 来源:   {ml_count}")
print(f"  有高度:    {h_count}")
print(f"  有层数:    {l_count}")
print(f"  缺失高度:  {m_count}")
print(f"  跳过无效: {skipped}")

manifest = {
    'source':       'Overture Maps 2026-11-18.0 + OpenStreetMap',
    'overtureRelease': '2026-11-18.0',
    'bbox':         [109.3990, 24.3050, 109.4190, 24.3300],
    'attribution':  '© OpenStreetMap contributors · Overture Maps Foundation',
    'license':      'ODbL 1.0',
    'copyrightUrl': 'https://www.openstreetmap.org/copyright',
    'overtureUrl':  'https://overturemaps.org/',
    'origin':       {'lon': ORIGIN_LON, 'lat': ORIGIN_LAT, 'node': '6038500119'},
    'units':        'm',
    'axes':         ['east', 'up', 'south'],
    'stats': {
        'total': len(buildings), 'osm': osm_count, 'ml': ml_count,
        'hasHeight': h_count, 'hasLevels': l_count, 'missing': m_count,
    },
    'buildings': buildings,
}

os.makedirs(os.path.dirname(out_path), exist_ok=True)
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(manifest, f, ensure_ascii=False, separators=(',', ':'))  # 紧凑格式节省空间

size_mb = os.path.getsize(out_path) / 1024 / 1024
print(f"\n已保存: {out_path}")
print(f"文件大小: {size_mb:.1f} MB")
