/**
 * StreetProps — 柳州特色街景氛围道具（纯 InstancedMesh 合批，总计仅 5 次 Draw Call）
 *
 * 内容（沿真实 OSM 道路边缘确定性排布，避开建筑轮廓）：
 *  - 柳州城市名片：洋紫荆（紫荆花）粉花行道树 + 亚热带常绿行道树
 *  - 现代简约路灯（日落/夜景自动点亮暖黄灯光）
 *
 * 注：属于街景视觉氛围示意，切换至「数据检视」模式时自动隐藏以展示纯地理白模。
 */
import * as THREE from 'three';
import type { RoadEntry } from './RoadNetwork';
import type { BuildingColliderData } from './WuxingBuildings';

interface PropPlacement {
  x: number;
  z: number;
  yaw: number;
  scale: number;
  isBauhinia: boolean;
}

interface LampPlacement {
  x: number;
  z: number;
  yaw: number;
}

/** 轻量级空间网格：快速剔除落在建筑轮廓附近（避免树或路灯穿模进楼体） */
class BuildingFootprintIndex {
  private readonly cellSize = 40;
  private readonly cells = new Map<string, [number, number, number, number][]>();

  constructor(footprints: BuildingColliderData[]) {
    for (const b of footprints) {
      if (!b.outline_local || b.outline_local.length < 3) continue;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const [x, z] of b.outline_local) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }
      // 外扩 1.4 m 缓冲距
      const box: [number, number, number, number] = [minX - 1.4, maxX + 1.4, minZ - 1.4, maxZ + 1.4];
      const cx0 = Math.floor(box[0] / this.cellSize);
      const cx1 = Math.floor(box[1] / this.cellSize);
      const cz0 = Math.floor(box[2] / this.cellSize);
      const cz1 = Math.floor(box[3] / this.cellSize);
      for (let cx = cx0; cx <= cx1; cx++) {
        for (let cz = cz0; cz <= cz1; cz++) {
          const key = `${cx},${cz}`;
          let arr = this.cells.get(key);
          if (!arr) { arr = []; this.cells.set(key, arr); }
          arr.push(box);
        }
      }
    }
  }

  public isNearBuilding(x: number, z: number): boolean {
    const key = `${Math.floor(x / this.cellSize)},${Math.floor(z / this.cellSize)}`;
    const arr = this.cells.get(key);
    if (!arr) return false;
    for (const [minX, maxX, minZ, maxZ] of arr) {
      if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) return true;
    }
    return false;
  }
}

export class StreetProps {
  public readonly group: THREE.Group;
  private lampHeadMat: THREE.MeshStandardMaterial;
  private treeCount = 0;
  private lampCount = 0;

  constructor(roads: RoadEntry[], footprints: BuildingColliderData[]) {
    this.group = new THREE.Group();
    this.group.name = 'liuzhou-street-props';

    const bIndex = new BuildingFootprintIndex(footprints);
    const trees: PropPlacement[] = [];
    const lamps: LampPlacement[] = [];
    const occupied = new Set<string>();

    // 在核心漫游区 (±700m) 沿主干道、次干道与步行街生成行道树与路灯
    const MAX_RANGE = 700;
    const MAX_TREES = 480;
    const MAX_LAMPS = 220;

    let seed = 1;
    const nextHash = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };

