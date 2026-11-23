/**
 * StreetProps — 柳州高密度街景细节（全 InstancedMesh 合批，总计最多 7 次 Draw Call）
 *
 * 包含（沿真实 OSM 道路确定性排布并避开建筑轮廓）：
 *  1. 树干（1 Draw Call）
 *  2. 柳州名片：三簇饱满粉花洋紫荆花冠（1 Draw Call）
 *  3. 三簇亚热带常绿行道树冠（1 Draw Call）
 *  4. 街灯灯杆 + 夜间发光灯头（2 Draw Calls）
 *  5. 广西街头标志性蓝白机非隔离护栏（沿主干道，1 Draw Call）
 *  6. 主/次干道路口白色人行横道斑马线（1 Draw Call）
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

interface RailPlacement {
  x: number;
  z: number;
  yaw: number;
}

interface CrosswalkPlacement {
  x: number;
  z: number;
  yaw: number;
  width: number;
}

/** 将多个非索引几何体合并为一个单 Draw Call 的雕塑感树冠几何体 */
function mergeSimpleGeometries(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const posList: number[] = [];
  const norList: number[] = [];
  for (const raw of parts) {
    const g = raw.index ? raw.toNonIndexed() : raw;
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const nor = g.getAttribute('normal') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      posList.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      norList.push(nor ? nor.getX(i) : 0, nor ? nor.getY(i) : 1, nor ? nor.getZ(i) : 0);
    }
    if (g !== raw) g.dispose();
    raw.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(posList, 3));
  merged.setAttribute('normal',   new THREE.Float32BufferAttribute(norList, 3));
  merged.computeBoundingSphere();
  return merged;
}

/** 构造三簇错落有致的饱满树冠（洋紫荆 / 常绿树共用结构，仅 1 Draw Call） */
function createLushCanopyGeometry(baseRadius: number): THREE.BufferGeometry {
  const p1 = new THREE.DodecahedronGeometry(baseRadius, 1);
  p1.scale(1.15, 0.78, 1.08);
  p1.translate(0, 3.85, 0);

  const p2 = new THREE.DodecahedronGeometry(baseRadius * 0.76, 1);
  p2.scale(1.1, 0.75, 1.0);
  p2.translate(baseRadius * 0.58, 3.35, baseRadius * 0.25);

  const p3 = new THREE.DodecahedronGeometry(baseRadius * 0.72, 1);
  p3.scale(1.05, 0.76, 1.1);
  p3.translate(-baseRadius * 0.52, 3.45, -baseRadius * 0.30);

  return mergeSimpleGeometries([p1, p2, p3]);
}

/** 构造 1 段 3.2m 蓝白隔离护栏（合并栏杆与立柱为 1 个几何体） */
function createGuardrailGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const topBar = new THREE.BoxGeometry(0.10, 0.08, 3.15);
  topBar.translate(0, 0.92, 0);
  parts.push(topBar);

  const midBar = new THREE.BoxGeometry(0.08, 0.22, 3.10);
  midBar.translate(0, 0.56, 0);
  parts.push(midBar);

  const botBar = new THREE.BoxGeometry(0.08, 0.06, 3.15);
  botBar.translate(0, 0.22, 0);
  parts.push(botBar);

  for (const pz of [-1.45, 0, 1.45]) {
    const post = new THREE.BoxGeometry(0.12, 0.98, 0.12);
    post.translate(0, 0.49, pz);
    parts.push(post);
  }
  return mergeSimpleGeometries(parts);
}

