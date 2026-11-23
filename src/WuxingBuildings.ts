/**
 * WuxingBuildings — 加载五星街建筑
 *
 * 加载优先级（按数据完整性）：
 *  1. manifest-overture.json  (Overture, 2891 栋，OSM + ML)
 *  2. manifest-wide.json      (OSM 宽幅, 240 栋)
 *  3. manifest.json           (GLB fallback, 34 栋)
 *
 * 坐标系：+X 东 / +Y 上 / +Z 南
 * ExtrudeGeometry 材质组：group 0 = 顶底盖 (top)，group 1 = 立面 (side)
 *
 * 颜色 (art-direction.md §2.2)：
 *  osm.height  立面 #C9D2D6 / 顶面 #E4EBED
 *  osm.levels  立面 #9FB0B8 / 顶面 #BCC9CE
 *  missing     立面 #5C4A57 / 顶面 #6E5868 + 斜纹 shader
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export type HeightSource = 'osm.height' | 'osm.levels' | 'missing';

export interface BuildingStats {
  total:     number;
  hasHeight: number;
  hasLevels: number;
  missing:   number;
  source:    string;  // 数据来源标签
}

// ── 颜色 ──────────────────────────────────────────────────────────────────────
const COLORS: Record<HeightSource, { side: number; top: number }> = {
  'osm.height': { side: 0xC9D2D6, top: 0xE4EBED },
  'osm.levels': { side: 0x9FB0B8, top: 0xBCC9CE },
  'missing':    { side: 0x5C4A57, top: 0x6E5868 },
};

// ── missing 建筑斜纹 shader ───────────────────────────────────────────────────
function enableMissingHeightStripes(mat: THREE.MeshStandardMaterial): void {
  mat.onBeforeCompile = shader => {
    shader.uniforms.stripeColor = { value: new THREE.Color(0xd9549b) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float stripeDistance;')
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
        vec3 wallNormal = normalize(mat3(modelMatrix) * normal);
        vec2 tangent = vec2(-wallNormal.z, wallNormal.x);
        stripeDistance = abs(wallNormal.y) > 0.5 ? 0.9 : (dot(world.xz, tangent) + world.y) * 0.70710678;
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float stripeDistance;\nuniform vec3 stripeColor;')
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        float footprint = max(fwidth(stripeDistance), 0.0001);
        float distToCenter = abs(mod(stripeDistance + 0.9, 1.8) - 0.9);
        float stripe = 1.0 - smoothstep(0.3 - footprint*0.5, 0.3 + footprint*0.5, distToCenter);
        stripe = mix(stripe, 0.6/1.8, smoothstep(0.6, 1.8, footprint));
        diffuseColor.rgb = mix(diffuseColor.rgb, stripeColor, stripe);
      `);
  };
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
// outline_local 为 [east(x), south(z)]；Shape 传入 (x, -z)，经 rotateX(-π/2) 后
// (X, Y, Z_ext) -> (X, +Z_ext, -Y) = (east, height, south)，与世界坐标严格一致。
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
): Promise<{ group: THREE.Group; stats: BuildingStats } | null> {
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
    for (const e of m.buildings) groups[e.heightSource]?.push(e);

    // Three.js ExtrudeGeometry: group 0 = 顶/底盖 (top)，group 1 = 立面 (side)
    const materials: Record<HeightSource, THREE.MeshStandardMaterial[]> = {} as never;
    for (const hs of ['osm.height', 'osm.levels', 'missing'] as HeightSource[]) {
      const top  = new THREE.MeshStandardMaterial({ color: COLORS[hs].top,  roughness: 0.85, metalness: 0 });
      const side = new THREE.MeshStandardMaterial({ color: COLORS[hs].side, roughness: 0.85, metalness: 0 });
      if (hs === 'missing') enableMissingHeightStripes(side);
      materials[hs] = [top, side];
    }

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

    return { group: rootGroup, stats };
  } catch (err) {
    console.error(`[WuxingBuildings] 加载 ${filename} 失败:`, err);
    return null;
  }
}

// ── 主入口 ───────────────────────────────────────────────────────────────────
export async function loadWuxingBuildings(): Promise<{ group: THREE.Group; stats: BuildingStats }> {
  const base = new URL(import.meta.env.BASE_URL + 'models/wuxing-street/', document.baseURI);

  // 1. Overture (2891 栋)
  const overture = await loadProceduralManifest(base, 'manifest-overture.json', 'Overture 2891');
  if (overture) return overture;

  // 2. OSM 宽幅 (240 栋)
  const wide = await loadProceduralManifest(base, 'manifest-wide.json', 'OSM 240');
  if (wide) return wide;

  // 3. GLB fallback (34 栋)
  return loadGlbFallback(base);
}

// ── GLB fallback ──────────────────────────────────────────────────────────────
interface GlbEntry { file: string; position: [number,number,number]; heightSource: HeightSource }
async function loadGlbFallback(base: URL): Promise<{ group: THREE.Group; stats: BuildingStats }> {
  const response = await fetch(new URL('manifest.json', base));
  if (!response.ok) throw new Error(`manifest.json HTTP ${response.status}`);
  const { buildings }: { buildings: GlbEntry[] } = await response.json();
  const loader = new GLTFLoader();
  const group  = new THREE.Group();
  const shared = new Map<string, THREE.Material>();
  const stats: BuildingStats = { total: 0, hasHeight: 0, hasLevels: 0, missing: 0, source: 'GLB 34' };
  await Promise.all(buildings.map(async e => {
    const { scene } = await loader.loadAsync(new URL(e.file, base).href);
    group.add(scene);
    scene.position.fromArray(e.position);
    scene.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      const mat = child.material as THREE.MeshStandardMaterial;
      const ex = shared.get(mat.name);
      if (ex) { if (ex !== mat) mat.dispose(); child.material = ex; }
      else { shared.set(mat.name, mat); if (e.heightSource === 'missing' && mat.name === 'missing-facade') enableMissingHeightStripes(mat); }
    });
    stats.total++;
    if (e.heightSource === 'osm.height') stats.hasHeight++;
    else if (e.heightSource === 'osm.levels') stats.hasLevels++;
    else stats.missing++;
  }));
  return { group, stats };
}
