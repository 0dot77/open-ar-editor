# 진행 상황 — MVP 3 (Event Graph) 완료

**스냅샷 시점**: 2026-04-26 (저녁 세션)
**이전 스냅샷**: `docs/진행-상황.md` (MVP 1·2 + Wave 3 + 핸드폰 검증 완료 시점)
**개발 단계 참조**: `docs/제작-단계.md` MVP 3
**비전 문서**: `CLAUDE.md` 최상단 "이 앱이 무엇인가" 4가지

---

## 한 줄 요약

MVP 3 (Event Graph, React Flow 기반) 5 phase 전부 완료.
**카드 인식 → 사운드 재생** end-to-end 검증 완료 (핸드폰 + cloudflared 터널). 다음 세션 후보: MVP 4 (Signal Binding) 또는 MVP 2 잔무 (b/c).

---

## 이번 세션 — MVP 3 5단계 완료

### Phase 1 — React Flow 인프라
| 항목 | 위치 |
|---|---|
| `@xyflow/react@12.10.2` 의존성 추가 | `package.json` |
| 빈 React Flow 캔버스 (Dots 배경 / Controls / MiniMap, 어트리뷰션 숨김, 다크 테마 매핑) | `src/editor/node-graph/NodeGraph.tsx` |

### Phase 2 — 노드 카탈로그 + 변환 레이어
| 항목 | 위치 | 메모 |
|---|---|---|
| 단일 진실 원천 — 15 노드 메타 (영문 라벨, 카테고리, 기본값, enabled flag) | `src/editor/node-graph/nodeCatalog.ts` | `action.sceneChange` 는 `enabled: false` 로 자리만 (다중 장면 도입 시 활성) |
| GraphNode ↔ React Flow Node 변환 | `src/editor/node-graph/graphNodeAdapter.ts` | 우리 GraphNode 를 `node.data.graphNode` 안에 보존 — 직렬화 시 손실 없이 추출 |
| 단일 파라메트릭 노드 뷰 — 카테고리별 컬러바 + 핸들 + 한 줄 메타 | `src/editor/node-graph/GraphNodeView.tsx` | trigger=출력만 / action=입출력 / data=출력만 |

### Phase 3 — Edge 검증 + 팔레트 + 드래그-드롭
| 항목 | 위치 |
|---|---|
| 좌측 180px 노드 팔레트 (카테고리별 그룹, `enabled: false` 자동 제외) | `src/editor/node-graph/NodePalette.tsx` |
| 신규 노드 생성 (id prefix 가 카테고리) | `src/editor/node-graph/nodeFactory.ts` |
| WKWebView 의 dataTransfer custom-MIME 누락 회피용 모듈-레벨 drag 채널 | `src/editor/node-graph/nodeDragChannel.ts` |
| `isValidConnection` — Trigger→Action / Action→Action 만 허용. Data 출력 차단 (MVP 4 까지) | `NodeGraph.tsx` |
| `screenToFlowPosition` 으로 드롭 좌표 캔버스 변환 | `NodeGraph.tsx` |

### Phase 4 — 직렬화 + projectStore graph slice
| 항목 | 위치 |
|---|---|
| `graph_load` / `graph_save` Rust 커맨드 (raw JSON 패스스루) | `src-tauri/src/commands/graph.rs` 신규 + `mod.rs` + `lib.rs` 등록 |
| `graphApi.load/save` 프론트엔드 래퍼 | `src/tauri/api.ts` |
| store 의 `graph` slice + `setGraph` / `updateGraphNode` / `selectGraphNode` 액션 | `src/state/projectStore.ts` |
| `newProject` / `openProject` / `saveProject` 가 graph 도 함께 다룸 | `projectStore.ts` |
| React Flow uncontrolled (`useNodesState`/`useEdgesState`) + meaningful 이벤트 (drop / connect / drag stop / delete) 시점에만 store 동기화 | `NodeGraph.tsx` |
| 프로젝트 변경 시 깨끗한 remount — `<NodeGraphCanvas key={projectPath} />` | `NodeGraph.tsx` |

