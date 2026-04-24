/**
 * schemaVersion.ts — 스키마 버전 상수 및 호환성 유틸.
 */

// ============================================================
// 현재 버전 상수
// ============================================================

/** 현재 스키마 버전. 모든 저장 파일에 주입된다. */
export const SCHEMA_VERSION = "0.1.0" as const;

// ============================================================
// 버전 파싱
// ============================================================

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
}

function parseSemVer(version: string): ParsedVersion | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

// ============================================================
// 호환성 검사
// ============================================================

/**
 * 파일에 기록된 버전이 현재 런타임과 호환되는지 확인한다.
 *
 * 호환 조건:
 *  - MAJOR 버전이 일치해야 한다.
 *  - MINOR 버전이 현재 이하여야 한다.
 *  - PATCH 는 무시 (버그 수정 전용).
 *
 * 예:
 *   현재: 0.1.0
 *   isCompatible("0.1.0") → true
 *   isCompatible("0.0.9") → true  (minor 0 ≤ 1)
 *   isCompatible("0.2.0") → false (minor 2 > 1)
 *   isCompatible("1.0.0") → false (major 불일치)
 */
export function isCompatible(fileVersion: string): boolean {
  const current = parseSemVer(SCHEMA_VERSION);
  const file = parseSemVer(fileVersion);

  if (!current || !file) return false;
  if (current.major !== file.major) return false;
  if (file.minor > current.minor) return false;

  return true;
}

// ============================================================
// 저장 시 schemaVersion 주입 유틸
// ============================================================

/**
 * 객체에 schemaVersion 필드를 자동으로 주입한다.
 * 파일 저장 직전에 호출한다.
 *
 * 예:
 *   injectSchemaVersion({ nodes: [], edges: [] })
 *   → { schemaVersion: "0.1.0", nodes: [], edges: [] }
 */
export function injectSchemaVersion<T extends object>(data: T): T & { schemaVersion: string } {
  return { ...data, schemaVersion: SCHEMA_VERSION };
}
