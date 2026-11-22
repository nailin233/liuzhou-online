/**
 * Scene Manager - 管理 Three.js 场景的核心类
 * 
 * 职责:
 * - 初始化渲染器、场景、相机
 * - 管理窗口大小调整
 * - 提供渲染循环
 * - 提供场景对象添加/移除接口
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface SceneManagerOptions {
  container: HTMLElement;
  backgroundColor?: number;
  enableFog?: boolean;
  fogColor?: number;
  fogNear?: number;
  fogFar?: number;
}

export class SceneManager {
  public readonly renderer: THREE.WebGLRenderer;
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly controls: OrbitControls;

  private container: HTMLElement;
  private resizeObserver: ResizeObserver;
  private animationId: number | null = null;

  constructor(options: SceneManagerOptions) {
    this.container = options.container;

    // 初始化渲染器
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    // 初始化场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(options.backgroundColor ?? 0x101820);

    if (options.enableFog !== false) {
      const fogColor = options.fogColor ?? options.backgroundColor ?? 0x101820;
      const fogNear = options.fogNear ?? 45;
      const fogFar = options.fogFar ?? 115;
      this.scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
    }

    // 初始化相机
    this.camera = new THREE.PerspectiveCamera(
      55, // FOV
      this.container.clientWidth / Math.max(1, this.container.clientHeight),
      0.1, // near
      250 // far
    );
    this.camera.position.set(18, 20, 23);

    // 初始化控制器
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1, 0);
    this.controls.enableDamping = true;
    this.controls.update();

    // 设置窗口大小监听
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
  }

  private handleResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  /**
   * 添加对象到场景
   */
  public add(...objects: THREE.Object3D[]): void {
    this.scene.add(...objects);
  }

  /**
   * 从场景移除对象
   */
  public remove(...objects: THREE.Object3D[]): void {
    this.scene.remove(...objects);
  }

  /**
   * 开始渲染循环
   */
  public startRendering(onUpdate?: (delta: number, elapsed: number) => void): void {
    let lastTime = performance.now();

    const animate = (now: number) => {
      this.animationId = requestAnimationFrame(animate);

      const delta = (now - lastTime) / 1000; // 秒
      lastTime = now;

      this.controls.update();
      
      if (onUpdate) {
        onUpdate(delta, now / 1000);
      }

      this.renderer.render(this.scene, this.camera);
    };

    animate(performance.now());
  }

  /**
   * 停止渲染循环
   */
  public stopRendering(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    this.stopRendering();
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
