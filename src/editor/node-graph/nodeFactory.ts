import { newId } from "@/shared/ids";
import type { GraphNode, GraphNodeType, NodeGraphPosition } from "@/shared/types";
import { getNodeMetaOrThrow } from "./nodeCatalog";

/**
 * 새 GraphNode 인스턴스 생성.
 * id 는 카테고리 기반 prefix ("trigger" / "action" / "data") 로 부여 — 디버깅 시 노드 종류 식별 용이.
 */
export function createGraphNode(
  type: GraphNodeType,
  position: NodeGraphPosition,
): GraphNode {
  const meta = getNodeMetaOrThrow(type);
  const payload = meta.defaultPayload();
  return {
    ...(payload as GraphNode),
    id: newId(meta.category),
    graphPosition: position,
  };
}
