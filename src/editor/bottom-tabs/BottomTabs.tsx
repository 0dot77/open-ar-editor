import { useState } from "react";
import NodeGraph from "@/editor/node-graph/NodeGraph";
import "./BottomTabs.css";

type Tab = "interaction" | "signal-binding" | "mobile-log";

const TABS: { id: Tab; label: string }[] = [
  { id: "interaction", label: "인터랙션" },
  { id: "signal-binding", label: "값 연결" },
  { id: "mobile-log", label: "모바일 로그" },
];

/**
 * BottomTabs — 하단 탭 영역
 *
 * 탭:
 *   - 인터랙션 (노드 그래프) — MVP 3 에서 React Flow 연결
 *   - 값 연결 (Signal Binding) — MVP 4 에서 오디오/얼굴 데이터 바인딩 구현
 *   - 모바일 로그 — MVP 1 에서 preview server 연결 예정
 */
function BottomTabs() {
  const [activeTab, setActiveTab] = useState<Tab>("interaction");

  return (
    <div className="bottom-tabs">
      {/* 탭 헤더 */}
      <div className="bottom-tabs__header">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`bottom-tabs__tab${activeTab === tab.id ? " bottom-tabs__tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="bottom-tabs__content">
        {activeTab === "interaction" && <NodeGraph />}

        {activeTab === "signal-binding" && (
          <div className="bottom-tabs__placeholder">
            <p>값 연결</p>
            <span>
              MVP 4 에서 오디오·얼굴·시간 데이터를 오브젝트 속성에 연결하는 Signal Binding 구현 예정
            </span>
          </div>
        )}

        {activeTab === "mobile-log" && (
          <div className="bottom-tabs__placeholder">
            <p>모바일 로그</p>
            <span>MVP 1 에서 preview server 연결 후 모바일 콘솔 로그 표시 예정</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default BottomTabs;
