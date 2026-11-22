export function resizeViewport(renderer, camera, width, height, devicePixelRatio) {
  if (width <= 0 || height <= 0) return false;

  renderer.setDrawingBufferSize(width, height, Math.min(devicePixelRatio, 2));
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  return true;
}
