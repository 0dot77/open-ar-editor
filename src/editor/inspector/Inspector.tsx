import "./Inspector.css";

/**
 * Inspector — 속성 패널 (오른쪽 패널)
 *
 * 선택한 오브젝트의 위치 / 크기 / 기울기 / 미디어 설정을 표시.
 * MVP 2~3 에서 실제 속성 편집 UI 구현 예정.
 *
 * 작가용 용어 사용:
 *   - position → 위치
 *   - scale → 크기
 *   - rotation → 기울기
 */
function Inspector() {
  return (
    <div className="inspector">
      <div className="inspector__header">
        <span className="inspector__title">속성</span>
      </div>

      <div className="inspector__body">
        <div className="inspector__placeholder">
          <p>오브젝트를 선택하면</p>
          <p>여기에 속성이 표시됩니다.</p>
          <span>MVP 2 에서 위치 / 크기 / 기울기 패널 구현 예정</span>
        </div>
      </div>
    </div>
  );
}

export default Inspector;
