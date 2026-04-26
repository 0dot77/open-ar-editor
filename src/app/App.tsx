import "./App.css";
import TopBar from "@/editor/top-bar/TopBar";
import LeftPanel from "@/editor/left-panel/LeftPanel";
import Viewport from "@/editor/viewport/Viewport";
import Inspector from "@/editor/inspector/Inspector";
import BottomTabs from "@/editor/bottom-tabs/BottomTabs";
import MigrationModal from "@/editor/migration-modal/MigrationModal";

/**
 * App — 에디터 전체 레이아웃 뼈대
 *
 * CSS Grid 기반:
 *   grid-template-columns: 240px 1fr 280px
 *   grid-template-rows: 48px 1fr 220px
 *
 * 에디터 로직은 구현하지 않음. 레이아웃 뼈대와 placeholder 컴포넌트만.
 */
function App() {
  return (
    <div className="app-layout">
      {/* 상단 바: 프로젝트명 / 저장 / 모바일 미리보기 / Export */}
      <header className="area-top-bar">
        <TopBar />
      </header>

      {/* 왼쪽 패널: 템플릿 / 에셋 / 장면 목록 */}
      <aside className="area-left-panel">
        <LeftPanel />
      </aside>

      {/* 중앙: 3D 뷰포트 */}
      <main className="area-viewport">
        <Viewport />
      </main>

      {/* 오른쪽: 선택 속성 패널 */}
      <aside className="area-inspector">
        <Inspector />
      </aside>

      {/* 하단 탭: 인터랙션 / 값 연결 / 모바일 로그 */}
      <footer className="area-bottom">
        <BottomTabs />
      </footer>

      {/* 구 프로젝트 호환 마이그레이션 모달 (pendingMigrationPath 가 있을 때만 렌더) */}
      <MigrationModal />
    </div>
  );
}

export default App;