### Phase 5 — 런타임 그래프 해석 + Inspector + export 통합
| 항목 | 위치 |
|---|---|
| 그래프 노드용 Inspector — Play Sound 의 audio 자산 드롭다운, action 들의 object 드롭다운, openURL 의 url 등 | `src/editor/inspector/GraphNodeInspector.tsx` 신규 |
| Inspector 본체에서 그래프 노드 선택 시 GraphNodeInspector 로 분기 | `Inspector.tsx` |
| React Flow `onSelectionChange` → store 동기화 | `NodeGraph.tsx` |
| `attachGraphRuntime` — 트리거 인덱싱 + outgoing 따라 action 체이닝 + edge.delay 지원 | `runtime-prototype/runtime/graph-runtime.js` 신규 |
| `_runGraphAction` — show/hide/toggle/playSound/playVideo/pauseVideo/playAnimation/openURL 디스패치 | `runtime-prototype/runtime/ar-scene-loader.js` |
| `event.targetFound` / `targetLost` / `tap` / `timeElapsed` (targetFound 후 N초) 매핑 | `graph-runtime.js` |
| export 가 `graph.webar.json` 을 export root 에 복사 — 런타임이 fetch | `src-tauri/src/commands/export.rs` |
| AudioContext 를 "시작하기" 탭 안에서 미리 생성/resume — iOS 사용자 제스처 정책 회피 | `ar-scene-loader.js::resumeAudio` |
| `[graph-runtime] 부착됨` / `[ar-scene-loader] action.playSound 호출` / `사운드 fetch` / `사운드 재생 시작` 진단 로그 | `ar-scene-loader.js` + `graph-runtime.js` |

---

## 정체성 / 정책 결정 사항

### UI 문자열 영문 통일
**이전**: 한국어 우선 (`scale → 크기`, `anchor → 붙는 기준`)
**변경**: 영문 통일 (`Trigger`, `Action`, `Data (preview)`, `Play Sound`, `Audio asset`, etc.)
**근거**:
1. 한글이 macOS/Windows 콘솔·git diff·터미널 환경에서 깨지는 사례 반복 (사용자 직접 경험)
2. 직렬화 키 (`event.targetFound` 등) 가 영문이라 라벨도 영문이면 grep 한 번에 매칭
3. 비교 대상 (8th Wall / Effect House / Lens Studio) 전부 영문 — open-source 대안 포지셔닝과 일치
4. 영문이 source-of-truth 면 추후 i18n layer 추가만 하면 됨

**예외**: 사용자 데이터 (작품 제목·라벨) 와 개발자 문서 (이 파일, CLAUDE.md, docs/) 는 한국어 유지.

`CLAUDE.md` 원칙 3 갱신됨. 메모리에도 박혀 있어 신규 UI 문자열은 자동 영문.

### 노드 직렬화 형식
React Flow 의 native 형식이 아닌 **우리 `Graph/GraphNode/GraphEdge` 스키마** 가 source-of-truth. 변환 레이어 (`graphNodeAdapter.ts`) 가 React Flow 의 boundary 에서 양방향 매핑. 런타임은 React Flow 를 모름 — 순수 JSON 만 본다.

### 노드 라벨 정책
- React Flow `node.type` = 카테고리 (`'trigger' | 'action' | 'data'`) — 컴포넌트 매핑에만 사용
- `node.data.graphNode.type` = 직렬화 타입 (`'event.targetFound'` 등) — 디스패치에 사용
- UI 표시 라벨은 카탈로그의 `label` 영문

### MVP 3 범위 결정
- **Data 노드** — 시각적으로 팔레트에 노출 ("preview" 표시). 연결 비허용 (Data → 무엇 차단). MVP 4 Signal Binding 도입 시 활성
- **action.sceneChange** — 다중 장면 미지원이라 enabled=false. 팔레트에 안 뜸
- **action.playSound 의 src form** — Inspector 가 audio 자산 드롭다운으로 직접 src 설정. objectId form (audio scene object) 은 audio 가 SceneObject 로 도입될 때 함께

---

## 알려진 sleeper 이슈 (다음 세션이 알아야 할 것)

이번 세션에서 시간 많이 잡아먹은 함정들. 메모리에도 들어있음.

### 1. **Tauri 2 `dragDropEnabled` 기본 true 가 webview 내부 HTML5 DnD 가로챔**
- 증상: 팔레트 아이템 끌면 grab 커서 + 드롭 위치에 + 표시까지 뜨는데 `drop` 이벤트 자체가 webview 까지 도달 안 함
- 진단: Playwright headless WebKit 으로 같은 Vite 서버 (localhost:1420) 테스트 → 드래그-드롭 정상 작동. 차이점은 Tauri webview 의 native drag intercept
- 해결: `tauri.conf.json` 의 `app.windows[].dragDropEnabled = false`. 변경 후 cargo 재컴파일 필요 — 단순 HMR 안 됨
- 참고: Tauri 1 의 동등 옵션은 `fileDropEnabled`

