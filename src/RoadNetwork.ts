/**
 * RoadNetwork — 从 roads.json 加载道路网络并按类别合批生成带沿线 UV 的连续条带几何体
 *
 * 视觉双模式：
 *  - 都市漫游模式：主/次干道呈现柏油路面 + 白色虚线中线 + 白色路缘边线；
 *    五星街步行街呈现暖石砖铺装 + 广西街头标志性黄色盲道条带！
 *  - 数据检视模式：还原 art-direction.md §2.1 深色工程色板。
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

export interface RoadStyleController {
  setVisualMode(auditMode: boolean): void;
}

export interface LoadRoadsResult {
  group:           THREE.Group;
  roads:           RoadEntry[];
  styleController: RoadStyleController;
}

const AUDIT_ROAD_COLORS: Record<RoadCategory, number> = {
  major:      0x3A4954,
  minor:      0x33414B,
  service:    0x2C3943,
  pedestrian: 0x5A6B62,
  path:       0x4A5A55,
};

const CITY_ROAD_COLORS: Record<RoadCategory, number> = {
  major:      0x363E46,  // 柏油主干道
  minor:      0x454E57,  // 次干道柏油
  service:    0x565E66,  // 支路
  pedestrian: 0xCBBFA8,  // 五星街暖米色石砖步行街
  path:       0xBDB5A6,  // 人行道石板
};

const ROAD_ELEVATION: Record<RoadCategory, number> = {
  path:       0.024,
  service:    0.028,
  pedestrian: 0.032,
  minor:      0.036,
  major:      0.042,
};

/**
 * 将一条道路折线转为 XZ 平面连续条带的顶点、UV(沿线米数, 横向 -1..+1) 和索引（法线朝 +Y）。
 */
export function buildRoadRibbon(
  rawPoints: [number, number][],
  width: number,
  elevation: number,
): { positions: number[]; uvs: number[]; indices: number[] } {
  const pts: [number, number][] = [];
  for (const p of rawPoints) {
    const prev = pts[pts.length - 1];
    if (!prev || Math.hypot(p[0] - prev[0], p[1] - prev[1]) > 0.05) {
      pts.push(p);
    }
  }
  if (pts.length < 2 || !(width > 0)) return { positions: [], uvs: [], indices: [] };

  const half = width / 2;
  const n = pts.length;

  const dirs: [number, number][] = [];
  const segLens: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0];
    const dz = pts[i + 1][1] - pts[i][1];
    const len = Math.hypot(dx, dz) || 1;
    dirs.push([dx / len, dz / len]);
    segLens.push(len);
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let accumLen = 0;

  for (let i = 0; i < n; i++) {
    if (i > 0) accumLen += segLens[i - 1];
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
        const dot = Math.max(0.5, mx * n2x + mz * n2z);
        nx = mx;
        nz = mz;
        scale = half / dot;
      }
    }

    const [x, z] = pts[i];
    positions.push(x + nx * scale, elevation, z + nz * scale);
    positions.push(x - nx * scale, elevation, z - nz * scale);
    uvs.push(accumLen, 1.0);
    uvs.push(accumLen, -1.0);

    if (i > 0) {
      const b = (i - 1) * 2;
      indices.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
  }

  return { positions, uvs, indices };
}

