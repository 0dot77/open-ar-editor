/**
 * signalPath.ts — Signal Target dot-path 파싱 및 검증 유틸.
 *
 * 런타임 적용(Three.js Object3D 조작)은 이 파일의 범위 밖이다.
 * 파싱·검증만 담당한다.
 */

// ============================================================
// ParsedTarget 타입
// ============================================================

/**
 * parseSignalTarget 의 반환 타입.
 *
 * 예:
 *   "objects.foo.scale"     → { objectId: "foo", property: ["scale"], isUniformScale: true }
 *   "objects.foo.scale.x"   → { objectId: "foo", property: ["scale", "x"], isUniformScale: false }
 *   "objects.foo.position.y"→ { objectId: "foo", property: ["position", "y"], isUniformScale: false }
 *   "objects.foo.material.emissiveIntensity"
 *                           → { objectId: "foo", property: ["material", "emissiveIntensity"], isUniformScale: false }
 */
export interface ParsedTarget {
  /** 오브젝트 ID (kebab-case) */
  objectId: string;
  /** 속성 경로 세그먼트. 예: ["scale"] | ["scale","x"] | ["material","emissiveIntensity"] */
  property: string[];
  /**
   * true 이면 scale uniform 경로 — Three.js object3D.scale.setScalar(v) 적용 대상.
   * false 이면 축별 또는 기타 그룹 속성.
   */
  isUniformScale: boolean;
}

// ============================================================
// parseSignalTarget
// ============================================================

/**
 * Signal Target dot-path 문자열을 ParsedTarget 으로 분해한다.
 *
 * 유효한 경로 규칙 (v0.1.0 확정):
 *  - "objects.{id}.scale"              → uniform scale
 *  - "objects.{id}.scale.{x|y|z}"     → 축별 scale
 *  - "objects.{id}.position.{x|y|z}"  → position 축별 (uniform 없음)
 *  - "objects.{id}.rotation.{x|y|z}"  → rotation 축별 (uniform 없음)
 *  - "objects.{id}.{group}.{prop}"     → material, animation, particle, video, audio 등
 *
 * 잘못된 경로 예:
 *  - "objects.foo.position"            → position uniform 없음 → throw
 *  - "objects.foo.rotation"            → rotation uniform 없음 → throw
 *  - "objects.foo"                     → 속성 없음 → throw
 *  - "foo.bar"                         → objects. prefix 없음 → throw
 *
 * 단위 테스트 주석 예제:
 *
 * // parseSignalTarget("objects.foo.scale")
 * // → { objectId: "foo", property: ["scale"], isUniformScale: true }
 *
 * // parseSignalTarget("objects.foo.scale.x")
 * // → { objectId: "foo", property: ["scale", "x"], isUniformScale: false }
 *
 * // parseSignalTarget("objects.foo.position.y")
 * // → { objectId: "foo", property: ["position", "y"], isUniformScale: false }
 *
 * // parseSignalTarget("objects.foo.material.emissiveIntensity")
 * // → { objectId: "foo", property: ["material", "emissiveIntensity"], isUniformScale: false }
 *
 * // parseSignalTarget("objects.foo.position") → Error: position은 축별 경로만 허용
 * // parseSignalTarget("foo.bar") → Error: objects. 접두사 없음
 */
export function parseSignalTarget(path: string): ParsedTarget {
  // 1) prefix 검증
  if (!path.startsWith("objects.")) {
    throw new Error(
      `[signalPath] 잘못된 경로: "${path}" — "objects." 접두사가 없습니다.`
    );
  }

  // 2) 세그먼트 분해 (첫 세그먼트는 "objects" → 제거)
  const segments = path.split(".");
  // segments[0] = "objects"
  // segments[1] = objectId (kebab 포함 단 dot 없이 표현됨 — 단 kebab의 '-' 은 dot 아님)
  // 주의: objectId 는 kebab-case 이므로 '-' 포함 가능하지만 '.' 없음.

  if (segments.length < 3) {
    throw new Error(
      `[signalPath] 잘못된 경로: "${path}" — objectId 와 속성이 모두 필요합니다.`
    );
  }

  const objectId = segments[1];

  // objectId kebab-case 검증
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(objectId)) {
    throw new Error(
      `[signalPath] 잘못된 objectId: "${objectId}" — kebab-case 패턴(^[a-z0-9][a-z0-9-]*[a-z0-9]$)이어야 합니다.`
    );
  }

  // 속성 세그먼트 (segments[2...])
  const property = segments.slice(2);
  const group = property[0]; // "scale", "position", "rotation", "material", ...

  // 3) position / rotation uniform 불허
  if ((group === "position" || group === "rotation") && property.length === 1) {
    throw new Error(
      `[signalPath] 잘못된 경로: "${path}" — "${group}" 은 uniform 경로를 허용하지 않습니다. 축별 경로를 사용하세요 (예: ${group}.x).`
    );
  }

  // 4) position / rotation 축 검증
  if (group === "position" || group === "rotation") {
    const axis = property[1];
    if (!["x", "y", "z"].includes(axis)) {
      throw new Error(
        `[signalPath] 잘못된 축: "${path}" — "${group}" 은 x, y, z 만 허용합니다. 받은 값: "${axis}"`
      );
    }
  }

  // 5) scale 축 검증 (축별인 경우)
  if (group === "scale" && property.length === 2) {
    const axis = property[1];
    if (!["x", "y", "z"].includes(axis)) {
      throw new Error(
        `[signalPath] 잘못된 축: "${path}" — "scale" 축별 경로는 x, y, z 만 허용합니다. 받은 값: "${axis}"`
      );
    }
  }

  // 6) isUniformScale 판단
  const isUniformScale = group === "scale" && property.length === 1;

  return { objectId, property, isUniformScale };
}

// ============================================================
// isValidSignalTarget — 빠른 boolean 검증
// ============================================================

/**
 * 경로 문자열이 유효한 SignalTarget 인지 확인한다.
 * 예외 대신 boolean 반환.
 */
export function isValidSignalTarget(path: string): boolean {
  try {
    parseSignalTarget(path);
    return true;
  } catch {
    return false;
  }
}