/** 构造一条人行横道斑马线（6 条平行白条合为 1 个几何体） */
function createCrosswalkGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = -2.5; i <= 2.5; i += 1.0) {
    const stripe = new THREE.PlaneGeometry(0.55, 2.8);
    stripe.rotateX(-Math.PI / 2);
    stripe.translate(i * 1.05, 0.048, 0);
    parts.push(stripe);
  }
  return mergeSimpleGeometries(parts);
}

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
      const box: [number, number, number, number] = [minX - 1.5, maxX + 1.5, minZ - 1.5, maxZ + 1.5];
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
  private railCount = 0;
  private crosswalkCount = 0;

  constructor(roads: RoadEntry[], footprints: BuildingColliderData[]) {
    this.group = new THREE.Group();
    this.group.name = 'liuzhou-street-props';

    const bIndex = new BuildingFootprintIndex(footprints);
    const trees: PropPlacement[] = [];
    const lamps: LampPlacement[] = [];
    const rails: RailPlacement[] = [];
    const crosswalks: CrosswalkPlacement[] = [];
    const occupied = new Set<string>();
    const crosswalkCells = new Set<string>();

    const MAX_RANGE = 750;
    const MAX_TREES = 540;
    const MAX_LAMPS = 240;
    const MAX_RAILS = 420;
    const MAX_CROSSWALKS = 65;

    let seed = 7;
    const nextHash = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };

    for (const road of roads) {
      if (road.category !== 'major' && road.category !== 'pedestrian' && road.category !== 'minor') continue;
      const spacing = road.category === 'pedestrian' ? 12 : road.category === 'major' ? 16 : 22;
      const offsetDist = road.width / 2 + 1.45;
      let accum = spacing * 0.35;

      for (let i = 0; i < road.points.length - 1; i++) {
        const [x1, z1] = road.points[i];
        const [x2, z2] = road.points[i + 1];
        if (Math.abs(x1) > MAX_RANGE && Math.abs(x2) > MAX_RANGE) continue;
        if (Math.abs(z1) > MAX_RANGE && Math.abs(z2) > MAX_RANGE) continue;

        const dx = x2 - x1;
        const dz = z2 - z1;
        const segLen = Math.hypot(dx, dz);
        if (segLen < 1.2) continue;
        const ux = dx / segLen;
        const uz = dz / segLen;
        const nx = -uz;
        const nz = ux;
        const yaw = Math.atan2(ux, uz);

        // 主干道两侧布置蓝白机非隔离护栏（中段，避开路口前后 6m）
        if (road.category === 'major' && segLen > 16 && rails.length < MAX_RAILS) {
          const railOff = road.width / 2 - 0.15;
          for (let rd = 7.0; rd < segLen - 7.0 && rails.length < MAX_RAILS; rd += 3.6) {
            const rx = x1 + ux * rd;
            const rz = z1 + uz * rd;
            if (Math.abs(rx) > 550 || Math.abs(rz) > 550) continue;
            for (const side of [-1, 1]) {
              if (rails.length >= MAX_RAILS) break;
              rails.push({ x: rx + nx * railOff * side, z: rz + nz * railOff * side, yaw });
            }
          }
        }

        // 主干道端点附近布置白色斑马线
        if (road.category === 'major' && segLen > 14 && crosswalks.length < MAX_CROSSWALKS) {
          const cwX = x1 + ux * 4.5;
          const cwZ = z1 + uz * 4.5;
          const cwKey = `${Math.round(cwX / 24)},${Math.round(cwZ / 24)}`;
          if (Math.abs(cwX) < 650 && Math.abs(cwZ) < 650 && !crosswalkCells.has(cwKey)) {
            crosswalkCells.add(cwKey);
            crosswalks.push({ x: cwX, z: cwZ, yaw, width: road.width });
          }
        }

        let d = accum;
        while (d < segLen) {
          const px = x1 + ux * d;
          const pz = z1 + uz * d;

          for (const side of [-1, 1]) {
            const tx = px + nx * offsetDist * side;
            const tz = pz + nz * offsetDist * side;
            if (Math.abs(tx) > MAX_RANGE || Math.abs(tz) > MAX_RANGE) continue;
            // 避开原点与五星雕塑核心广场（核心广场由 WuxingHeroDistrict 布置修长棕榈与多球路灯）
            if (Math.hypot(tx, tz) < 5.5) continue;
            if (Math.hypot(tx + 55.83, tz - 139.09) < 30.0) continue;

            const cellKey = `${Math.round(tx / 6.5)},${Math.round(tz / 6.5)}`;
            if (occupied.has(cellKey)) continue;
            if (bIndex.isNearBuilding(tx, tz)) continue;

            occupied.add(cellKey);
            const r = nextHash();

            if (lamps.length < MAX_LAMPS && r < 0.28) {
              lamps.push({ x: tx, z: tz, yaw: yaw + (side > 0 ? Math.PI / 2 : -Math.PI / 2) });
            } else if (trees.length < MAX_TREES) {
              // 52% 为柳州洋紫荆粉花树，48% 为亚热带绿荫树
              trees.push({
                x: tx,
                z: tz,
                yaw: r * Math.PI * 2,
                scale: 0.88 + nextHash() * 0.44,
                isBauhinia: nextHash() < 0.52,
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
    this.railCount = rails.length;
    this.crosswalkCount = crosswalks.length;

    const dummy = new THREE.Object3D();

    // 1. 树干（1 Draw Call）
    if (trees.length > 0) {
      const trunkGeo = new THREE.CylinderGeometry(0.15, 0.24, 3.0, 6);
      trunkGeo.translate(0, 1.5, 0);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5B4435, roughness: 0.92, metalness: 0 });
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

      // 2. 柳州洋紫荆饱满三簇粉花冠（1 Draw Call）
      if (pinkTrees.length > 0) {
        const pinkGeo = createLushCanopyGeometry(1.55);
        const pinkMat = new THREE.MeshStandardMaterial({ color: 0xF28FBA, roughness: 0.76, metalness: 0 });
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
          c.setHex(idx % 3 === 0 ? 0xF9B0D2 : idx % 3 === 1 ? 0xEB7DB0 : 0xF398C3);
          pinkMesh.setColorAt(idx, c);
        });
        pinkMesh.instanceMatrix.needsUpdate = true;
        if (pinkMesh.instanceColor) pinkMesh.instanceColor.needsUpdate = true;
        this.group.add(pinkMesh);
      }

      // 3. 亚热带饱满三簇绿荫树冠（1 Draw Call）
      if (greenTrees.length > 0) {
        const greenGeo = createLushCanopyGeometry(1.52);
        const greenMat = new THREE.MeshStandardMaterial({ color: 0x4E9E56, roughness: 0.80, metalness: 0 });
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
          c.setHex(idx % 3 === 0 ? 0x56AA5B : idx % 3 === 1 ? 0x428D4B : 0x69B664);
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
      const poleGeo = new THREE.CylinderGeometry(0.06, 0.09, 5.5, 6);
      poleGeo.translate(0, 2.75, 0);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x3D4954, roughness: 0.6, metalness: 0.25 });
      const poleMesh = new THREE.InstancedMesh(poleGeo, poleMat, lamps.length);
      poleMesh.castShadow = true;
      poleMesh.name = 'street-lamp-poles';

      const headGeo = new THREE.BoxGeometry(0.45, 0.14, 0.92);
      headGeo.translate(0, 5.52, 0.38);
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

    // 6. 蓝白机非隔离护栏（1 Draw Call）
    if (rails.length > 0) {
      const railGeo = createGuardrailGeometry();
      const railMat = new THREE.MeshStandardMaterial({ color: 0xE6EEF4, roughness: 0.55, metalness: 0.25 });
      const railMesh = new THREE.InstancedMesh(railGeo, railMat, rails.length);
      railMesh.castShadow = true;
      railMesh.receiveShadow = true;
      railMesh.name = 'street-guardrails';

      const c = new THREE.Color();
      rails.forEach((r, idx) => {
        dummy.position.set(r.x, 0, r.z);
        dummy.rotation.set(0, r.yaw, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        railMesh.setMatrixAt(idx, dummy.matrix);
        // 交替浅白与交通蓝，还原广西街头护栏节奏
        c.setHex(idx % 2 === 0 ? 0xECF3F8 : 0x3B7BC0);
        railMesh.setColorAt(idx, c);
      });
      railMesh.instanceMatrix.needsUpdate = true;
      if (railMesh.instanceColor) railMesh.instanceColor.needsUpdate = true;
      this.group.add(railMesh);
    }

    // 7. 主干道路口斑马线（1 Draw Call）
    if (crosswalks.length > 0) {
      const cwGeo = createCrosswalkGeometry();
      const cwMat = new THREE.MeshStandardMaterial({
        color: 0xF2F5F7,
        roughness: 0.85,
        metalness: 0,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      const cwMesh = new THREE.InstancedMesh(cwGeo, cwMat, crosswalks.length);
      cwMesh.receiveShadow = true;
      cwMesh.name = 'street-crosswalks';

      crosswalks.forEach((cw, idx) => {
        dummy.position.set(cw.x, 0, cw.z);
        dummy.rotation.set(0, cw.yaw, 0);
        dummy.scale.set(cw.width / 7.0, 1, 1);
        dummy.updateMatrix();
        cwMesh.setMatrixAt(idx, dummy.matrix);
      });
      cwMesh.instanceMatrix.needsUpdate = true;
      this.group.add(cwMesh);
    }
  }

  public setAtmosphere(nightGlow: number, visible: boolean): void {
    this.group.visible = visible;
    this.lampHeadMat.emissiveIntensity = 0.12 + nightGlow * 2.2;
  }

  public getStats(): { trees: number; lamps: number; rails: number; crosswalks: number } {
    return {
      trees: this.treeCount,
      lamps: this.lampCount,
      rails: this.railCount,
      crosswalks: this.crosswalkCount,
    };
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
