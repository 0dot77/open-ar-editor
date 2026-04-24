/**
 * exportPlan.ts — 순수 export 플래너.
 *
 * 파일 I/O 없음. Project 객체를 받아 export 에 필요한 정보를 계산해 반환한다.
 * 실제 파일 복사/생성은 Tauri 의 export_project 커맨드(에이전트 D)가 담당한다.
 */

import type { Project, Config, Manifest, RuntimeScene, RuntimeObject } from "@/shared/types";
import { SCHEMA_VERSION } from "@/shared/schemaVersion";

// ============================================================
// 보조 타입
// ============================================================

/** exportPlan 에 전달하는 외부 라이브러리 버전 정보 */
export interface Libraries {
  mindar: string;
  three: string;
  arjs?: string;
}

// ============================================================
// ExportPlan 타입
// ============================================================

/**
 * buildExportPlan 의 반환 타입.
 * 에이전트 D 의 export_project Rust 커맨드가 이 구조를 참고해 파일을 생성한다.
 */
export interface ExportPlan {
  /** project → config.json 변환 결과 (런타임이 읽는 부분) */
  config: Config;

  /** export 시점 메타 (manifest.json) */
  manifest: Manifest;

  /**
   * 복사할 에셋 목록.
   * from: 원본 절대 경로 (프로젝트 디렉토리 내)
   * to:   export 결과물 내 상대 경로 (예: "assets/models/sculpture.glb")
   */
  assetCopies: { from: string; to: string }[];

  /**
   * runtime-prototype/runtime/ 에서 가져올 파일 목록 (상대 경로).
   * 에이전트 D 가 이 목록을 기준으로 runtime/ 디렉토리를 구성한다.
   */
  runtimeFiles: string[];
}

// ============================================================
// buildExportPlan — 순수 함수
// ============================================================

/**
 * Project 객체를 기반으로 ExportPlan 을 계산한다.
 *
 * @param project       편집용 프로젝트 데이터
 * @param runtimeVersion 포함할 런타임 버전 문자열 (예: "1.0.0")
 * @param libraries     라이브러리 버전 정보
 */
export function buildExportPlan(
  project: Project,
  runtimeVersion: string,
  libraries: Libraries
): ExportPlan {
  // --- config 생성 ---
  const runtimeScene: RuntimeScene = {
    background: project.scene.background,
    ...(project.scene.backgroundColor
      ? { backgroundColor: project.scene.backgroundColor }
      : {}),
    units: project.scene.units,
    objects: project.scene.objects.map((obj): RuntimeObject => ({
      ...obj,
      // events 는 graph.webar.json 기반 런타임에서 처리하므로 config 에서는 비움
      events: [],
    })),
  };

  const config: Config = {
    schemaVersion: SCHEMA_VERSION,
    tracking: project.tracking,
    scene: runtimeScene,
  };

  // --- manifest 생성 ---
  const manifest: Manifest = {
    runtimeVersion,
    schemaVersions: {
      project: SCHEMA_VERSION,
      config: SCHEMA_VERSION,
      graph: SCHEMA_VERSION,
      bindings: SCHEMA_VERSION,
    },
    libraries,
    exportedAt: new Date().toISOString(),
    projectTitle: project.metadata.title,
    artist: project.metadata.artist,
  };

  // --- assetCopies 생성 ---
  const assetCopies: ExportPlan["assetCopies"] = project.assets.map((asset) => {
    const filename = asset.path.split("/").pop() ?? asset.id;
    return {
      from: asset.path,
      to: `assets/${asset.type}/${filename}`,
    };
  });

  // --- runtimeFiles 생성 ---
  // runtime-prototype/runtime/ 아래 포함할 파일 목록.
  // 경로는 runtime-prototype/ 루트 기준 상대 경로.
  const runtimeFiles: string[] = [
    "runtime/mindar-image.js",
    "runtime/mindar-face.js",
    "runtime/three-runtime.js",
    "runtime/ar-scene-loader.js",
    "index.html",
    "manifest.json",
  ];

  return { config, manifest, assetCopies, runtimeFiles };
}
