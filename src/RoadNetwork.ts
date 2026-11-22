/**
 * RoadNetwork — 从 roads.json 加载道路网络并生成 Three.js 几何体
 * 颜色按 art-direction.md § 2.1 场景色板
 */
import * as THREE from 'three';

interface RoadEntry {
  id: string;
  category: 'major' | 'minor' | 'service' | 'pedestrian' | 'path';
  width: number;
  name: string | null;
  points: [number, number][];  // [x, z] 本地坐标
}

interface RoadsManifest {
  attribution: string;
  roads: RoadEntry[];
}

// 颜色按 art-direction.md 表格
const ROAD_COLORS: Record<string, number> = {
  major:      0x3A4954,
  minor:      0x33414B,
  service:    0x2C3943,
  pedestrian: 0x5A6B62,
  path:       0x4A5A55,
};

function buildRoadSegment(
  p1: THREE.Vector3, p2: THREE.Vector3,
  width: number, material: THREE.Material
): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const len = dir.length();
  if (len < 0.01) return new THREE.Mesh();

  // 沿 XZ 平面的矩形板
  const geo = new THREE.PlaneGeometry(len, width);
  const mesh = new THREE.Mesh(geo, material);

  // 旋转：PlaneGeometry 默认在 XY 平面，先旋转到 XZ 平面，再对齐方向
  const angle = Math.atan2(dir.x, dir.z);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = -angle;  // 注意旋转顺序
  // 位移到线段中点，抬高 1cm 防 z-fighting
  mesh.position.set(
    (p1.x + p2.x) / 2,
    0.01,
    (p1.z + p2.z) / 2
  );
  mesh.receiveShadow = true;
  return mesh;
}

function buildRoad(road: RoadEntry, material: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = road.id;
  for (let i = 0; i < road.points.length - 1; i++) {
    const [x1, z1] = road.points[i];
    const [x2, z2] = road.points[i + 1];
    const seg = buildRoadSegment(
      new THREE.Vector3(x1, 0, z1),
      new THREE.Vector3(x2, 0, z2),
      road.width,
      material
    );
    if (seg.geometry.attributes.position) group.add(seg);
  }
  return group;
}

export async function loadRoadNetwork(): Promise<THREE.Group> {
  const base = new URL(import.meta.env.BASE_URL + 'models/wuxing-street/', document.baseURI);
  const response = await fetch(new URL('roads.json', base));
  if (!response.ok) throw new Error(`roads.json · HTTP ${response.status}`);
  const manifest: RoadsManifest = await response.json();

  // 共享材质：每个 category 一个
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  for (const [cat, color] of Object.entries(ROAD_COLORS)) {
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.95,
      metalness: 0,
    });
    materials.set(cat, mat);
  }

  const group = new THREE.Group();
  group.name = 'road-network';
  for (const road of manifest.roads) {
    const mat = materials.get(road.category) ?? materials.get('minor')!;
    group.add(buildRoad(road, mat));
  }
  return group;
}

export function disposeRoads(group: THREE.Group): void {
  const mats = new Set<THREE.Material>();
  group.traverse(o => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) mats.add(m);
    }
  });
  for (const m of mats) m.dispose();
}
