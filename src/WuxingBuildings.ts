/**
 * WuxingBuildings — 五星街建筑加载器（双模式：都市多层漫游 vs 数据检视白模）
 *
 * - 都市漫游模式（默认，晴日/日落/夜景）：
 *   * 实测高度（地王 311 m 等）与有层数建筑严格保持真实高度；
 *   * 缺失高度建筑按真实占地面积、OSM 业态与建筑名称（大厦/商厦/酒店等）生成确定性多层风格化楼高，
 *     配合底层商铺雨棚、多窗格立面、高层玻璃幕墙与夜景暖黄窗灯，还原真实柳州中心城区空间层次；
 * - 数据检视模式（audit）：
 *   * 瞬间切换为纯工程白模（缺失高度统一 3 m + 45° 洋红斜纹），完全遵守数据诚实原则。
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

const AUDIT_COLORS: Record<HeightSource, { side: number; top: number }> = {
  'osm.height': { side: 0xC9D2D6, top: 0xE4EBED },
  'osm.levels': { side: 0x9FB0B8, top: 0xBCC9CE },
  'missing':    { side: 0x5C4A57, top: 0x6E5868 },
};

const CITY_COLORS: Record<HeightSource, { side: number; top: number }> = {
  'osm.height': { side: 0xCFE0EC, top: 0xE6EEF4 },
  'osm.levels': { side: 0xE4DDD2, top: 0xCFC8BD },
  'missing':    { side: 0xDFD7CB, top: 0xC6C0B6 },
};

function polygonArea(pts: [number, number][]): number {
  if (!pts || pts.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[(i + 1) % pts.length];
    s += x1 * z2 - x2 * z1;
  }
  return Math.abs(s) * 0.5;
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** 漫游模式下按真实占地面积、OSM 业态与具名标签计算确定性多层楼高（仅用于都市视觉展示） */
export function computeStylizedCityHeight(entry: {
  id: string;
  tags?: Record<string, string>;
  outline_local: [number, number][];
  heightSource: HeightSource;
  modelHeight: number;
}): number {
  if (entry.heightSource === 'osm.height' || entry.heightSource === 'osm.levels') {
    return entry.modelHeight;
  }
  const area = polygonArea(entry.outline_local);
  const name = entry.tags?.name || '';
  const btype = (entry.tags?.building || entry.tags?.class || '').toLowerCase();
  const h = hashString(entry.id);

  // 具名大厦/商厦/酒店/公馆等柳州核心区高楼
  if (/大厦|财富|中心|酒店|公馆|花苑|广场|商厦|商城|银行/.test(name)) {
    const floors = 8 + Math.floor(h * 10); // 8–17 层
    return Math.round(floors * 3.2 * 10) / 10;
  }
  if (/博物馆|图书馆|艺术中心|医院|学校|中学|小学/.test(name)) {
    const floors = 4 + Math.floor(h * 4); // 4–7 层
    return Math.round(floors * 3.4 * 10) / 10;
  }
  if (btype === 'commercial' || btype === 'office' || btype === 'retail' || area > 750) {
    const floors = 6 + Math.floor(h * 7); // 6–12 层
    return Math.round(floors * 3.2 * 10) / 10;
  }
  if (btype === 'apartments' || btype === 'residential' || area > 260) {
    const floors = 4 + Math.floor(h * 5); // 4–8 层
    return Math.round(floors * 3.1 * 10) / 10;
  }
  if (area > 95) {
    const floors = 2 + Math.floor(h * 3); // 2–4 层临街商住楼
    return Math.round(floors * 3.1 * 10) / 10;
  }
  return Math.round((3.8 + h * 3.2) * 10) / 10;
}

interface CityFacadeUniforms {
  uNightGlow: { value: number };
}

