import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

const _gltfLoader = new GLTFLoader();

// Build a Three.js object from a scene object descriptor parsed from config.json
export function createObject(descriptor) {
  const { type } = descriptor;
  if (type === 'model') return _createModel(descriptor);
  if (type === 'image') return _createImage(descriptor);
  if (type === 'video') return _createVideo(descriptor);
  if (type === 'text') return _createText(descriptor);
  console.warn(`[scene-objects] 알 수 없는 오브젝트 타입: ${type}`);
  return Promise.resolve(null);
}

function _applyTransform(obj, descriptor) {
  const [px, py, pz] = descriptor.position || [0, 0, 0];
  const [rx, ry, rz] = descriptor.rotation || [0, 0, 0];
  const [sx, sy, sz] = descriptor.scale    || [1, 1, 1];
  obj.position.set(px, py, pz);
  obj.rotation.set(
    THREE.MathUtils.degToRad(rx),
    THREE.MathUtils.degToRad(ry),
    THREE.MathUtils.degToRad(rz)
  );
  obj.scale.set(sx, sy, sz);
  obj.visible = descriptor.visible !== false;
}

function _createModel(descriptor) {
  return new Promise(resolve => {
    _gltfLoader.load(
      descriptor.src,
      gltf => {
        const root = gltf.scene;
        root.userData.gltf = gltf;
        root.userData.mixer = new THREE.AnimationMixer(root);
        root.userData.animations = gltf.animations || [];
        _applyTransform(root, descriptor);
        resolve(root);
      },
      undefined,
      err => {
        console.warn(`[scene-objects] GLB 로드 실패 (${descriptor.src}): ${err.message}`);
        // Return a placeholder cube so missing assets don't crash the scene
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.1, 0.1),
          new THREE.MeshBasicMaterial({ color: 0xff4444, wireframe: true })
        );
        mesh.userData.loadError = true;
        _applyTransform(mesh, descriptor);
        resolve(mesh);
      }
    );
  });
}

function _createImage(descriptor) {
  return new Promise(resolve => {
    const loader = new THREE.TextureLoader();
    loader.load(
      descriptor.src,
      texture => {
        const aspect = texture.image.width / texture.image.height;
        const width = descriptor.width || 1;
        const height = width / aspect;
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(width, height),
          new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })
        );
        _applyTransform(mesh, descriptor);
        resolve(mesh);
      },
      undefined,
      err => {
        console.warn(`[scene-objects] 이미지 로드 실패 (${descriptor.src}): ${err.message}`);
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({ color: 0xffaa00, wireframe: true })
        );
        mesh.userData.loadError = true;
        _applyTransform(mesh, descriptor);
        resolve(mesh);
      }
    );
  });
}

function _createVideo(descriptor) {
  const video = document.createElement('video');
  video.src = descriptor.src;
  video.crossOrigin = 'anonymous';
  video.loop = descriptor.loop !== false;
  video.muted = true;           // must start muted for iOS autoplay
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');

  const texture = new THREE.VideoTexture(video);
  texture.minFilter = THREE.LinearFilter;

  const width = descriptor.width || 1;
  const height = descriptor.height || (width * 9 / 16);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
  );

  mesh.userData.videoElement = video;
  mesh.userData.isMuted = true;
  _applyTransform(mesh, descriptor);

  video.load();
  return Promise.resolve(mesh);
}

function _createText(descriptor) {
  // Deferred — uses a canvas-painted sprite for zero-dependency text
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(descriptor.text || '', canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 0.25),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })
  );
  _applyTransform(mesh, descriptor);
  return Promise.resolve(mesh);
}
