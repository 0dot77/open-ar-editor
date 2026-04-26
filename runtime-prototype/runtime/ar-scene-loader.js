import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { MindARImageRuntime } from './mindar-image-runtime.js';
import { createObject } from './scene-objects.js';
import { bus } from './event-bus.js';
import { attachGraphRuntime } from './graph-runtime.js';

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

    // custom.js 훅 시스템 — register(api) 로 사용자가 등록
    this._customActions          = new Map();   // type → handler(node, ctx)
    this._customFrameHooks       = [];          // (delta, ctx) => void
    this._customTargetFoundHooks = [];          // (ctx) => void
    this._customTargetLostHooks  = [];          // (ctx) => void
    this._beforeStartHooks       = [];          // (ctx) => void | Promise<void>
    this._customCtx              = null;        // load() 안에서 빌드
    this._customOverrideLogged   = new Set();   // 빌트인 type 오버라이드 1회 로그용
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

    // custom.js 훅에서 쓸 ctx — scene/camera/anchor 가 준비된 직후 빌드
    this._customCtx = {
      getObject: (id) => this._objects[id] || null,
      playSound: (src) => this._playSound(src),
      scene:    threeScene,
      camera:   this._runtime.camera,
      anchor:   anchor,
    };

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
      this._customTargetFoundHooks.forEach(fn => {
        try { fn(this._customCtx); }
        catch (e) { console.warn('[custom.js] onTargetFound handler threw:', e); }
      });
    });
    bus.on('targetLost', () => {
      Object.values(this._objects).forEach(o => { o.visible = false; });
      this._customTargetLostHooks.forEach(fn => {
        try { fn(this._customCtx); }
        catch (e) { console.warn('[custom.js] onTargetLost handler threw:', e); }
      });
    });

    // Event Graph 부착 — graph.webar.json 이 있으면 fetch & attach
    await this._attachGraph();

    // custom.js 훅 로드 — 그래프 dispatcher 가 붙은 후, raycaster 전에.
    // 이유: api.onAction 이 그래프 dispatch 보다 먼저 평가되도록 등록 순서 확보.
    await this._loadCustomScript();

    this._setupRaycaster();

    this._runtime.startRenderLoop(() => {
      const delta = this._clock.getDelta();
      this._mixers.forEach(m => m.update(delta));
      this._customFrameHooks.forEach(fn => {
        try { fn(delta, this._customCtx); }
        catch (e) { console.warn('[custom.js] onFrame handler threw:', e); }
      });
    });

    // beforeStart 훅 — mindar.start() 직전에 1회 실행. async 허용.
    if (this._beforeStartHooks.length > 0) {
      await Promise.all(this._beforeStartHooks.map(async fn => {
        try { await fn(this._customCtx); }
        catch (e) { console.warn('[custom.js] beforeStart handler threw:', e); }
      }));
    }

    await this._runtime.start().catch(err => {
      this._handleCameraError(err);
      throw err;
    });
  }

  // custom.js 가 있으면 로드해서 register(api) 를 호출.
  // 파일이 없거나 import 가 실패해도 런타임 자체는 계속 동작해야 한다.
  async _loadCustomScript() {
    let mod;
    try {
      // ar-scene-loader.js 는 runtime/ 안, custom.js 는 프로젝트 루트(index.html 옆)
      mod = await import('../custom.js');
    } catch (e) {
      console.warn('[custom.js] 로드 실패 또는 파일 없음 — 스킵:', e?.message || e);
      return;
    }

    if (!mod || typeof mod.register !== 'function') {
      console.warn('[custom.js] register 함수를 export 하지 않음 — 스킵');
      return;
    }

    const api = {
      onAction: (type, handler) => {
        if (typeof handler !== 'function') return;
        this._customActions.set(type, handler);
      },
      onTargetFound: (handler) => {
        if (typeof handler === 'function') this._customTargetFoundHooks.push(handler);
      },
      onTargetLost: (handler) => {
        if (typeof handler === 'function') this._customTargetLostHooks.push(handler);
      },
      onFrame: (handler) => {
        if (typeof handler === 'function') this._customFrameHooks.push(handler);
      },
      beforeStart: (handler) => {
        if (typeof handler === 'function') this._beforeStartHooks.push(handler);
      },
    };

    try {
      mod.register(api);
      console.log('[custom.js] register(api) 호출 완료');
    } catch (e) {
      console.warn('[custom.js] register() threw:', e);
    }
  }

  // graph.webar.json 을 fetch 해서 graph-runtime 에 연결
  async _attachGraph() {
    try {
      const res = await fetch('graph.webar.json');
      if (!res.ok) {
        console.log('[ar-scene-loader] graph.webar.json 없음 — Event Graph 비활성');
        return;
      }
      const graph = await res.json();
      attachGraphRuntime({
        graph,
        bus,
        runAction: (node) => this._runGraphAction(node),
      });
    } catch (e) {
      console.warn('[ar-scene-loader] graph.webar.json 로드 실패:', e);
    }
  }

  // 그래프 노드 단위 액션 실행 (action.* 노드)
  _runGraphAction(node) {
    // custom.js 의 onAction 등록이 있으면 우선 호출. 빌트인 type 도 오버라이드 가능.
    if (this._customActions.has(node.type)) {
      const isBuiltin = [
        'action.show', 'action.hide', 'action.toggle',
        'action.playSound', 'action.playVideo', 'action.pauseVideo',
        'action.playAnimation', 'action.openURL', 'action.sceneChange',
      ].includes(node.type);
      if (isBuiltin && !this._customOverrideLogged.has(node.type)) {
        console.log(`[custom.js] 빌트인 액션 오버라이드: ${node.type}`);
        this._customOverrideLogged.add(node.type);
      }
      try {
        this._customActions.get(node.type)(node, this._customCtx);
      } catch (e) {
        console.warn(`[custom.js] onAction(${node.type}) handler threw:`, e);
      }
      return;
    }

    const obj = node.objectId ? this._objects[node.objectId] : null;

    switch (node.type) {
      case 'action.show':   if (obj) obj.visible = true;  break;
      case 'action.hide':   if (obj) obj.visible = false; break;
      case 'action.toggle': if (obj) obj.visible = !obj.visible; break;

      case 'action.playSound': {
        console.log('[ar-scene-loader] action.playSound 호출', { src: node.src, objectId: node.objectId });
        // src form (asset 경로 직접) 우선 처리. objectId form 은 audio scene object 도입 시.
        if (node.src) this._playSound(node.src);
        else console.log('[ar-scene-loader] action.playSound: src 없음 (objectId form 미지원)');
        break;
      }

      case 'action.playVideo': {
        const v = obj?.userData?.videoElement;
        if (v) v.play().catch(() => {});
        break;
      }
      case 'action.pauseVideo': {
        const v = obj?.userData?.videoElement;
        if (v) v.pause();
        break;
      }

      case 'action.playAnimation': {
        const mixer = obj?.userData?.mixer;
        const clips = obj?.userData?.animations || [];
        if (mixer && clips.length > 0) {
          const clip = node.animationName
            ? THREE.AnimationClip.findByName(clips, node.animationName) || clips[0]
            : clips[0];
          mixer.clipAction(clip).play();
        }
        break;
      }

      case 'action.openURL': {
        if (node.url) window.open(node.url, node.newTab ? '_blank' : '_self');
        break;
      }

      case 'action.sceneChange':
        // MVP 3 비활성 — 다중 장면 도입 시 구현
        break;

      default:
        console.warn(`[ar-scene-loader] 알 수 없는 그래프 액션: ${node.type}`);
    }
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
      if (!this._audioCtx) {
        // 이론적으로 resumeAudio() 가 미리 만들었어야 하지만 안전망.
        // 사용자 제스처 밖이면 iOS 에서 suspended 가 풀리지 않을 수 있다.
        this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        console.warn('[ar-scene-loader] AudioContext 가 _playSound 시점에 생성됨 — iOS 에서 안 들릴 수 있음');
      }
      if (this._audioCtx.state === 'suspended') await this._audioCtx.resume();

      if (!this._audioBuffers[src]) {
        console.log('[ar-scene-loader] 사운드 fetch:', src);
        const res = await fetch(src);
        if (!res.ok) throw new Error(`fetch ${src}: ${res.status}`);
        const buf = await res.arrayBuffer();
        this._audioBuffers[src] = await this._audioCtx.decodeAudioData(buf);
      }
      const source = this._audioCtx.createBufferSource();
      source.buffer = this._audioBuffers[src];
      source.connect(this._audioCtx.destination);
      source.start();
      console.log('[ar-scene-loader] 사운드 재생 시작:', src);
    } catch (e) {
      console.warn('[ar-scene-loader] 사운드 재생 실패:', e);
    }
  }

  /**
   * 사용자 제스처 (시작하기 버튼 탭) 안에서 호출해야 한다.
   * iOS / WKWebView 는 사용자 제스처 컨텍스트 밖에서 AudioContext 를 생성/재개하면
   * suspended 상태로 멈춰 있고 sound 가 안 난다.
   */
  resumeAudio() {
    try {
      if (!this._audioCtx) {
        this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        console.log('[ar-scene-loader] AudioContext 생성됨 (사용자 제스처)');
      }
      if (this._audioCtx.state === 'suspended') {
        this._audioCtx.resume().catch((e) => console.warn('[ar-scene-loader] AudioContext resume 실패:', e));
      }
    } catch (e) {
      console.warn('[ar-scene-loader] AudioContext 초기화 실패:', e);
    }
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
