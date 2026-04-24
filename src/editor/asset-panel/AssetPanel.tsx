import "./AssetPanel.css";

/**
 * AssetPanel — 에셋 패널 placeholder
 *
 * 이미지 / GLB / 영상 / 사운드 파일 목록을 표시.
 * MVP 2 에서 Tauri 파일 시스템 API 와 연결 예정.
 */
function AssetPanel() {
  return (
    <div className="asset-panel">
      <div className="asset-panel__placeholder">
        <p>에셋 패널</p>
        <span>MVP 2 에서 이미지·GLB·영상·사운드 파일 관리 구현 예정</span>
      </div>
    </div>
  );
}

export default AssetPanel;
