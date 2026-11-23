/**
 * SkyAtmosphere — 24 小时动态天空穹顶、体积感云层、太阳/月亮方向光与昼夜氛围预设
 *
 * 支持 4 种一键模式：
 *  - 'day'    晴日（默认 10:30，明媚蓝天白云，最适合抖音街拍宣传）
 *  - 'sunset' 日落（17:55，柳江金色晚霞与温暖逆光）
 *  - 'night'  夜景（21:30，深蓝星空、建筑暖黄窗灯与路灯发光）
 *  - 'audit'  数据检视（保留原 M1 工程沙盘深色底色 + 洋红缺失高度斜纹）
 */
import * as THREE from 'three';

export type AtmospherePresetId = 'day' | 'sunset' | 'night' | 'audit';

export interface AtmospherePreset {
  id:           AtmospherePresetId;
  label:        string;
  timeLabel:    string;
  skyTop:       number;
  skyMid:       number;
  skyHorizon:   number;
  fogColor:     number;
  fogNear:      number;
  fogFar:       number;
  hemiSky:      number;
  hemiGround:   number;
  hemiIntensity:number;
  sunColor:     number;
  sunIntensity: number;
  sunPosition:  [number, number, number];
  cloudColor:   number;
  cloudOpacity: number;
  nightGlow:    number;  // 0 = 白天，1 = 夜景窗灯/路灯全亮
  exposure:     number;
}

export const ATMOSPHERE_PRESETS: Record<AtmospherePresetId, AtmospherePreset> = {
  day: {
    id:            'day',
    label:         '晴日',
    timeLabel:     '10:25',
    skyTop:        0x2D7DD2,
    skyMid:        0x72B5E8,
    skyHorizon:    0xD4ECFA,
    fogColor:      0xC8E3F4,
    fogNear:       650,
    fogFar:        2800,
    hemiSky:       0xDFF2FF,
    hemiGround:    0x5A6658,
    hemiIntensity: 1.25,
    sunColor:      0xFFF6E3,
    sunIntensity:  2.45,
    sunPosition:   [-420, 740, 380],
    cloudColor:    0xFFFFFF,
    cloudOpacity:  0.88,
    nightGlow:     0.0,
    exposure:      1.05,
  },
  sunset: {
    id:            'sunset',
    label:         '日落',
    timeLabel:     '17:55',
    skyTop:        0x2A3D66,
    skyMid:        0xC86D5B,
    skyHorizon:    0xFFD194,
    fogColor:      0xE8AE82,
    fogNear:       520,
    fogFar:        2500,
    hemiSky:       0xFFD8B0,
    hemiGround:    0x433544,
    hemiIntensity: 1.05,
    sunColor:      0xFF9F5A,
    sunIntensity:  2.65,
    sunPosition:   [-760, 290, 260],
    cloudColor:    0xFFE0BA,
    cloudOpacity:  0.82,
    nightGlow:     0.45,
    exposure:      1.05,
  },
  night: {
    id:            'night',
    label:         '夜景',
    timeLabel:     '21:30',
    skyTop:        0x07101E,
    skyMid:        0x10203A,
    skyHorizon:    0x1F3654,
    fogColor:      0x132238,
    fogNear:       420,
    fogFar:        2200,
    hemiSky:       0x3B5E8C,
    hemiGround:    0x141B24,
    hemiIntensity: 0.72,
    sunColor:      0x99C4FF,
    sunIntensity:  0.95,
    sunPosition:   [380, 620, -340],
    cloudColor:    0x273D5C,
    cloudOpacity:  0.42,
    nightGlow:     1.0,
    exposure:      1.02,
  },
  audit: {
    id:            'audit',
    label:         '数据检视',
    timeLabel:     'AUDIT',
    skyTop:        0x101820,
    skyMid:        0x101820,
    skyHorizon:    0x101820,
    fogColor:      0x101820,
    fogNear:       1800,
    fogFar:        4600,
    hemiSky:       0xBCD2E0,
    hemiGround:    0x293744,
    hemiIntensity: 1.6,
    sunColor:      0xFFE0B5,
    sunIntensity:  2.4,
    sunPosition:   [-455, 765, 455],
    cloudColor:    0x223344,
    cloudOpacity:  0.0,
    nightGlow:     0.0,
    exposure:      1.0,
  },
};