### 2. **WKWebView 가 dataTransfer 의 커스텀 MIME 페이로드를 dragover/drop 에서 비움**
- 증상: `application/x-graph-node-type` 같은 커스텀 MIME 으로 setData 해도 `dataTransfer.types` 가 dragover 에서 안 보이고 drop 에서 getData 가 빈 문자열
- 해결: 같은 JS 모듈 안의 변수를 데이터 채널로 사용 (`nodeDragChannel.ts`). dataTransfer 는 cursor 표시용으로 `text/plain` 만.

### 3. **React Flow controlled (`nodes={...}` prop) + transient change race**
- 증상: 드롭으로 새 노드 추가 → 직후 React Flow 가 `dimensions` change 를 onNodesChange 로 발화 → 콜백 closure 의 OLD flowNodes 로 store 가 덮여써져 새 노드가 사라짐
- 해결: `useNodesState` / `useEdgesState` (uncontrolled) 로 React Flow 자체 view state 를 관리하고, drop / connect / drag stop / delete 같은 meaningful 이벤트에서만 `getNodes()` / `getEdges()` 로 읽어 store 와 동기화
- 추가 안전장치: `<NodeGraphCanvas key={projectPath} />` 로 프로젝트 변경 시 fresh remount

### 4. **iOS / WKWebView 의 AudioContext 사용자 제스처 정책**
- 증상: 카드 인식되어 graph 가 `_playSound` 호출하는데 소리 안 남. AudioContext 가 카메라 콜백 (사용자 제스처 밖) 에서 lazy 생성돼 suspended 에서 안 풀림
- 해결: "시작하기" 버튼 onclick (사용자 제스처) 안에서 `loader.resumeAudio()` 호출. `resumeAudio` 가 AudioContext 를 만들고 resume 까지 함

### 5. **CLAUDE.md sleeper #2 재확인** — cargo cache 가 conf 변경 못 잡는 패턴
- 이번 세션에서도 `tauri.conf.json` 변경 후 `Finished in 0.19s` 로 옛 binary 가 그대로 재실행되는 케이스 재현
- 우회: `touch src-tauri/src/lib.rs src-tauri/src/main.rs` 후 재시작. 빌드 로그에 `Compiling open-ar-editor` 라인 떠야 진짜 재컴파일

---

## 검증 결과 — 카드 인식 → 사운드 재생 ✅

| 단계 | 결과 |
|---|---|
| New Project / Open Project | ✅ store.graph 도 함께 초기화/로드 |
| 팔레트에서 노드 드래그-드롭 | ✅ (Tauri dragDropEnabled false + capture phase + 모듈 drag 채널) |
| 노드 끼리 연결 (Trigger → Action) | ✅ isValidConnection 룰 작동 |
| Data 노드 출력 차단 | ✅ |
| 노드 선택 시 우측 Inspector 가 GraphNodeInspector 로 전환 | ✅ |
| Play Sound 노드의 audio asset 드롭다운 | ✅ |
| Save → graph.webar.json 디스크 저장 | ✅ |
| 프로젝트 재오픈 → 그래프 복원 | ✅ |
| Preview build → graph.webar.json 이 .preview-tmp root 에 복사 | ✅ |
| 카드 비춤 → MindAR 인식 → graph 트리거 발화 → 사운드 재생 | ✅ (핸드폰 + cloudflared 터널) |

---

## 새로 생긴 / 변경된 파일

### 신규 (9)
```
src/editor/node-graph/
  nodeCatalog.ts
  graphNodeAdapter.ts
  GraphNodeView.tsx
  NodePalette.tsx
  nodeFactory.ts
  nodeDragChannel.ts
src/editor/inspector/
  GraphNodeInspector.tsx
src-tauri/src/commands/
  graph.rs
runtime-prototype/runtime/
  graph-runtime.js
```

