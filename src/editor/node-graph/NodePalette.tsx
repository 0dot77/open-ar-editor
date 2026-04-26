import type { DragEvent } from "react";
import type { GraphNodeType } from "@/shared/types";
import { NODE_CATALOG, type NodeCategory } from "./nodeCatalog";
import { clearPendingDragNode, setPendingDragNode } from "./nodeDragChannel";

const CATEGORY_TITLES: Record<NodeCategory, string> = {
  trigger: "Trigger",
  action: "Action",
  data: "Data (preview)",
};

const CATEGORY_HINTS: Record<NodeCategory, string> = {
  trigger: "When this happens",
  action: "Do this",
  data: "Wired to properties in MVP 4",
};

const CATEGORY_ORDER: NodeCategory[] = ["trigger", "action", "data"];

function NodePalette() {
  const onDragStart = (e: DragEvent<HTMLDivElement>, type: GraphNodeType) => {
    setPendingDragNode(type);
    // dataTransfer 는 cursor 표시용으로만 setData (실제 데이터는 모듈 채널로 전달).
    e.dataTransfer.setData("text/plain", type);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragEnd = () => {
    // 드롭 안 되고 끝나면 pending 정리
    clearPendingDragNode();
  };

  return (
    <aside className="node-palette">
      {CATEGORY_ORDER.map((category) => {
        const items = NODE_CATALOG.filter(
          (e) => e.category === category && e.enabled,
        );
        if (items.length === 0) return null;
        return (
          <section key={category} className="node-palette__group">
            <header className="node-palette__group-title">
              <span>{CATEGORY_TITLES[category]}</span>
              <small>{CATEGORY_HINTS[category]}</small>
            </header>
            <div className="node-palette__items">
              {items.map((entry) => (
                <div
                  key={entry.type}
                  className={`node-palette__item node-palette__item--${entry.category}`}
                  draggable
                  onDragStart={(e) => onDragStart(e, entry.type)}
                  onDragEnd={onDragEnd}
                  title={entry.description}
                >
                  {entry.label}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </aside>
  );
}

export default NodePalette;