    for (const road of roads) {
      if (road.category !== 'major' && road.category !== 'pedestrian' && road.category !== 'minor') continue;
      const spacing = road.category === 'pedestrian' ? 14 : road.category === 'major' ? 18 : 24;
      const offsetDist = road.width / 2 + 1.35;
      let accum = spacing * 0.4;

      for (let i = 0; i < road.points.length - 1; i++) {
        const [x1, z1] = road.points[i];
        const [x2, z2] = road.points[i + 1];
        if (Math.abs(x1) > MAX_RANGE && Math.abs(x2) > MAX_RANGE) continue;
        if (Math.abs(z1) > MAX_RANGE && Math.abs(z2) > MAX_RANGE) continue;

        const dx = x2 - x1;
        const dz = z2 - z1;
        const segLen = Math.hypot(dx, dz);
        if (segLen < 1) continue;
        const ux = dx / segLen;
        const uz = dz / segLen;
        const nx = -uz;
        const nz = ux;
        const yaw = Math.atan2(ux, uz);

        let d = accum;
        while (d < segLen) {
          const px = x1 + ux * d;
          const pz = z1 + uz * d;

          for (const side of [-1, 1]) {
            const tx = px + nx * offsetDist * side;
            const tz = pz + nz * offsetDist * side;
            if (Math.abs(tx) > MAX_RANGE || Math.abs(tz) > MAX_RANGE) continue;
            // 出生点周围 6m 保持开阔视野
            if (Math.hypot(tx, tz) < 6.0) continue;

            const cellKey = `${Math.round(tx / 7)},${Math.round(tz / 7)}`;
            if (occupied.has(cellKey)) continue;
            if (bIndex.isNearBuilding(tx, tz)) continue;

            occupied.add(cellKey);
            const r = nextHash();

            if (lamps.length < MAX_LAMPS && r < 0.30) {
              lamps.push({ x: tx, z: tz, yaw: yaw + (side > 0 ? Math.PI / 2 : -Math.PI / 2) });
            } else if (trees.length < MAX_TREES) {
              // 约 48% 为柳州特色粉花洋紫荆，52% 为常绿行道树
              trees.push({
                x: tx,
                z: tz,
                yaw: r * Math.PI * 2,
                scale: 0.85 + nextHash() * 0.42,
                isBauhinia: nextHash() < 0.48,
              });
            }
          }
          d += spacing;
        }
        accum = d - segLen;
      }
    }

    this.treeCount = trees.length;
    this.lampCount = lamps.length;

    const dummy = new THREE.Object3D();

