import { useState } from "react";
import AssetPanel from "@/editor/asset-panel/AssetPanel";
import ObjectList from "@/editor/object-list/ObjectList";
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
 * 탭:
 *  - 템플릿: MVP 6 예정 안내
 *  - 에셋: AssetPanel (에셋 추가 / 장면에 올리기)
 *  - 장면 목록: ObjectList (오브젝트 선택 / 가시성 토글)
 */
function LeftPanel() {
  const [activeTab, setActiveTab] = useState<Tab>("asset");

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
            <span>MVP 6 에서 작가용 템플릿 라이브러리 제공 예정</span>
          </div>
        )}
        {activeTab === "asset" && <AssetPanel />}
        {activeTab === "scene" && <ObjectList />}
      </div>
    </div>
  );
}

export default LeftPanel;
