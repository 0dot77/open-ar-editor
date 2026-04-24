import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { bus } from './event-bus.js';

const MINDAR_CDN = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js';

let _MindARThree = null;

async function _loadMindAR() {
  if (_MindARThree) return _MindARThree;
  await import(MINDAR_CDN);
  // mind-ar attaches itself to window.MINDAR
  _MindARThree = window.MINDAR?.IMAGE?.MindARThree;
  if (!_MindARThree) throw new Error('MindAR 로드 실패: window.MINDAR.IMAGE.MindARThree 없음');
  return _MindARThree;
}

export class MindARImageRuntime {
  constructor({ container, targetSrc }) {
    this._container = container;
    this._targetSrc  = targetSrc;
    this._mindar     = null;
    this._anchors    = [];
    this._started    = false;
  }

  get renderer()  { return this._mindar?.renderer  || null; }
  get scene()     { return this._mindar?.scene      || null; }
  get camera()    { return this._mindar?.camera     || null; }

  async init() {
    const MindARThree = await _loadMindAR();

    this._mindar = new MindARThree({
      container:  this._container,
      imageTargetSrc: this._targetSrc,
      uiLoading:  'no',
      uiScanning: 'no',
      uiError:    'no',
    });

    const { renderer, scene, camera } = this._mindar;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Anchor index 0 = first (and only) target in this Phase 1 runtime
    const anchor = this._mindar.addAnchor(0);
    this._anchors.push(anchor);

    anchor.onTargetFound = () => bus.emit('targetFound',  { anchorIndex: 0 });
    anchor.onTargetLost  = () => bus.emit('targetLost',   { anchorIndex: 0 });

    return { renderer, scene, camera, anchor };
  }

  getAnchorGroup(index = 0) {
    return this._anchors[index]?.group || null;
  }

  async start() {
    if (this._started) return;
    await this._mindar.start();
    this._started = true;
  }

  stop() {
    if (!this._started) return;
    this._mindar.stop();
    this._started = false;
  }

  startRenderLoop(onFrame) {
    const { renderer, scene, camera } = this._mindar;
    renderer.setAnimationLoop(delta => {
      onFrame(delta);
      renderer.render(scene, camera);
    });
  }

  stopRenderLoop() {
    this._mindar?.renderer?.setAnimationLoop(null);
  }
}
