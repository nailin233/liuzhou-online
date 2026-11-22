/**
 * MapGround — 地面、区域边框、100m 网格
 * art-direction.md §2.1 场景色板
 */
import * as THREE from 'three';

// 500m × 500m 区域（约对应 bbox 实际尺寸）
const AREA = 500;

export function createMapGround(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'map-ground';

  // 大地面（bbox 外区域，更暗）
  const outerGeo = new THREE.PlaneGeometry(2000, 2000);
  const outerMat = new THREE.MeshStandardMaterial({ color: 0x0D141A, roughness: 1 });
  const outer = new THREE.Mesh(outerGeo, outerMat);
  outer.rotation.x = -Math.PI / 2;
  outer.receiveShadow = true;
  group.add(outer);

  // 500m 数据区地面
  const innerGeo = new THREE.PlaneGeometry(AREA, AREA);
  const innerMat = new THREE.MeshStandardMaterial({ color: 0x17232C, roughness: 0.9 });
  const inner = new THREE.Mesh(innerGeo, innerMat);
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.005;  // 略高于外地面
  inner.receiveShadow = true;
  group.add(inner);

  // 100m 网格线（在数据区内）
  const gridMat = new THREE.LineBasicMaterial({ color: 0x203340 });
  const gridGeo = new THREE.BufferGeometry();
  const verts: number[] = [];
  const half = AREA / 2;
  const step = 100;
  for (let v = -half; v <= half; v += step) {
    // 垂直线
    verts.push(v, 0.012, -half, v, 0.012, half);
    // 水平线
    verts.push(-half, 0.012, v, half, 0.012, v);
  }
  gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  group.add(new THREE.LineSegments(gridGeo, gridMat));

  // 500m 边框（#3E8F91，ODbL 要求边界可识别）
  const borderMat = new THREE.LineBasicMaterial({ color: 0x3E8F91, transparent: true, opacity: 0.6 });
  const borderGeo = new THREE.BufferGeometry();
  const h = half + 0.5;
  const borderVerts = [
    -h, 0.02, -h,  h, 0.02, -h,
     h, 0.02, -h,  h, 0.02,  h,
     h, 0.02,  h, -h, 0.02,  h,
    -h, 0.02,  h, -h, 0.02, -h,
  ];
  borderGeo.setAttribute('position', new THREE.Float32BufferAttribute(borderVerts, 3));
  group.add(new THREE.LineSegments(borderGeo, borderMat));

  return group;
}
