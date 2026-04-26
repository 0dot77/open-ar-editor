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
3. **UI 문자열은 영문 통일** — 사용자 노출 UI 문자열 (라벨, 카테고리, 탭, 인스펙터 필드명 등) 은 영문으로 작성한다. 기술 용어를 그대로 노출하지 말고 작가 친화적 영문 표현으로 (`scale` → `Size`, `anchor` → `Attached To`). 한국어가 필요하면 추후 i18n layer 로 도입. 한국어는 macOS/Windows 콘솔·git diff·터미널 환경에서 깨지는 사례가 반복돼 source-of-truth 영문이 안전하다. 단, **사용자 데이터** (작품 제목·설명, 오브젝트 라벨) 와 **개발자 문서** (이 CLAUDE.md, docs/) 는 한국어 유지.
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

**현재 단계**: MVP 1·2·3 완료. MVP 3 = React Flow Event Graph (`event.targetFound` → `action.playSound` end-to-end 핸드폰 검증 ✅). 자세한 내용은 `docs/진행-상황-mvp3.md`. 빌드/실행은 `npm install && npm run tauri dev`.

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

- 스펙 문서 (`docs/제작-단계.md`) 의 해당 단계 섹션을 먼저 읽는다.
- 가장 최근 진행 상황 (`docs/진행-상황-mvp3.md`) 을 훑어 어디까지 됐는지 / 결정된 사항이 뭔지 본다.
- JSON 스키마부터 설계한다 (코드 생성이 아닌 JSON 해석 방식).
- 사용자 노출 UI 문자열은 영문 (원칙 3).
- 모바일 실기기 검증을 전제로 구조를 짠다.

## 알려진 함정 (이 환경에서 시간 잡아먹은 것들)

이전 세션에서 디버깅에 시간 많이 들었던 함정들. 비슷한 증상 보이면 여기 먼저 확인.

### 진단 메타-패턴: Tauri webview vs 일반 브라우저 격리
Tauri 창 안에서만 안 되고 콘솔에도 에러 없을 땐, **같은 Vite URL (localhost:1420) 을 일반 Safari/Chrome 또는 Playwright headless WebKit 으로 띄워 동일 코드를 테스트**. 둘 다 안 되면 코드 문제, Tauri 만 안 되면 webview 정책 (drag-drop / clipboard / autoplay 등) 의심. 이걸 안 하고 코드만 만지면 한 시간씩 날린다.

### Tauri 2 `dragDropEnabled` 기본 true
- 증상: webview 안에서 HTML5 드래그-드롭이 grab 까지 되고 + 표시까지 뜨는데 `drop` 이벤트 자체가 발화 안 함
- 고침: `tauri.conf.json` 의 `app.windows[].dragDropEnabled = false`. webview 내부에서 DnD UI 만들 거면 거의 default. 변경 후 cargo 재컴파일 필요.

### WKWebView 가 dataTransfer 의 커스텀 MIME 페이로드 누락
- 증상: `application/x-foo` 같은 커스텀 MIME 으로 `setData` 해도 `getData` 가 빈 문자열
- 고침: 같은 JS 모듈 안의 변수를 데이터 채널로 사용. dataTransfer 는 cursor 표시용으로 `text/plain` 만.

### React Flow controlled mode + transient change race
- 증상: 새 노드 드롭하면 store 에 잠깐 추가됐다가 React Flow 의 `dimensions` change 가 OLD closure 로 onNodesChange 발화하며 사라짐
- 고침: `useNodesState` / `useEdgesState` (uncontrolled) 로 React Flow 자체 view state 관리 + drop / connect / drag stop / delete 같은 meaningful 이벤트에서만 store sync. 프로젝트 변경 시 `<Canvas key={projectPath} />` 로 fresh remount.

### iOS / WKWebView 의 AudioContext 사용자 제스처 정책
- 증상: 카드 인식 콜백에서 `_playSound` 호출하는데 소리 안 남
- 고침: AudioContext 를 **사용자 제스처 (시작하기 버튼 onclick) 안에서** 생성/resume. 카메라/MindAR 콜백 같은 indirect path 안에서 lazy 생성하면 iOS 가 suspended 풀어주지 않음.

### cargo 가 변경 못 잡는 패턴
- 증상: `.rs` 또는 `tauri.conf.json` 변경 후 `Finished in 0.18s` 로 옛 binary 가 그대로 재실행
- 고침: `touch src-tauri/src/{lib,main}.rs` 후 재시작. 빌드 로그에 `Compiling open-ar-editor` 라인이 떠야 진짜 재컴파일.

### `npm run tauri dev` 재시작 시 포트 점유
- 증상: `Error: Port 1420 is already in use`
- 고침: `lsof -ti:1420 | xargs -r kill -9` 후 재시작. 부모 프로세스 kill 해도 vite 자식이 살아남는 케이스 있음.
