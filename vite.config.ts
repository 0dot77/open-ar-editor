import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
// Tauri 연동: clearScreen false, strictPort, HMR host 설정
export default defineConfig({
  plugins: [react()],

  // Tauri dev server 환경에서 터미널 화면을 지우지 않도록 설정
  clearScreen: false,

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    port: 1420,
    // Tauri가 고정 포트를 기대하므로 이미 사용 중이면 오류로 처리
    strictPort: true,
    // HMR: Tauri WebView 안에서 HMR이 동작하도록 host 를 명시
    // (개발 환경에서 Tauri가 http://localhost:1420 를 로드함)
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 1420,
    },
    // Tauri가 필요로 하는 파일 시스템 감시 설정
    watch: {
      // 2. Tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  // Tauri build: 상대 경로 사용 (기본값은 절대 경로)
  build: {
    // Tauri가 지원하는 Chromium 기반 WebView 를 대상으로 빌드
    target: process.env.TAURI_PLATFORM === "windows" ? "chrome105" : "safari13",
    // 디버그 빌드에서 minify 비활성화
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    // 빌드 소스맵 (Tauri debug 모드)
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
