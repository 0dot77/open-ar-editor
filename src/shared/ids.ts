/**
 * ids.ts — ID 생성 및 검증 유틸.
 *
 * 의존성: nanoid ^5.0.0 (package.json 에 추가됨)
 */

import { nanoid } from "nanoid";

// ============================================================
// ID 생성
// ============================================================

/**
 * prefix 기반 kebab-case ID 를 생성한다.
 *
 * 예:
 *   newId("model")  → "model-V1StGXR8Z5jdHi6B"
 *   newId("audio")  → "audio-7eOlkBX4MeN2r1pQ"
 *
 * nanoid 기본 길이: 21자 (충돌 확률 ~1e-30).
 * prefix 포함 전체 길이: prefix.length + 1(hyphen) + 21.
 */
export function newId(prefix: string): string {
  return `${prefix}-${nanoid()}`;
}

// ============================================================
// ID 검증
// ============================================================

/** 스키마 패턴 ^[a-z0-9][a-z0-9-]*[a-z0-9]$ 검증. */
const KEBAB_CASE_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

/**
 * 문자열이 스키마 kebab-case ID 패턴과 일치하는지 확인한다.
 *
 * 유효:   "model-001", "forehead-crown", "a", "abc123"
 * 무효:   "Model-001" (대문자), "-start" (하이픈 시작), "end-" (하이픈 끝), "a b" (공백)
 */
export function isKebabCaseId(s: string): boolean {
  return KEBAB_CASE_PATTERN.test(s);
}
