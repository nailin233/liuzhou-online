/**
 * WaterNetwork — 从 waterways.json 加载柳江等水系
 * art-direction.md §2.1: 水体 #1F4A5C, roughness=0.35
 */
import * as THREE from 'three';

interface WaterwayEntry {
  id: string;
  name: string;
  type: string;    // 'river' | 'water'
  closed: boolean;
  points: [number, number][];  // [x, z] 本地坐标
  width: number;
}

interface WaterManifest {
  attribution: string;
  waterways: WaterwayEntry[];
}

const WATER_COLOR   = 0x1F4A5C;
const WATER_ROUGH   = 0.35;
const RIVER_DEFAULT = 50;  // 默认河宽 (m)

function buildRiverStrip(pts: [number, number][], width: number, mat: THREE.Material): THREE.Mesh {
  // 把折线变成带宽的矩形条带（沿折线方向展宽）
  if (pts.length < 2) return new THREE.Mesh();
  const positions: number[] = [];
  const indices:   number[] = [];
  const half = width / 2;

  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i];
    // 计算法向量（垂直于折线方向）
    let dx = 0, dz = 0;
    if (i === 0) {
      dx = pts[1][0] - pts[0][0]; dz = pts[1][1] - pts[0][1];
    } else if (i === pts.length - 1) {
      dx = pts[i][0] - pts[i-1][0]; dz = pts[i][1] - pts[i-1][1];
    } else {
      dx = pts[i+1][0] - pts[i-1][0]; dz = pts[i+1][1] - pts[i-1][1];
    }
    const len = Math.sqrt(dx*dx + dz*dz) || 1;
    const nx = -dz / len, nz = dx / len;  // 垂直方向

    positions.push(x + nx*half, 0, z + nz*half);
    positions.push(x - nx*half, 0, z - nz*half);

    if (i > 0) {
      const base = (i - 1) * 2;
      indices.push(base, base+1, base+2, base+1, base+3, base+2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.005;  // 比地面略高
  mesh.receiveShadow = true;
  return mesh;
}

function buildWaterPolygon(pts: [number, number][], mat: THREE.Material): THREE.Mesh | null {
  if (pts.length < 3) return null;
  // Three.js ShapeGeometry 在 XZ 平面
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();

  const geo = new THREE.ShapeGeometry(shape);
  // ShapeGeometry 在 XY 平面，旋转到 XZ
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.005;
  mesh.receiveShadow = true;
  return mesh;
}

export async function loadWaterNetwork(): Promise<THREE.Group> {
  const base = new URL(import.meta.env.BASE_URL + 'models/wuxing-street/', document.baseURI);
  const response = await fetch(new URL('waterways.json', base));
  if (!response.ok) throw new Error(`waterways.json · HTTP ${response.status}`);
  const manifest: WaterManifest = await response.json();

  const mat = new THREE.MeshStandardMaterial({
    color:    WATER_COLOR,
    roughness: WATER_ROUGH,
    metalness: 0,
  });

  const group = new THREE.Group();
  group.name = 'water-network';

  for (const w of manifest.waterways) {
    let mesh: THREE.Mesh | null = null;

    if (w.closed && w.points.length >= 3) {
      // 闭合面（湖泊、水体）
      mesh = buildWaterPolygon(w.points, mat);
    } else if (w.type === 'river' || w.type === 'stream' || w.type === 'canal') {
      // 河流折线 → 带宽条带
      const width = w.width ?? RIVER_DEFAULT;
      mesh = buildRiverStrip(w.points, width, mat);
    } else if (w.points.length >= 3) {
      // 其他闭合水体
      mesh = buildWaterPolygon(w.points, mat);
    }

    if (mesh) {
      mesh.name = w.id;
      group.add(mesh);
    }
  }

  return group;
}

export function disposeWater(group: THREE.Group): void {
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
