import "./TopBar.css";

/**
 * TopBar — 상단 바
 *
 * 프로젝트명 / 저장 / 모바일 미리보기 / Export 버튼
 * MVP 1.5: onClick 은 console.log 만. 실제 기능은 이후 에이전트에서 구현 예정.
 */
function TopBar() {
  const handleSave = () => {
    console.log("[TopBar] 저장 클릭");
  };

  const handlePreview = () => {
    console.log("[TopBar] 모바일 미리보기 클릭");
  };

  const handleExport = () => {
    console.log("[TopBar] Export 클릭");
  };

  return (
    <>
      {/* 프로젝트명 */}
      <span className="top-bar__project-name">새 프로젝트</span>

      <div className="top-bar__spacer" />

      {/* 저장 */}
      <button className="top-bar__btn" onClick={handleSave}>
        저장
      </button>

      {/* 모바일 미리보기 */}
      <button className="top-bar__btn top-bar__btn--accent" onClick={handlePreview}>
        모바일 미리보기
      </button>

      {/* Export */}
      <button className="top-bar__btn top-bar__btn--primary" onClick={handleExport}>
        웹으로 내보내기
      </button>
    </>
  );
}

export default TopBar;
