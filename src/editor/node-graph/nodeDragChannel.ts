/**
 * 노드 팔레트 → 캔버스 drag-drop 데이터 채널.
 *
 * 왜 dataTransfer 안 쓰는가:
 *   WKWebView (macOS Tauri) 가 커스텀 MIME 페이로드를 dragover/drop 단계에서
 *   비우거나 노출하지 않는 경우가 있어, 같은 JS 모듈 안에서 변수로 들고 다니는 게
 *   가장 robust. 단일 페이지·단일 프로세스 환경이라 race 가능성 없음.
 */
import type { GraphNodeType } from "@/shared/types";

let pendingType: GraphNodeType | null = null;

export function setPendingDragNode(type: GraphNodeType): void {
  pendingType = type;
}

export function consumePendingDragNode(): GraphNodeType | null {
  const t = pendingType;
  pendingType = null;
  return t;
}

export function clearPendingDragNode(): void {
  pendingType = null;
}
