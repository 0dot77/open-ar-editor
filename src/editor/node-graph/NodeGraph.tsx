import { useCallback, useMemo } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type IsValidConnection,
  type OnConnect,
  type OnSelectionChangeFunc,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Graph } from "@/shared/types";
import { useProjectStore } from "@/state/projectStore";
import GraphNodeView from "./GraphNodeView";
import NodePalette from "./NodePalette";
import { consumePendingDragNode } from "./nodeDragChannel";
import {
  fromFlowEdge,
  fromFlowNode,
  toFlowEdge,
  toFlowNode,
  type GraphFlowEdge,
  type GraphFlowNode,
} from "./graphNodeAdapter";
import { createGraphNode } from "./nodeFactory";
import "./NodeGraph.css";

/**
 * NodeGraphCanvas — React Flow 의 useNodesState/useEdgesState 로 view state 관리.
 * meaningful 이벤트 (drop / connect / drag stop / delete) 시점에만 store 의 graph 와 동기화.
 *
 * 왜 controlled (nodes prop) 가 아닌가:
 *   React Flow 가 내부적으로 dimensions / select 같은 transient change 를 발화하는데,
 *   이를 그대로 store 에 쓰면 store → render → flow → onNodesChange → store 루프가
 *   생겨 race 로 새 노드가 사라진다. 표준 권장 패턴 (uncontrolled + 명시적 sync) 적용.
 *
 * 프로젝트 변경 시 fresh state: 외부 NodeGraph 가 ReactFlowProvider 를 projectPath 로 key.
 */
function NodeGraphCanvas() {
  const graph = useProjectStore((s) => s.graph);
  const setGraph = useProjectStore((s) => s.setGraph);
  const selectGraphNode = useProjectStore((s) => s.selectGraphNode);

  const initialNodes = useMemo<GraphFlowNode[]>(
    () => (graph?.nodes ?? []).map(toFlowNode),
    // 한 번만 (key remount 가 프로젝트 변경 처리)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const initialEdges = useMemo<GraphFlowEdge[]>(
    () => (graph?.edges ?? []).map(toFlowEdge),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<GraphFlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<GraphFlowEdge>(initialEdges);

  const nodeTypes = useMemo(
    () => ({ trigger: GraphNodeView, action: GraphNodeView, data: GraphNodeView }),
    [],
  );

  const { screenToFlowPosition, getNode, getNodes, getEdges } =
    useReactFlow<GraphFlowNode, GraphFlowEdge>();

  /** React Flow 내부 state → store 의 graph 로 한 번에 직렬화. */
  const syncToStore = useCallback(() => {
    const current = useProjectStore.getState().graph;
    if (!current) return;
    const nextNodes = getNodes().map(fromFlowNode);
    const nextEdges = getEdges().map(fromFlowEdge);
    const updated: Graph = { ...current, nodes: nextNodes, edges: nextEdges };
    setGraph(updated);
  }, [getNodes, getEdges, setGraph]);

  /**
   * 연결 가능성 규칙 (MVP 3):
   *   - 트리거 → 동작:  ✓
   *   - 동작 → 동작:    ✓ (체이닝)
   *   - 데이터 → 무엇:  ✗ (MVP 4 Signal Binding 에서 활성)
   *   - 자기 자신:      ✗
   */
  const isValidConnection = useCallback<IsValidConnection<Edge>>(
    (conn) => {
      if (!conn.source || !conn.target || conn.source === conn.target) return false;
      const source = getNode(conn.source);
      const target = getNode(conn.target);
      if (!source || !target) return false;
      const sourceCategory = source.data.category;
      const targetCategory = target.data.category;
      if (sourceCategory === "data") return false;
      if (targetCategory !== "action") return false;
      return true;
    },
    [getNode],
  );

  const onConnect = useCallback<OnConnect>(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
      // 다음 tick 에 sync (setEdges 가 비동기이므로 마이크로태스크로 연기)
      queueMicrotask(syncToStore);
    },
    [setEdges, syncToStore],
  );

  const onNodeDragStop = useCallback(() => {
    syncToStore();
  }, [syncToStore]);

  const onNodesDelete = useCallback(() => {
    queueMicrotask(syncToStore);
  }, [syncToStore]);

  const onEdgesDelete = useCallback(() => {
    queueMicrotask(syncToStore);
  }, [syncToStore]);

  const onSelectionChange = useCallback<OnSelectionChangeFunc>(
    ({ nodes: selected }) => {
      selectGraphNode(selected[0]?.id ?? null);
    },
    [selectGraphNode],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const nodeType = consumePendingDragNode();
      if (!nodeType) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const graphNode = createGraphNode(nodeType, position);
      setNodes((nds) => [...nds, toFlowNode(graphNode)]);
      queueMicrotask(syncToStore);
    },
    [screenToFlowPosition, setNodes, syncToStore],
  );

  if (!graph) {
    return (
      <div className="node-graph node-graph--empty">
        <div className="node-graph__empty-message">
          <p>No project open</p>
          <span>Create or open a project to edit the event graph.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="node-graph">
      <NodePalette />
      <div
        className="node-graph__canvas"
        onDragOverCapture={onDragOver}
        onDropCapture={onDrop}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          isValidConnection={isValidConnection}
          nodeTypes={nodeTypes}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>
    </div>
  );
}

function NodeGraph() {
  // projectPath 가 바뀌면 NodeGraphCanvas 를 통째로 remount → React Flow 내부 state 가
  // 새 프로젝트의 graph 로 초기화됨. (useNodesState 는 initial value 만 본다)
  const projectPath = useProjectStore((s) => s.projectPath);
  return (
    <ReactFlowProvider>
      <NodeGraphCanvas key={projectPath ?? "empty"} />
    </ReactFlowProvider>
  );
}

export default NodeGraph;
