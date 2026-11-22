import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera } from 'three';
import { resizeViewport } from '../src/viewport.js';

test('first frame and subsequent resizes use the viewport aspect and capped pixel ratio', () => {
  const camera = new PerspectiveCamera(55, 1, 0.1, 250);
  const bufferSizes = [];
  const renderer = { setDrawingBufferSize: (...args) => bufferSizes.push(args) };

  for (const [width, height, ratio] of [[960, 540, 3], [360, 640, 1.5]]) {
    assert.equal(resizeViewport(renderer, camera, width, height, ratio), true);
    const expected = new PerspectiveCamera(55, width / height, 0.1, 250);
    assert.equal(camera.aspect, expected.aspect);
    assert.deepEqual(camera.projectionMatrix.elements, expected.projectionMatrix.elements);
  }
  assert.deepEqual(bufferSizes, [[960, 540, 2], [360, 640, 1.5]]);
});

test('a collapsed viewport preserves its last valid projection until it can render again', () => {
  const camera = new PerspectiveCamera();
  const bufferSizes = [];
  const renderer = { setDrawingBufferSize: (...args) => bufferSizes.push(args) };
  resizeViewport(renderer, camera, 800, 600, 1);
  const projection = camera.projectionMatrix.clone();

  for (const [width, height] of [[0, 600], [800, 0], [0, 0]]) {
    assert.equal(resizeViewport(renderer, camera, width, height, 1), false);
    assert.equal(camera.aspect, 800 / 600);
    assert.ok(camera.projectionMatrix.equals(projection));
  }
  assert.equal(resizeViewport(renderer, camera, 400, 600, 1), true);
  assert.equal(camera.aspect, 400 / 600);
  assert.deepEqual(bufferSizes, [[800, 600, 1], [400, 600, 1]]);
});
