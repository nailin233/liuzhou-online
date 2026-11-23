/**
 * LanduseLayer — 渲染真实 OSM 提取的柳州公园、林地、体育场、商业广场与河滩（landuse.json）
 *
 * 按类别合批为最多 6 个 Mesh，位于地面 (0.005) 之上、水体 (0.016) 与道路 (0.024+) 之下。
 */
import * as THREE from 'three';
import type { AtmospherePresetId } from './SkyAtmosphere';

export type LanduseKind = 'park' | 'wood' | 'pitch' | 'plaza' | 'beach' | 'cultural';

interface LanduseArea {
  id: string;
  name: string;
  kind: LanduseKind;
  center: [number, number];
  points: [number, number][];
}

interface LanduseManifest {
  attribution: string;
  areas: LanduseArea[];
}

export interface LanduseStyleController {
  setPreset(preset: AtmospherePresetId): void;
}

export interface LoadLanduseResult {
  group: THREE.Group;
  styleController: LanduseStyleController;
  areaCount: number;
}

const ELEVATION: Record<LanduseKind, number> = {
  plaza:    0.009,
  park:     0.011,
  wood:     0.012,
  cultural: 0.0125,
  beach:    0.013,
  pitch:    0.014,
};

const PALETTES: Record<AtmospherePresetId, Record<LanduseKind, number>> = {
  day: {
    park:     0x5FA45A,  // 柳侯公园/马鞍山公园鲜活草坪绿
    wood:     0x3F7F48,  // 林地深绿
    pitch:    0x469E68,  // 柳州体育场与球场绿茵
    plaza:    0xC8BEB0,  // 五星步行街与商业广场暖石板
    beach:    0xC9BB9A,  // 柳江河滩
    cultural: 0xB8A68E,  // 柳州文庙院落石板
  },
  sunset: {
    park:     0x4E7E4A,
    wood:     0x34603C,
    pitch:    0x3D7A54,
    plaza:    0xA59382,
    beach:    0xA8967A,
    cultural: 0x99856F,
  },
  night: {
    park:     0x1A3024,
    wood:     0x13261C,
    pitch:    0x163628,
    plaza:    0x272E36,
    beach:    0x2A2B28,
    cultural: 0x2B2825,
  },
  audit: {
    park:     0x24392E,
    wood:     0x1D3026,
    pitch:    0x223B30,
    plaza:    0x1B2830,
    beach:    0x262C30,
    cultural: 0x212B33,
  },
};

function mergePolygons(areas: LanduseArea[], y: number): THREE.BufferGeometry | null {
  const allPos: number[] = [];
  const allIdx: number[] = [];
  let vertBase = 0;

  for (const area of areas) {
    if (!area.points || area.points.length < 3) continue;
    try {
      const shape = new THREE.Shape();
      shape.moveTo(area.points[0][0], -area.points[0][1]);
      for (let i = 1; i < area.points.length; i++) {
        shape.lineTo(area.points[i][0], -area.points[i][1]);
      }
      shape.closePath();
      const g = new THREE.ShapeGeometry(shape);
      g.rotateX(-Math.PI / 2);
      const pos = g.getAttribute('position') as THREE.BufferAttribute;
      const idx = g.index;
      if (idx) {
        for (let i = 0; i < pos.count; i++) {
          allPos.push(pos.getX(i), y, pos.getZ(i));
        }
        for (let i = 0; i < idx.count; i++) {
          allIdx.push(idx.getX(i) + vertBase);
        }
        vertBase += pos.count;
      }
      g.dispose();
    } catch {
      // 忽略偶发退化多边形
    }
  }

  if (allPos.length === 0 || allIdx.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(allPos, 3));
  geo.setIndex(allIdx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

export async function loadLanduseLayer(): Promise<LoadLanduseResult> {
  const base = new URL(import.meta.env.BASE_URL + 'models/wuxing-street/', document.baseURI);
  const response = await fetch(new URL('landuse.json', base));
  if (!response.ok) throw new Error(`landuse.json · HTTP ${response.status}`);
  const manifest: LanduseManifest = await response.json();

  const byKind: Record<LanduseKind, LanduseArea[]> = {
    park: [], wood: [], pitch: [], plaza: [], beach: [], cultural: [],
  };
  for (const a of manifest.areas) {
    if (a.kind in byKind) byKind[a.kind].push(a);
  }

  const group = new THREE.Group();
  group.name = 'liuzhou-landuse';
  const mats = new Map<LanduseKind, THREE.MeshStandardMaterial>();

  for (const kind of ['plaza', 'park', 'wood', 'cultural', 'beach', 'pitch'] as LanduseKind[]) {
    const geo = mergePolygons(byKind[kind], ELEVATION[kind]);
    if (!geo) continue;
    const mat = new THREE.MeshStandardMaterial({
      color: PALETTES.day[kind],
      roughness: 0.94,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -0.25,
      polygonOffsetUnits: -0.25,
    });
    mats.set(kind, mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `landuse-${kind}`;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  const styleController: LanduseStyleController = {
    setPreset(preset: AtmospherePresetId) {
      const p = PALETTES[preset] ?? PALETTES.day;
      for (const [kind, mat] of mats) {
        mat.color.setHex(p[kind]);
      }
    },
  };

  return { group, styleController, areaCount: manifest.areas.length };
}

export function disposeLanduse(group: THREE.Group): void {
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
