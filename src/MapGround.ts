/**
 * MapGround — 地面、区域边框、100m 网格
 * art-direction.md §2.1 场景色板
 * 宽幅版：覆盖 ~2km×2.8km（含柳江）
 */
import * as THREE from 'three';

// 宽幅 bbox 换算本地坐标（米）
// 西: 109.3990 → x ≈ -980   东: 109.4190 → x ≈ +990
// 南: 24.3050  → z ≈ +1200  北: 24.3300  → z ≈ -1140
const W = 1980;   // 东西宽
const H = 2340;   // 南北高
const OX = 5;     // bbox 中心相对原点偏移 x ≈ (+990-980)/2
const OZ = 30;    // bbox 中心相对原点偏移 z ≈ (1200-1140)/2

export function createMapGround(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'map-ground';

  // 大地面（bbox 外区域，更暗）
  const outerGeo = new THREE.PlaneGeometry(6000, 6000);
  const outerMat = new THREE.MeshStandardMaterial({ color: 0x0D141A, roughness: 1 });
  const outer = new THREE.Mesh(outerGeo, outerMat);
  outer.rotation.x = -Math.PI / 2;
  outer.receiveShadow = true;
  group.add(outer);

  // 数据区地面（宽幅 bbox 范围）
  const innerGeo = new THREE.PlaneGeometry(W, H);
  const innerMat = new THREE.MeshStandardMaterial({ color: 0x17232C, roughness: 0.9 });
  const inner = new THREE.Mesh(innerGeo, innerMat);
  inner.rotation.x = -Math.PI / 2;
  inner.position.set(OX, 0.005, OZ);
  inner.receiveShadow = true;
  group.add(inner);

  // 100m 网格线
  const gridMat = new THREE.LineBasicMaterial({ color: 0x203340 });
  const gridGeo = new THREE.BufferGeometry();
  const verts: number[] = [];
  const x0 = OX - W/2, x1 = OX + W/2;
  const z0 = OZ - H/2, z1 = OZ + H/2;
  for (let v = Math.ceil(x0/100)*100; v <= x1; v += 100) {
    verts.push(v, 0.012, z0, v, 0.012, z1);
  }
  for (let v = Math.ceil(z0/100)*100; v <= z1; v += 100) {
    verts.push(x0, 0.012, v, x1, 0.012, v);
  }
  gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  group.add(new THREE.LineSegments(gridGeo, gridMat));

  // 数据区边框（#3E8F91）
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
  group.add(new THREE.LineSegments(borderGeo, borderMat));

  return group;
}
