/**
 * 이 파일은 docs/schemas/types.ts 의 동기화 사본.
 * 변경 시 양쪽 맞추기.
 *
 * open-ar-editor 공유 타입 정의 — 에디터 프론트엔드 전역 사용.
 * 모든 타입은 docs/schemas/*.schema.json 과 1:1 대응한다.
 */

// ============================================================
// 공통 원시 타입
// ============================================================

/** semver 형식 버전 문자열 (예: "0.1.0") */
export type SemVer = string;

/** [x, y, z] 3차원 벡터 */
export type Vector3 = [number, number, number];

/** 균등 스케일(단일 숫자) 또는 [x, y, z] */
export type Vector3OrScalar = number | Vector3;

/** hex 색상 문자열 (예: "#ff0000") */
export type HexColor = string;

// ============================================================
// 1. Project — 편집용 원본 프로젝트 파일 (project.webar.json)
// ============================================================

/** 편집용 AR 프로젝트 원본 파일. 장면, 에셋, export 이력을 담는다. */
export interface Project {
  schemaVersion: SemVer;
  metadata: ProjectMetadata;
  tracking: TrackingConfig;
  scene: Scene;
  assets: Asset[];
  exports?: ExportRecord[];
}

export interface ProjectMetadata {
  title: string;
  artist: string;
  description?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  keywords?: string[];
}

// --- Tracking ---

/** AR 트래킹 방식 (discriminated union, type 기준) */
export type TrackingConfig =
  | TrackingImage
  | TrackingFace
  | TrackingMarker
  | TrackingGPS;

export interface TrackingImage {
  type: "image";
  /** MindAR .mind 파일 경로 (에셋 ID 또는 상대 경로) */
  target: string;
  preview?: string;
}

export interface TrackingFace {
  type: "face";
  maxFaces?: number;
}

export interface TrackingMarker {
  type: "marker";
  markerSrc: string;
}

export interface TrackingGPS {
  type: "gps";
  latitude?: number;
  longitude?: number;
  radius?: number;
}

// --- Scene ---

/** AR 장면 구성 */
export interface Scene {
  background: "camera" | "transparent" | "color";
  backgroundColor?: HexColor;
  units: "meters" | "centimeters";
  objects: SceneObject[];
}

/** 오브젝트 타입 식별자 */
export type SceneObjectType = "model" | "image" | "video" | "audio" | "text" | "button";

/** 오브젝트가 붙는 기준점 */
export type AnchorType = "target" | "forehead" | "leftEye" | "rightEye" | "mouth" | "world";

/** 재질 속성 */
export interface MaterialProps {
  opacity?: number;
  color?: HexColor;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
}

/** 장면 오브젝트 */
export interface SceneObject {
  /** kebab-case 고유 ID */
  id: string;
  type: SceneObjectType;
  /** 에디터 표시용 작가 친화적 이름 */
  label?: string;
  /** 에셋 ID 참조 */
  src: string;
  position: Vector3;
  rotation: Vector3;
  scale: Vector3OrScalar;
  visible: boolean;
  anchorType?: AnchorType;
  animationName?: string;
  autoplay?: boolean;
  loop?: boolean;
  /** 텍스트 오브젝트 내용 */
  content?: string;
  material?: MaterialProps;
}

// --- Assets ---

export type AssetType = "target" | "model" | "image" | "video" | "audio";

/** 에셋 메타데이터 */
export interface Asset {
  /** kebab-case 고유 ID */
  id: string;
  type: AssetType;
  path: string;
  originalPath?: string;
  size?: number;
  hash?: string;
  mimeType?: string;
}

/** export 기록 */
export interface ExportRecord {
  exportedAt: string; // ISO 8601
  outputPath: string;
  runtimeVersion?: string;
  note?: string;
}

// ============================================================
// 2. Config — export 결과물 런타임 config (config.json)
// ============================================================

/** export 결과물 런타임 config. project.webar.json 의 부분집합. */
export interface Config {
  schemaVersion: SemVer;
  tracking: TrackingConfig;
  scene: RuntimeScene;
}

/** 런타임 장면 (config.json 내부) */
export interface RuntimeScene {
  background: "camera" | "transparent" | "color";
  backgroundColor?: HexColor;
  units: "meters" | "centimeters";
  objects: RuntimeObject[];
}

/** 인라인 단순 이벤트 (config.json 에서만 사용) */
export interface InlineEvent {
  trigger: "tap" | "targetFound" | "targetLost" | "videoEnded" | "soundEnded";
  action: "show" | "hide" | "toggle" | "playSound" | "pauseSound" | "playVideo" | "pauseVideo" | "playAnimation" | "openURL";
  target?: string;
  src?: string;
  animation?: string;
  url?: string;
}

/** 런타임 오브젝트 (config.json 내부, SceneObject 에 events 추가) */
export interface RuntimeObject extends SceneObject {
  events?: InlineEvent[];
}

// ============================================================
// 3. Graph — Event Graph (graph.webar.json)
// ============================================================

