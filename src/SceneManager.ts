/**
 * SceneManager — Three.js 场景/渲染器/相机统一管理
 * 升级：ACESFilmic toneMapping + 阴影开启
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

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // art-direction.md §3.2
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(options.backgroundColor ?? 0x101820);

    if (options.enableFog !== false) {
      this.scene.fog = new THREE.Fog(
        options.fogColor ?? options.backgroundColor ?? 0x101820,
        options.fogNear ?? 600,
        options.fogFar ?? 1400,
      );
    }

    this.camera = new THREE.PerspectiveCamera(
      55,
      this.container.clientWidth / Math.max(1, this.container.clientHeight),
      0.1,
      3000,
    );
    // 宽幅视角：能看到整个 ~2km×2.8km 范围（含柳江）
    this.camera.position.set(0, 1200, 1400);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, 100);
    this.controls.enableDamping = true;
    this.controls.update();

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
  }

  private handleResize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  public add(...objects: THREE.Object3D[]): void { this.scene.add(...objects); }
  public remove(...objects: THREE.Object3D[]): void { this.scene.remove(...objects); }

  public startRendering(onUpdate?: (delta: number, elapsed: number) => void): void {
    let last = performance.now();
    const animate = (now: number) => {
      this.animationId = requestAnimationFrame(animate);
      const delta = (now - last) / 1000;
      last = now;
      this.controls.update();
      if (onUpdate) onUpdate(delta, now / 1000);
      this.renderer.render(this.scene, this.camera);
    };
    animate(performance.now());
  }

  public stopRendering(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  public dispose(): void {
    this.stopRendering();
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