/** 都市漫游立面 Shader：底商彩色雨棚橱窗 + 多层窗格/阳台中缝 + 高层玻璃幕墙 + 夜景暖灯 */
function attachCityFacadeShader(
  mat: THREE.MeshStandardMaterial,
  uniformList: CityFacadeUniforms[],
): void {
  const uniforms: CityFacadeUniforms = { uNightGlow: { value: 0.0 } };
  uniformList.push(uniforms);

  mat.onBeforeCompile = shader => {
    shader.uniforms.uNightGlow = uniforms.uNightGlow;
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
        uniform float uNightGlow;

        float bHash(vec2 p) {
          p = fract(p * vec2(127.1, 311.7));
          p += dot(p, p + 34.5);
          return fract(p.x * p.y);
        }`,
      )
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        if (abs(vWorldNorm.y) < 0.5) {
          vec2 blockId = floor(vWorldPos.xz / 22.0);
          float bh = bHash(blockId);
          // 广西城市建筑丰富立面底色（暖米白、淡陶土、浅灰蓝、象牙白）
          vec3 tint = bh < 0.25 ? vec3(1.02, 0.96, 0.89)
                    : bh < 0.50 ? vec3(0.95, 0.97, 1.02)
                    : bh < 0.75 ? vec3(1.00, 0.91, 0.84)
                                : vec3(0.92, 0.94, 0.92);
          diffuseColor.rgb *= tint;

          // 高层幕墙区 (y > 38m)：现代蓝灰玻璃幕墙感
          if (vWorldPos.y > 38.0) {
            float fyH = mod(vWorldPos.y, 3.6);
            float fuH = mod(vWallU, 2.2);
            bool spandrel = fyH < 0.55 || fuH < 0.14;
            vec3 glassSky = mix(vec3(0.32, 0.54, 0.72), vec3(0.10, 0.16, 0.25), uNightGlow);
            diffuseColor.rgb = spandrel ? vec3(0.76, 0.82, 0.87) * (1.0 - 0.55 * uNightGlow) : glassSky;
          } else if (vWorldPos.y < 3.55) {
            // 一楼临街商铺：深色门头框架 + 彩色雨棚/招牌带 + 透明玻璃橱窗
            float fuS = mod(vWallU, 3.6);
            if (vWorldPos.y > 2.75 && vWorldPos.y < 3.40) {
              // 五星街底商门头招牌色带（红 / 青绿 / 暖橙 / 藏蓝）
              float sh = bHash(vec2(floor(vWallU / 7.2), blockId.x + blockId.y));
              vec3 signCol = sh < 0.28 ? vec3(0.76, 0.24, 0.24)
                           : sh < 0.56 ? vec3(0.16, 0.50, 0.46)
                           : sh < 0.80 ? vec3(0.84, 0.52, 0.22)
                                       : vec3(0.18, 0.34, 0.56);
              diffuseColor.rgb = signCol;
            } else if (vWorldPos.y > 0.35 && vWorldPos.y <= 2.75 && fuS > 0.35 && fuS < 3.25) {
              // 商铺透明橱窗
              vec3 shopWin = mix(vec3(0.28, 0.40, 0.48), vec3(0.22, 0.19, 0.14), uNightGlow);
              diffuseColor.rgb = shopWin;
            } else {
              // 底层花岗岩踢脚与柱子
              diffuseColor.rgb *= 0.72;
            }
          } else {
            // 2F+ 标准楼层：水平楼板挑檐 + 带窗框的双格窗
            float fy = mod(vWorldPos.y - 3.55, 3.15);
            float fu = mod(vWallU, 2.5);
            if (fy < 0.22) {
              diffuseColor.rgb *= 0.80; // 楼板/阳台阴影视差
            } else if (fu > 0.38 && fu < 2.12 && fy > 0.78 && fy < 2.55) {
              bool frame = (fu < 0.48 || fu > 2.02 || fy < 0.88 || fy > 2.45 || abs(fu - 1.25) < 0.05);
              if (frame) {
                diffuseColor.rgb = vec3(0.24, 0.29, 0.34);
              } else {
                vec3 dayGlass = vec3(0.34, 0.53, 0.67);
                vec3 nightOff = vec3(0.09, 0.14, 0.22);
                float vGrad = smoothstep(0.88, 2.45, fy);
                diffuseColor.rgb = mix(dayGlass, nightOff, uNightGlow) * (0.84 + 0.32 * vGrad);
              }
            }
          }
        }
      `)
      .replace('#include <emissivemap_fragment>', `
        #include <emissivemap_fragment>
        if (uNightGlow > 0.05 && abs(vWorldNorm.y) < 0.5) {
          if (vWorldPos.y < 3.55) {
            // 夜间临街底商橱窗与招牌亮灯
            float fuS = mod(vWallU, 3.6);
            if (vWorldPos.y > 0.35 && vWorldPos.y <= 2.75 && fuS > 0.35 && fuS < 3.25) {
              totalEmissiveRadiance += vec3(1.0, 0.82, 0.52) * uNightGlow * 0.72;
            } else if (vWorldPos.y > 2.75 && vWorldPos.y < 3.40) {
              totalEmissiveRadiance += diffuseColor.rgb * uNightGlow * 0.45;
            }
          } else {
            float fyE = mod(vWorldPos.y - 3.55, 3.15);
            float fuE = mod(vWallU, 2.5);
            if (fuE > 0.48 && fuE < 2.02 && fyE > 0.88 && fyE < 2.45) {
              vec2 winCell = vec2(floor(vWallU / 2.5), floor(vWorldPos.y / 3.15) + floor((vWorldPos.x + vWorldPos.z) * 0.08));
              float lit = step(0.54, bHash(winCell));
              vec3 warmLamp = mix(vec3(1.0, 0.79, 0.46), vec3(0.84, 0.94, 1.0), step(0.82, bHash(winCell + 5.7)));
              totalEmissiveRadiance += warmLamp * lit * uNightGlow * 0.95;
            }
          }
        }
      `);
  };
  mat.customProgramCacheKey = () => 'liuzhou-city-facade-v2';
}