    // 1. 树干（合并所有树，1 Draw Call）
    if (trees.length > 0) {
      const trunkGeo = new THREE.CylinderGeometry(0.14, 0.22, 2.8, 6);
      trunkGeo.translate(0, 1.4, 0);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5C4638, roughness: 0.92, metalness: 0 });
      const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
      trunkMesh.castShadow = true;
      trunkMesh.receiveShadow = true;
      trunkMesh.name = 'street-tree-trunks';

      const pinkTrees = trees.filter(t => t.isBauhinia);
      const greenTrees = trees.filter(t => !t.isBauhinia);

      trees.forEach((t, idx) => {
        dummy.position.set(t.x, 0, t.z);
        dummy.rotation.set(0, t.yaw, 0);
        dummy.scale.setScalar(t.scale);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(idx, dummy.matrix);
      });
      trunkMesh.instanceMatrix.needsUpdate = true;
      this.group.add(trunkMesh);

      // 2. 柳州洋紫荆（粉花冠，1 Draw Call）
      if (pinkTrees.length > 0) {
        const pinkGeo = new THREE.DodecahedronGeometry(1.75, 1);
        pinkGeo.scale(1.12, 0.82, 1.05);
        pinkGeo.translate(0, 3.65, 0);
        const pinkMat = new THREE.MeshStandardMaterial({ color: 0xF08BB8, roughness: 0.78, metalness: 0 });
        const pinkMesh = new THREE.InstancedMesh(pinkGeo, pinkMat, pinkTrees.length);
        pinkMesh.castShadow = true;
        pinkMesh.receiveShadow = true;
        pinkMesh.name = 'liuzhou-bauhinia-canopies';

        const c = new THREE.Color();
        pinkTrees.forEach((t, idx) => {
          dummy.position.set(t.x, 0, t.z);
          dummy.rotation.set(0, t.yaw, 0);
          dummy.scale.setScalar(t.scale);
          dummy.updateMatrix();
          pinkMesh.setMatrixAt(idx, dummy.matrix);
          // 微调深浅粉紫，呈现自然花海层次
          c.setHex(idx % 3 === 0 ? 0xF7A8CC : idx % 3 === 1 ? 0xE879AE : 0xF295C0);
          pinkMesh.setColorAt(idx, c);
        });
        pinkMesh.instanceMatrix.needsUpdate = true;
        if (pinkMesh.instanceColor) pinkMesh.instanceColor.needsUpdate = true;
        this.group.add(pinkMesh);
      }

      // 3. 亚热带绿荫树冠（1 Draw Call）
      if (greenTrees.length > 0) {
        const greenGeo = new THREE.DodecahedronGeometry(1.68, 1);
        greenGeo.scale(1.08, 0.88, 1.08);
        greenGeo.translate(0, 3.6, 0);
        const greenMat = new THREE.MeshStandardMaterial({ color: 0x4F9B58, roughness: 0.82, metalness: 0 });
        const greenMesh = new THREE.InstancedMesh(greenGeo, greenMat, greenTrees.length);
        greenMesh.castShadow = true;
        greenMesh.receiveShadow = true;
        greenMesh.name = 'street-green-canopies';

        const c = new THREE.Color();
        greenTrees.forEach((t, idx) => {
          dummy.position.set(t.x, 0, t.z);
          dummy.rotation.set(0, t.yaw, 0);
          dummy.scale.setScalar(t.scale);
          dummy.updateMatrix();
          greenMesh.setMatrixAt(idx, dummy.matrix);
          c.setHex(idx % 3 === 0 ? 0x58A85D : idx % 3 === 1 ? 0x458E4E : 0x67B365);
          greenMesh.setColorAt(idx, c);
        });
        greenMesh.instanceMatrix.needsUpdate = true;
        if (greenMesh.instanceColor) greenMesh.instanceColor.needsUpdate = true;
        this.group.add(greenMesh);
      }
    }

    // 4 & 5. 路灯杆与发光灯头（2 Draw Calls）
    this.lampHeadMat = new THREE.MeshStandardMaterial({
      color: 0xFFF2CC,
      emissive: 0xFFD97D,
      emissiveIntensity: 0.15,
      roughness: 0.3,
      metalness: 0,
    });

    if (lamps.length > 0) {
      const poleGeo = new THREE.CylinderGeometry(0.06, 0.09, 5.4, 6);
      poleGeo.translate(0, 2.7, 0);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x3D4954, roughness: 0.6, metalness: 0.25 });
      const poleMesh = new THREE.InstancedMesh(poleGeo, poleMat, lamps.length);
      poleMesh.castShadow = true;
      poleMesh.name = 'street-lamp-poles';

      const headGeo = new THREE.BoxGeometry(0.45, 0.14, 0.9);
      headGeo.translate(0, 5.45, 0.35);
      const headMesh = new THREE.InstancedMesh(headGeo, this.lampHeadMat, lamps.length);
      headMesh.name = 'street-lamp-heads';

      lamps.forEach((l, idx) => {
        dummy.position.set(l.x, 0, l.z);
        dummy.rotation.set(0, l.yaw, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        poleMesh.setMatrixAt(idx, dummy.matrix);
        headMesh.setMatrixAt(idx, dummy.matrix);
      });
      poleMesh.instanceMatrix.needsUpdate = true;
      headMesh.instanceMatrix.needsUpdate = true;
      this.group.add(poleMesh, headMesh);
    }
  }

  public setAtmosphere(nightGlow: number, visible: boolean): void {
    this.group.visible = visible;
    this.lampHeadMat.emissiveIntensity = 0.12 + nightGlow * 2.2;
  }

  public getStats(): { trees: number; lamps: number } {
    return { trees: this.treeCount, lamps: this.lampCount };
  }

  public dispose(): void {
    const geos = new Set<THREE.BufferGeometry>();
    const mats = new Set<THREE.Material>();
    this.group.traverse(o => {
      if (o instanceof THREE.Mesh) {
        geos.add(o.geometry);
        const list = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of list) mats.add(m);
      }
    });
    for (const g of geos) g.dispose();
    for (const m of mats) m.dispose();
  }
}
