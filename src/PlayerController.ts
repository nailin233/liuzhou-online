/**
 * PlayerController — 第三人称动漫角色控制、WASD/跳跃、相机跟随与步行/鸟瞰模式切换
 *
 * 默认落地五星街锚点 (0, 0, 0) 进入第三人称步行模式：
 *  - W/A/S/D 或 方向键：相对相机朝向移动
 *  - Shift：奔跑加速
 *  - Space：跳跃（受 Rapier 重力与碰撞约束）
 *  - 鼠标左键拖动：环绕角色旋转镜头；滚轮：缩放跟随距离
 *  - V：在「步行模式」与「鸟瞰总览」间无缝切换
 */
import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { AnimeCharacter } from './AnimeCharacter';
import type { PhysicsWorld } from './PhysicsWorld';

export type CameraMode = 'walk' | 'overview';
export type WalkCameraPreset = 'close' | 'wide' | 'first';

export interface PlayerInputState {
  forward:  boolean;
  backward: boolean;
  left:     boolean;
  right:    boolean;
  sprint:   boolean;
  jump:     boolean;
}

export const WALK_SPEED = 5.0;      // m/s
export const SPRINT_SPEED = 9.5;    // m/s
export const JUMP_VELOCITY = 8.2;   // m/s
export const GRAVITY = -20.0;       // m/s²
const TARGET_EYE_HEIGHT = 2.05;     // 相机注视高度 (m)，让首屏完整框入角色、5.88m 雕塑与高层商厦天际线

export interface PlayerControllerOptions {
  character:    AnimeCharacter;
  physics:      PhysicsWorld;
  camera:       THREE.PerspectiveCamera;
  controls:     OrbitControls;
  spawn?:       { x: number; y: number; z: number };
  initialYaw?:  number;
  initialMode?: CameraMode;
  onModeChange?: (mode: CameraMode) => void;
  bindKeyboard?: boolean;
}

function lerpAngle(current: number, target: number, alpha: number): number {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * alpha;
}

export class PlayerController {
  private readonly character: AnimeCharacter;
  private readonly physics: PhysicsWorld;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly spawn: { x: number; y: number; z: number };
  private readonly initialYaw: number;
  private readonly onModeChange?: (mode: CameraMode) => void;

  private mode: CameraMode = 'walk';
  private walkPreset: WalkCameraPreset = 'close';
  private verticalVel = 0;
  private grounded = true;
  private currentYaw = Math.PI; // 默认朝向正北 (-Z)，可按 initialYaw 覆盖
  private lastHorizSpeed = 0;
  private lastCollidedWall = false;

