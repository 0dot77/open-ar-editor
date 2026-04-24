# open-ar-editor 스키마 문서

미디어아트 작가의 AR 작품을 10년 이상 보존하기 위한 JSON 스키마 정의.
모든 스키마는 JSON Schema draft-07 을 사용한다.

---

## 스키마 역할 요약

| 파일 | 역할 |
|---|---|
| `project.webar.schema.json` | 편집용 원본 — 장면, 에셋 메타데이터, export 이력 전체를 보존 |
| `config.schema.json` | 런타임 config — export 결과물에 포함, 런타임이 장면을 복원하는 최소 정보 |
| `graph.webar.schema.json` | Event Graph — 1회성 이벤트 체인 (타깃 인식 → 모델 보이기 → 영상 재생) |
| `bindings.webar.schema.json` | Signal Graph — 매 프레임 데이터 채널을 오브젝트 속성에 연결 (MVP 4) |
| `manifest.schema.json` | 장기 보존 기록 — 런타임/라이브러리/스키마 버전과 체크섬 |

---

## 파일 관계 다이어그램

```
에디터 내부                           export 결과물
────────────────────────────────      ──────────────────────────────────
project.webar.json ──────────────→   config.json          (부분집합)
graph.webar.json   ──────────────→   graph.webar.json     (그대로 복사)
bindings.webar.json ─────────────→   bindings.webar.json  (그대로 복사)
                                      manifest.json        (export 시 생성)
                                      assets/
                                      runtime/
                                      index.html
```

```
project.webar.json
  └─ assets[]          ← 에셋 ID 참조 (임베딩 금지)
  └─ scene.objects[]   ← src 는 에셋 ID

graph.webar.json
  └─ nodes[].objectId  ← scene object ID 참조
  └─ edges[].from/to   ← node ID 참조

bindings.webar.json
  └─ bindings[].target ← objects.{objectId}.{property} 참조

manifest.json
  └─ schemaVersions    ← 스키마 버전 스냅샷 (미래 마이그레이션 기준)
```

---

## 버전 정책

### schemaVersion 필드

모든 스키마 파일 최상위에 `schemaVersion` (semver, `MAJOR.MINOR.PATCH`) 이 필수다.

```json
{ "schemaVersion": "0.1.0", ... }
```

### 런타임 호환 규칙

- 런타임은 **MAJOR 버전이 일치**하고 **MINOR 버전이 현재 이하**인 파일만 로드한다.
- PATCH 버전은 버그 수정 전용이며 항상 호환된다.
- 예: 런타임 `1.2.x` 는 스키마 `1.0.x`, `1.1.x`, `1.2.x` 를 로드하지만 `1.3.x`, `2.0.x` 는 거부한다.

### Breaking Change 정책

- **breaking change (MAJOR 증가)**: 기존 작품 파일에 부담을 주므로 최소화한다.
- breaking change 를 할 경우 반드시 `docs/schemas/migrations/` 에 마이그레이션 문서를 작성해야 한다.
- 마이그레이션 스크립트 없이 MAJOR 를 올리는 것은 금지한다.
- 필드 추가(optional)는 MINOR 증가, 필드 제거/타입 변경은 MAJOR 증가.

### 스키마 파일 자체 보존

스키마 파일도 `docs/schemas/archive/v{MAJOR}.{MINOR}.{PATCH}/` 에 버전별로 보존한다.

```
docs/schemas/archive/
  v0.1.0/
    project.webar.schema.json
    config.schema.json
    graph.webar.schema.json
    bindings.webar.schema.json
    manifest.schema.json
```

---

## ID 및 네이밍 규칙

| 대상 | 규칙 | 예시 |
|---|---|---|
| 노드 ID | kebab-case | `target-found-001`, `show-model-001` |
| 오브젝트 ID | kebab-case | `glb-main-sculpture`, `forehead-crown` |
| 에셋 ID | kebab-case | `glb-sculpture-asset`, `audio-bgm-asset` |
| node type | dot-case namespace | `event.targetFound`, `action.playSound` |
| signal source | dot-case namespace | `audio.low`, `face.yaw`, `time.sin` |
| signal target | dot-case path | `objects.forehead-crown.material.emissiveIntensity` |

### Signal Target 경로 규칙 (v0.1.0 확정)

`scale` 은 두 가지 형태를 허용한다:
- `objects.{id}.scale` — uniform scale (Three.js `object3D.scale.setScalar(v)` 적용)
- `objects.{id}.scale.{x|y|z}` — 축별 scale

`position`, `rotation` 은 축별 경로만 허용한다 (uniform 의미 없음):
- `objects.{id}.position.{x|y|z}`
- `objects.{id}.rotation.{x|y|z}`

uniform scale 지정 경로 (`objects.id.scale`) 에 단일 숫자 값이 들어오면 런타임은 `setScalar(v)` 를 호출한다.

### Signal Source 목록 (v0.1.0 확정)

**정적 채널** (enum):

| 채널 | 설명 |
|---|---|
| `audio.volume` | 전체 볼륨 (0~1) |
| `audio.low` | 저음 에너지 |
| `audio.mid` | 중음 에너지 |
| `audio.high` | 고음 에너지 |
| `audio.peak` | 피크 값 |
| `audio.beat` | 비트 감지 (0/1) |
| `face.x/y/z` | 얼굴 위치 |
| `face.pitch/yaw/roll` | 얼굴 회전 |
| `face.mouthOpen` | 입 열림 (0~1) |
| `face.leftEye/rightEye` | 눈 열림 (0~1) |
| `face.foreheadAnchor` | 이마 앵커 |
| `time.seconds/delta/sin/cos/loop` | 시간 채널 |
| `random.value/noise/pulse` | 랜덤/노이즈 |
| `target.visible/confidence/x/y/rotation` | 타깃 상태 |

