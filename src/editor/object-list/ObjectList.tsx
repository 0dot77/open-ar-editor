import { useProjectStore } from "@/state/projectStore";
import type { SceneObjectType } from "@/shared/types";
import "./ObjectList.css";

// ============================================================
// 타입 아이콘 (이모지 — ObjectList 한 군데만 허용)
// ============================================================

function typeIcon(type: SceneObjectType): string {
  switch (type) {
    case "model":  return "🧊";
    case "image":  return "🖼";
    case "video":  return "🎬";
    case "audio":  return "🔊";
    case "text":   return "💬";
    case "button": return "💬";
  }
}

/**
 * ObjectList — 장면 오브젝트 목록
 *
 * 장면에 있는 모든 오브젝트를 리스트로 표시한다.
 * 클릭하면 선택, 눈 토글로 보이기/숨기기.
 */
function ObjectList() {
  const { project, selectedObjectId, selectObject, updateObject } = useProjectStore();

  const objects = project?.scene.objects ?? [];

  if (objects.length === 0) {
    return (
      <div className="object-list object-list--empty">
        <p className="object-list__empty-text">
          장면에 아무것도 없습니다.
        </p>
        <span className="object-list__empty-hint">
          왼쪽 에셋 패널에서 추가하세요.
        </span>
      </div>
    );
  }

  return (
    <ul className="object-list">
      {objects.map((obj) => {
        const isSelected = obj.id === selectedObjectId;
        return (
          <li
            key={obj.id}
            className={`object-list__item${isSelected ? " object-list__item--selected" : ""}`}
            onClick={() => selectObject(obj.id)}
            title={obj.id}
          >
            {/* 타입 아이콘 */}
            <span className="object-list__icon" aria-hidden="true">
              {typeIcon(obj.type)}
            </span>

            {/* 이름 */}
            <span className="object-list__name">
              {obj.label ?? obj.id}
            </span>

            {/* 가시성 토글 */}
            <button
              className={`object-list__eye-btn${obj.visible ? "" : " object-list__eye-btn--hidden"}`}
              aria-label={obj.visible ? "숨기기" : "보이기"}
              title={obj.visible ? "숨기기" : "보이기"}
              onClick={(e) => {
                e.stopPropagation();
                updateObject(obj.id, { visible: !obj.visible });
              }}
            >
              {obj.visible ? "👁" : "🚫"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default ObjectList;
