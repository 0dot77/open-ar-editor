# WebAR 런타임 — runtime-prototype

open-ar-editor MVP 1 Phase 1 최소 런타임.  
Tauri, 빌드 도구, 계정 없이 **순수 정적 파일**로 모바일 브라우저에서 실행됩니다.

---

## 빠른 시작

1. `assets/targets/target.mind` — MindAR 컴파일된 타깃 파일 추가 (아래 참고)
2. `assets/models/object.glb` — 3D 모델 추가 (없어도 와이어프레임 큐브로 대체됨)
3. HTTPS 서버로 서빙 → 모바일 브라우저로 접속

---

## 모바일 HTTPS 서빙 방법

카메라 API는 **HTTPS 또는 localhost** 환경에서만 작동합니다.  
`npx serve .` 는 HTTP라서 실제 기기에서 카메라가 열리지 않습니다.

### 방법 1 — mkcert + http-server (같은 Wi-Fi)

```bash
# mkcert 설치 (한 번만)
brew install mkcert          # macOS
choco install mkcert         # Windows (관리자 PowerShell)

mkcert -install
mkcert localhost 127.0.0.1 <로컬 IP 예: 192.168.0.10>

# 서빙 (runtime-prototype/ 디렉토리에서)
npx http-server . -S -C localhost+2.pem -K localhost+2-key.pem -p 8443 --cors
```

같은 Wi-Fi에 연결된 스마트폰에서 `https://192.168.0.10:8443` 으로 접속합니다.

### 방법 2 — ngrok (외부 접속 가능)

```bash
ngrok http 8080
# 출력된 https://xxxx.ngrok-free.app URL을 모바일에서 열기

# 별도 터미널에서 서버 실행
npx serve . -l 8080
```

### 방법 3 — cloudflared 터널 (Cloudflare 계정 불필요)

```bash
npx serve . -l 8080 &
cloudflared tunnel --url http://localhost:8080
```

출력된 `https://*.trycloudflare.com` URL을 사용합니다.

> **오프라인 보존용**: CDN 의존 없이 실행하려면 `runtime/` 아래에  
> Three.js(`three.module.js`, `GLTFLoader.js`)와 MindAR(`mindar-image-three.prod.js`)를  
> 수동으로 복사하고 import 경로를 상대 경로로 변경하세요.

---

## .mind 파일 만드는 법

MindAR 공식 온라인 컴파일러를 사용합니다.

**URL**: https://hiukim.github.io/mind-ar-js-doc/tools/compile

**워크플로우**:

1. 위 URL에 접속합니다.
2. 타깃 이미지(JPG/PNG)를 업로드합니다.
3. "Start" 버튼을 누르고 잠시 기다립니다.
4. 생성된 `.mind` 파일을 다운로드합니다.
5. `assets/targets/target.mind` 로 저장합니다.
6. 타깃 미리보기 이미지를 `assets/targets/target-preview.jpg` 로 저장합니다.

---

## 좋은 타깃 이미지 조건

**좋은 타깃**:
- 디테일이 많고 시각적으로 복잡하다
- 밝고 어두운 부분의 대비가 분명하다
- 반복 패턴이 없다
- 반사가 없고 무광 표면이다
- 관객이 가까이(30–80cm) 비출 수 있다
- 평평하게 설치할 수 있다

**나쁜 타깃**:
- 흰 여백이 많거나 단색 면이 크다
- 규칙적인 반복 패턴만 있다 (격자, 줄무늬 등)
- 유리/금속 반사가 강하다
- 조명에 따라 모습이 크게 달라진다
- 너무 작거나 너무 멀리 설치된다

포스터, 사진 인화물, 전시 캡션 패널, 책 표지가 일반적으로 좋은 타깃입니다.

---

## 실기기 테스트 체크리스트

### iPhone Safari

- [ ] HTTPS URL로 접속되는가
- [ ] "시작하기" 버튼을 누른 후 카메라 권한 요청이 뜨는가
- [ ] 권한 허용 후 카메라 화면이 표시되는가
- [ ] 타깃 이미지를 비추면 3D 오브젝트가 나타나는가
- [ ] 타깃을 벗어나면 오브젝트가 사라지는가
- [ ] 오브젝트를 탭하면 등록된 이벤트가 실행되는가
- [ ] 사운드는 버튼 탭 이후에 재생되는가 (자동재생 차단 확인)

### Android Chrome

- [ ] HTTPS URL로 접속되는가
- [ ] 카메라 권한 요청 및 허용이 작동하는가
- [ ] 타깃 인식 및 오브젝트 표시가 되는가
- [ ] 영상(video 타입) 자동재생이 muted 상태로 시작되는가
- [ ] 오브젝트 탭 → playVideo 액션이 실행되는가

### 공통

- [ ] 콘솔에 `config loaded` 로그가 출력되는가
- [ ] `.mind` 파일 누락 시 한국어 에러 메시지가 표시되는가
- [ ] 카메라 권한 거부 시 한국어 안내가 표시되는가
- [ ] GLB 누락 시 와이어프레임 큐브(플레이스홀더)가 표시되는가

---

## 에셋 추가 방법

### 3D 모델 교체

1. GLB 파일을 `assets/models/` 에 복사
2. `config.json` 의 `"src"` 를 해당 경로로 변경

### 이미지 오버레이 추가

`config.json` 의 `scene.objects` 배열에 추가:

```json
{
  "id": "image-001",
  "type": "image",
  "src": "assets/images/overlay.png",
  "position": [0, 0.5, 0],
  "scale": [1, 1, 1],
  "visible": true
}
```

### 영상 오버레이 추가

```json
{
  "id": "video-001",
  "type": "video",
  "src": "assets/videos/video.mp4",
  "width": 1.6,
  "height": 0.9,
  "position": [0, 0, 0],
  "visible": true,
  "events": [
    { "trigger": "tap", "action": "playVideo", "target": "video-001" }
  ]
}
```

### 지원 이벤트 트리거

| 트리거 | 설명 |
|---|---|
| `targetFound` | 타깃 인식될 때 |
| `targetLost` | 타깃 사라질 때 |
| `tap` | 오브젝트 터치/클릭 |

### 지원 액션

| 액션 | 설명 |
|---|---|
| `show` | 오브젝트 보이기 |
| `hide` | 오브젝트 숨기기 |
| `toggle` | 보이기/숨기기 전환 |
| `playAnimation` | GLB 애니메이션 재생 |
| `playSound` | 사운드 재생 (src 필요) |
| `playVideo` | 영상 재생 |
| `pauseVideo` | 영상 일시정지 |

---

## 라이브러리 버전

| 라이브러리 | 버전 | 출처 |
|---|---|---|
| MindAR | 1.2.5 | jsdelivr CDN |
| Three.js | 0.160.0 | jsdelivr CDN |

버전 정보는 `manifest.json` 에도 기록되어 있습니다.
