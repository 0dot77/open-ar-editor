# open-ar-editor

미디어아트 작가를 위한 오픈소스 WebAR 에디터.

이미지 타깃 기반 AR 작품을 데스크톱 앱에서 만들고, 순수 정적 웹사이트로 export해서 GitHub Pages / Netlify / Vercel / 개인 서버에 배포하고 장기 보존한다.

## 목표

> 작가가 자신의 이미지, 포스터, 캡션, 오브젝트 표면을 AR 타깃으로 삼아 웹 기반 작품을 만들고, 그 결과물을 스스로 보존하고 배포할 수 있게 하는 오픈소스 WebAR 제작 도구.

- 완전한 플랫폼 종속 회피
- 프로젝트 파일 / 에셋 / 설정 JSON / 빌드 결과물을 작가가 소유
- 최종 결과물은 정적 웹사이트로 export
- 1차 범위: 이미지 타깃 기반 WebAR

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
