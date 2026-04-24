/**
 * GizmoControls — TransformControls + 모드 토글 오버레이.
 * Viewport 에서 선택된 오브젝트에 붙임.
 */

import * as THREE from "three";
import { TransformControls } from "@react-three/drei";

export type GizmoMode = "translate" | "rotate" | "scale";

interface GizmoControlsProps {
  target: THREE.Object3D | null;
  mode: GizmoMode;
  onModeChange: (mode: GizmoMode) => void;
  onDraggingChange: (dragging: boolean) => void;
  onObjectChange: () => void;
}

export function GizmoControls({
  target,
  mode,
  onDraggingChange,
  onObjectChange,
}: GizmoControlsProps) {
  if (!target) return null;

  return (
    <TransformControls
      object={target}
      mode={mode}
      onMouseDown={() => onDraggingChange(true)}
      onMouseUp={() => {
        onDraggingChange(false);
        onObjectChange();
      }}
    />
  );
}

// ────────────────────────────────────────────────────────
// 오버레이 버튼 (DOM — Viewport 의 absolute 레이어)
// ────────────────────────────────────────────────────────

interface GizmoButtonsProps {
  mode: GizmoMode;
  visible: boolean;
  onModeChange: (mode: GizmoMode) => void;
}

export function GizmoButtons({ mode, visible, onModeChange }: GizmoButtonsProps) {
  if (!visible) return null;

  const MODES: { key: GizmoMode; label: string }[] = [
    { key: "translate", label: "이동" },
    { key: "rotate", label: "회전" },
    { key: "scale", label: "크기" },
  ];

  return (
    <div className="viewport__gizmo-buttons">
      {MODES.map(({ key, label }) => (
        <button
          key={key}
          className={`viewport__gizmo-btn${mode === key ? " viewport__gizmo-btn--active" : ""}`}
          onClick={() => onModeChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default GizmoControls;
