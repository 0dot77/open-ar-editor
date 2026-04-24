/**
 * api.ts — Tauri 커맨드 프론트엔드 래퍼.
 *
 * 에이전트 D 가 구현할 Rust 커맨드의 TypeScript 계약 정의.
 * 이 파일의 시그니처를 변경할 경우 반드시 에이전트 D 에게 통보해야 한다.
 *
 * Tauri camelCase 변환 규칙:
 *   TS  projectPath: string  ↔  Rust  project_path: String
 *   TS  outputDir: string    ↔  Rust  output_dir: String
 */

import { invoke } from "@tauri-apps/api/core";
import type { Project, Asset, AssetType } from "@/shared/types";

// ============================================================
// 반환 타입 정의
// ============================================================

/** preview_start 커맨드의 반환 타입 */
export interface PreviewInfo {
  /** 로컬 미리보기 URL (예: http://192.168.1.5:8080) */
  url: string;
  /** QR 코드 data URL (base64 PNG) */
  qrDataUrl: string;
  /** 미리보기 서버 포트 */
  port: number;
}

/** export_project 커맨드의 반환 타입 */
export interface ExportResult {
  /** export 가 생성된 디렉토리 절대 경로 */
  outputPath: string;
  /** export 에 포함된 파일 목록 (outputPath 기준 상대 경로) */
  files: string[];
}

// ============================================================
// projectApi — 프로젝트 CRUD
// ============================================================

/**
 * 프로젝트 커맨드 래퍼.
 *
 * Rust 커맨드 (에이전트 D 구현 필요):
 *   project_new(path: String, title: String) -> Project
 *   project_open(path: String) -> Project
 *   project_save(path: String, project: Project) -> ()
 */
export const projectApi = {
  /** 새 프로젝트 생성. 지정 경로에 project.webar.json 을 초기화한다. */
  new: (path: string, title: string) =>
    invoke<Project>("project_new", { path, title }),

  /** 기존 프로젝트 폴더를 열어 Project 객체로 반환한다. */
  open: (path: string) =>
    invoke<Project>("project_open", { path }),

  /** Project 객체를 project.webar.json 으로 저장한다. */
  save: (path: string, project: Project) =>
    invoke<void>("project_save", { path, project }),
};

// ============================================================
// assetApi — 에셋 관리
// ============================================================

/**
 * 에셋 커맨드 래퍼.
 *
 * Rust 커맨드 (에이전트 D 구현 필요):
 *   asset_import(project_path: String, source_path: String, asset_type: String) -> Asset
 */
export const assetApi = {
  /**
   * 외부 파일을 프로젝트 assets/ 로 복사하고 Asset 메타데이터를 반환한다.
   * assetType 은 "target" | "model" | "image" | "video" | "audio".
   */
  import: (projectPath: string, sourcePath: string, assetType: AssetType) =>
    invoke<Asset>("asset_import", { projectPath, sourcePath, assetType }),
};

// ============================================================
// previewApi — 로컬 미리보기 서버
// ============================================================

/**
 * 미리보기 커맨드 래퍼.
 *
 * Rust 커맨드 (에이전트 D 구현 필요):
 *   preview_start(project_path: String) -> PreviewInfo
 *   preview_stop() -> ()
 */
export const previewApi = {
  /** 로컬 preview server 를 시작하고 URL, QR, 포트를 반환한다. */
  start: (projectPath: string) =>
    invoke<PreviewInfo>("preview_start", { projectPath }),

  /** 실행 중인 preview server 를 중지한다. */
  stop: () =>
    invoke<void>("preview_stop"),
};

// ============================================================
// exportApi — 정적 사이트 export
// ============================================================

/**
 * export 커맨드 래퍼.
 *
 * Rust 커맨드 (에이전트 D 구현 필요):
 *   export_project(project_path: String, output_dir: String) -> ExportResult
 *
 * 이 커맨드는 ExportPlan(src/services/exportPlan.ts) 을 참고해 구현한다.
 * 파일 복사 / config.json 생성 / manifest.json 생성 / runtime/ 번들 복사는
 * 모두 Rust 커맨드 내부에서 처리한다.
 */
export const exportApi = {
  /** 프로젝트를 outputDir 에 정적 사이트로 export 한다. */
  project: (projectPath: string, outputDir: string) =>
    invoke<ExportResult>("export_project", { projectPath, outputDir }),
};

// ============================================================
// qrApi — QR 코드 생성
// ============================================================

/**
 * QR 커맨드 래퍼.
 *
 * Rust 커맨드 (에이전트 D 구현 필요):
 *   qr_generate(text: String) -> String  (base64 data URL)
 */
export const qrApi = {
  /** 텍스트를 QR 코드 PNG data URL 로 변환한다. */
  generate: (text: string) =>
    invoke<string>("qr_generate", { text }),
};
