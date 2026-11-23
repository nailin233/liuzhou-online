/**
 * PhysicsWorld — 基于 @dimforge/rapier3d-compat 的地面与建筑碰撞世界
 *
 * 特点：
 *  - 将全部建筑轮廓（2891 栋 Overture / 240 栋 OSM / 34 栋 GLB）打包为单个静态 Trimesh BVH，
 *    保持真实建筑多边形轮廓精度（不膨胀为超大轴对齐盒，窄巷可顺畅穿行），初始化 < 30 ms。
 *  - 使用 KinematicCharacterController 实现贴墙滑动、自动跨步与可靠接地检测。
 */
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { BuildingColliderData } from './WuxingBuildings';

export const PLAYER_CAPSULE_RADIUS = 0.30;
export const PLAYER_CAPSULE_HALF_HEIGHT = 0.52;
// 胶囊底部到中心的距离 = halfHeight + radius = 0.82 m，总高 1.64 m
export const PLAYER_CENTER_OFFSET_Y = PLAYER_CAPSULE_HALF_HEIGHT + PLAYER_CAPSULE_RADIUS;

let rapierInitPromise: Promise<void> | null = null;
async function ensureRapierReady(): Promise<void> {
  if (!rapierInitPromise) {
    rapierInitPromise = RAPIER.init();
  }
  await rapierInitPromise;
}

/** 将建筑轮廓数组构造成 Rapier Trimesh 所需的顶点与索引（含外墙与屋顶） */
export function buildBuildingTrimeshBuffers(
  footprints: BuildingColliderData[],
): { vertices: Float32Array; indices: Uint32Array } {
  const verts: number[] = [];
  const idx: number[] = [];
  let baseVert = 0;

  for (const b of footprints) {
    const raw = b.outline_local;
    const h = b.modelHeight;
    if (!raw || raw.length < 3 || !(h > 0)) continue;

    const pts = (
      raw.length > 3 &&
      raw[0][0] === raw[raw.length - 1][0] &&
      raw[0][1] === raw[raw.length - 1][1]
    ) ? raw.slice(0, -1) : raw;
    if (pts.length < 3) continue;

    const n = pts.length;
    // 底部 n 个顶点 (0..n-1)，顶部 n 个顶点 (n..2n-1)
    for (let i = 0; i < n; i++) verts.push(pts[i][0], 0, pts[i][1]);
    for (let i = 0; i < n; i++) verts.push(pts[i][0], h, pts[i][1]);

    // 外墙双三角形
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      const b0 = baseVert + i;
      const b1 = baseVert + next;
      const t0 = baseVert + n + i;
      const t1 = baseVert + n + next;
      idx.push(b0, b1, t1, b0, t1, t0);
    }

    // 屋顶三角化（支持落到低矮建筑顶面）
    try {
      const contour = pts.map(([x, z]) => new THREE.Vector2(x, -z));
      const faces = THREE.ShapeUtils.triangulateShape(contour, []);
      for (const [a, bIdx, c] of faces) {
        idx.push(baseVert + n + a, baseVert + n + bIdx, baseVert + n + c);
      }
    } catch {
      // 偶发自交轮廓仅保留外墙碰撞即可
    }

    baseVert += n * 2;
  }

  return {
    vertices: new Float32Array(verts),
    indices: new Uint32Array(idx),
  };
}

export interface MoveResult {
  x: number;
  y: number;          // 角色脚底高度 (m)
  z: number;
  grounded: boolean;
  collidedHorizontal: boolean;
}

export class PhysicsWorld {
  private world: RAPIER.World;
  private controller: RAPIER.KinematicCharacterController;
  private playerBody: RAPIER.RigidBody;
  private playerCollider: RAPIER.Collider;
  private buildingCollider: RAPIER.Collider | null = null;
  private buildingCount = 0;

