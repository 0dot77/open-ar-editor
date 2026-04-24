import "./NodeGraph.css";

/**
 * NodeGraph — 인터랙션 노드 그래프 placeholder
 *
 * MVP 3 에서 React Flow 와 연결 예정.
 * 노드 그래프는 "언제 무엇이 일어나는가"를 설계하는 영역.
 *
 * 예시:
 *   [타깃 인식됨] → [3D 모델 보이기] → [사운드 재생]
 */
function NodeGraph() {
  return (
    <div className="node-graph">
      <div className="node-graph__placeholder">
        <p>인터랙션</p>
        <span>MVP 3 에서 React Flow 연결 예정</span>
        <div className="node-graph__example">
          <span className="node-graph__node">타깃 인식됨</span>
          <span className="node-graph__arrow">→</span>
          <span className="node-graph__node">모델 보이기</span>
          <span className="node-graph__arrow">→</span>
          <span className="node-graph__node">사운드 재생</span>
        </div>
      </div>
    </div>
  );
}

export default NodeGraph;