**동적 채널** (패턴 `^audio\.spectrum\.\d+$`):

`audio.spectrum.{N}` — FFT 스펙트럼 빈, 0-indexed, dot-case 통일.

예: `audio.spectrum.0`, `audio.spectrum.1`, ..., `audio.spectrum.31`

- bin 개수 기본값: **32** (spectrumBins = 32)
- manifest 또는 `config.audio.spectrumBins` 로 override 가능
- 스펙 문서의 `audio.spectrum[0..n]` 서술 표현은 설명 목적이며, 실제 식별자는 dot-case (`audio.spectrum.0`) 를 사용한다

---

## 파일 간 참조 원칙

- **임베딩 금지**: 파일 간 참조는 반드시 문자열 ID로만 한다.
- `graph.webar.json` 의 노드는 `scene.objects[].id` 를 문자열로 참조한다.
- `bindings.webar.json` 의 target 은 `objects.{id}.{property}` dot-path 로 참조한다.
- `config.json` 의 `src` 는 에디터에서 에셋 ID → 실제 경로로 치환된다.

---

## JSON Schema draft-07 사용 이유

- **최대 호환성**: AJV, Ajv, VS Code, IntelliJ 등 주요 검증기가 모두 지원.
- **충분한 표현력**: `oneOf`, `allOf`, `$ref`, `pattern`, `format` 으로 discriminated union 과 패턴 검증 가능.
- draft-2019-09, draft-2020-12 는 일부 도구에서 아직 불완전 지원.
- 10년 보존 관점에서 가장 안정적인 선택.

---

## Signal Target dot-path 규칙

```
objects.{objectId}.{property}
objects.{objectId}.{group}.{property}
```

지원하는 target path 예시:

| path | 설명 |
|---|---|
| `objects.forehead-crown.scale` | uniform 크기 (setScalar) — v0.1.0 확정 |
| `objects.forehead-crown.scale.x` | X축 크기 — v0.1.0 확정 |
| `objects.forehead-crown.position.x` | X 위치 (축별만 허용) |
| `objects.forehead-crown.rotation.y` | Y 회전 (축별만 허용) |
| `objects.forehead-crown.material.opacity` | 투명도 |
| `objects.forehead-crown.material.emissiveIntensity` | 빛 세기 |
| `objects.forehead-crown.animation.speed` | 애니메이션 속도 |
| `objects.forehead-particles.particle.rate` | 파티클 발생 속도 |
| `objects.overlay-video.video.playbackRate` | 영상 재생 속도 |

**v0.1.0 확정**: `scale` 은 uniform(`objects.id.scale`) 과 축별(`objects.id.scale.{x|y|z}`) 모두 허용. `position`, `rotation` 은 축별(`objects.id.position.{x|y|z}`) 만 허용.

---

## action.playSound / action.playVideo 소스 규칙 (v0.1.0 확정)

`action.playSound`, `action.playVideo` 노드는 `objectId` 와 `src` 중 **정확히 하나만** 가질 수 있다.

| 필드 | 런타임 동작 |
|---|---|
| `objectId` | 장면 오브젝트를 참조해 해당 오브젝트에 바인딩된 미디어 엘리먼트를 재생. 장면 상태와 연동. |
| `src` | 경로를 직접 지정해 ephemeral `HTMLAudioElement` / `HTMLVideoElement` 를 생성 후 재생. 장면 오브젝트와 무관. |

우선순위는 없다. `objectId` 가 있으면 장면 오브젝트 경로, `src` 가 있으면 일회성 재생.
두 필드를 동시에 지정하면 스키마 검증 오류다.

---

## 보존 원칙

1. **JSON이 보존의 기본 형식**. 코드 생성 없이 런타임이 JSON을 해석해 실행한다.
2. **스키마 파일도 버전별 아카이브** (`archive/v*`).
3. **런타임 포함 export**: CDN 없이도 실행 가능한 export 옵션 제공.
4. **라이브러리 버전 기록**: `manifest.json` 에 MindAR, Three.js 버전 필수 기재.
5. **에디터가 사라져도**: `index.html` + `config.json` + `assets/` + `runtime/` 만으로 복원 가능.
6. **v0.1.0 릴리스는 최초 사용자 export 발생 이후 archive/v0.1.0/ 스냅샷 확정**.

---

## 예시 파일

| 파일 | 설명 |
|---|---|
| `examples/project.webar.json` | 포스터 기반 AR (이미지 타깃 + GLB + 영상) |
| `examples/project.webar.face-audio.json` | 얼굴 오디오 반응형 (face tracking + 이마 오브젝트 + bindings) |
| `examples/config.json` | project.webar.json 에서 export된 런타임 config |
| `examples/graph.webar.json` | 타깃 인식 → 모델 보이기 → 영상 재생 → 사운드 재생 체인 |
| `examples/bindings.webar.json` | audio.low → scale, audio.high → emissiveIntensity, face.yaw → rotation.y |
| `examples/manifest.json` | 장기 보존용 export 기록 |