### 수정 (10)
```
src/editor/node-graph/NodeGraph.tsx           # placeholder → React Flow + store 연결 (Phase 1~5 누적)
src/editor/node-graph/NodeGraph.css           # 팔레트 + 노드 + 빈 상태 스타일
src/editor/inspector/Inspector.tsx            # graph 노드 선택 시 GraphNodeInspector 로 분기
src/editor/bottom-tabs/BottomTabs.tsx         # 한국어 라벨 → 영문
src/state/projectStore.ts                     # graph slice + selectedGraphNodeId + updateGraphNode
src/tauri/api.ts                              # graphApi
src-tauri/src/commands/mod.rs                 # graph 모듈
src-tauri/src/lib.rs                          # graph_load/save invoke handler
src-tauri/src/commands/export.rs              # graph.webar.json 을 export root 에 복사
src-tauri/tauri.conf.json                     # dragDropEnabled: false (이번 세션의 핵심 발견)
runtime-prototype/runtime/ar-scene-loader.js  # _attachGraph + _runGraphAction + resumeAudio 강화
CLAUDE.md                                     # 원칙 3 영문 통일
package.json + package-lock.json              # @xyflow/react@12.10.2
```

---

## 다음 착수 후보

### A. **MVP 4 — Signal Binding** (정체성 4번의 본 구현)
- TouchDesigner CHOP Reference 식 매 프레임 데이터 → 속성 바인딩
- 현재 Data 노드 (time / random) 가 자리만 있음 — 활성화 시작점
- 새 source 추가: 포인터 (pointer.x/y/down/deltaX/deltaY), 얼굴 (face.distance / blendshapes — MVP 7 face tracking 도입 시), 오디오 spectrum
- bindings.webar.json 스키마는 이미 v0.1.0 에 정의됨 — 런타임 통합부터

### B. **MVP 2 잔무**
- GLB 애니메이션 트리거 (`action.playAnimation` 디스패치는 이미 구현됨, GLTFLoader 도 있음 — 실제 GLB 로 검증 필요)
- material 속성 (opacity / emissive / color) Inspector 노출
- Asset → Viewport drag-drop 으로 배치 (현재는 클릭으로 추가)
- **포스터 템플릿 1종** — 작가가 바로 fork 해서 수정할 수 있는 starter

### C. **HTTPS / 검증 정비** (낮은 우선순위)
- cloudflared 안내 문구 정확도 (실 사이즈 36MB)
- mkcert 옵션 (트럭 통신 막힐 때 mkcert + LAN 으로)
- iOS 자동재생 정책 정리 — 영상 unmute 흐름

### D. **에디터 UX 정비**
- 그래프 노드 우클릭 메뉴 (Delete, Duplicate)
- 그래프 zoom 단축키 (현재는 Controls 패널)
- 노드 라벨 인라인 편집 (`label` 필드)
- 전체 한국어 UI 잔존 (TopBar, AssetPanel, PreviewModal, Viewport empty state 등) 점진 영문화

---

## 빠른 재검증 시나리오

```
0. npm install (clean checkout 이면)
1. npm run tauri dev
   → 창이 안 뜨면: lsof -ti:1420 | xargs kill -9 후 재시도
   → Rust 변경했는데 0.18s Finished 면: touch src-tauri/src/{lib,main}.rs 후 재시작
2. New Project (부모 폴더 + 이름)
3. Asset 추가:
   - 이미지 타깃 (.mind) → runtime-prototype/assets/targets/card.mind
   - 사운드 → 임의 mp3
4. Bottom Tab "Interaction":
   - 팔레트에서 Target Found / Play Sound 끌어다 캔버스에
   - Target Found 우측 → Play Sound 좌측 핸들 연결
   - Play Sound 클릭 → 우측 Inspector 의 Audio asset 드롭다운에서 사운드 선택
5. Cmd+S 저장
6. PreviewModal → 공개 HTTPS 터널 시작
7. 핸드폰으로 trycloudflare URL 접속 → 시작하기 → 카드 비춤 → 사운드 재생

3분 안에 통과되면 MVP 1·2·3 모두 정상.

콘솔 진단 키워드 (Tauri 창 Cmd+Opt+I):
  [graph-runtime] 부착됨           → 그래프 잘 로드됨
  AudioContext 생성됨 (사용자 제스처)  → 시작하기 탭 시 audio 준비
  action.playSound 호출            → 카드 인식 시 액션 실행
  사운드 fetch / 재생 시작            → 실제 재생
```
