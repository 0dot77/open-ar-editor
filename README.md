# open-ar-editor

미디어아트 작가를 위한 오픈소스 WebAR 에디터.

이미지 타깃 기반 AR 작품을 데스크톱 앱에서 만들고, 순수 정적 웹사이트로 export해서 GitHub Pages / Netlify / Vercel / 개인 서버에 배포하고 장기 보존한다.

## 이 앱이 무엇인가

1. **오픈 에디터** — 작가가 자유롭게 사용·수정·재배포할 수 있다. 코드도(MIT) 결과물도(웹 표준) 종속성 없음.
2. **공간 위 실험 매체** — 자유롭게 공간에 디지털·무형의 것을 올려놓고 빠르게 반복하는 도구. AR 을 *기술 시연* 이 아닌 *작가의 매체* 로 다룬다.
3. **다양한 AR 기술의 통합** — image / marker / face / GPS / WebXR depth 등 여러 트래킹 모드를 한 에디터에서. 1차 범위는 image, 이후 점진 확장.
4. **데이터 → 실시간 렌더링이 차별점** — TouchDesigner CHOP Reference 의 데이터 그래프 *방식론* 을 AR 도메인에 가져온다. 다른 AR 에디터들이 "효과 제작기" 라면, 이 앱은 "데이터로 움직이는 AR 을 만드는 도구". 시간/타깃/얼굴/포인터/랜덤/오디오 등 모든 실시간 신호가 동등한 시민이고, 오디오는 그중 하나의 입력 source 일 뿐.

## 목표

> 작가가 자신의 이미지, 포스터, 캡션, 오브젝트 표면을 AR 타깃으로 삼아 웹 기반 작품을 만들고, 그 결과물을 스스로 보존하고 배포할 수 있게 하는 오픈소스 WebAR 제작 도구.

- 완전한 플랫폼 종속 회피
- 프로젝트 파일 / 에셋 / 설정 JSON / 빌드 결과물을 작가가 소유
- 최종 결과물은 정적 웹사이트로 export
- 1차 범위: 이미지 타깃 기반 WebAR (점진 확장)

## 기술 스택

Tauri · React · Vite · TypeScript · React Flow · Three.js · MindAR

## 현재 단계

**MVP 1** — MindAR 이미지 타깃 최소 런타임을 `runtime-prototype/` 에서 먼저 검증한다.

```bash
# 런타임 프로토타입 실행
cd runtime-prototype
npx http-server -S -C cert.pem -K key.pem -p 8080
# 또는
npx serve .
```

모바일에서 같은 Wi-Fi로 접속해서 카메라 권한 → 타깃 이미지 인식 → 3D 오브젝트 표시가 되는지 확인.

## 라이선스

미정 (MIT 예정).
