import sys,io,gzip,xml.etree.ElementTree as ET,json,math
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding='utf-8')
PI=math.pi;R=6378137.0;OLAT=24.3157756;OLON=109.4086882

def l2x(lon): return round((lon-OLON)*PI/180*R*math.cos(OLAT*PI/180),4)
def l2z(lat): return round(-(lat-OLAT)*PI/180*R,4)

CATS={'trunk':'major','trunk_link':'major','primary':'major','primary_link':'major',
      'secondary':'major','tertiary':'major','secondary_link':'major','tertiary_link':'major',
      'unclassified':'minor','residential':'minor','living_street':'minor','service':'service',
      'pedestrian':'pedestrian','footway':'path','cycleway':'path','steps':None,'platform':None}
WIDTHS={'major':8,'minor':5,'service':3,'pedestrian':6,'path':2}

with gzip.open('data/wuxing-street/map-wide.osm.gz') as f:
    root=ET.parse(f).getroot()

nodes={n.get('id'):(float(n.get('lat')),float(n.get('lon'))) for n in root.findall('node')}
roads=[]
for way in root.findall('way'):
    tags={t.get('k'):t.get('v') for t in way.findall('tag')}
    h=tags.get('highway')
    if not h: continue
    cat=CATS.get(h)
    if cat is None: continue
    if tags.get('tunnel')=='yes' or tags.get('layer','0')=='-1': continue
    pts=[[l2x(nodes[nd.get('ref')][1]),l2z(nodes[nd.get('ref')][0])]
         for nd in way.findall('nd') if nd.get('ref') in nodes]
    if len(pts)<2: continue
    roads.append({'id': 'way/'+way.get('id'),
                  'category':cat,'width':WIDTHS[cat],
                  'name':tags.get('name'),'points':pts})

out={'source':'data/wuxing-street/map-wide.osm.gz','license':'ODbL 1.0',
     'attribution':'(c) OpenStreetMap contributors',
     'origin':{'lon':OLON,'lat':OLAT},'roads':roads}

with open('public/models/wuxing-street/roads.json','w',encoding='utf-8') as f:
    json.dump(out,f,ensure_ascii=False,indent=2)
print(f'roads: {len(roads)} -> public/models/wuxing-street/roads.json')
