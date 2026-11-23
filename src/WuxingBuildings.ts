/**
 * WuxingBuildings — 加载五星街建筑（支持「都市漫游窗格立面」与「数据检视洋红斜纹」一键无损切换）
 *
 * 加载优先级（按数据完整性）：
 *  1. manifest-overture.json  (Overture, 2891 栋，OSM + ML)
 *  2. manifest-wide.json      (OSM 宽幅, 240 栋)
 *  3. manifest.json           (GLB fallback, 34 栋)
 *
 * 坐标系：+X 东 / +Y 上 / +Z 南
 * ExtrudeGeometry 材质组：group 0 = 顶底盖 (top)，group 1 = 立面 (side)
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export type HeightSource = 'osm.height' | 'osm.levels' | 'missing';

export interface BuildingStats {
  total:     number;
  hasHeight: number;
  hasLevels: number;
  missing:   number;
  source:    string;
}

export interface BuildingColliderData {
  id:            string;
  outline_local: [number, number][];
  modelHeight:   number;
}

export interface BuildingStyleController {
  setVisualMode(auditMode: boolean, nightGlow: number): void;
}

export interface LoadBuildingsResult {
  group:           THREE.Group;
  stats:           BuildingStats;
  footprints:      BuildingColliderData[];
  styleController: BuildingStyleController;
}

// ── 都市漫游配色 vs 数据检视配色 ───────────────────────────────────────────────
const AUDIT_COLORS: Record<HeightSource, { side: number; top: number }> = {
  'osm.height': { side: 0xC9D2D6, top: 0xE4EBED },
  'osm.levels': { side: 0x9FB0B8, top: 0xBCC9CE },
  'missing':    { side: 0x5C4A57, top: 0x6E5868 },
};

const CITY_COLORS: Record<HeightSource, { side: number; top: number }> = {
  'osm.height': { side: 0xDCE6EE, top: 0xEDF3F7 },  // 地标高楼：浅蓝灰玻璃幕墙感
  'osm.levels': { side: 0xE2DACD, top: 0xEFECE6 },  // 有层数建筑：暖米白涂装
  'missing':    { side: 0xDDD4C7, top: 0xC9C2B8 },  // 占位高度建筑：明亮暖灰白城建基调
};

interface FacadeUniforms {
  uAuditMode: { value: number };
  uNightGlow: { value: number };
  uIsMissing: { value: number };
  uStripeCol: { value: THREE.Color };
}

/**
 * 注入双模式世界空间立面 Shader：
 *  - 都市模式（uAuditMode = 0）：程序化层线、玻璃窗格、底商雨棚色带与夜景随机暖黄窗灯
 *  - 数据检视模式（uAuditMode = 1）：缺失高度立面渲染 45° 洋红斜纹（art-direction.md §2.2）
 */
