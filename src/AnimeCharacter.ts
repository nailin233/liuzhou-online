/**
 * AnimeCharacter — 原创动漫风格第三人称角色（非真实人物肖像）
 *
 * 尺寸：身高 ~1.68 m，底面原点在脚底 (y = 0)，正面朝向 +Z
 * 美术：三阶赛璐璐 MeshToonMaterial + 反面墨线轮廓（BackSide）
 * 动画：待机呼吸、步行/奔跑四肢与膝肘摆动、跳跃/下落姿态、发辫与围巾随动
 * 配色：支持实时切换 'teal'（青绿）/ 'amber'（暖橙）/ 'white'（亮白）
 */
import * as THREE from 'three';

export type CharacterPaletteId = 'teal' | 'amber' | 'white';

export interface CharacterPalette {
  id:            CharacterPaletteId;
  label:         string;
  swatchHex:     string;
  accent:        number;  // 外套 / 发带 / 鞋饰主色
  secondary:     number;  // 下装 / 背包主体深色
  hair:          number;  // 头发主色
  hairHighlight: number;  // 发饰 / 发光点缀
  scarf:         number;  // 围巾与内搭
  eye:           number;  // 动漫虹膜色
  shoe:          number;  // 运动鞋主色
}

export const CHARACTER_PALETTES: Record<CharacterPaletteId, CharacterPalette> = {
  teal: {
    id:            'teal',
    label:         '青绿',
    swatchHex:     '#5CE1CE',
    accent:        0x5CE1CE,
    secondary:     0x1F3642,
    hair:          0x28384E,
    hairHighlight: 0x8AD2C8,
    scarf:         0xEDF4F5,
    eye:           0x2EC4B6,
    shoe:          0xEDF4F5,
  },
  amber: {
    id:            'amber',
    label:         '暖橙',
    swatchHex:     '#F4A261',
    accent:        0xF4A261,
    secondary:     0x2B2D42,
    hair:          0x4A2E2B,
    hairHighlight: 0xFFD166,
    scarf:         0xFFF4E6,
    eye:           0xE76F51,
    shoe:          0xFFF4E6,
  },
  white: {
    id:            'white',
    label:         '亮白',
    swatchHex:     '#EDF4F5',
    accent:        0xEDF4F5,
    secondary:     0x263544,
    hair:          0xD8E3EE,
    hairHighlight: 0x8AD2C8,
    scarf:         0x8AD2C8,
    eye:           0x4EA8DE,
    shoe:          0x8AD2C8,
  },
};

export interface CharacterAnimState {
  speed:       number;   // 水平移动速度 (m/s)
  maxSpeed:    number;   // 奔跑速度参考 (m/s)
  verticalVel: number;   // 竖直速度 (m/s)
  grounded:    boolean;
  sprinting:   boolean;
}