export class SkyAtmosphere {
  public readonly group: THREE.Group;
  public readonly hemiLight: THREE.HemisphereLight;
  public readonly sunLight: THREE.DirectionalLight;

  private presetId: AtmospherePresetId = 'day';
  private skyMesh: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private sunDisc: THREE.Mesh;
  private sunDiscMat: THREE.MeshBasicMaterial;
  private cloudGroup: THREE.Group;
  private cloudMat: THREE.MeshLambertMaterial;
  private scene: THREE.Scene;
  private renderer?: THREE.WebGLRenderer;

  constructor(scene: THREE.Scene, renderer?: THREE.WebGLRenderer, initial: AtmospherePresetId = 'day') {
    this.scene = scene;
    this.renderer = renderer;
    this.group = new THREE.Group();
    this.group.name = 'sky-atmosphere';

    // ── 半球光与平行光（太阳/月亮）──
    this.hemiLight = new THREE.HemisphereLight(0xDFF2FF, 0x5A6658, 1.25);
    this.group.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xFFF6E3, 2.45);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    const sc = this.sunLight.shadow.camera as THREE.OrthographicCamera;
    sc.left = sc.bottom = -420;
    sc.right = sc.top = 420;
    sc.near = 50;
    sc.far = 2200;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.25;
    this.group.add(this.sunLight);
    this.group.add(this.sunLight.target);