function attachBuildingFacadeShader(
  mat: THREE.MeshStandardMaterial,
  isMissing: boolean,
  uniformList: FacadeUniforms[],
): void {
  const uniforms: FacadeUniforms = {
    uAuditMode: { value: 0.0 },
    uNightGlow: { value: 0.0 },
    uIsMissing: { value: isMissing ? 1.0 : 0.0 },
    uStripeCol: { value: new THREE.Color(0xd9549b) },
  };
  uniformList.push(uniforms);

  mat.onBeforeCompile = shader => {
    shader.uniforms.uAuditMode = uniforms.uAuditMode;
    shader.uniforms.uNightGlow = uniforms.uNightGlow;
    shader.uniforms.uIsMissing = uniforms.uIsMissing;
    shader.uniforms.uStripeCol = uniforms.uStripeCol;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vWorldPos;\nvarying vec3 vWorldNorm;\nvarying float vWallU;',
      )
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
        vec3 wn = normalize(mat3(modelMatrix) * normal);
        vec2 tang = vec2(-wn.z, wn.x);
        vWorldPos = wp;
        vWorldNorm = wn;
        vWallU = dot(wp.xz, tang);
      `);

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWorldPos;
        varying vec3 vWorldNorm;
        varying float vWallU;
        uniform float uAuditMode;
        uniform float uNightGlow;
        uniform float uIsMissing;
        uniform vec3 uStripeCol;

        float bHash(vec2 p) {
          p = fract(p * vec2(127.1, 311.7));
          p += dot(p, p + 34.5);
          return fract(p.x * p.y);
        }`,
      )
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        bool isWall = abs(vWorldNorm.y) < 0.5;
        if (uAuditMode > 0.5) {
          if (uIsMissing > 0.5 && isWall) {
            float stripeDist = (vWallU + vWorldPos.y) * 0.70710678;
            float footprint = max(fwidth(stripeDist), 0.0001);
            float distToCenter = abs(mod(stripeDist + 0.9, 1.8) - 0.9);
            float stripe = 1.0 - smoothstep(0.3 - footprint * 0.5, 0.3 + footprint * 0.5, distToCenter);
            stripe = mix(stripe, 0.6 / 1.8, smoothstep(0.6, 1.8, footprint));
            diffuseColor.rgb = mix(diffuseColor.rgb, uStripeCol, stripe);
          }
        } else if (isWall) {
          // 轻微街区色彩变化，避免千楼一面
          vec2 blockId = floor(vWorldPos.xz / 18.0);
          float tintHash = bHash(blockId);
          vec3 warmTint = mix(vec3(0.95, 0.97, 1.0), vec3(1.03, 0.96, 0.90), tintHash);
          diffuseColor.rgb *= warmTint;

          // 层高 3.1m，水平窗距 2.4m
          float fy = mod(vWorldPos.y, 3.1);
          float fu = mod(vWallU, 2.4);
          float floorIdx = floor(vWorldPos.y / 3.1);
          float colIdx = floor(vWallU / 2.4);

          // 水平楼层腰线（浅暗细线）
          if (fy < 0.16) {
            diffuseColor.rgb *= 0.84;
          }

          // 窗户矩形区域（一楼底商为较宽橱窗，以上为标准住宅/写字楼窗）
          bool inWin = (vWorldPos.y > 0.55) &&
            (fu > 0.45 && fu < 1.95) &&
            (fy > 0.85 && fy < 2.45);
          if (inWin) {
            vec3 dayGlass = vec3(0.36, 0.52, 0.64);
            vec3 nightOff = vec3(0.11, 0.16, 0.24);
            vec3 glassCol = mix(dayGlass, nightOff, uNightGlow);
            // 窗格内柔和天光反射渐变
            float vGrad = smoothstep(0.85, 2.45, fy);
            glassCol *= (0.86 + 0.28 * vGrad);
            diffuseColor.rgb = glassCol;
          }
        }
      `)
      .replace('#include <emissivemap_fragment>', `
        #include <emissivemap_fragment>
        if (uAuditMode < 0.5 && uNightGlow > 0.05 && abs(vWorldNorm.y) < 0.5) {
          float fyE = mod(vWorldPos.y, 3.1);
          float fuE = mod(vWallU, 2.4);
          bool inWinE = (vWorldPos.y > 0.55) &&
            (fuE > 0.45 && fuE < 1.95) &&
            (fyE > 0.85 && fyE < 2.45);
          if (inWinE) {
            vec2 winCell = vec2(floor(vWallU / 2.4), floor(vWorldPos.y / 3.1) + floor(vWorldPos.x * 0.1));
            float lit = step(0.56, bHash(winCell));
            vec3 warmLamp = mix(vec3(1.0, 0.78, 0.45), vec3(0.85, 0.94, 1.0), step(0.85, bHash(winCell + 7.3)));
            totalEmissiveRadiance += warmLamp * lit * uNightGlow * 0.95;
          }
        }
      `);
  };
  mat.customProgramCacheKey = () => `liuzhou-facade-${isMissing ? 'm' : 'h'}`;
}

// ── 资源释放 ──────────────────────────────────────────────────────────────────
export function disposeBuildings(group: THREE.Group): void {
  const mats = new Set<THREE.Material>();
  group.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    o.geometry.dispose();
    const list = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of list) mats.add(m);
  });
  for (const m of mats) m.dispose();
}

// ── 单栋建筑挤出 ──────────────────────────────────────────────────────────────
export function extrudeBuildingGeometry(
  outline: [number, number][],
  height: number,
): THREE.BufferGeometry | null {
  if (outline.length < 3 || !(height > 0)) return null;
  try {
    const pts = (
      outline.length > 3 &&
      outline[0][0] === outline[outline.length - 1][0] &&
      outline[0][1] === outline[outline.length - 1][1]
    ) ? outline.slice(0, -1) : outline;
    if (pts.length < 3) return null;

    const shape = new THREE.Shape();
    shape.moveTo(pts[0][0], -pts[0][1]);
    for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], -pts[i][1]);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    return geo;
  } catch {
    return null;
  }
}

// ── 合并几何体（支持非索引 ExtrudeGeometry，按材质组 0=top / 1=side 分桶合并）──
export function mergeBuildingGeometries(
  geos: THREE.BufferGeometry[],
): THREE.BufferGeometry | null {
  if (geos.length === 0) return null;

  const bucketPos: [number[], number[]] = [[], []];
  const bucketNor: [number[], number[]] = [[], []];

  for (const raw of geos) {
    const g = raw.index ? raw.toNonIndexed() : raw;
    const pos = g.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos || pos.count === 0) {
      if (g !== raw) g.dispose();
      raw.dispose();
      continue;
    }
    const nor = g.getAttribute('normal') as THREE.BufferAttribute | undefined;
    const groups = g.groups.length > 0
      ? g.groups
      : [{ start: 0, count: pos.count, materialIndex: 0 }];

    for (const grp of groups) {
      const mIdx: 0 | 1 = grp.materialIndex === 1 ? 1 : 0;
      const outP = bucketPos[mIdx];
      const outN = bucketNor[mIdx];
      const end = Math.min(grp.start + grp.count, pos.count);
      for (let i = grp.start; i < end; i++) {
        outP.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        if (nor) outN.push(nor.getX(i), nor.getY(i), nor.getZ(i));
        else outN.push(0, 1, 0);
      }
    }

    if (g !== raw) g.dispose();
    raw.dispose();
  }

  const count0 = bucketPos[0].length / 3;
  const count1 = bucketPos[1].length / 3;
  const totalVerts = count0 + count1;
  if (totalVerts === 0) return null;

  const positions = new Float32Array(totalVerts * 3);
  const normals   = new Float32Array(totalVerts * 3);
  positions.set(bucketPos[0], 0);
  positions.set(bucketPos[1], bucketPos[0].length);
  normals.set(bucketNor[0], 0);
  normals.set(bucketNor[1], bucketNor[0].length);

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal',   new THREE.BufferAttribute(normals, 3));
  if (count0 > 0) merged.addGroup(0, count0, 0);
  if (count1 > 0) merged.addGroup(count0, count1, 1);
  merged.computeBoundingSphere();
  return merged;
}

// ── 程序化加载：批量挤出 + 合并 ──────────────────────────────────────────────
interface WideEntry {
  id:            string;
  tags:          Record<string, string>;
  position:      [number, number, number];
  outline_local: [number, number][];
  heightSource:  HeightSource;
  height:        number | null;
  num_floors:    number | null;
  modelHeight:   number;
  file?:         string;
}

interface WideManifest {
  attribution: string;
  source:      string;
  overtureRelease?: string;
  buildings:   WideEntry[];
}

async function loadProceduralManifest(
  base: URL, filename: string, label: string,
): Promise<LoadBuildingsResult | null> {
  try {
    const r = await fetch(new URL(filename, base));
    if (!r.ok) {
      console.warn(`[WuxingBuildings] ${filename} HTTP ${r.status}，尝试下一优先级数据源`);
      return null;
    }
    const m: WideManifest = await r.json();

    const groups: Record<HeightSource, WideEntry[]> = {
      'osm.height': [], 'osm.levels': [], 'missing': [],
    };
    const footprints: BuildingColliderData[] = [];
    for (const e of m.buildings) {
      groups[e.heightSource]?.push(e);
      if (Array.isArray(e.outline_local) && e.outline_local.length >= 3 && e.modelHeight > 0) {
        footprints.push({
          id: e.id,
          outline_local: e.outline_local,
          modelHeight: e.modelHeight,
        });
      }
    }

    const uniformList: FacadeUniforms[] = [];
    // Three.js ExtrudeGeometry: group 0 = 顶/底盖 (top)，group 1 = 立面 (side)
    const materials: Record<HeightSource, [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial]> = {} as never;
    for (const hs of ['osm.height', 'osm.levels', 'missing'] as HeightSource[]) {
      const top  = new THREE.MeshStandardMaterial({ color: CITY_COLORS[hs].top,  roughness: 0.86, metalness: 0 });
      const side = new THREE.MeshStandardMaterial({ color: CITY_COLORS[hs].side, roughness: 0.80, metalness: 0.04 });
      attachBuildingFacadeShader(side, hs === 'missing', uniformList);
      materials[hs] = [top, side];
    }

    const styleController: BuildingStyleController = {
      setVisualMode(auditMode: boolean, nightGlow: number) {
        const palette = auditMode ? AUDIT_COLORS : CITY_COLORS;
        for (const hs of ['osm.height', 'osm.levels', 'missing'] as HeightSource[]) {
          materials[hs][0].color.setHex(palette[hs].top);
          materials[hs][1].color.setHex(palette[hs].side);
        }
        for (const u of uniformList) {
          u.uAuditMode.value = auditMode ? 1.0 : 0.0;
          u.uNightGlow.value = auditMode ? 0.0 : nightGlow;
        }
      },
    };

    const rootGroup = new THREE.Group();
    rootGroup.name = 'wuxing-buildings';
    const stats: BuildingStats = {
      total: 0, hasHeight: 0, hasLevels: 0, missing: 0, source: label,
    };

    for (const hs of ['osm.height', 'osm.levels', 'missing'] as HeightSource[]) {
      const entries = groups[hs];
      if (entries.length === 0) continue;

      if (hs === 'missing' && entries.length > 50) {
        const BATCH = 1000;
        for (let bStart = 0; bStart < entries.length; bStart += BATCH) {
          const batch = entries.slice(bStart, bStart + BATCH);
          const geos: THREE.BufferGeometry[] = [];
          for (const e of batch) {
            const g = extrudeBuildingGeometry(e.outline_local, e.modelHeight);
            if (g) geos.push(g);
          }
          const merged = mergeBuildingGeometries(geos);
          if (merged) {
            const mesh = new THREE.Mesh(merged, materials[hs]);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.name = `buildings-missing-batch-${bStart}`;
            rootGroup.add(mesh);
          }
        }
      } else {
        for (const e of entries) {
          const geo = extrudeBuildingGeometry(e.outline_local, e.modelHeight);
          if (!geo) continue;
          const mesh = new THREE.Mesh(geo, materials[hs]);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.name = e.id;
          rootGroup.add(mesh);
        }
      }

      stats.total += entries.length;
      if (hs === 'osm.height') stats.hasHeight = entries.length;
      else if (hs === 'osm.levels') stats.hasLevels = entries.length;
      else stats.missing = entries.length;
    }

    return { group: rootGroup, stats, footprints, styleController };
  } catch (err) {
    console.error(`[WuxingBuildings] 加载 ${filename} 失败:`, err);
    return null;
  }
}

// ── 主入口 ───────────────────────────────────────────────────────────────────
export async function loadWuxingBuildings(): Promise<LoadBuildingsResult> {
  const base = new URL(import.meta.env.BASE_URL + 'models/wuxing-street/', document.baseURI);

  const overture = await loadProceduralManifest(base, 'manifest-overture.json', 'Overture 2891');
  if (overture) return overture;

  const wide = await loadProceduralManifest(base, 'manifest-wide.json', 'OSM 240');
  if (wide) return wide;

  return loadGlbFallback(base);
}

// ── GLB fallback ──────────────────────────────────────────────────────────────
interface GlbEntry { file: string; position: [number,number,number]; heightSource: HeightSource }
async function loadGlbFallback(base: URL): Promise<LoadBuildingsResult> {
  const response = await fetch(new URL('manifest.json', base));
  if (!response.ok) throw new Error(`manifest.json HTTP ${response.status}`);
  const { buildings }: { buildings: GlbEntry[] } = await response.json();
  const loader = new GLTFLoader();
  const group  = new THREE.Group();
  const shared = new Map<string, THREE.Material>();
  const uniformList: FacadeUniforms[] = [];
  const stats: BuildingStats = { total: 0, hasHeight: 0, hasLevels: 0, missing: 0, source: 'GLB 34' };
  const footprints: BuildingColliderData[] = [];
  await Promise.all(buildings.map(async e => {
    const { scene } = await loader.loadAsync(new URL(e.file, base).href);
    group.add(scene);
    scene.position.fromArray(e.position);
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    if (!box.isEmpty()) {
      footprints.push({
        id: e.file,
        outline_local: [
          [box.min.x, box.min.z],
          [box.max.x, box.min.z],
          [box.max.x, box.max.z],
          [box.min.x, box.max.z],
        ],
        modelHeight: Math.max(box.max.y, 3),
      });
    }
    scene.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      const mat = child.material as THREE.MeshStandardMaterial;
      const ex = shared.get(mat.name);
      if (ex) { if (ex !== mat) mat.dispose(); child.material = ex; }
      else {
        shared.set(mat.name, mat);
        if (e.heightSource === 'missing' && mat.name === 'missing-facade') {
          attachBuildingFacadeShader(mat, true, uniformList);
        }
      }
    });
    stats.total++;
    if (e.heightSource === 'osm.height') stats.hasHeight++;
    else if (e.heightSource === 'osm.levels') stats.hasLevels++;
    else stats.missing++;
  }));

  const styleController: BuildingStyleController = {
    setVisualMode(auditMode: boolean, nightGlow: number) {
      for (const u of uniformList) {
        u.uAuditMode.value = auditMode ? 1.0 : 0.0;
        u.uNightGlow.value = auditMode ? 0.0 : nightGlow;
      }
    },
  };
  return { group, stats, footprints, styleController };
}
