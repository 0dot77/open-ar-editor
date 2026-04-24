import "./Viewport.css";

/**
 * Viewport — 3D 뷰포트 / 타깃 이미지 미리보기 placeholder
 *
 * MVP 2 에서 Three.js / React Three Fiber 연결 예정.
 * MVP 2 에서 MindAR 이미지 타깃 미리보기 연결 예정.
 */
function Viewport() {
  return (
    <div className="viewport">
      <div className="viewport__placeholder">
        <div className="viewport__icon">◻</div>
        <p className="viewport__title">3D 뷰포트</p>
        <span className="viewport__desc">
          MVP 2 에서 Three.js / React Three Fiber 연결 예정
        </span>
      </div>
    </div>
  );
}

export default Viewport;
