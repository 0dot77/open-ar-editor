# export 결과물 형식 명세

이 문서는 open-ar-editor 의 "정적 사이트 export" 결과물 구조와 자기완결성 보장 규칙을 정의한다.

---

## 출력 디렉토리 트리

```
{프로젝트명}-export/
  index.html              ← WebAR 진입점. Tauri 없이 브라우저에서 직접 실행 가능
  config.json             ← 런타임 config. schemaVersion + tracking + scene 포함
  manifest.json           ← 장기 보존 기록. 라이브러리 버전, exportedAt, 체크섬
  assets/
    targets/              ← MindAR .mind 파일 + preview 이미지
    models/               ← GLB 3D 모델
    images/               ← 이미지 plane 소스
    videos/               ← 영상 파일
    audio/                ← 오디오 파일
  runtime/
    mindar-image.js       ← MindAR 이미지 타깃 런타임
    mindar-face.js        ← MindAR face tracking 런타임
    three-runtime.js      ← Three.js 렌더러
    ar-scene-loader.js    ← config.json 을 해석해 장면을 조립하는 진입 스크립트
  graph.webar.json        ← Event Graph (원본 그대로 복사, 복원 가능성 보장)
  bindings.webar.json     ← Signal Graph (원본 그대로 복사, 복원 가능성 보장)
  README.md               ← 자동 생성. 작품 제목, 배포 방법, 권장 환경
```

---

## 에디터 없이 실행 가능 원칙

다음 체크리스트를 모두 만족해야 export 가 유효하다.

- [ ] `index.html` + `config.json` + `assets/` + `runtime/` 네 가지만으로 장면 복원 가능
- [ ] Tauri 앱 없이도 실행 가능 (정적 파일 서버 또는 GitHub Pages 에서 동작)
- [ ] 계정, 로그인, 클라우드 API 없이 실행 가능
- [ ] `runtime/` 디렉토리에 필요한 JS 번들이 모두 포함되어 CDN 없이도 실행 가능
- [ ] `config.json` 의 `schemaVersion` 필드가 포함되어 있어야 한다
- [ ] `manifest.json` 에 `runtimeVersion`, `exportedAt`, 라이브러리 버전이 기록되어 있어야 한다
- [ ] `assets/` 하위 모든 파일이 `config.json` 에 기록된 경로와 일치해야 한다
- [ ] iPhone Safari, Android Chrome 에서 HTTPS 환경 실행 검증 필수

---

## config.json 구조

`config.json` 은 `project.webar.json` 의 부분집합이다. 에디터 메타데이터(작가 노트, export 이력)는 포함하지 않고 런타임 실행에 필요한 최소 정보만 담는다.

```json
{
  "schemaVersion": "0.1.0",
  "tracking": {
    "type": "image",
    "target": "assets/targets/poster.mind",
    "preview": "assets/targets/poster-preview.jpg"
  },
  "scene": {
    "background": "camera",
    "units": "meters",
    "objects": [
      {
        "id": "glb-sculpture",
        "type": "model",
        "src": "assets/models/sculpture.glb",
        "position": [0, 0, 0],
        "rotation": [0, 0, 0],
        "scale": 1,
        "visible": true
      }
    ]
  }
}
```

스키마 참조: `docs/schemas/config.schema.json`

---

## manifest.json 구조

장기 보존을 위한 export 기록이다. 몇 년 뒤 동일 결과물을 재현하거나 마이그레이션할 때 기준점이 된다.

```json
{
  "runtimeVersion": "1.0.0",
  "schemaVersions": {
    "project": "0.1.0",
    "config": "0.1.0",
    "graph": "0.1.0",
    "bindings": "0.1.0"
  },
  "libraries": {
    "mindar": "1.0.0",
    "three": "0.160.0"
  },
  "exportedAt": "2026-04-25T12:00:00Z",
  "projectTitle": "포스터 AR 작품",
  "artist": "작가명"
}
```

스키마 참조: `docs/schemas/manifest.schema.json`

---

## Tauri export_project 커맨드 스펙

에이전트 D 가 구현하는 `export_project` Rust 커맨드는 다음 절차를 수행한다.

1. `src/services/exportPlan.ts` 의 `buildExportPlan()` 이 반환한 `ExportPlan` 구조를 입력으로 받는다.
2. `outputDir` 디렉토리를 생성한다.
3. `ExportPlan.assetCopies` 목록에 따라 에셋을 복사한다.
4. `ExportPlan.config` 를 `config.json` 으로 직렬화해 저장한다.
5. `ExportPlan.manifest` 를 `manifest.json` 으로 저장한다.
6. `ExportPlan.runtimeFiles` 목록에 따라 `runtime-prototype/` 에서 `runtime/` 로 복사한다.
7. `index.html` 을 복사한다.
8. `graph.webar.json`, `bindings.webar.json` 을 원본 그대로 복사한다.
9. `README.md` 를 자동 생성한다 (작품 제목, 배포 가이드, 권장 환경 포함).
10. `ExportResult { outputPath, files }` 를 반환한다.

TS 래퍼: `src/tauri/api.ts` 의 `exportApi.project()`

---

## runtime/ 번들 포함 원칙

> **장기 보존을 위해 runtime/ 번들 자체를 export 에 포함한다.**

- 기본 export: `runtime/` 디렉토리에 MindAR, Three.js, ar-scene-loader 를 모두 포함.
- CDN 의존 선택: 네트워크가 안정적인 환경에서 CDN 링크를 사용하는 "경량 export" 옵션을 나중에 제공할 수 있다. 이 경우 `manifest.json` 에 `cdnMode: true` 플래그를 기록한다.
- 기본값은 항상 **자기완결** 방식이다. 작가의 파일 소유권과 장기 보존이 CDN 편의보다 우선한다.

---

## 파일 간 참조 원칙

- `config.json` 의 `src` 필드는 export 결과물 내 상대 경로를 사용한다.
- 절대 URL, 외부 CDN 링크를 `config.json` 에 저장하지 않는다.
- `graph.webar.json` 의 노드는 `objectId` 로 `config.json` 의 오브젝트를 참조한다.
- 경로 구분자는 항상 `/` (유닉스 스타일).

---

## 스키마 버전 호환성

`config.json` 의 `schemaVersion` 은 런타임 로드 시 호환성 검사에 사용된다.

- 런타임 `0.1.x` 는 `schemaVersion` `0.0.x` ~ `0.1.x` 를 로드한다.
- MAJOR 불일치, 또는 파일의 MINOR 가 현재 런타임보다 크면 로드를 거부하고 오류 메시지를 표시한다.

검사 로직 참조: `src/shared/schemaVersion.ts` 의 `isCompatible()`
