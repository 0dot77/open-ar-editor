# open-ar-editor

미디어아트 작가를 위한 오픈소스 WebAR 에디터. Tauri 데스크톱 앱에서 이미지 타깃 기반 AR 작품을 편집하고, 순수 정적 웹사이트로 export해 GitHub Pages/Netlify/Vercel/개인 서버에 배포·장기 보존한다.

## 이 앱이 무엇인가

1. **오픈 에디터** — 작가가 자유롭게 사용·수정·재배포할 수 있다. 코드도(MIT) 결과물도(웹 표준) 종속성 없음.
2. **공간 위 실험 매체** — 자유롭게 공간에 디지털·무형의 것을 올려놓고 빠르게 반복하는 도구. AR 을 *기술 시연* 이 아닌 *작가의 매체* 로 다룬다.
3. **다양한 AR 기술의 통합** — image / marker / face / GPS / WebXR depth 등 여러 트래킹 모드를 한 에디터에서. 1차 범위는 image, 이후 점진 확장.
4. **데이터 → 실시간 렌더링이 차별점** — TouchDesigner CHOP Reference 의 데이터 그래프 *방식론* 을 AR 도메인에 가져온다. 다른 AR 에디터들이 "효과 제작기" 라면, 이 앱은 "데이터로 움직이는 AR 을 만드는 도구". 시간/타깃/얼굴/포인터/랜덤/오디오 등 모든 실시간 신호가 동등한 시민이고, 오디오는 그중 하나의 입력 source 일 뿐.

**개발 단계 참조 문서**: `docs/제작-단계.md` (원본은 Obsidian vault `taeyang/01_Projects/강의 & 워크숍/뉴아트클럽-feedhijacking/`에서 복사)
**도구 비교 문서**: `docs/도구-비교.md` — 8th Wall/Effect House/Lens Studio 비교, 이 프로젝트의 포지셔닝 근거.

새 작업 지시를 받으면 먼저 `docs/제작-단계.md` 의 해당 단계(제작 단계 / 개발 로드맵 MVP 1~8) 섹션을 확인한다.

## 아키텍처 핵심

```
Tauri Editor (편집/미리보기/export 전용)
  └→ Exported WebAR Site (Tauri 없이 실행되는 순수 정적 사이트)
```

**에디터가 사라져도 작품이 실행되어야 한다.** `index.html` + `config.json` + `assets/` + `runtime/` 이 네 가지로 복원 가능해야 한다.

## 기술 스택

| 영역 | 기술 |
|---|---|
| 데스크톱 | Tauri |
| UI | React + Vite + TypeScript |
| 노드 에디터 | React Flow |
| 3D 렌더링 | Three.js / React Three Fiber |
| 이미지 AR | MindAR |
| 얼굴 AR | MindAR Face Tracking |
| 마커/GPS | AR.js |
| 프로젝트 저장 | JSON |

## 디렉토리 구조 (완성 목표)

```
open-ar-editor/
  src-tauri/                      # Tauri 백엔드 (Rust)
    src/
      main.rs
      commands/                   # project / export / preview / assets
  src/                            # React 프론트엔드
    app/App.tsx
    editor/
      viewport/                   # 3D 뷰포트
      node-graph/                 # React Flow Event/Signal Graph
      asset-panel/
      inspector/
      timeline/
    runtime-template/             # export될 런타임 (번들 대상)
      index.html
      ar-scene-loader.ts
      mindar-image-runtime.ts
      mindar-face-runtime.ts
    shared/
      project-schema.ts
      graph-schema.ts
      asset-schema.ts
  runtime-prototype/              # Phase 1 — 에디터 전에 먼저 검증하는 최소 런타임
    index.html
    config.json
    assets/
    runtime/
```

## 프로젝트 파일 스키마

**편집용** (에디터 내부):
- `project.webar.json` — 장면/에셋 메타데이터
- `graph.webar.json` — Event Graph (이벤트 기반 1회 실행)
- `bindings.webar.json` — Signal Graph (매 프레임 값 바인딩, MVP 4에서 도입)

**Export 결과물** (배포용):
- `index.html` / `config.json` / `manifest.json`
- `assets/targets|models|images|videos|audio/`
- `runtime/` (MindAR + Three.js 번들)
- `README.md` (자동 생성)

## 핵심 설계 원칙