  private input: PlayerInputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jump: false,
  };
  private jumpConsumed = false;

  private onKeyDown?: (e: KeyboardEvent) => void;
  private onKeyUp?: (e: KeyboardEvent) => void;
  private onBlur?: () => void;

  // 临时复用向量，避免每帧 GC
  private readonly tmpForward = new THREE.Vector3();
  private readonly tmpRight   = new THREE.Vector3();
  private readonly tmpMove    = new THREE.Vector3();
  private readonly tmpTarget  = new THREE.Vector3();
  private readonly tmpDelta   = new THREE.Vector3();

  constructor(options: PlayerControllerOptions) {
    this.character = options.character;
    this.physics = options.physics;
    this.camera = options.camera;
    this.controls = options.controls;
    this.spawn = options.spawn ?? { x: 0, y: 0, z: 0 };
    this.initialYaw = options.initialYaw ?? Math.PI;
    this.currentYaw = this.initialYaw;
    this.onModeChange = options.onModeChange;

    this.character.root.position.set(this.spawn.x, this.spawn.y, this.spawn.z);
    this.character.root.rotation.y = this.currentYaw;

    this.setMode(options.initialMode ?? 'walk', true);

    if (options.bindKeyboard !== false && typeof window !== 'undefined') {
      this.bindEvents();
    }
  }

  private bindEvents(): void {
    const mapCode = (code: string, pressed: boolean, e: KeyboardEvent): void => {
      if (code === 'KeyW' || code === 'ArrowUp')    { this.input.forward  = pressed; if (code.startsWith('Arrow')) e.preventDefault(); }
      if (code === 'KeyS' || code === 'ArrowDown')  { this.input.backward = pressed; if (code.startsWith('Arrow')) e.preventDefault(); }
      if (code === 'KeyA' || code === 'ArrowLeft')  { this.input.left     = pressed; if (code.startsWith('Arrow')) e.preventDefault(); }
      if (code === 'KeyD' || code === 'ArrowRight') { this.input.right    = pressed; if (code.startsWith('Arrow')) e.preventDefault(); }
      if (code === 'ShiftLeft' || code === 'ShiftRight') { this.input.sprint = pressed; }
      if (code === 'Space') {
        if (this.mode === 'walk') e.preventDefault();
        this.input.jump = pressed;
        if (!pressed) this.jumpConsumed = false;
      }
    };

    this.onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'KeyV' && !e.repeat) {
        this.toggleMode();
        return;
      }
      if (e.code === 'KeyC' && !e.repeat && this.mode === 'walk') {
        this.cycleWalkCameraPreset();
        return;
      }
      if (e.code === 'KeyR' && !e.repeat) {
        this.reset();
        return;
      }
      mapCode(e.code, true, e);
    };
    this.onKeyUp = (e: KeyboardEvent) => {
      mapCode(e.code, false, e);
    };
    this.onBlur = () => {
      this.input = { forward: false, backward: false, left: false, right: false, sprint: false, jump: false };
      this.jumpConsumed = false;
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  /** 供自动化测试或虚拟摇杆直接注入输入状态 */
  public setInputState(partial: Partial<PlayerInputState>): void {
    Object.assign(this.input, partial);
    if (partial.jump === false) this.jumpConsumed = false;
  }

  public getMode(): CameraMode {
    return this.mode;
  }

  public toggleMode(): CameraMode {
    const next: CameraMode = this.mode === 'walk' ? 'overview' : 'walk';
    this.setMode(next);
    return next;
  }

  public getWalkCameraPreset(): WalkCameraPreset {
    return this.walkPreset;
  }

  /** C 键循环切换：近景第三人称 -> 远景第三人称 -> 第一人称漫步 */
  public cycleWalkCameraPreset(): WalkCameraPreset {
    const order: WalkCameraPreset[] = ['close', 'wide', 'first'];
    const next = order[(order.indexOf(this.walkPreset) + 1) % order.length];
    this.walkPreset = next;
    if (this.mode === 'walk') {
      this.applyWalkCameraPreset();
    }
    return next;
  }

  private applyWalkCameraPreset(): void {
    const pos = this.physics.getFootPosition();
    const backX = -Math.sin(this.currentYaw);
    const backZ = -Math.cos(this.currentYaw);
    this.controls.enableDamping = false;

    if (this.walkPreset === 'first') {
      this.character.root.visible = false;
      this.controls.minDistance = 0.2;
      this.controls.maxDistance = 0.6;
      this.controls.target.set(pos.x - backX * 0.4, pos.y + 1.56, pos.z - backZ * 0.4);
      this.camera.position.set(pos.x, pos.y + 1.58, pos.z);
    } else {
      this.character.root.visible = true;
      const dist = this.walkPreset === 'wide' ? 9.0 : 5.8;
      const height = this.walkPreset === 'wide' ? 3.8 : 2.35;
      this.controls.minDistance = 2.6;
      this.controls.maxDistance = 18;
      this.controls.target.set(pos.x, pos.y + TARGET_EYE_HEIGHT, pos.z);
      this.camera.position.set(pos.x + backX * dist, pos.y + height, pos.z + backZ * dist);
    }
    this.controls.update();
    this.controls.enableDamping = true;
  }

  public setMode(mode: CameraMode, immediate = false): void {
    this.mode = mode;
    const pos = this.physics.getFootPosition();
    this.controls.enableDamping = false;

    if (mode === 'walk') {
      this.controls.enablePan = false;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.06;
      this.controls.minPolarAngle = 0.22;
      this.applyWalkCameraPreset();
    } else {
      this.character.root.visible = true;
      this.controls.enablePan = true;
      this.controls.minDistance = 40;
      this.controls.maxDistance = 2800;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.03;
      this.controls.minPolarAngle = 0.05;

      this.controls.target.set(pos.x, 0, pos.z + 120);
      this.camera.position.set(pos.x, 720, pos.z + 860);
    }

    this.controls.update();
    if (!immediate) this.controls.saveState();
    this.controls.enableDamping = true;
    this.onModeChange?.(mode);
  }

  /** 将当前视角置北（+Z 侧看向 -Z） */
  public orientNorth(): void {
    const dist = this.camera.position.distanceTo(this.controls.target);
    const offset = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    const polar = THREE.MathUtils.clamp(
      Math.acos(THREE.MathUtils.clamp(offset.y / Math.max(dist, 0.5), -1, 1)),
      0.25,
      Math.PI / 2 - 0.06,
    );
    this.controls.enableDamping = false;
    this.camera.position.set(
      this.controls.target.x,
      this.controls.target.y + dist * Math.cos(polar),
      this.controls.target.z + dist * Math.sin(polar),
    );
    this.controls.update();
    this.controls.enableDamping = true;
  }

  /** 重置角色到五星街原点并恢复当前模式默认视角 */
  public reset(): void {
    this.verticalVel = 0;
    this.grounded = true;
    this.currentYaw = this.initialYaw;
    this.physics.teleport(this.spawn.x, this.spawn.y, this.spawn.z);
    this.character.root.position.set(this.spawn.x, this.spawn.y, this.spawn.z);
    this.character.root.rotation.y = this.currentYaw;
    this.setMode(this.mode, true);
  }

  public getPosition(): { x: number; y: number; z: number } {
    return this.physics.getFootPosition();
  }

  public getState(): {
    mode: CameraMode;
    grounded: boolean;
    verticalVel: number;
    speed: number;
    collidedWall: boolean;
  } {
    return {
      mode: this.mode,
      grounded: this.grounded,
      verticalVel: this.verticalVel,
      speed: this.lastHorizSpeed,
      collidedWall: this.lastCollidedWall,
    };
  }

  /** 每帧更新物理移动、相机跟随与动漫骨骼动画 */
  public update(dt: number): void {
    const safeDt = Math.min(Math.max(dt, 0.001), 0.05);
    const prevPos = this.physics.getFootPosition();

    let desiredDx = 0;
    let desiredDz = 0;
    let sprinting = false;

    if (this.mode === 'walk') {
      const fwdAxis = (this.input.forward ? 1 : 0) - (this.input.backward ? 1 : 0);
      const sideAxis = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);

      if (fwdAxis !== 0 || sideAxis !== 0) {
        // 相机水平前向（从相机指向目标）
        this.tmpForward.subVectors(this.controls.target, this.camera.position).setY(0);
        if (this.tmpForward.lengthSq() < 1e-6) this.tmpForward.set(0, 0, -1);
        else this.tmpForward.normalize();

        // 水平右向 = forward × (0,1,0) = (-forward.z, 0, forward.x)
        this.tmpRight.set(-this.tmpForward.z, 0, this.tmpForward.x);

        this.tmpMove.set(0, 0, 0)
          .addScaledVector(this.tmpForward, fwdAxis)
          .addScaledVector(this.tmpRight, sideAxis)
          .normalize();

        sprinting = this.input.sprint;
        const speed = sprinting ? SPRINT_SPEED : WALK_SPEED;
        desiredDx = this.tmpMove.x * speed * safeDt;
        desiredDz = this.tmpMove.z * speed * safeDt;

        // 角色平滑转向移动方向（模型正面朝 +Z，atan2(x, z) 即绕 Y 旋转角）
        const targetYaw = Math.atan2(this.tmpMove.x, this.tmpMove.z);
        this.currentYaw = lerpAngle(this.currentYaw, targetYaw, Math.min(1, safeDt * 14));
      }

      // 跳跃输入（落地时触发）
      if (this.input.jump && !this.jumpConsumed && this.grounded) {
        this.verticalVel = JUMP_VELOCITY;
        this.grounded = false;
        this.jumpConsumed = true;
      }
    }

    // 重力积分
    if (!this.grounded || this.verticalVel > 0) {
      this.verticalVel += GRAVITY * safeDt;
    } else {
      this.verticalVel = -0.5; // 轻微向下贴地力确保接地稳定
    }
    const desiredDy = this.verticalVel * safeDt;

    // Rapier 碰撞解算（地面 + 2891 栋建筑外墙/屋顶）
    const res = this.physics.moveCharacter(desiredDx, desiredDy, desiredDz);
    this.grounded = res.grounded;
    if (res.grounded && this.verticalVel < 0) {
      this.verticalVel = 0;
    }

    const actualDx = res.x - prevPos.x;
    const actualDz = res.z - prevPos.z;
    this.lastHorizSpeed = Math.hypot(actualDx, actualDz) / safeDt;
    this.lastCollidedWall = res.collidedHorizontal;

    // 同步 Three.js 动漫角色模型位置与朝向
    this.character.root.position.set(res.x, res.y, res.z);
    this.character.root.rotation.y = this.currentYaw;

    // 驱动动漫骨骼动画
    this.character.updateAnimation(safeDt, {
      speed: this.lastHorizSpeed,
      maxSpeed: SPRINT_SPEED,
      verticalVel: this.verticalVel,
      grounded: this.grounded,
      sprinting,
    });

    // 第三人称跟随：平移相机与 OrbitControls 目标点，保留玩家自由拖动旋转与滚轮缩放
    if (this.mode === 'walk') {
      this.tmpTarget.set(res.x, res.y + TARGET_EYE_HEIGHT, res.z);
      this.tmpDelta.subVectors(this.tmpTarget, this.controls.target);
      const followAlpha = Math.min(1, safeDt * 18);
      this.tmpDelta.multiplyScalar(followAlpha);
      this.controls.target.add(this.tmpDelta);
      this.camera.position.add(this.tmpDelta);
      // 防止相机贴地过低
      if (this.camera.position.y < res.y + 0.6) {
        this.camera.position.y = res.y + 0.6;
      }
    }
  }

  public dispose(): void {
    if (this.onKeyDown) window.removeEventListener('keydown', this.onKeyDown);
    if (this.onKeyUp) window.removeEventListener('keyup', this.onKeyUp);
    if (this.onBlur) window.removeEventListener('blur', this.onBlur);
  }
}