/** 创建 3 阶赛璐璐明暗渐变纹理（无需 DOM canvas，兼容 Node 单测） */
function createToonGradientMap(): THREE.DataTexture {
  // 3 级阶梯：阴影 120 / 中间调 205 / 高光 255
  const data = new Uint8Array([
    120, 120, 120, 255,
    205, 205, 205, 255,
    255, 255, 255, 255,
  ]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export class AnimeCharacter {
  public readonly root: THREE.Group;
  private paletteId: CharacterPaletteId;
  private gradientMap: THREE.DataTexture;

  // 可切换配色的共享材质
  private matAccent:        THREE.MeshToonMaterial;
  private matSecondary:     THREE.MeshToonMaterial;
  private matHair:          THREE.MeshToonMaterial;
  private matHairHighlight: THREE.MeshStandardMaterial;
  private matScarf:         THREE.MeshToonMaterial;
  private matEye:           THREE.MeshBasicMaterial;
  private matShoe:          THREE.MeshToonMaterial;
  private matSkin:          THREE.MeshToonMaterial;
  private matInk:           THREE.MeshBasicMaterial;
  private matWhite:         THREE.MeshBasicMaterial;
  private matBlush:         THREE.MeshBasicMaterial;
  private matFootRing:      THREE.MeshBasicMaterial;

  // 骨骼关节节点
  private bodyPivot:     THREE.Group;
  private headPivot:     THREE.Group;
  private leftArmPivot:  THREE.Group;
  private rightArmPivot: THREE.Group;
  private leftLegPivot:  THREE.Group;
  private rightLegPivot: THREE.Group;
  private ponytailPivot: THREE.Group;
  private scarfTailPivot:THREE.Group;

  // 动画状态
  private walkPhase = 0;
  private idleTime  = 0;
  private wasGrounded = true;
  private landSquash  = 0;

  constructor(initialPalette: CharacterPaletteId = 'teal') {
    this.paletteId = initialPalette;
    this.gradientMap = createToonGradientMap();
    const p = CHARACTER_PALETTES[initialPalette];

    this.matAccent = new THREE.MeshToonMaterial({ color: p.accent, gradientMap: this.gradientMap });
    this.matSecondary = new THREE.MeshToonMaterial({ color: p.secondary, gradientMap: this.gradientMap });
    this.matHair = new THREE.MeshToonMaterial({ color: p.hair, gradientMap: this.gradientMap });
    this.matHairHighlight = new THREE.MeshStandardMaterial({
      color: p.hairHighlight,
      emissive: p.hairHighlight,
      emissiveIntensity: 0.35,
      roughness: 0.35,
      metalness: 0.1,
    });
    this.matScarf = new THREE.MeshToonMaterial({ color: p.scarf, gradientMap: this.gradientMap });
    this.matEye = new THREE.MeshBasicMaterial({ color: p.eye });
    this.matShoe = new THREE.MeshToonMaterial({ color: p.shoe, gradientMap: this.gradientMap });
    this.matSkin = new THREE.MeshToonMaterial({ color: 0xFCE4D4, gradientMap: this.gradientMap });
    this.matInk = new THREE.MeshBasicMaterial({ color: 0x101822, side: THREE.BackSide });
    this.matWhite = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    this.matBlush = new THREE.MeshBasicMaterial({ color: 0xF299A8, transparent: true, opacity: 0.45 });
    this.matFootRing = new THREE.MeshBasicMaterial({
      color: p.accent,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });

    this.root = new THREE.Group();
    this.root.name = 'anime-character';

    // 脚底定位光环（鸟瞰视角也容易一眼找到角色）
    const ringGeo = new THREE.RingGeometry(0.36, 0.48, 28);
    ringGeo.rotateX(-Math.PI / 2);
    const footRing = new THREE.Mesh(ringGeo, this.matFootRing);
    footRing.position.y = 0.055;
    footRing.name = 'character-foot-ring';
    this.root.add(footRing);

    // 主身体枢轴（用于呼吸起伏与落地弹性形变）
    this.bodyPivot = new THREE.Group();
    this.bodyPivot.position.y = 0;
    this.root.add(this.bodyPivot);

    // ── 双腿 (髋部 y = 0.78 m) ──
    this.leftLegPivot = this.createLeg(-0.105);
    this.rightLegPivot = this.createLeg(0.105);
    this.bodyPivot.add(this.leftLegPivot, this.rightLegPivot);

    // ── 下装（都市动漫百褶短裙/短裤廓形）──
    const skirtGeo = new THREE.CylinderGeometry(0.14, 0.215, 0.24, 14);
    const skirt = this.makeOutlinedMesh(skirtGeo, this.matSecondary, 1.04);
    skirt.position.set(0, 0.77, 0);
    this.bodyPivot.add(skirt);

    // 腰带点缀
    const beltGeo = new THREE.CylinderGeometry(0.145, 0.148, 0.045, 14);
    const belt = new THREE.Mesh(beltGeo, this.matHairHighlight);
    belt.position.set(0, 0.88, 0);
    this.bodyPivot.add(belt);

    // ── 上身外套（短款机能风动漫夹克）──
    const torsoGeo = new THREE.CylinderGeometry(0.145, 0.135, 0.40, 12);
    const torso = this.makeOutlinedMesh(torsoGeo, this.matAccent, 1.05);
    torso.position.set(0, 1.08, 0);
    this.bodyPivot.add(torso);

    // 胸前内搭三角领口
    const collarGeo = new THREE.BoxGeometry(0.11, 0.16, 0.05);
    const collar = new THREE.Mesh(collarGeo, this.matScarf);
    collar.position.set(0, 1.18, 0.12);
    this.bodyPivot.add(collar);

    // ── 围巾 + 飘动尾端 ──
    const scarfRingGeo = new THREE.TorusGeometry(0.12, 0.042, 8, 16);
    scarfRingGeo.rotateX(Math.PI / 2);
    const scarfRing = this.makeOutlinedMesh(scarfRingGeo, this.matScarf, 1.07);
    scarfRing.position.set(0, 1.28, 0);
    this.bodyPivot.add(scarfRing);

    this.scarfTailPivot = new THREE.Group();
    this.scarfTailPivot.position.set(0.05, 1.26, -0.11);
    const scarfTailGeo = new THREE.BoxGeometry(0.10, 0.30, 0.032);
    scarfTailGeo.translate(0, -0.14, -0.02);
    const scarfTail = this.makeOutlinedMesh(scarfTailGeo, this.matScarf, 1.06);
    this.scarfTailPivot.add(scarfTail);
    this.bodyPivot.add(this.scarfTailPivot);

    // ── 街头探索小背包（第三人称背面视觉重心）──
    const packGroup = new THREE.Group();
    packGroup.position.set(0, 1.06, -0.18);
    const packGeo = new THREE.BoxGeometry(0.24, 0.28, 0.12);
    const pack = this.makeOutlinedMesh(packGeo, this.matSecondary, 1.05);
    const packStripeGeo = new THREE.BoxGeometry(0.18, 0.035, 0.02);
    const packStripe = new THREE.Mesh(packStripeGeo, this.matHairHighlight);
    packStripe.position.set(0, 0.04, -0.062);
    const packPocketGeo = new THREE.BoxGeometry(0.19, 0.10, 0.03);
    const packPocket = new THREE.Mesh(packPocketGeo, this.matAccent);
    packPocket.position.set(0, -0.06, -0.062);
    packGroup.add(pack, packStripe, packPocket);
    this.bodyPivot.add(packGroup);

    // ── 双臂 (肩部 y = 1.23 m) ──
    this.leftArmPivot = this.createArm(-0.205);
    this.rightArmPivot = this.createArm(0.205);
    this.bodyPivot.add(this.leftArmPivot, this.rightArmPivot);

    // ── 头部 + 动漫五官 + 发型 + 随动高马尾 ──
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 1.32, 0);
    this.bodyPivot.add(this.headPivot);

    // 脖颈
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 10), this.matSkin);
    neck.position.y = 0.02;
    this.headPivot.add(neck);

    // 动漫头型（略微修长柔和）
    const headGeo = new THREE.SphereGeometry(0.155, 18, 16);
    headGeo.scale(1.0, 1.04, 0.96);
    const head = this.makeOutlinedMesh(headGeo, this.matSkin, 1.04);
    head.position.y = 0.18;
    this.headPivot.add(head);

    // 动漫大眼 + 高光 + 腮红（正前方 +Z）
    this.addAnimeFace(this.headPivot);

    // 发型（顶部蓬松层 + 两侧鬓角 + 额前刘海 + 高马尾）
    this.ponytailPivot = this.addAnimeHair(this.headPivot);
  }

  private makeOutlinedMesh(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    outlineScale: number,
  ): THREE.Group {
    const wrapper = new THREE.Group();
    const main = new THREE.Mesh(geo, mat);
    main.castShadow = true;
    main.receiveShadow = true;
    const outline = new THREE.Mesh(geo, this.matInk);
    outline.scale.setScalar(outlineScale);
    wrapper.add(main, outline);
    return wrapper;
  }

  private createLeg(xOffset: number): THREE.Group {
    const pivot = new THREE.Group();
    pivot.position.set(xOffset, 0.78, 0);

    // 大腿（肤色）
    const thigh = this.makeOutlinedMesh(new THREE.CylinderGeometry(0.062, 0.052, 0.34, 10), this.matSkin, 1.06);
    thigh.position.y = -0.17;
    pivot.add(thigh);

    // 过膝袜（深色 + 顶部主题色条纹）
    const sock = this.makeOutlinedMesh(new THREE.CylinderGeometry(0.052, 0.044, 0.34, 10), this.matSecondary, 1.06);
    sock.position.y = -0.49;
    pivot.add(sock);

    const sockStripe = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.053, 0.032, 10), this.matAccent);
    sockStripe.position.y = -0.34;
    pivot.add(sockStripe);

    // 厚底动漫运动鞋
    const shoeGeo = new THREE.BoxGeometry(0.11, 0.10, 0.21);
    const shoe = this.makeOutlinedMesh(shoeGeo, this.matShoe, 1.06);
    shoe.position.set(0, -0.73, 0.035);
    pivot.add(shoe);

    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.03, 0.22), this.matAccent);
    sole.position.set(0, -0.765, 0.035);
    pivot.add(sole);

    return pivot;
  }

  private createArm(xOffset: number): THREE.Group {
    const pivot = new THREE.Group();
    pivot.position.set(xOffset, 1.23, 0);

    // 夹克袖子
    const sleeve = this.makeOutlinedMesh(new THREE.CylinderGeometry(0.056, 0.048, 0.34, 10), this.matAccent, 1.06);
    sleeve.position.y = -0.16;
    pivot.add(sleeve);

    // 袖口点缀
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.051, 0.051, 0.04, 10), this.matScarf);
    cuff.position.y = -0.33;
    pivot.add(cuff);

    // 小臂与手
    const hand = this.makeOutlinedMesh(new THREE.SphereGeometry(0.046, 10, 10), this.matSkin, 1.07);
    hand.position.y = -0.39;
    pivot.add(hand);

    return pivot;
  }

  private addAnimeFace(headPivot: THREE.Group): void {
    const faceZ = 0.146;
    for (const side of [-1, 1]) {
      // 眼白
      const sclera = new THREE.Mesh(new THREE.CircleGeometry(0.032, 14), this.matWhite);
      sclera.position.set(side * 0.056, 0.175, faceZ);
      headPivot.add(sclera);

      // 动漫虹膜
      const iris = new THREE.Mesh(new THREE.CircleGeometry(0.025, 14), this.matEye);
      iris.position.set(side * 0.054, 0.173, faceZ + 0.002);
      headPivot.add(iris);

      // 深色瞳孔
      const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.013, 12), new THREE.MeshBasicMaterial({ color: 0x101822 }));
      pupil.position.set(side * 0.054, 0.171, faceZ + 0.004);
      headPivot.add(pupil);

      // 眼神高光（动漫标志性双高光）
      const spark1 = new THREE.Mesh(new THREE.CircleGeometry(0.007, 10), this.matWhite);
      spark1.position.set(side * 0.054 + 0.008, 0.183, faceZ + 0.006);
      const spark2 = new THREE.Mesh(new THREE.CircleGeometry(0.004, 8), this.matWhite);
      spark2.position.set(side * 0.054 - 0.008, 0.163, faceZ + 0.006);
      headPivot.add(spark1, spark2);

      // 淡淡腮红
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.020, 12), this.matBlush);
      blush.scale.set(1.3, 0.65, 1);
      blush.position.set(side * 0.078, 0.140, faceZ - 0.004);
      headPivot.add(blush);
    }
  }

  private addAnimeHair(headPivot: THREE.Group): THREE.Group {
    // 顶部发冠（略大于头部）
    const crownGeo = new THREE.SphereGeometry(0.168, 16, 14, 0, Math.PI * 2, 0, Math.PI * 0.65);
    const crown = this.makeOutlinedMesh(crownGeo, this.matHair, 1.04);
    crown.position.set(0, 0.195, -0.01);
    headPivot.add(crown);

    // 后脑勺发包
    const backGeo = new THREE.SphereGeometry(0.162, 14, 12);
    const back = this.makeOutlinedMesh(backGeo, this.matHair, 1.04);
    back.position.set(0, 0.175, -0.045);
    headPivot.add(back);

    // 额前分层动漫刘海（3 缕斜角发束）
    for (const [bx, rotZ, w] of [[-0.06, 0.18, 0.055], [0, -0.04, 0.06], [0.06, -0.18, 0.055]] as [number, number, number][]) {
      const bangGeo = new THREE.ConeGeometry(w, 0.13, 5);
      bangGeo.rotateX(Math.PI);
      const bang = this.makeOutlinedMesh(bangGeo, this.matHair, 1.06);
      bang.position.set(bx, 0.255, 0.135);
      bang.rotation.z = rotZ;
      bang.rotation.x = -0.22;
      headPivot.add(bang);
    }

    // 两侧鬓角发束
    for (const side of [-1, 1]) {
      const lockGeo = new THREE.ConeGeometry(0.042, 0.22, 6);
      lockGeo.rotateX(Math.PI);
      const lock = this.makeOutlinedMesh(lockGeo, this.matHair, 1.06);
      lock.position.set(side * 0.142, 0.14, 0.045);
      lock.rotation.z = side * -0.12;
      headPivot.add(lock);
    }

    // 呆毛（动漫灵魂标志）
    const ahogeGeo = new THREE.ConeGeometry(0.018, 0.11, 5);
    const ahoge = new THREE.Mesh(ahogeGeo, this.matHair);
    ahoge.position.set(0.01, 0.39, 0.01);
    ahoge.rotation.z = -0.35;
    headPivot.add(ahoge);

    // 发光发带 + 高马尾随动枢轴
    const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.016, 8, 14), this.matHairHighlight);
    ribbon.position.set(0, 0.25, -0.17);
    ribbon.rotation.x = 0.5;
    headPivot.add(ribbon);

    const ponytailPivot = new THREE.Group();
    ponytailPivot.position.set(0, 0.24, -0.18);
    const tailGeo = new THREE.ConeGeometry(0.072, 0.42, 7);
    tailGeo.rotateX(Math.PI);
    tailGeo.translate(0, -0.19, -0.05);
    const tail = this.makeOutlinedMesh(tailGeo, this.matHair, 1.05);
    tail.rotation.x = 0.35;
    ponytailPivot.add(tail);
    headPivot.add(ponytailPivot);

    return ponytailPivot;
  }

  /** 实时切换配色方案 */
  public setPalette(id: CharacterPaletteId): void {
    const p = CHARACTER_PALETTES[id];
    if (!p) return;
    this.paletteId = id;
    this.matAccent.color.setHex(p.accent);
    this.matSecondary.color.setHex(p.secondary);
    this.matHair.color.setHex(p.hair);
    this.matHairHighlight.color.setHex(p.hairHighlight);
    this.matHairHighlight.emissive.setHex(p.hairHighlight);
    this.matScarf.color.setHex(p.scarf);
    this.matEye.color.setHex(p.eye);
    this.matShoe.color.setHex(p.shoe);
    this.matFootRing.color.setHex(p.accent);
  }

  public getPaletteId(): CharacterPaletteId {
    return this.paletteId;
  }

  /** 每帧驱动角色骨骼程序化动画 */
  public updateAnimation(dt: number, state: CharacterAnimState): void {
    const safeDt = Math.min(dt, 0.05);
    this.idleTime += safeDt;

    // 落地弹性缓冲触发
    if (!this.wasGrounded && state.grounded) {
      this.landSquash = 1.0;
    }
    this.wasGrounded = state.grounded;
    this.landSquash = Math.max(0, this.landSquash - safeDt * 6.5);

    const moveRatio = Math.min(1, state.speed / Math.max(state.maxSpeed, 0.1));

    if (state.grounded) {
      if (state.speed > 0.15) {
        const freq = state.sprinting ? 12.5 : 8.5;
        this.walkPhase += safeDt * freq * (0.45 + 0.55 * moveRatio);
        const swing = Math.sin(this.walkPhase) * (state.sprinting ? 0.82 : 0.55) * moveRatio;
        const bounce = Math.abs(Math.cos(this.walkPhase)) * (state.sprinting ? 0.065 : 0.035) * moveRatio;

        this.leftLegPivot.rotation.x = swing;
        this.rightLegPivot.rotation.x = -swing;
        this.leftArmPivot.rotation.x = -swing * 0.85;
        this.rightArmPivot.rotation.x = swing * 0.85;
        this.leftArmPivot.rotation.z = 0.08;
        this.rightArmPivot.rotation.z = -0.08;

        this.bodyPivot.position.y = bounce;
        this.bodyPivot.rotation.x = state.sprinting ? 0.14 : 0.06;
        this.headPivot.rotation.x = -(state.sprinting ? 0.10 : 0.04);

        // 马尾和围巾随奔跑飘动
        this.ponytailPivot.rotation.x = 0.25 + moveRatio * 0.55 + Math.sin(this.walkPhase * 2) * 0.12;
        this.scarfTailPivot.rotation.x = 0.30 + moveRatio * 0.65 + Math.cos(this.walkPhase * 2) * 0.15;
      } else {
        // 待机呼吸
        const breath = Math.sin(this.idleTime * 2.4);
        this.leftLegPivot.rotation.x *= 0.82;
        this.rightLegPivot.rotation.x *= 0.82;
        this.leftArmPivot.rotation.x *= 0.82;
        this.rightArmPivot.rotation.x *= 0.82;
        this.leftArmPivot.rotation.z = 0.09 + breath * 0.025;
        this.rightArmPivot.rotation.z = -0.09 - breath * 0.025;
        this.bodyPivot.position.y = breath * 0.014;
        this.bodyPivot.rotation.x *= 0.85;
        this.headPivot.rotation.x = breath * 0.03;
        this.ponytailPivot.rotation.x = 0.08 + Math.sin(this.idleTime * 1.9) * 0.06;
        this.scarfTailPivot.rotation.x = 0.08 + Math.sin(this.idleTime * 2.1 + 0.7) * 0.06;
      }
    } else {
      // 跳跃 / 空中滞空姿态
      const rising = state.verticalVel > 0;
      this.leftLegPivot.rotation.x = rising ? -0.45 : 0.22;
      this.rightLegPivot.rotation.x = rising ? 0.32 : -0.18;
      this.leftArmPivot.rotation.x = rising ? -0.55 : -0.30;
      this.rightArmPivot.rotation.x = rising ? -0.55 : -0.30;
      this.leftArmPivot.rotation.z = 0.35;
      this.rightArmPivot.rotation.z = -0.35;
      this.bodyPivot.position.y = 0;
      this.bodyPivot.rotation.x = rising ? -0.06 : 0.08;
      this.ponytailPivot.rotation.x = rising ? -0.15 : 0.85;
      this.scarfTailPivot.rotation.x = rising ? -0.10 : 0.95;
    }

    // 应用落地轻微弹性挤压
    const sx = 1 + this.landSquash * 0.08;
    const sy = 1 - this.landSquash * 0.11;
    this.bodyPivot.scale.set(sx, sy, sx);
  }

  public dispose(): void {
    const geos = new Set<THREE.BufferGeometry>();
    const mats = new Set<THREE.Material>();
    this.root.traverse(o => {
      if (o instanceof THREE.Mesh) {
        geos.add(o.geometry);
        const list = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of list) mats.add(m);
      }
    });
    for (const g of geos) g.dispose();
    for (const m of mats) m.dispose();
    this.gradientMap.dispose();
  }
}
