import { useState } from "react";
import "./LeftPanel.css";

type Tab = "template" | "asset" | "scene";

const TABS: { id: Tab; label: string }[] = [
  { id: "template", label: "템플릿" },
  { id: "asset", label: "에셋" },
  { id: "scene", label: "장면 목록" },
];

/**
 * LeftPanel — 왼쪽 패널
 *
 * 탭: 템플릿 / 에셋 / 장면 목록 (모두 placeholder)
 * MVP 2~3 에서 실제 내용 구현 예정.
 */
function LeftPanel() {
  const [activeTab, setActiveTab] = useState<Tab>("template");

  return (
    <div className="left-panel">
      {/* 탭 헤더 */}
      <div className="left-panel__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`left-panel__tab${activeTab === tab.id ? " left-panel__tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="left-panel__content">
        {activeTab === "template" && (
          <div className="left-panel__placeholder">
            <p>템플릿</p>
            <span>MVP 6 에서 작가용 템플릿 라이브러리 구현 예정</span>
          </div>
        )}
        {activeTab === "asset" && (
          <div className="left-panel__placeholder">
            <p>에셋</p>
            <span>MVP 2 에서 이미지·GLB·영상·사운드 패널 구현 예정</span>
          </div>
        )}
        {activeTab === "scene" && (
          <div className="left-panel__placeholder">
            <p>장면 목록</p>
            <span>MVP 2 에서 장면 관리 구현 예정</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default LeftPanel;