1. **플랫폼 종속 회피** — 결과물은 Tauri/계정/CDN 없이도 실행되어야 한다.
2. **JSON 기반 저장** — 노드는 JS 코드를 생성하지 않는다. 런타임이 JSON을 해석해 실행한다.
3. **작가용 용어 우선** — 기술 용어는 한국어 작가 친화 표현으로 (`scale` → `크기`, `anchor` → `붙는 기준`).
4. **Tauri는 껍데기** — 편집 로직은 모두 React. Tauri 백엔드는 파일 시스템 / export / preview server / QR만 담당.
5. **1차 범위 고정** — 이미지 타깃 기반 AR만. 월드/바닥/VPS/object tracking은 건드리지 않음.
6. **Event Graph vs Signal Graph 분리** — 1회성 이벤트와 매 프레임 바인딩을 구조적으로 구분.
7. **데이터 참조형 그래프 — 오디오비주얼 앱이 아니다** — TouchDesigner CHOP Reference 의 *방식론* (실시간 채널을 속성에 바인딩) 만 차용한다. 시간/타깃 변환/얼굴/포인터/랜덤/오디오 등 다양한 실시간 신호가 동등한 시민이며, 오디오는 그중 하나의 입력 source 일 뿐이다. "오디오 반응형"·"오디오비주얼" 같은 표현으로 도구를 정체화하지 말 것.
8. **모바일 실기기 검증 필수** — Tauri WebView 테스트로 끝내면 안 됨. iPhone Safari + Android Chrome 필수.

## 개발 로드맵

| MVP | 기간 | 목표 |
|---|---|---|
| 1 | 2-4주 | MindAR 런타임 + Tauri 껍데기 + preview server + QR |
| 2 | 2-4주 | 이미지 타깃 1개 + GLB 배치 + export |
| 3 | 4-6주 | React Flow Event Graph (타깃 인식 → 재생 등) |
| 4 | 4-6주 | Signal Binding (실시간 데이터 → 속성 매 프레임 바인딩) |
| 5 | 4-6주 | 이미지/영상/사운드 plane, GLB 애니메이션 |
| 6 | 3-4주 | 작가 템플릿 5종 + 자동 README |
| 7 | 3-5주 | MindAR Face Tracking + foreheadAnchor |
| 8 | 3-5주 | AR.js 마커/GPS |

**현재 단계**: MVP 1 완료 (runtime-prototype/ + Tauri 껍데기 + JSON 스키마 5종). MVP 2 Wave 1 진행 중 — foundation (src/shared, src/state, src/tauri/api, src/services/exportPlan) + Tauri 백엔드 커맨드. 실제 빌드 검증은 사용자가 `pnpm install && pnpm tauri dev` 로.

## 스키마 확정 사항 (v0.1.0)

세 가지 설계 결정이 v0.1.0 에 반영됨:

1. **scale 경로 이중성**: `objects.{id}.scale` = uniform scale (Three.js `setScalar`), `objects.{id}.scale.{x|y|z}` = 축별. `position` / `rotation` 은 축별만 허용 (uniform 의미 없음).
2. **audio.spectrum 인덱스**: dot-case `audio.spectrum.N` (0-indexed). 스펙 문서의 `audio.spectrum[0..n]` 은 서술 표현, 실제 식별자는 dot-case 통일.
3. **playSound / playVideo 소스**: `oneOf(objectId, src)` — 정확히 하나만. `objectId` 는 장면 내 오브젝트 참조 (재사용), `src` 는 일회성 경로 직접 재생.

## 1차 범위에서 제외

바닥/벽 자동 인식, VPS, 3D object tracking, 손 추적, 협업 편집, 클라우드 호스팅, 계정 시스템, 결제/사용량 관리.

## 검증 체크리스트 (모든 MVP 공통)

- [ ] iPhone Safari에서 실행
- [ ] Android Chrome에서 실행
- [ ] HTTPS 환경에서 카메라 권한
- [ ] 타깃 로스트 시 오브젝트 숨김 / 재인식 시 복원
- [ ] 사운드/영상은 사용자 터치 이후 재생 (iOS 자동재생 정책)

## 작업 지시 받을 때

- 스펙 문서에서 해당 단계 섹션을 먼저 읽는다.
- JSON 스키마부터 설계한다 (코드 생성이 아닌 JSON 해석 방식).
- 작가용 UI 문구는 한국어로 써본다.
- 모바일 실기기 검증을 전제로 구조를 짠다.
