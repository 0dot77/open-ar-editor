import { useState, useEffect } from "react";
import { useProjectStore, useSelectedObject } from "@/state/projectStore";
import type { Vector3, Vector3OrScalar } from "@/shared/types";
import "./Inspector.css";

// ============================================================
// 유틸리티
// ============================================================

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

function toDeg(rad: number): number {
  return parseFloat((rad * RAD_TO_DEG).toFixed(4));
}

function toRad(deg: number): number {
  return deg * DEG_TO_RAD;
}

function toVec3(v: Vector3OrScalar): Vector3 {
  if (typeof v === "number") return [v, v, v];
  return v;
}

// ============================================================
// 숫자 입력 컴포넌트
// ============================================================

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  step?: number;
}

function NumberField({ label, value, onChange, step = 0.01 }: NumberFieldProps) {
  const [localValue, setLocalValue] = useState(String(value));

  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    const parsed = parseFloat(e.target.value);
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  };

  return (
    <label className="inspector__field">
      <span className="inspector__field-label">{label}</span>
      <input
        type="number"
        className="inspector__number-input"
        value={localValue}
        step={step}
        onChange={handleChange}
      />
    </label>
  );
}

// ============================================================
// 벡터3 편집 행 (좌우 / 위아래 / 앞뒤)
// ============================================================

interface Vec3RowProps {
  title: string;
  xLabel?: string;
  yLabel?: string;
  zLabel?: string;
  values: Vector3;
  onChange: (v: Vector3) => void;
  step?: number;
}

function Vec3Row({
  title,
  xLabel = "좌우 (X)",
  yLabel = "위아래 (Y)",
  zLabel = "앞뒤 (Z)",
  values,
  onChange,
  step,
}: Vec3RowProps) {
  return (
    <div className="inspector__section">
      <span className="inspector__section-title">{title}</span>
      <div className="inspector__vec3">
        <NumberField label={xLabel} value={values[0]} onChange={(v) => onChange([v, values[1], values[2]])} step={step} />
        <NumberField label={yLabel} value={values[1]} onChange={(v) => onChange([values[0], v, values[2]])} step={step} />
        <NumberField label={zLabel} value={values[2]} onChange={(v) => onChange([values[0], values[1], v])} step={step} />
      </div>
    </div>
  );
}

// ============================================================
// Inspector 본체
// ============================================================

/**
 * Inspector — 속성 패널
 *
 * 작가용 용어:
 *   position → 위치 (좌우 / 위아래 / 앞뒤)
 *   rotation → 기울기 (도 단위)
 *   scale    → 크기 (균일 크기 체크박스)
 *   visible  → 보이기
 */
function Inspector() {
  const selectedObject = useSelectedObject();
  const { updateObject } = useProjectStore();

  const [uniformScale, setUniformScale] = useState(false);

  if (!selectedObject) {
    return (
      <div className="inspector">
        <div className="inspector__header">
          <span className="inspector__title">속성</span>
        </div>
        <div className="inspector__body">
          <div className="inspector__placeholder">
            <p>선택된 오브젝트 없음</p>
            <span>뷰포트 또는 장면 목록에서 오브젝트를 선택하세요.</span>
          </div>
        </div>
      </div>
    );
  }

  const obj = selectedObject;
  const pos: Vector3 = obj.position;
  const rot: Vector3 = obj.rotation;
  const scl: Vector3 = toVec3(obj.scale);

  // 라디안 → 도 변환된 rotation
  const rotDeg: Vector3 = [toDeg(rot[0]), toDeg(rot[1]), toDeg(rot[2])];

  const handlePosition = (v: Vector3) => {
    updateObject(obj.id, { position: v });
  };

  const handleRotation = (degVec: Vector3) => {
    const radVec: Vector3 = [toRad(degVec[0]), toRad(degVec[1]), toRad(degVec[2])];
    updateObject(obj.id, { rotation: radVec });
  };

  const handleScale = (v: Vector3) => {
    updateObject(obj.id, { scale: v });
  };

  const handleScaleX = (x: number) => {
    if (uniformScale) {
      updateObject(obj.id, { scale: [x, x, x] });
    } else {
      updateObject(obj.id, { scale: [x, scl[1], scl[2]] });
    }
  };

  const handleVisible = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateObject(obj.id, { visible: e.target.checked });
  };

  return (
    <div className="inspector">
      <div className="inspector__header">
        <span className="inspector__title">속성</span>
      </div>

      <div className="inspector__body">
        {/* 오브젝트 정보 */}
        <div className="inspector__section">
          <span className="inspector__section-title">오브젝트 정보</span>
          <div className="inspector__info-row">
            <span className="inspector__info-label">ID</span>
            <span className="inspector__info-value">{obj.id}</span>
          </div>
          {obj.label && (
            <div className="inspector__info-row">
              <span className="inspector__info-label">이름</span>
              <span className="inspector__info-value">{obj.label}</span>
            </div>
          )}
          <div className="inspector__info-row">
            <span className="inspector__info-label">종류</span>
            <span className="inspector__info-value">{obj.type}</span>
          </div>
        </div>

        {/* 보이기 */}
        <div className="inspector__section">
          <label className="inspector__checkbox-row">
            <input
              type="checkbox"
              checked={obj.visible}
              onChange={handleVisible}
              className="inspector__checkbox"
            />
            <span className="inspector__checkbox-label">보이기</span>
          </label>
        </div>

        {/* 위치 */}
        <Vec3Row
          title="위치"
          values={pos}
          onChange={handlePosition}
          step={0.01}
        />

        {/* 기울기 (도) */}
        <Vec3Row
          title="기울기 (도)"
          xLabel="좌우 (X)"
          yLabel="위아래 (Y)"
          zLabel="앞뒤 (Z)"
          values={rotDeg}
          onChange={handleRotation}
          step={1}
        />

        {/* 크기 */}
        <div className="inspector__section">
          <span className="inspector__section-title">크기 (X / Y / Z)</span>
          <label className="inspector__checkbox-row inspector__uniform-scale">
            <input
              type="checkbox"
              checked={uniformScale}
              onChange={(e) => setUniformScale(e.target.checked)}
              className="inspector__checkbox"
            />
            <span className="inspector__checkbox-label">균일 크기</span>
          </label>
          {uniformScale ? (
            <NumberField
              label="크기"
              value={scl[0]}
              onChange={(v) => handleScale([v, v, v])}
              step={0.01}
            />
          ) : (
            <div className="inspector__vec3">
              <NumberField label="좌우 (X)" value={scl[0]} onChange={handleScaleX} step={0.01} />
              <NumberField label="위아래 (Y)" value={scl[1]} onChange={(v) => handleScale([scl[0], v, scl[2]])} step={0.01} />
              <NumberField label="앞뒤 (Z)" value={scl[2]} onChange={(v) => handleScale([scl[0], scl[1], v])} step={0.01} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Inspector;