/** Event Graph. 1회성 이벤트 체인을 JSON 으로 정의한다. */
export interface Graph {
  schemaVersion: SemVer;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** 에디터 캔버스 상의 노드 좌표 (React Flow 레이아웃 전용) */
export interface NodeGraphPosition {
  x: number;
  y: number;
}

/** 노드 공통 베이스. graphPosition 은 캔버스 레이아웃, 액션별 position(3D) 과 충돌 피함. */
export interface NodeBase {
  id: string;
  label?: string;
  graphPosition?: NodeGraphPosition;
}

// --- 입력 노드 ---

export interface NodeEventTargetFound extends NodeBase {
  type: "event.targetFound";
}

export interface NodeEventTargetLost extends NodeBase {
  type: "event.targetLost";
}

export interface NodeEventTap extends NodeBase {
  type: "event.tap";
  objectId: string;
}

export interface NodeEventButtonClick extends NodeBase {
  type: "event.buttonClick";
  objectId: string;
}

export interface NodeEventTimeElapsed extends NodeBase {
  type: "event.timeElapsed";
  /** 타깃 인식 후 경과 시간 (초) */
  seconds: number;
}

export interface NodeEventVideoEnded extends NodeBase {
  type: "event.videoEnded";
  objectId: string;
}

export interface NodeEventSoundEnded extends NodeBase {
  type: "event.soundEnded";
  objectId: string;
}

// --- 동작 노드 ---

export interface NodeActionShow extends NodeBase {
  type: "action.show";
  objectId: string;
}

export interface NodeActionHide extends NodeBase {
  type: "action.hide";
  objectId: string;
}

export interface NodeActionToggle extends NodeBase {
  type: "action.toggle";
  objectId: string;
}

/**
 * action.playSound — objectId XOR src (v0.1.0 확정)
 *
 * objectId: 장면 오브젝트에 바인딩된 오디오 재생 (장면 상태 연동)
 * src:      ephemeral HTMLAudioElement 생성 후 일회성 재생
 */
export interface NodeActionPlaySoundByObjectId extends NodeBase {
  type: "action.playSound";
  objectId: string;
  src?: never;
  loop?: boolean;
}

export interface NodeActionPlaySoundBySrc extends NodeBase {
  type: "action.playSound";
  src: string;
  objectId?: never;
  loop?: boolean;
}

export type NodeActionPlaySound = NodeActionPlaySoundByObjectId | NodeActionPlaySoundBySrc;

export interface NodeActionPauseSound extends NodeBase {
  type: "action.pauseSound";
  objectId: string;
}

/**
 * action.playVideo — objectId XOR src (v0.1.0 확정)
 *
 * objectId: 장면 오브젝트에 바인딩된 영상 재생 (장면 상태 연동)
 * src:      ephemeral HTMLVideoElement 생성 후 일회성 재생
 */
export interface NodeActionPlayVideoByObjectId extends NodeBase {
  type: "action.playVideo";
  objectId: string;
  src?: never;
  loop?: boolean;
}

export interface NodeActionPlayVideoBySrc extends NodeBase {
  type: "action.playVideo";
  src: string;
  objectId?: never;
  loop?: boolean;
}

export type NodeActionPlayVideo = NodeActionPlayVideoByObjectId | NodeActionPlayVideoBySrc;

export interface NodeActionPauseVideo extends NodeBase {
  type: "action.pauseVideo";
  objectId: string;
}

export interface NodeActionPlayAnimation extends NodeBase {
  type: "action.playAnimation";
  objectId: string;
  animationName?: string;
  loop?: boolean;
}

export interface NodeActionMoveTo extends NodeBase {
  type: "action.moveTo";
  objectId: string;
  position: Vector3;
  /** 이동 시간 (초) */
  duration?: number;
}

export interface NodeActionSetScale extends NodeBase {
  type: "action.setScale";
  objectId: string;
  scale: Vector3OrScalar;
  duration?: number;
}

export interface NodeActionSetColor extends NodeBase {
  type: "action.setColor";
  objectId: string;
  color: HexColor;
}

export interface NodeActionOpenURL extends NodeBase {
  type: "action.openURL";
  url: string;
  newTab?: boolean;
}

export interface NodeActionSceneChange extends NodeBase {
  type: "action.sceneChange";
  sceneId: string;
}

// --- 데이터 노드 ---

export interface NodeDataNumber extends NodeBase {
  type: "data.number";
  value: number;
}

export interface NodeDataText extends NodeBase {
  type: "data.text";
  value: string;
}

export interface NodeDataColor extends NodeBase {
  type: "data.color";
  value: HexColor;
}

export interface NodeDataTime extends NodeBase {
  type: "data.time";
  seconds: number;
}

export interface NodeDataRandom extends NodeBase {
  type: "data.random";
  min?: number;
  max?: number;
}

export interface NodeDataAudienceInput extends NodeBase {
  type: "data.audienceInput";
  prompt?: string;
  inputType?: "text" | "number" | "choice";
}

/** 모든 그래프 노드의 유니온 타입 (discriminated union, type 기준) */
export type GraphNode =
  | NodeEventTargetFound
  | NodeEventTargetLost
  | NodeEventTap
  | NodeEventButtonClick
  | NodeEventTimeElapsed
  | NodeEventVideoEnded
  | NodeEventSoundEnded
  | NodeActionShow
  | NodeActionHide
  | NodeActionToggle
  | NodeActionPlaySound
  | NodeActionPauseSound
  | NodeActionPlayVideo
  | NodeActionPauseVideo
  | NodeActionPlayAnimation
  | NodeActionMoveTo
  | NodeActionSetScale
  | NodeActionSetColor
  | NodeActionOpenURL
  | NodeActionSceneChange
  | NodeDataNumber
  | NodeDataText
  | NodeDataColor
  | NodeDataTime
  | NodeDataRandom
  | NodeDataAudienceInput;

/** 노드 type 리터럴 유니온 */
export type GraphNodeType = GraphNode["type"];

/** 그래프 엣지 (노드 간 실행 연결) */
export interface GraphEdge {
  id?: string;
  from: string;
  to: string;
  /** 실행 지연 (초) */
  delay?: number;
}

// ============================================================
// 4. Bindings — Signal Graph (bindings.webar.json)
// ============================================================

/** Signal Graph. 매 프레임 실시간 데이터를 오브젝트 속성에 연결한다. */
export interface Bindings {
  schemaVersion: SemVer;
  bindings: SignalBinding[];
}

/**
 * 정적 Signal Source 채널 식별자 (dot-case namespace).
 */
export type SignalSource =
  | "audio.volume"
  | "audio.low"
  | "audio.mid"
  | "audio.high"
  | "audio.peak"
  | "audio.beat"
  | "face.x"
  | "face.y"
  | "face.z"
  | "face.pitch"
  | "face.yaw"
  | "face.roll"
  | "face.mouthOpen"
  | "face.leftEye"
  | "face.rightEye"
  | "face.foreheadAnchor"
  | "time.seconds"
  | "time.delta"
  | "time.sin"
  | "time.cos"
  | "time.loop"
  | "random.value"
  | "random.noise"
  | "random.pulse"
  | "target.visible"
  | "target.confidence"
  | "target.x"
  | "target.y"
  | "target.rotation";

/**
 * audio.spectrum.N dot-case 패턴을 포함한 Signal Source (v0.1.0 확정).
 * 실제 식별자: audio.spectrum.0, audio.spectrum.1, ..., audio.spectrum.{spectrumBins-1}
 * 기본 bins: 32. config.audio.spectrumBins 로 override 가능.
 */
export type SignalSourceWithSpectrum = SignalSource | `audio.spectrum.${number}`;

/**
 * Signal Target dot-path (v0.1.0 확정).
 *
 * scale: uniform(objects.id.scale) 또는 축별(objects.id.scale.{x|y|z}) 허용.
 * position/rotation: 축별만 허용 (uniform 의미 없음).
 * 기타 그룹 속성: objects.id.{group}.{property} 자유 경로.
 */
export type SignalTarget =
  | `objects.${string}.scale`
  | `objects.${string}.scale.${'x' | 'y' | 'z'}`
  | `objects.${string}.position.${'x' | 'y' | 'z'}`
  | `objects.${string}.rotation.${'x' | 'y' | 'z'}`
  | `objects.${string}.material.${string}`
  | `objects.${string}.animation.${string}`
  | `objects.${string}.particle.${string}`
  | `objects.${string}.video.${string}`
  | `objects.${string}.audio.${string}`;

/** 값 범위 변환 및 평활화 설정 */
export interface SignalMapConfig {
  /** 입력 범위 [min, max] */
  in?: [number, number];
  /** 출력 범위 [min, max] */
  out?: [number, number];
  /** 출력 범위 clamp 여부 */
  clamp?: boolean;
  /** 평활화 계수 (0 = 즉각, 1 = 변화 없음) */
  smooth?: number;
  /** 출력 값 반전 여부 */
  invert?: boolean;
}

/** Signal Map — 타입 별칭 (signalPath.ts 등에서 사용) */
export type SignalMap = SignalMapConfig;

/** 단일 Signal Binding */
export interface SignalBinding {
  /** kebab-case 고유 ID */
  id: string;
  source: SignalSourceWithSpectrum;
  target: SignalTarget;
  map?: SignalMapConfig;
  enabled?: boolean;
}

// ============================================================
// 5. Manifest — 장기 보존 export 기록 (manifest.json)
// ============================================================

/** 장기 보존용 export 기록. 스키마/라이브러리 버전과 체크섬을 담는다. */
export interface Manifest {
  runtimeVersion: SemVer;
  schemaVersions: ManifestSchemaVersions;
  libraries: ManifestLibraries;
  exportedAt: string; // ISO 8601
  sourceChecksum?: ManifestChecksum;
  projectTitle?: string;
  artist?: string;
  exportNote?: string;
}

export interface ManifestSchemaVersions {
  project: SemVer;
  config: SemVer;
  graph: SemVer;
  bindings: SemVer;
}

export interface ManifestLibraries {
  mindar: string;
  three: string;
  arjs?: string;
}

export interface ManifestChecksum {
  projectWebar?: string;
  graphWebar?: string;
  bindingsWebar?: string;
}
