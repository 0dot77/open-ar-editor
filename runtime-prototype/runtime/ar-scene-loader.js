import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { MindARImageRuntime } from './mindar-image-runtime.js';
import { createObject } from './scene-objects.js';
import { bus } from './event-bus.js';

export class ARSceneLoader {
  constructor({ container, configPath = 'config.json' }) {
    this._container  = container;
    this._configPath = configPath;
    this._config     = null;
    this._runtime    = null;
    this._objects    = {};   // id → Three.js object
    this._mixers     = [];
    this._clock      = new THREE.Clock();
    this._audioCtx   = null;
    this._audioBuffers = {};
  }

  async load() {
    // Fetch and validate config.json
    const res = await fetch(this._configPath);
    if (!res.ok) throw new Error(`config.json 로드 실패 (${res.status})`);
    this._config = await res.json();
    console.log('config loaded', this._config);

    const { tracking, scene } = this._config;

    if (tracking.type !== 'image') {
      throw new Error(`지원하지 않는 트래킹 타입: ${tracking.type}`);
    }

    this._runtime = new MindARImageRuntime({
      container:  this._container,
      targetSrc:  tracking.target,
    });

    const { scene: threeScene, anchor } = await this._runtime.init().catch(err => {
      this._showMissingAssetHint('타깃 파일(.mind)이 없거나 로드에 실패했습니다.', err);
      throw err;
    });

    // Build scene objects from config
    const anchorGroup = this._runtime.getAnchorGroup(0);
    for (const objDef of (scene.objects || [])) {
      const obj = await createObject(objDef).catch(err => {
        console.warn(`[ar-scene-loader] 오브젝트 생성 실패 (${objDef.id}):`, err);
        return null;
      });
      if (!obj) continue;

      obj.name = objDef.id;
      this._objects[objDef.id] = obj;
      anchorGroup.add(obj);

      if (obj.userData.mixer) this._mixers.push(obj.userData.mixer);

      // Register per-object event handlers from config
      this._registerObjectEvents(objDef);
    }

    // Default behaviour: hide all objects on targetLost, restore on targetFound
    bus.on('targetFound', () => {
      Object.values(this._objects).forEach(o => { o.visible = true; });
    });
    bus.on('targetLost', () => {
      Object.values(this._objects).forEach(o => { o.visible = false; });
    });

    this._setupRaycaster();

    this._runtime.startRenderLoop(() => {
      const delta = this._clock.getDelta();
      this._mixers.forEach(m => m.update(delta));
    });

    await this._runtime.start().catch(err => {
      this._handleCameraError(err);
      throw err;
    });
  }

  // Wire up event/action pairs declared in each object's "events" array in config.json
  _registerObjectEvents(objDef) {
    for (const ev of (objDef.events || [])) {
      const { trigger, action, target: targetId, animation, src } = ev;
      const resolvedTarget = () => this._objects[targetId || objDef.id];

      if (trigger === 'targetFound' || trigger === 'targetLost') {
        bus.on(trigger, () => this._runAction(action, resolvedTarget(), { animation, src }));
      }
      // tap is handled by raycaster; store on userData for lookup
      if (trigger === 'tap') {
        const obj = this._objects[objDef.id];
        if (obj) {
          if (!obj.userData.tapEvents) obj.userData.tapEvents = [];
          obj.userData.tapEvents.push({ action, targetId, animation, src });
        }
      }
    }
  }

  _setupRaycaster() {
    const raycaster = new THREE.Raycaster();
    const pointer   = new THREE.Vector2();
    const camera    = this._runtime.camera;

    const onTap = (clientX, clientY) => {
      const rect = this._container.getBoundingClientRect();
      pointer.x =  ((clientX - rect.left)  / rect.width)  * 2 - 1;
      pointer.y = -((clientY - rect.top)   / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(Object.values(this._objects), true);
      if (!hits.length) return;

      // Walk up to find the root object that has tapEvents
      let root = hits[0].object;
      while (root.parent && !root.userData.tapEvents) root = root.parent;

      bus.emit('tap', { object: root });

      for (const ev of (root.userData.tapEvents || [])) {
        const tgt = this._objects[ev.targetId] || root;
        this._runAction(ev.action, tgt, ev);
      }
    };

    this._container.addEventListener('click',      e => onTap(e.clientX, e.clientY));
    this._container.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0];
      onTap(t.clientX, t.clientY);
    }, { passive: false });
  }

  // Execute a single action from config.json
  _runAction(action, obj, params = {}) {
    if (!obj) return;
    switch (action) {
      case 'show':   obj.visible = true;  break;
      case 'hide':   obj.visible = false; break;
      case 'toggle': obj.visible = !obj.visible; break;

      case 'playAnimation': {
        const mixer = obj.userData.mixer;
        const clips = obj.userData.animations || [];
        const clip  = params.animation
          ? THREE.AnimationClip.findByName(clips, params.animation) || clips[0]
          : clips[0];
        if (mixer && clip) mixer.clipAction(clip).play();
        break;
      }

      case 'playVideo': {
        const vid = obj.userData.videoElement;
        if (vid) vid.play().catch(() => {});
        break;
      }
      case 'pauseVideo': {
        const vid = obj.userData.videoElement;
        if (vid) vid.pause();
        break;
      }

      case 'playSound':  this._playSound(params.src);  break;
      case 'pauseSound': /* future */ break;

      default:
        console.warn(`[ar-scene-loader] 알 수 없는 액션: ${action}`);
    }
  }

  async _playSound(src) {
    if (!src) return;
    try {
      if (!this._audioCtx) this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (this._audioCtx.state === 'suspended') await this._audioCtx.resume();

      if (!this._audioBuffers[src]) {
        const res  = await fetch(src);
        const buf  = await res.arrayBuffer();
        this._audioBuffers[src] = await this._audioCtx.decodeAudioData(buf);
      }
      const source = this._audioCtx.createBufferSource();
      source.buffer = this._audioBuffers[src];
      source.connect(this._audioCtx.destination);
      source.start();
    } catch (e) {
      console.warn('[ar-scene-loader] 사운드 재생 실패:', e);
    }
  }

  resumeAudio() {
    if (this._audioCtx?.state === 'suspended') this._audioCtx.resume();
  }

  _showMissingAssetHint(msg, err) {
    const el = document.getElementById('ar-error');
    if (el) {
      el.textContent = `⚠️ ${msg}`;
      el.style.display = 'block';
    }
    console.warn('[ar-scene-loader]', msg, err);
  }

  _handleCameraError(err) {
    const msg = err?.name === 'NotAllowedError'
      ? '카메라 권한이 거부되었습니다.\n설정 > 사이트 설정 > 카메라에서 이 사이트를 허용해 주세요.'
      : err?.name === 'NotFoundError'
      ? '카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인하세요.'
      : `카메라를 열 수 없습니다: ${err?.message || err}`;

    const el = document.getElementById('ar-error');
    if (el) {
      el.innerHTML = msg.replace(/\n/g, '<br>');
      el.style.display = 'block';
    }
  }

  stop() {
    this._runtime?.stopRenderLoop();
    this._runtime?.stop();
  }
}
