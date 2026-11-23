/**
 * MapGround — 地面、数据检视边框与 100m 网格（支持昼夜都市地面与数据检视双模式切换）
 */
import * as THREE from 'three';
import type { AtmospherePresetId } from './SkyAtmosphere';

const W = 1980;   // 东西宽
const H = 2340;   // 南北高
const OX = 5;
const OZ = 30;

export interface GroundStyleController {
  setPreset(preset: AtmospherePresetId): void;
}

export interface CreateGroundResult {
  group:           THREE.Group;
  styleController: GroundStyleController;
}

const GROUND_PALETTE: Record<AtmospherePresetId, { outer: number; inner: number; showGrid: boolean }> = {
  day:    { outer: 0x7E9C74, inner: 0x99A598, showGrid: false },
  sunset: { outer: 0x626A58, inner: 0x7B7568, showGrid: false },
  night:  { outer: 0x16202B, inner: 0x1F2933, showGrid: false },
  audit:  { outer: 0x0D141A, inner: 0x17232C, showGrid: true },
};

export function createMapGround(): CreateGroundResult {
  const group = new THREE.Group();
  group.name = 'map-ground';

  const outerGeo = new THREE.PlaneGeometry(7000, 7000);
  const outerMat = new THREE.MeshStandardMaterial({ color: GROUND_PALETTE.day.outer, roughness: 0.98 });
  const outer = new THREE.Mesh(outerGeo, outerMat);
  outer.rotation.x = -Math.PI / 2;
  outer.receiveShadow = true;
  group.add(outer);

  const innerGeo = new THREE.PlaneGeometry(W, H);
  const innerMat = new THREE.MeshStandardMaterial({ color: GROUND_PALETTE.day.inner, roughness: 0.94 });
  const inner = new THREE.Mesh(innerGeo, innerMat);
  inner.rotation.x = -Math.PI / 2;
  inner.position.set(OX, 0.005, OZ);
  inner.receiveShadow = true;
  group.add(inner);

  // 100m 网格线（仅在数据检视模式显示，都市漫游保持清爽自然地表）
  const gridMat = new THREE.LineBasicMaterial({ color: 0x203340 });
  const gridGeo = new THREE.BufferGeometry();
  const verts: number[] = [];
  const x0 = OX - W / 2, x1 = OX + W / 2;
  const z0 = OZ - H / 2, z1 = OZ + H / 2;
  for (let v = Math.ceil(x0 / 100) * 100; v <= x1; v += 100) {
    verts.push(v, 0.010, z0, v, 0.010, z1);
  }
  for (let v = Math.ceil(z0 / 100) * 100; v <= z1; v += 100) {
    verts.push(x0, 0.010, v, x1, 0.010, v);
  }
  gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  const gridLines = new THREE.LineSegments(gridGeo, gridMat);
  gridLines.visible = false;
  group.add(gridLines);

  // 数据区边框（仅在数据检视模式显示）
  const borderMat = new THREE.LineBasicMaterial({ color: 0x3E8F91, transparent: true, opacity: 0.6 });
  const bx0 = x0 - 1, bx1 = x1 + 1, bz0 = z0 - 1, bz1 = z1 + 1;
  const bv = [
    bx0, 0.02, bz0,  bx1, 0.02, bz0,
    bx1, 0.02, bz0,  bx1, 0.02, bz1,
    bx1, 0.02, bz1,  bx0, 0.02, bz1,
    bx0, 0.02, bz1,  bx0, 0.02, bz0,
  ];
  const borderGeo = new THREE.BufferGeometry();
  borderGeo.setAttribute('position', new THREE.Float32BufferAttribute(bv, 3));
  const borderLines = new THREE.LineSegments(borderGeo, borderMat);
  borderLines.visible = false;
  group.add(borderLines);

  const styleController: GroundStyleController = {
    setPreset(preset: AtmospherePresetId) {
      const p = GROUND_PALETTE[preset] ?? GROUND_PALETTE.day;
      outerMat.color.setHex(p.outer);
      innerMat.color.setHex(p.inner);
      gridLines.visible = p.showGrid;
      borderLines.visible = p.showGrid;
    },
  };

  return { group, styleController };
}