  private constructor(spawnX: number, spawnY: number, spawnZ: number) {
    this.world = new RAPIER.World({ x: 0, y: -20.0, z: 0 });

    // 地面静态碰撞体：顶面精确位于 y = 0.0
    const groundDesc = RAPIER.ColliderDesc.cuboid(3000, 0.5, 3000)
      .setTranslation(0, -0.5, 0);
    this.world.createCollider(groundDesc);

    // 角色运动学刚体 + 胶囊碰撞体
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(spawnX, spawnY + PLAYER_CENTER_OFFSET_Y, spawnZ);
    this.playerBody = this.world.createRigidBody(bodyDesc);
    const colDesc = RAPIER.ColliderDesc.capsule(PLAYER_CAPSULE_HALF_HEIGHT, PLAYER_CAPSULE_RADIUS);
    this.playerCollider = this.world.createCollider(colDesc, this.playerBody);

    // Rapier 角色控制器：允许贴墙滑动、小台阶自动跨步与坡面吸附
    this.controller = this.world.createCharacterController(0.02);
    this.controller.setSlideEnabled(true);
    this.controller.setMaxSlopeClimbAngle(45 * Math.PI / 180);
    this.controller.setMinSlopeSlideAngle(55 * Math.PI / 180);
    this.controller.enableAutostep(0.30, 0.22, true);
    this.controller.enableSnapToGround(0.25);

    this.world.step();
  }

  public static async create(spawn: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }): Promise<PhysicsWorld> {
    await ensureRapierReady();
    return new PhysicsWorld(spawn.x, spawn.y, spawn.z);
  }

  /** 注册全部建筑静态 Trimesh 碰撞体 */
  public setBuildingColliders(footprints: BuildingColliderData[]): number {
    if (this.buildingCollider) {
      this.world.removeCollider(this.buildingCollider, true);
      this.buildingCollider = null;
      this.buildingCount = 0;
    }
    const { vertices, indices } = buildBuildingTrimeshBuffers(footprints);
    if (vertices.length === 0 || indices.length === 0) return 0;

    const trimeshDesc = RAPIER.ColliderDesc.trimesh(vertices, indices);
    this.buildingCollider = this.world.createCollider(trimeshDesc);
    this.buildingCount = footprints.length;
    this.world.step();
    return this.buildingCount;
  }

  public getBuildingColliderCount(): number {
    return this.buildingCount;
  }

  /** 按期望位移执行一次带碰撞检测与贴墙滑动的移动 */
  public moveCharacter(dx: number, dy: number, dz: number): MoveResult {
    this.controller.computeColliderMovement(this.playerCollider, { x: dx, y: dy, z: dz });
    const corrected = this.controller.computedMovement();
    const cur = this.playerBody.translation();

    const nextX = cur.x + corrected.x;
    const nextY = Math.max(PLAYER_CENTER_OFFSET_Y, cur.y + corrected.y);
    const nextZ = cur.z + corrected.z;

    this.playerBody.setNextKinematicTranslation({ x: nextX, y: nextY, z: nextZ });
    this.world.step();

    const grounded = this.controller.computedGrounded() || (nextY <= PLAYER_CENTER_OFFSET_Y + 0.015 && dy <= 0);
    const desiredHoriz = Math.hypot(dx, dz);
    const actualHoriz = Math.hypot(corrected.x, corrected.z);
    const collidedHorizontal = desiredHoriz > 1e-4 && actualHoriz < desiredHoriz * 0.85;

    return {
      x: nextX,
      y: Math.max(0, nextY - PLAYER_CENTER_OFFSET_Y),
      z: nextZ,
      grounded,
      collidedHorizontal,
    };
  }

  /** 瞬间重置角色位置（如重置视角/回到五星街原点） */
  public teleport(x: number, y: number, z: number): void {
    this.playerBody.setTranslation({ x, y: y + PLAYER_CENTER_OFFSET_Y, z }, true);
    this.playerBody.setNextKinematicTranslation({ x, y: y + PLAYER_CENTER_OFFSET_Y, z });
    this.world.step();
  }

  public getFootPosition(): { x: number; y: number; z: number } {
    const t = this.playerBody.translation();
    return { x: t.x, y: Math.max(0, t.y - PLAYER_CENTER_OFFSET_Y), z: t.z };
  }

  public dispose(): void {
    this.world.removeCharacterController(this.controller);
    this.world.free();
  }
}