/** 数据检视模式立面 Shader：45° 洋红斜纹 */
function attachAuditStripeShader(mat: THREE.MeshStandardMaterial): void {
  mat.onBeforeCompile = shader => {
    shader.uniforms.stripeColor = { value: new THREE.Color(0xd9549b) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float stripeDistance;')
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
        vec3 wn = normalize(mat3(modelMatrix) * normal);
        vec2 tang = vec2(-wn.z, wn.x);
        stripeDistance = abs(wn.y) > 0.5 ? 0.9 : (dot(wp.xz, tang) + wp.y) * 0.70710678;
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float stripeDistance;\nuniform vec3 stripeColor;')
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        float footprint = max(fwidth(stripeDistance), 0.0001);
        float distToCenter = abs(mod(stripeDistance + 0.9, 1.8) - 0.9);
        float stripe = 1.0 - smoothstep(0.3 - footprint * 0.5, 0.3 + footprint * 0.5, distToCenter);
        stripe = mix(stripe, 0.6 / 1.8, smoothstep(0.6, 1.8, footprint));
        diffuseColor.rgb = mix(diffuseColor.rgb, stripeColor, stripe);
      `);
  };
  mat.customProgramCacheKey = () => 'liuzhou-audit-stripes';
}

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

function buildBatchedLayer(
  entriesByHs: Record<HeightSource, WideEntry[]>,
  materialsByHs: Record<HeightSource, [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial]>,
  heightFn: (e: WideEntry) => number,
  layerName: string,
): THREE.Group {
  const layer = new THREE.Group();
  layer.name = layerName;

  for (const hs of ['osm.height', 'osm.levels', 'missing'] as HeightSource[]) {
    const entries = entriesByHs[hs];
    if (entries.length === 0) continue;

    if (hs === 'missing' && entries.length > 50) {
      const BATCH = 1000;
      for (let bStart = 0; bStart < entries.length; bStart += BATCH) {
        const batch = entries.slice(bStart, bStart + BATCH);
        const geos: THREE.BufferGeometry[] = [];
        for (const e of batch) {
          const g = extrudeBuildingGeometry(e.outline_local, heightFn(e));
          if (g) geos.push(g);
        }
        const merged = mergeBuildingGeometries(geos);
        if (merged) {
          const mesh = new THREE.Mesh(merged, materialsByHs[hs]);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.name = `${layerName}-${hs}-${bStart}`;
          layer.add(mesh);
        }
      }
    } else {
      for (const e of entries) {
        const geo = extrudeBuildingGeometry(e.outline_local, heightFn(e));
        if (!geo) continue;
        const mesh = new THREE.Mesh(geo, materialsByHs[hs]);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.name = `${layerName}-${e.id}`;
        layer.add(mesh);
      }
    }
  }
  return layer;
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
          modelHeight: computeStylizedCityHeight(e),
        });
      }
    }

    const cityUniforms: CityFacadeUniforms[] = [];
    const cityMats: Record<HeightSource, [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial]> = {} as never;
    const auditMats: Record<HeightSource, [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial]> = {} as never;

    for (const hs of ['osm.height', 'osm.levels', 'missing'] as HeightSource[]) {
      const cTop  = new THREE.MeshStandardMaterial({ color: CITY_COLORS[hs].top,  roughness: 0.88, metalness: 0 });
      const cSide = new THREE.MeshStandardMaterial({ color: CITY_COLORS[hs].side, roughness: 0.78, metalness: 0.05 });
      attachCityFacadeShader(cSide, cityUniforms);
      cityMats[hs] = [cTop, cSide];

      const aTop  = new THREE.MeshStandardMaterial({ color: AUDIT_COLORS[hs].top,  roughness: 0.85, metalness: 0 });
      const aSide = new THREE.MeshStandardMaterial({ color: AUDIT_COLORS[hs].side, roughness: 0.85, metalness: 0 });
      if (hs === 'missing') attachAuditStripeShader(aSide);
      auditMats[hs] = [aTop, aSide];
    }

    const cityLayer  = buildBatchedLayer(groups, cityMats, e => computeStylizedCityHeight(e), 'buildings-city');
    const auditLayer = buildBatchedLayer(groups, auditMats, e => e.modelHeight, 'buildings-audit');
    auditLayer.visible = false;

    const rootGroup = new THREE.Group();
    rootGroup.name = 'wuxing-buildings';
    rootGroup.add(cityLayer, auditLayer);

    const stats: BuildingStats = {
      total:     groups['osm.height'].length + groups['osm.levels'].length + groups['missing'].length,
      hasHeight: groups['osm.height'].length,
      hasLevels: groups['osm.levels'].length,
      missing:   groups['missing'].length,
      source:    label,
    };

    const styleController: BuildingStyleController = {
      setVisualMode(auditMode: boolean, nightGlow: number) {
        cityLayer.visible  = !auditMode;
        auditLayer.visible = auditMode;
        for (const u of cityUniforms) {
          u.uNightGlow.value = auditMode ? 0.0 : nightGlow;
        }
      },
    };

    return { group: rootGroup, stats, footprints, styleController };
  } catch (err) {
    console.error(`[WuxingBuildings] 加载 ${filename} 失败:`, err);
    return null;
  }
}

export async function loadWuxingBuildings(): Promise<LoadBuildingsResult> {
  const base = new URL(import.meta.env.BASE_URL + 'models/wuxing-street/', document.baseURI);

  const overture = await loadProceduralManifest(base, 'manifest-overture.json', 'Overture 2891');
  if (overture) return overture;

  const wide = await loadProceduralManifest(base, 'manifest-wide.json', 'OSM 240');
  if (wide) return wide;

  return loadGlbFallback(base);
}

interface GlbEntry { file: string; position: [number,number,number]; heightSource: HeightSource }
async function loadGlbFallback(base: URL): Promise<LoadBuildingsResult> {
  const response = await fetch(new URL('manifest.json', base));
  if (!response.ok) throw new Error(`manifest.json HTTP ${response.status}`);
  const { buildings }: { buildings: GlbEntry[] } = await response.json();
  const loader = new GLTFLoader();
  const group  = new THREE.Group();
  const shared = new Map<string, THREE.Material>();
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
        if (e.heightSource === 'missing' && mat.name === 'missing-facade') attachAuditStripeShader(mat);
      }
    });
    stats.total++;
    if (e.heightSource === 'osm.height') stats.hasHeight++;
    else if (e.heightSource === 'osm.levels') stats.hasLevels++;
    else stats.missing++;
  }));

  return {
    group,
    stats,
    footprints,
    styleController: { setVisualMode() {} },
  };
}
