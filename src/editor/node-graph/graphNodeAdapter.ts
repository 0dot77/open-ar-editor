import type { Edge, Node } from "@xyflow/react";
import type { GraphEdge, GraphNode, NodeGraphPosition } from "@/shared/types";
import { getNodeMetaOrThrow, type NodeCategory } from "./nodeCatalog";

/**
 * React Flow 노드의 `data` 페이로드.
 * 우리 GraphNode 를 그대로 들고 다닌다 (직렬화 시 그대로 추출 가능).
 */
export interface GraphNodeData extends Record<string, unknown> {
  graphNode: GraphNode;
  category: NodeCategory;
  label: string;
}

/** React Flow 의 `node.type` 은 카테고리. 커스텀 컴포넌트 매핑에 사용. */
export type FlowNodeType = NodeCategory;
export type GraphFlowNode = Node<GraphNodeData, FlowNodeType>;
export type GraphFlowEdge = Edge;

const DEFAULT_POSITION: NodeGraphPosition = { x: 0, y: 0 };

export function toFlowNode(node: GraphNode): GraphFlowNode {
  const meta = getNodeMetaOrThrow(node.type);
  const position = node.graphPosition ?? DEFAULT_POSITION;
  return {
    id: node.id,
    type: meta.category,
    position: { x: position.x, y: position.y },
    data: {
      graphNode: node,
      category: meta.category,
      label: node.label ?? meta.label,
    },
  };
}

/**
 * React Flow 노드 → GraphNode.
 * position 은 React Flow 가 드래그로 갱신하므로 graphPosition 에 반영.
 */
export function fromFlowNode(flowNode: GraphFlowNode): GraphNode {
  const { graphNode } = flowNode.data;
  return {
    ...graphNode,
    id: flowNode.id,
    graphPosition: { x: flowNode.position.x, y: flowNode.position.y },
  };
}

export function toFlowEdge(edge: GraphEdge): GraphFlowEdge {
  return {
    id: edge.id ?? `${edge.from}->${edge.to}`,
    source: edge.from,
    target: edge.to,
    data: edge.delay !== undefined ? { delay: edge.delay } : undefined,
  };
}

export function fromFlowEdge(flowEdge: GraphFlowEdge): GraphEdge {
  const delay = (flowEdge.data as { delay?: number } | undefined)?.delay;
  return {
    id: flowEdge.id,
    from: flowEdge.source,
    to: flowEdge.target,
    ...(delay !== undefined ? { delay } : {}),
  };
}
