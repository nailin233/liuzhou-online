/**
 * MapHUD — HUD、指北针、图例、常驻署名与加载失败提示
 * art-direction.md §4–§5 界面与防重叠布局规范
 */
import * as THREE from 'three';

export interface HUDState {
  fps: number;
  drawCalls: number;
  triangles: number;
  buildingsTotal: number;
  buildingsMissing: number;
  roadsTotal: number;
  dataSource?: string;  // 数据来源标签（如 'Overture 2891'）
  mode?: 'walk' | 'overview';
  colliders?: number;
}

export interface MapHUDOptions {
  onCompassClick?: () => void;
}

export class MapHUD {
  private statusEl:   HTMLElement;
  private compassEl:  HTMLButtonElement;
  private legendEl:   HTMLElement;
  private attrEl:     HTMLAnchorElement;
  private errorEl:    HTMLElement | null = null;
  private onKeyDown:  (e: KeyboardEvent) => void;
  private onCompass?: () => void;

  constructor(container: HTMLElement, options: MapHUDOptions = {}) {
    this.onCompass = options.onCompassClick;

    // ── 状态栏 (右下；移动端位于署名上方) ──
    this.statusEl = document.createElement('div');
    this.statusEl.id = 'map-hud';
    this.statusEl.className = 'map-hud';
    container.appendChild(this.statusEl);

    // ── 指北针 (右上，位于 header 下方，可点击重置朝北) ──
    this.compassEl = document.createElement('button');
    this.compassEl.id = 'map-compass';
    this.compassEl.className = 'map-compass';
    this.compassEl.type = 'button';
    this.compassEl.title = '点击或按 N 重置朝北';
    this.compassEl.setAttribute('aria-label', '重置朝北');
    this.compassEl.innerHTML = `
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r="22" fill="#101820" stroke="#3E8F91" stroke-width="1.5" opacity="0.88"/>
        <polygon id="compass-n" points="24,6 20,24 24,28 28,24" fill="#D9549B"/>
        <polygon id="compass-s" points="24,42 20,24 24,20 28,24" fill="#86b9b8" opacity="0.6"/>
        <text x="24" y="13" text-anchor="middle" fill="#EDF4F5" font-size="8"
              font-family="'Segoe UI',sans-serif">N</text>
      </svg>`;
    this.compassEl.addEventListener('click', () => {
      this.onCompass?.();
    });
    container.appendChild(this.compassEl);

    // ── 图例 (左下，按 L 切换) ──
    this.legendEl = document.createElement('div');
    this.legendEl.id = 'map-legend';
    this.legendEl.className = 'map-legend';
    this.legendEl.style.display = 'none'; // 默认隐藏，按 L 切换
    this.legendEl.innerHTML = `
      <div class="map-legend-title">图例</div>
      ${this.legendRow('#C9D2D6', '建筑（实测高度）')}
      ${this.legendRow('#9FB0B8', '建筑（按层数估算）')}
      ${this.legendRow('#5C4A57', '建筑（高度缺失 · 3 m 占位）', '#D9549B')}
      ${this.legendRow('#3A4954', '主干道 / 次干道')}
      ${this.legendRow('#5A6B62', '步行街')}
      ${this.legendRow('#1F4A5C', '水系（中心线示意）')}
    `;
    container.appendChild(this.legendEl);

    // ── ODbL / Overture 常驻署名 (左下最底) ──
    const attrA = document.createElement('a');
    attrA.id     = 'map-attribution';
    attrA.className = 'map-attribution';
    attrA.href   = 'https://www.openstreetmap.org/copyright';
    attrA.target = '_blank';
    attrA.rel    = 'noopener noreferrer';
    attrA.textContent = '© OpenStreetMap contributors · ODbL 1.0';
    this.attrEl = attrA;
    container.appendChild(this.attrEl);

    // 键盘快捷键 (L 切换图例)
    this.onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'l' || e.key === 'L') this.toggleLegend();
    };
    document.addEventListener('keydown', this.onKeyDown);
  }

  private legendRow(fillHex: string, label: string, stripeHex?: string): string {
    const border = stripeHex ? `border:1px solid ${stripeHex};` : '';
    const bg = stripeHex
      ? `background:repeating-linear-gradient(45deg,${fillHex},${fillHex} 3px,${stripeHex} 3px,${stripeHex} 5px);`
      : `background:${fillHex};`;
    return `<div class="map-legend-row">
      <div class="map-legend-swatch" style="${bg}${border}"></div>
      <span>${label}</span>
    </div>`;
  }

  public toggleLegend(): void {
    this.legendEl.style.display = this.legendEl.style.display === 'none' ? 'block' : 'none';
  }

  public setAttributionForSource(dataSource?: string): void {
    if (dataSource && /overture/i.test(dataSource)) {
      this.attrEl.textContent = '© OpenStreetMap contributors · Overture Maps Foundation · ODbL 1.0';
    } else {
      this.attrEl.textContent = '© OpenStreetMap contributors · ODbL 1.0';
    }
  }

  public showError(reason: string): void {
    if (!this.errorEl) {
      this.errorEl = document.createElement('div');
      this.errorEl.id = 'map-load-error';
      this.errorEl.className = 'map-load-error';
      document.body.appendChild(this.errorEl);
    }
    this.errorEl.textContent = `数据加载失败：${reason}`;
  }

  /** 更新指北针旋转：指针始终指向世界 -Z（正北）在屏幕上的方向 */
  public updateCompass(camera: THREE.Camera, controls: { target: THREE.Vector3 }): void {
    const dir = new THREE.Vector3()
      .subVectors(camera.position, controls.target)
      .setY(0);
    if (dir.lengthSq() < 1e-6) return;
    dir.normalize();
    const angle = Math.atan2(dir.x, dir.z) * (180 / Math.PI);
    const svg = this.compassEl.querySelector('svg');
    if (svg) {
      const north = svg.querySelector('#compass-n') as SVGElement | null;
      const south = svg.querySelector('#compass-s') as SVGElement | null;
      if (north) {
        north.style.transformOrigin = '24px 24px';
        north.style.transform = `rotate(${angle.toFixed(1)}deg)`;
      }
      if (south) {
        south.style.transformOrigin = '24px 24px';
        south.style.transform = `rotate(${angle.toFixed(1)}deg)`;
      }
    }
  }

  public update(state: HUDState): void {
    this.setAttributionForSource(state.dataSource);
    const missing = state.buildingsMissing > 0
      ? `<span style="color:#D9549B">缺失高度 ${state.buildingsMissing}/${state.buildingsTotal}</span>`
      : `建筑 ${state.buildingsTotal}`;
    const modeTag = state.mode
      ? `<span style="color:#8AD2C8">${state.mode === 'walk' ? '步行' : '鸟瞰'}</span> · `
      : '';
    const colTag = state.colliders && state.colliders > 0
      ? ` · 碰撞 ${state.colliders}`
      : '';
    const src = state.dataSource
      ? `<span class="map-hud-src"> ${state.dataSource}</span>`
      : '';
    this.statusEl.innerHTML =
      `${modeTag}WebGL · ${state.fps} FPS · 调用 ${state.drawCalls} · ` +
      `三角形 ${(state.triangles / 1000).toFixed(0)}k · ` +
      `${missing} · 道路 ${state.roadsTotal}${colTag}${src} · <kbd>L</kbd>图例`;
  }

  public dispose(): void {
    document.removeEventListener('keydown', this.onKeyDown);
    this.statusEl.remove();
    this.compassEl.remove();
    this.legendEl.remove();
    this.attrEl.remove();
    this.errorEl?.remove();
    this.errorEl = null;
  }
}
