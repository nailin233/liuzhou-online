import type { PerspectiveCamera, WebGLRenderer } from 'three';

export function resizeViewport(
  renderer: WebGLRenderer,
  camera: PerspectiveCamera,
  width: number,
  height: number,
  devicePixelRatio: number,
): boolean;