/** 将同一类别的多条道路合并为单个 BufferGeometry */
export function buildCategoryRoadGeometry(
  roads: RoadEntry[],
  category: RoadCategory,
): THREE.BufferGeometry | null {
  const elevation = ROAD_ELEVATION[category] ?? 0.036;
  const allPos: number[] = [];
  const allUv:  number[] = [];
  const allIdx: number[] = [];
  let vertBase = 0;

  for (const road of roads) {
    const { positions, uvs, indices } = buildRoadRibbon(road.points, road.width, elevation);
    if (positions.length === 0) continue;
    for (let i = 0; i < positions.length; i++) allPos.push(positions[i]);
    for (let i = 0; i < uvs.length; i++) allUv.push(uvs[i]);
    for (let i = 0; i < indices.length; i++) allIdx.push(indices[i] + vertBase);
    vertBase += positions.length / 3;
  }

  if (allPos.length === 0) return null;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(allPos, 3));
  geo.setAttribute('uv',       new THREE.Float32BufferAttribute(allUv, 2));
  geo.setIndex(allIdx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/** 为道路材质注入程序化车道标线 / 步行街砖纹与盲道 Shader */
function attachRoadMarkingShader(
  mat: THREE.MeshStandardMaterial,
  cat: RoadCategory,
  auditUniforms: { value: number }[],
): void {
  const uAudit = { value: 0.0 };
  auditUniforms.push(uAudit);

  const kind = cat === 'major' ? 1 : cat === 'pedestrian' ? 2 : cat === 'minor' ? 3 : 0;
  if (kind === 0) return;

  mat.onBeforeCompile = shader => {
    shader.uniforms.uAudit = uAudit;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRoadUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRoadUv = uv;');

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRoadUv;\nuniform float uAudit;')
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        if (uAudit < 0.5) {
          float av = abs(vRoadUv.y);
          ${kind === 1 ? `
            // 主干道：中心白色虚线 + 双侧白边线 + 微微柏油颗粒
            float dash = step(0.42, fract(vRoadUv.x / 7.5));
            float centerLine = (1.0 - smoothstep(0.025, 0.045, av)) * dash;
            float edgeLine = smoothstep(0.87, 0.91, av) * (1.0 - smoothstep(0.95, 0.98, av));
            float curb = smoothstep(0.96, 1.0, av);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.95, 0.96), max(centerLine * 0.9, edgeLine * 0.65));
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.76, 0.78, 0.76), curb * 0.85);
          ` : kind === 2 ? `
            // 五星街步行街：广场石砖格纹 + 两侧黄色盲道条带
            float gx = smoothstep(0.92, 0.99, fract(vRoadUv.x / 1.2));
            float gy = smoothstep(0.90, 0.99, fract((vRoadUv.y + 1.0) * 3.0));
            diffuseColor.rgb *= (1.0 - max(gx, gy) * 0.11);
            float tactile = smoothstep(0.68, 0.71, av) * (1.0 - smoothstep(0.79, 0.82, av));
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.77, 0.30), tactile * 0.92);
            float curbP = smoothstep(0.93, 0.98, av);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.72, 0.68, 0.62), curbP * 0.7);
          ` : `
            // 次干道：柔和边线与微路缘
            float edgeM = smoothstep(0.89, 0.93, av) * (1.0 - smoothstep(0.96, 0.99, av));
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.84, 0.87, 0.88), edgeM * 0.45);
          `}
        }
      `);
  };
  mat.customProgramCacheKey = () => `liuzhou-road-${cat}`;
}

export async function loadRoadNetwork(): Promise<LoadRoadsResult> {
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

  const matsByCat = new Map<RoadCategory, THREE.MeshStandardMaterial>();
  const auditUniforms: { value: number }[] = [];

  for (const cat of ['path', 'service', 'pedestrian', 'minor', 'major'] as RoadCategory[]) {
    const geo = buildCategoryRoadGeometry(byCategory[cat], cat);
    if (!geo) continue;
    const mat = new THREE.MeshStandardMaterial({
      color: CITY_ROAD_COLORS[cat],
      roughness: 0.92,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    attachRoadMarkingShader(mat, cat, auditUniforms);
    matsByCat.set(cat, mat);

    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `roads-${cat}`;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  const styleController: RoadStyleController = {
    setVisualMode(auditMode: boolean) {
      const pal = auditMode ? AUDIT_ROAD_COLORS : CITY_ROAD_COLORS;
      for (const [cat, mat] of matsByCat) {
        mat.color.setHex(pal[cat]);
      }
      for (const u of auditUniforms) {
        u.value = auditMode ? 1.0 : 0.0;
      }
    },
  };

  return { group, roads: manifest.roads, styleController };
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
