import { useState } from "react";
import { useProjectStore } from "@/state/projectStore";
import "./MigrationModal.css";

/**
 * MigrationModal — 구 프로젝트 호환 마이그레이션 모달
 *
 * pendingMigrationPath 가 non-null 일 때만 렌더된다.
 * 사용자가 "Add files" 를 누르면 Rust project_materialize_template 을 호출해
 * 누락된 index.html / custom.js 를 프로젝트 폴더에 채워 넣는다.
 *
 * UI 문구는 모두 영어 (CLAUDE.md Principle 3).
 */
function MigrationModal() {
  const pendingMigrationPath = useProjectStore((s) => s.pendingMigrationPath);
  const runPendingMigration = useProjectStore((s) => s.runPendingMigration);
  const dismissPendingMigration = useProjectStore((s) => s.dismissPendingMigration);

  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (pendingMigrationPath === null) return null;

  const handleAdd = async () => {
    setError(null);
    setIsBusy(true);
    try {
      await runPendingMigration();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsBusy(false);
    }
  };

  const handleDismiss = () => {
    if (isBusy) return;
    dismissPendingMigration();
  };

  return (
    <div className="migration-modal__overlay" onClick={handleDismiss}>
      <div
        className="migration-modal__panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Update project files"
      >
        <div className="migration-modal__header">
          <span className="migration-modal__title">Update project files</span>
        </div>

        <div className="migration-modal__body">
          <p className="migration-modal__text">
            This project predates the new file layout. The editor would like to add{" "}
            <code>index.html</code> and <code>custom.js</code> so you can edit them
            directly inside the project folder.
          </p>
          <p className="migration-modal__text migration-modal__text--muted">
            These files are safe to add and will not change your scene data.
          </p>
          {error && (
            <p className="migration-modal__text" style={{ color: "#e05c5c" }}>
              {error}
            </p>
          )}
        </div>

        <div className="migration-modal__footer">
          <button
            className="migration-modal__btn"
            onClick={handleDismiss}
            disabled={isBusy}
          >
            Not now
          </button>
          <button
            className="migration-modal__btn migration-modal__btn--primary"
            onClick={handleAdd}
            disabled={isBusy}
          >
            {isBusy ? "Adding…" : "Add files"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MigrationModal;
