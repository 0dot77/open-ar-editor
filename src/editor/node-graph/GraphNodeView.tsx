import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { GraphFlowNode } from "./graphNodeAdapter";

/**
 * Shared view for all categories (trigger / action / data).
 *  - trigger: source handle only (emits events)
 *  - action:  target + source handles (chainable)
 *  - data:    source handle only (emits values; visually present in MVP 3, wiring validated later)
 */
function GraphNodeView({ data, selected }: NodeProps<GraphFlowNode>) {
  const { category, label, graphNode } = data;
  const meta = describeMeta(graphNode);
  const className = [
    "graph-node",
    `graph-node--${category}`,
    selected ? "graph-node--selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      {category === "action" && (
        <Handle type="target" position={Position.Left} className="graph-node__handle" />
      )}
      <div className="graph-node__category">{categoryLabel(category)}</div>
      <div className="graph-node__title">{label}</div>
      {meta && <div className="graph-node__meta">{meta}</div>}
      <Handle type="source" position={Position.Right} className="graph-node__handle" />
    </div>
  );
}

function categoryLabel(category: string): string {
  if (category === "trigger") return "Trigger";
  if (category === "action") return "Action";
  if (category === "data") return "Data";
  return category;
}

/** One-line summary of the node's key parameter (objectId / seconds / url / range). */
function describeMeta(node: GraphFlowNode["data"]["graphNode"]): string | undefined {
  if ("objectId" in node && node.objectId) return `target: ${node.objectId}`;
  if (node.type === "event.timeElapsed") return `after ${node.seconds}s`;
  if (node.type === "action.openURL") return node.url;
  if (node.type === "action.sceneChange") return node.sceneId || "no scene";
  if (node.type === "data.time") return `${node.seconds}s`;
  if (node.type === "data.random") {
    const min = node.min ?? 0;
    const max = node.max ?? 1;
    return `${min} ~ ${max}`;
  }
  return undefined;
}

export default GraphNodeView;
