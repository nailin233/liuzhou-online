/**
 * WuxingBuildings — 加载五星街建筑
 *
 * 双模式：
 *  1. GLB 模式 (manifest.json, 34 栋)：从预生成的 GLB 文件加载
 *  2. 程序化模式 (manifest-wide.json, 240 栋)：直接用 outline_local 在 Three.js 挤出
 *
 * art-direction.md §2.2 颜色：
 *   osm.height  立面 #C9D2D6 / 顶面 #E4EBED
 *   osm.levels  立面 #9FB0B8 / 顶面 #BCC9CE
 *   missing     立面 #5C4A57 / 顶面 #6E5868 + 斜纹 shader
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export type HeightSource = 'osm.height' | 'osm.levels' | 'missing';

export interface BuildingStats {
  total:   number;
  hasHeight: number;
  hasLevels: number;
  missing: number;
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

// ── 程序化挤出单栋建筑 ────────────────────────────────────────────────────────
function extrudeBuilding(
  outline: [number, number][],
  height: number,
  heightSource: HeightSource,
  sharedMats: Map<string, THREE.MeshStandardMaterial>,
): THREE.Mesh | null {
  if (outline.length < 3) return null;

  const shape = new THREE.Shape();
  shape.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) shape.lineTo(outline[i][0], outline[i][1]);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth:           height,
    bevelEnabled:    false,
  });
  // ExtrudeGeometry 在 XY 平面向 +Z 挤出；旋转到 XZ 平面（+Y 向上）
  geo.rotateX(-Math.PI / 2);

  // 获取或创建共享材质（侧面 / 顶面分开）
  const { side: sc, top: tc } = COLORS[heightSource];
  const sideKey = `side-${heightSource}`;
  const topKey  = `top-${heightSource}`;

  if (!sharedMats.has(sideKey)) {
    const m = new THREE.MeshStandardMaterial({ color: sc, roughness: 0.85, metalness: 0 });
    if (heightSource === 'missing') enableMissingHeightStripes(m);
    sharedMats.set(sideKey, m);
  }
  if (!sharedMats.has(topKey)) {
    sharedMats.set(topKey, new THREE.MeshStandardMaterial({ color: tc, roughness: 0.85, metalness: 0 }));
  }

  // ExtrudeGeometry materialIndex: 0=side, 1=cap (top + bottom)
  // 我们只需要顶面用不同颜色：groups[0]=sides, groups[1]=caps
  const mesh = new THREE.Mesh(geo, [
    sharedMats.get(sideKey)!,
    sharedMats.get(topKey)!,
  ]);
  mesh.castShadow    = true;
  mesh.receiveShadow = true;
  return mesh;
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

// ── 主加载函数：宽幅程序化模式 ───────────────────────────────────────────────

interface WideEntry {
  id: string;
  tags: Record<string, string>;
  position: [number, number, number];
  outline_local: [number, number][];
  heightSource: HeightSource;
  height: number | null;
  modelHeight: number;
  file: string;
}

export async function loadWuxingBuildings(): Promise<{ group: THREE.Group; stats: BuildingStats }> {
  const base = new URL(import.meta.env.BASE_URL + 'models/wuxing-street/', document.baseURI);

  // 优先加载宽幅 manifest（240 栋，含 outline_local）
  let entries: WideEntry[] = [];
  let useWide = false;

  try {
    const r = await fetch(new URL('manifest-wide.json', base));
    if (r.ok) {
      const m = await r.json();
      entries = m.buildings;
      useWide = true;
    }
  } catch { /* fall through */ }

  if (!useWide) {
    // fallback：旧 GLB 模式
    return loadGlbFallback(base);
  }

  const sharedMats = new Map<string, THREE.MeshStandardMaterial>();
  const group = new THREE.Group();
  const stats: BuildingStats = { total: 0, hasHeight: 0, hasLevels: 0, missing: 0 };

  for (const entry of entries) {
    const mesh = extrudeBuilding(
      entry.outline_local,
      entry.modelHeight,
      entry.heightSource,
      sharedMats,
    );
    if (!mesh) continue;

    mesh.name = entry.id;
    group.add(mesh);
    stats.total++;
    if (entry.heightSource === 'osm.height') stats.hasHeight++;
    else if (entry.heightSource === 'osm.levels') stats.hasLevels++;
    else stats.missing++;
  }

  return { group, stats };
}

// ── Fallback：旧版 GLB 加载（34 栋）────────────────────────────────────────

interface GlbEntry {
  file: string;
  position: [number, number, number];
  heightSource: HeightSource;
}

async function loadGlbFallback(base: URL): Promise<{ group: THREE.Group; stats: BuildingStats }> {
  const response = await fetch(new URL('manifest.json', base));
  if (!response.ok) throw new Error(`manifest.json · HTTP ${response.status}`);
  const { buildings }: { buildings: GlbEntry[] } = await response.json();

  const loader = new GLTFLoader();
  const group  = new THREE.Group();
  const shared = new Map<string, THREE.Material>();
  const stats: BuildingStats = { total: 0, hasHeight: 0, hasLevels: 0, missing: 0 };

  const results = await Promise.allSettled(buildings.map(async entry => {
    const { scene } = await loader.loadAsync(new URL(entry.file, base).href);
    group.add(scene);
    scene.position.fromArray(entry.position);
    scene.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      const mat = child.material as THREE.MeshStandardMaterial;
      const existing = shared.get(mat.name);
      if (existing) {
        if (existing !== mat) mat.dispose();
        child.material = existing;
      } else {
        shared.set(mat.name, mat);
        if (entry.heightSource === 'missing' && mat.name === 'missing-facade') {
          enableMissingHeightStripes(mat);
        }
      }
    });
    stats.total++;
    if (entry.heightSource === 'osm.height') stats.hasHeight++;
    else if (entry.heightSource === 'osm.levels') stats.hasLevels++;
    else stats.missing++;
  }));

  const failure = results.find(r => r.status === 'rejected');
  if (failure) { disposeBuildings(group); throw (failure as PromiseRejectedResult).reason; }
  return { group, stats };
}