    // ── 渐变天空穹顶（纯 Shader，零贴图，高帧率）──
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop:     { value: new THREE.Color(0x2D7DD2) },
        uMid:     { value: new THREE.Color(0x72B5E8) },
        uHorizon: { value: new THREE.Color(0xD4ECFA) },
        uSunDir:  { value: new THREE.Vector3(-0.4, 0.7, 0.4).normalize() },
        uSunCol:  { value: new THREE.Color(0xFFF6E3) },
        uNight:   { value: 0.0 },
      },
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uMid;
        uniform vec3 uHorizon;
        uniform vec3 uSunDir;
        uniform vec3 uSunCol;
        uniform float uNight;
        varying vec3 vWorldDir;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        void main() {
          vec3 d = normalize(vWorldDir);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.28, h));
          col = mix(col, uTop, smoothstep(0.24, 0.85, h));

          // 柔和太阳光晕
          float sunDot = max(dot(d, normalize(uSunDir)), 0.0);
          col += uSunCol * pow(sunDot, 16.0) * 0.28;
          col += uSunCol * pow(sunDot, 180.0) * 0.55;

          // 夜景稀疏星光
          if (uNight > 0.3 && h > 0.12) {
            vec2 grid = floor(d.xz / max(d.y, 0.15) * 48.0);
            float s = hash21(grid);
            if (s > 0.992) {
              col += vec3(0.85, 0.92, 1.0) * uNight * smoothstep(0.12, 0.35, h) * 0.8;
            }
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.skyMesh = new THREE.Mesh(new THREE.SphereGeometry(4800, 28, 18), this.skyMat);
    this.skyMesh.name = 'sky-dome';
    this.group.add(this.skyMesh);

    // 太阳光盘
    this.sunDiscMat = new THREE.MeshBasicMaterial({ color: 0xFFF9E6, fog: false });
    this.sunDisc = new THREE.Mesh(new THREE.SphereGeometry(75, 16, 12), this.sunDiscMat);
    this.group.add(this.sunDisc);

    // ── 低多边形动漫白云（漂浮在 320–460 m 高空，仅 1 个共享材质）──
    this.cloudGroup = new THREE.Group();
    this.cloudGroup.name = 'sky-clouds';
    this.cloudMat = new THREE.MeshLambertMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.88,
      fog: false,
    });
    this.buildAnimeClouds();
    this.group.add(this.cloudGroup);

    scene.add(this.group);
    this.setPreset(initial);
  }

  private buildAnimeClouds(): void {
    // 确定性分布 22 朵风格化白云（无随机数抖动，截图可复现）
    const puffGeo = new THREE.DodecahedronGeometry(1, 1);
    for (let i = 0; i < 22; i++) {
      const angle = (i / 22) * Math.PI * 2 + (i % 3) * 0.17;
      const dist = 550 + (i * 193) % 1400;
      const y = 330 + (i * 47) % 150;
      const cloud = new THREE.Group();
      cloud.position.set(Math.cos(angle) * dist, y, Math.sin(angle) * dist);

      const scaleBase = 26 + (i * 13) % 24;
      const offsets: [number, number, number, number][] = [
        [0, 0, 0, 1.0],
        [scaleBase * 0.9, -scaleBase * 0.15, 0, 0.72],
        [-scaleBase * 0.85, -scaleBase * 0.12, scaleBase * 0.2, 0.78],
        [scaleBase * 0.35, scaleBase * 0.28, -scaleBase * 0.2, 0.65],
      ];
      for (const [ox, oy, oz, s] of offsets) {
        const m = new THREE.Mesh(puffGeo, this.cloudMat);
        m.position.set(ox, oy, oz);
        m.scale.set(scaleBase * s * 1.4, scaleBase * s * 0.58, scaleBase * s * 0.95);
        cloud.add(m);
      }
      this.cloudGroup.add(cloud);
    }
  }

  public setPreset(id: AtmospherePresetId): AtmospherePreset {
    const p = ATMOSPHERE_PRESETS[id] ?? ATMOSPHERE_PRESETS.day;
    this.presetId = p.id;

    this.scene.background = new THREE.Color(p.fogColor);
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.setHex(p.fogColor);
      this.scene.fog.near = p.fogNear;
      this.scene.fog.far = p.fogFar;
    } else {
      this.scene.fog = new THREE.Fog(p.fogColor, p.fogNear, p.fogFar);
    }

    this.hemiLight.color.setHex(p.hemiSky);
    this.hemiLight.groundColor.setHex(p.hemiGround);
    this.hemiLight.intensity = p.hemiIntensity;

    this.sunLight.color.setHex(p.sunColor);
    this.sunLight.intensity = p.sunIntensity;
    this.sunLight.position.set(...p.sunPosition);

    this.skyMat.uniforms.uTop.value.setHex(p.skyTop);
    this.skyMat.uniforms.uMid.value.setHex(p.skyMid);
    this.skyMat.uniforms.uHorizon.value.setHex(p.skyHorizon);
    this.skyMat.uniforms.uSunDir.value.set(...p.sunPosition).normalize();
    this.skyMat.uniforms.uSunCol.value.setHex(p.sunColor);
    this.skyMat.uniforms.uNight.value = p.nightGlow;

    const sunDir = new THREE.Vector3(...p.sunPosition).normalize();
    this.sunDisc.position.copy(sunDir).multiplyScalar(3600);
    this.sunDiscMat.color.setHex(p.sunColor);
    this.sunDisc.visible = id !== 'audit';

    this.cloudMat.color.setHex(p.cloudColor);
    this.cloudMat.opacity = p.cloudOpacity;
    this.cloudGroup.visible = p.cloudOpacity > 0.01;

    if (this.renderer) {
      this.renderer.toneMappingExposure = p.exposure;
    }
    return p;
  }

  public getPresetId(): AtmospherePresetId {
    return this.presetId;
  }

  public getPreset(): AtmospherePreset {
    return ATMOSPHERE_PRESETS[this.presetId];
  }

  /** 每帧跟随相机中心（保证天空不穿帮、平行光阴影始终紧跟角色清晰锐利）并缓慢飘云 */
  public update(dt: number, focusPos: { x: number; z: number }): void {
    const p = ATMOSPHERE_PRESETS[this.presetId];
    this.skyMesh.position.set(focusPos.x, 0, focusPos.z);

    // 阴影相机锚定在角色附近（步长量化到 2 m，防止阴影边缘抖动）
    const snapX = Math.round(focusPos.x / 2) * 2;
    const snapZ = Math.round(focusPos.z / 2) * 2;
    this.sunLight.target.position.set(snapX, 0, snapZ);
    this.sunLight.position.set(
      snapX + p.sunPosition[0],
      p.sunPosition[1],
      snapZ + p.sunPosition[2],
    );

    // 白云轻柔飘移
    if (this.cloudGroup.visible) {
      this.cloudGroup.rotation.y += Math.min(dt, 0.05) * 0.004;
    }
  }

  public dispose(): void {
    const geos = new Set<THREE.BufferGeometry>();
    this.group.traverse(o => {
      if (o instanceof THREE.Mesh) geos.add(o.geometry);
    });
    for (const g of geos) g.dispose();
    this.skyMat.dispose();
    this.sunDiscMat.dispose();
    this.cloudMat.dispose();
  }
}
