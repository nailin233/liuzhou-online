/**
 * WuxingBuildings — 加载五星街建筑
 *
 * 加载优先级（按数据完整性）：
 *  1. manifest-overture.json  (Overture, 2891 栋，OSM + ML)
 *  2. manifest-wide.json      (OSM 宽幅, 240 栋)
 *  3. manifest.json           (GLB fallback, 34 栋)
 *
 * 性能优化：
 *  - 2891 栋建筑按高度来源分批合并为 3 个 Mesh，降低 draw call
 *  - 每种 heightSource 一个 MergedGeometry
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

// ── 单栋建筑挤出（返回侧面和顶面分离的几何体）────────────────────────────────
function extrudeOne(outline: [number, number][], height: number): THREE.BufferGeometry | null {
  if (outline.length < 3) return null;
  const shape = new THREE.Shape();
  shape.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) shape.lineTo(outline[i][0], outline[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

// ── 合并几何体（提升大量建筑的渲染性能）──────────────────────────────────────
function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (geos.length === 0) return null;
  // 手动合并（避免引入额外依赖）
  let totalPos = 0, totalIdx = 0;
  for (const g of geos) {
    totalPos += (g.getAttribute('position') as THREE.BufferAttribute).count;
    totalIdx += g.index ? g.index.count : 0;
  }

  const positions = new Float32Array(totalPos * 3);
  const normals   = new Float32Array(totalPos * 3);
  const indices   = new Uint32Array(totalIdx);
  let posOff = 0, idxOff = 0, vertBase = 0;

  for (const g of geos) {
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const nor = g.getAttribute('normal')   as THREE.BufferAttribute;
    const idx = g.index!;
    const count = pos.count;

    for (let i = 0; i < count; i++) {
      positions[(posOff + i) * 3]     = pos.getX(i);
      positions[(posOff + i) * 3 + 1] = pos.getY(i);
      positions[(posOff + i) * 3 + 2] = pos.getZ(i);
      if (nor) {
        normals[(posOff + i) * 3]     = nor.getX(i);
        normals[(posOff + i) * 3 + 1] = nor.getY(i);
        normals[(posOff + i) * 3 + 2] = nor.getZ(i);
      }
    }
    for (let i = 0; i < idx.count; i++) {
      indices[idxOff + i] = idx.getX(i) + vertBase;
    }

    posOff   += count;
    idxOff   += idx.count;
    vertBase += count;
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal',   new THREE.BufferAttribute(normals, 3));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
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
    if (!r.ok) return null;
    const m: WideManifest = await r.json();

    // 按 heightSource 分组
    const groups: Record<HeightSource, WideEntry[]> = {
      'osm.height': [], 'osm.levels': [], 'missing': [],
    };
    for (const e of m.buildings) groups[e.heightSource]?.push(e);

    // 材质：侧面 + 顶面各一个（ExtrudeGeometry group 0=side, 1=cap）
    const materials: Record<HeightSource, THREE.MeshStandardMaterial[]> = {} as never;
    for (const hs of ['osm.height', 'osm.levels', 'missing'] as HeightSource[]) {
      const side = new THREE.MeshStandardMaterial({ color: COLORS[hs].side, roughness: 0.85, metalness: 0 });
      const top  = new THREE.MeshStandardMaterial({ color: COLORS[hs].top,  roughness: 0.85, metalness: 0 });
      if (hs === 'missing') enableMissingHeightStripes(side);
      materials[hs] = [side, top];
    }

    const rootGroup = new THREE.Group();
    const stats: BuildingStats = {
      total: 0, hasHeight: 0, hasLevels: 0, missing: 0, source: label,
    };

    for (const hs of ['osm.height', 'osm.levels', 'missing'] as HeightSource[]) {
      const entries = groups[hs];
      if (entries.length === 0) continue;

      // 大量 missing 建筑合并几何体（提升性能）
      if (hs === 'missing' && entries.length > 100) {
        // 分批合并（每批 500，避免 Uint32 溢出）
        const BATCH = 500;
        for (let bStart = 0; bStart < entries.length; bStart += BATCH) {
          const batch = entries.slice(bStart, bStart + BATCH);
          const geos: THREE.BufferGeometry[] = [];
          for (const e of batch) {
            const g = extrudeOne(e.outline_local, e.modelHeight);
            if (g) geos.push(g);
          }
          const merged = mergeGeometries(geos);
          if (merged) {
            const mesh = new THREE.Mesh(merged, materials[hs]);
            mesh.castShadow = true;
            rootGroup.add(mesh);
          }
        }
      } else {
        // osm.height / osm.levels 数量少，逐个添加
        for (const e of entries) {
          const geo = extrudeOne(e.outline_local, e.modelHeight);
          if (!geo) continue;
          const mesh = new THREE.Mesh(geo, materials[hs]);
          mesh.castShadow = true;
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
  } catch {
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
