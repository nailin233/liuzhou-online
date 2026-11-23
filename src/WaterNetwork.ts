/**
 * WaterNetwork — 从 waterways.json 加载柳江等水系
 * art-direction.md §2.1: 水体 #1F4A5C, roughness=0.35
 *
 * 坐标系：+X 东 / +Y 上 / +Z 南
 * 层高：y = 0.015（高于地面 0.005 与网格 0.010，低于道路 0.024–0.042）
 */
import * as THREE from 'three';

interface WaterwayEntry {
  id: string;
  name: string;
  type: string;    // 'river' | 'water'
  closed: boolean;
  points: [number, number][];  // [x(东), z(南)] 本地坐标
  width: number;
}

interface WaterManifest {
  attribution: string;
  waterways: WaterwayEntry[];
}

const WATER_COLOR   = 0x1F4A5C;
const WATER_ROUGH   = 0.35;
const RIVER_DEFAULT = 50;  // 默认河宽 (m)，仅作中心线示意
export const WATER_ELEVATION = 0.016;

/** 将河流中心线折线转为法线朝 +Y 的条带几何体 */
export function buildRiverStripGeometry(
  rawPoints: [number, number][],
  width: number,
): THREE.BufferGeometry | null {
  const pts: [number, number][] = [];
  for (const p of rawPoints) {
    const prev = pts[pts.length - 1];
    if (!prev || Math.hypot(p[0] - prev[0], p[1] - prev[1]) > 0.1) pts.push(p);
  }
  if (pts.length < 2 || !(width > 0)) return null;

  const positions: number[] = [];
  const indices:   number[] = [];
  const half = width / 2;

  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i];
    let dx = 0, dz = 0;
    if (i === 0) {
      dx = pts[1][0] - pts[0][0]; dz = pts[1][1] - pts[0][1];
    } else if (i === pts.length - 1) {
      dx = pts[i][0] - pts[i - 1][0]; dz = pts[i][1] - pts[i - 1][1];
    } else {
      dx = pts[i + 1][0] - pts[i - 1][0]; dz = pts[i + 1][1] - pts[i - 1][1];
    }
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len, nz = dx / len;

    positions.push(x + nx * half, 0, z + nz * half);
    positions.push(x - nx * half, 0, z - nz * half);

    if (i > 0) {
      const b = (i - 1) * 2;
      // 朝 +Y 向上法线绕序：(b, b+2, b+1) 与 (b+1, b+2, b+3)
      indices.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * 将闭合水体轮廓（[east(x), south(z)]）转为 XZ 平面面几何体（法线朝 +Y）。
 * Shape 传入 (x, -z)，经 rotateX(-π/2) 后保持 (x, 0, +z)，无南北镜像。
 */
export function buildWaterPolygonGeometry(
  rawPoints: [number, number][],
): THREE.BufferGeometry | null {
  if (rawPoints.length < 3) return null;
  const pts = (
    rawPoints.length > 3 &&
    rawPoints[0][0] === rawPoints[rawPoints.length - 1][0] &&
    rawPoints[0][1] === rawPoints[rawPoints.length - 1][1]
  ) ? rawPoints.slice(0, -1) : rawPoints;
  if (pts.length < 3) return null;

  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], -pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], -pts[i][1]);
  shape.closePath();

  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

export async function loadWaterNetwork(): Promise<THREE.Group> {
  const base = new URL(import.meta.env.BASE_URL + 'models/wuxing-street/', document.baseURI);
  const response = await fetch(new URL('waterways.json', base));
  if (!response.ok) throw new Error(`waterways.json · HTTP ${response.status}`);
  const manifest: WaterManifest = await response.json();

  const mat = new THREE.MeshStandardMaterial({
    color: WATER_COLOR,
    roughness: WATER_ROUGH,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -0.5,
    polygonOffsetUnits: -0.5,
  });

  const group = new THREE.Group();
  group.name = 'water-network';

  for (const w of manifest.waterways) {
    let geo: THREE.BufferGeometry | null = null;
    if (w.closed && w.points.length >= 3) {
      geo = buildWaterPolygonGeometry(w.points);
    } else if (w.type === 'river' || w.type === 'stream' || w.type === 'canal') {
      geo = buildRiverStripGeometry(w.points, w.width ?? RIVER_DEFAULT);
    } else if (w.points.length >= 3) {
      geo = buildWaterPolygonGeometry(w.points);
    }

    if (geo) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = WATER_ELEVATION;
      mesh.receiveShadow = true;
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
