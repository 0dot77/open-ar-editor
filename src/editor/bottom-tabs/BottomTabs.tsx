import { lazy, Suspense, useState } from "react";
import NodeGraph from "@/editor/node-graph/NodeGraph";
import "./BottomTabs.css";

const CodeTab = lazy(() => import("@/editor/code-tab/CodeTab"));

type Tab = "interaction" | "code" | "signal-binding" | "mobile-log";

const TABS: { id: Tab; label: string }[] = [
  { id: "interaction", label: "Interaction" },
  { id: "code", label: "Code" },
  { id: "signal-binding", label: "Signal Binding" },
  { id: "mobile-log", label: "Mobile Log" },
];

function BottomTabs() {
  const [activeTab, setActiveTab] = useState<Tab>("interaction");

  return (
    <div className="bottom-tabs">
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

      <div className="bottom-tabs__content">
        {activeTab === "interaction" && <NodeGraph />}

        {activeTab === "code" && (
          <Suspense
            fallback={
              <div className="bottom-tabs__placeholder">
                <p>Loading editor…</p>
              </div>
            }
          >
            <CodeTab />
          </Suspense>
        )}

        {activeTab === "signal-binding" && (
          <div className="bottom-tabs__placeholder">
            <p>Signal Binding</p>
            <span>
              MVP 4 will wire real-time data (time / target / pointer / face / audio) into object properties.
            </span>
          </div>
        )}

        {activeTab === "mobile-log" && (
          <div className="bottom-tabs__placeholder">
            <p>Mobile Log</p>
            <span>Phone console logs will stream here once the preview server bridge lands.</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default BottomTabs;
