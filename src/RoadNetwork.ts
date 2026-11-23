/**
 * RoadNetwork — 从 roads.json 加载道路网络并按类别合批生成连续条带几何体
 * 颜色按 art-direction.md §2.1 场景色板
 *
 * 坐标系：+X 东 / +Y 上 / +Z 南
 * 性能：按 5 个类别合并为最多 5 个 Mesh（极大降低 Draw Calls）
 */
import * as THREE from 'three';

export type RoadCategory = 'major' | 'minor' | 'service' | 'pedestrian' | 'path';

export interface RoadEntry {
  id: string;
  category: RoadCategory;
  width: number;
  name: string | null;
  points: [number, number][];  // [x(东), z(南)] 本地坐标
}

interface RoadsManifest {
  attribution: string;
  roads: RoadEntry[];
}

const ROAD_COLORS: Record<RoadCategory, number> = {
  major:      0x3A4954,
  minor:      0x33414B,
  service:    0x2C3943,
  pedestrian: 0x5A6B62,
  path:       0x4A5A55,
};

// 按等级微调 Y 高度，避免交叉口共面 Z-fighting（均高于地面 0.005 与水体 0.015）
const ROAD_ELEVATION: Record<RoadCategory, number> = {
  path:       0.024,
  service:    0.028,
  pedestrian: 0.032,
  minor:      0.036,
  major:      0.042,
};

/**
 * 将一条道路折线转为 XZ 平面连续条带的顶点和索引（法线朝 +Y）。
 * 转角采用斜接（miter），最大拉伸限制为半宽的 2 倍，消除转角 V 形缝隙。
 */
export function buildRoadRibbon(
  rawPoints: [number, number][],
  width: number,
  elevation: number,
): { positions: number[]; indices: number[] } {
  // 过滤相邻重复点
  const pts: [number, number][] = [];
  for (const p of rawPoints) {
    const prev = pts[pts.length - 1];
    if (!prev || Math.hypot(p[0] - prev[0], p[1] - prev[1]) > 0.05) {
      pts.push(p);
    }
  }
  if (pts.length < 2 || !(width > 0)) return { positions: [], indices: [] };

  const half = width / 2;
  const n = pts.length;

  // 每段单位方向向量 d[i] 与左侧法线 (left = (-dz, dx) 在 +X东/+Z南 平面中)
  const dirs: [number, number][] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0];
    const dz = pts[i + 1][1] - pts[i][1];
    const len = Math.hypot(dx, dz) || 1;
    dirs.push([dx / len, dz / len]);
  }

  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < n; i++) {
    let nx = 0, nz = 0, scale = half;
    if (i === 0) {
      nx = -dirs[0][1];
      nz =  dirs[0][0];
    } else if (i === n - 1) {
      nx = -dirs[n - 2][1];
      nz =  dirs[n - 2][0];
    } else {
      const n1x = -dirs[i - 1][1], n1z = dirs[i - 1][0];
      const n2x = -dirs[i][1],     n2z = dirs[i][0];
      let mx = n1x + n2x;
      let mz = n1z + n2z;
      const mlen = Math.hypot(mx, mz);
      if (mlen < 1e-4) {
        nx = n2x;
        nz = n2z;
      } else {
        mx /= mlen;
        mz /= mlen;
        const dot = Math.max(0.5, mx * n2x + mz * n2z); // 限制斜接最长不超过 2 * half
        nx = mx;
        nz = mz;
        scale = half / dot;
      }
    }

    const [x, z] = pts[i];
    // 顶点 2i: +normal 侧；顶点 2i+1: -normal 侧
    positions.push(x + nx * scale, elevation, z + nz * scale);
    positions.push(x - nx * scale, elevation, z - nz * scale);

    if (i > 0) {
      const b = (i - 1) * 2;
      // 校验绕序：沿 +X 行进时 normal=(0,1)，b=(0,0,+h), b+1=(0,0,-h), b+2=(1,0,+h)
      // (b+2 - b) × (b+1 - b) = (1,0,0) × (0,0,-2h) = (0,+2h,0) 朝 +Y 向上
      indices.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
  }

  return { positions, indices };
}

/** 将同一类别的多条道路合并为单个 BufferGeometry */
export function buildCategoryRoadGeometry(
  roads: RoadEntry[],
  category: RoadCategory,
): THREE.BufferGeometry | null {
  const elevation = ROAD_ELEVATION[category] ?? 0.036;
  const allPos: number[] = [];
  const allIdx: number[] = [];
  let vertBase = 0;

  for (const road of roads) {
    const { positions, indices } = buildRoadRibbon(road.points, road.width, elevation);
    if (positions.length === 0) continue;
    for (let i = 0; i < positions.length; i++) allPos.push(positions[i]);
    for (let i = 0; i < indices.length; i++) allIdx.push(indices[i] + vertBase);
    vertBase += positions.length / 3;
  }

  if (allPos.length === 0) return null;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(allPos, 3));
  geo.setIndex(allIdx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

export async function loadRoadNetwork(): Promise<THREE.Group> {
  const base = new URL(import.meta.env.BASE_URL + 'models/wuxing-street/', document.baseURI);
  const response = await fetch(new URL('roads.json', base));
  if (!response.ok) throw new Error(`roads.json · HTTP ${response.status}`);
  const manifest: RoadsManifest = await response.json();

  const byCategory: Record<RoadCategory, RoadEntry[]> = {
    major: [], minor: [], service: [], pedestrian: [], path: [],
  };
  for (const road of manifest.roads) {
    const cat: RoadCategory = road.category in byCategory ? road.category : 'minor';
    byCategory[cat].push(road);
  }

  const group = new THREE.Group();
  group.name = 'road-network';
  group.userData.roadCount = manifest.roads.length;

  for (const cat of ['path', 'service', 'pedestrian', 'minor', 'major'] as RoadCategory[]) {
    const geo = buildCategoryRoadGeometry(byCategory[cat], cat);
    if (!geo) continue;
    const mat = new THREE.MeshStandardMaterial({
      color: ROAD_COLORS[cat],
      roughness: 0.95,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `roads-${cat}`;
    mesh.receiveShadow = true;
    group.add(mesh);
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
