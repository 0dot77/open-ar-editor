import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useProjectStore } from "@/state/projectStore";
import PreviewModal from "@/editor/preview-modal/PreviewModal";
import "./TopBar.css";

/**
 * TopBar — 상단 바
 *
 * 프로젝트명 표시 + 새 프로젝트 / 열기 / 저장 / 모바일 미리보기 / 웹으로 내보내기
 */
function TopBar() {
  const { project, isDirty, newProject, openProject, saveProject, startPreview, exportProject } =
    useProjectStore();

  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  // macOS Tauri WKWebView 는 window.prompt 가 즉시 null 을 반환하므로
  // 새 프로젝트 이름은 별도 입력 모달로 받는다.
  const [pendingParent, setPendingParent] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("새-AR-작품");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pendingParent !== null) {
      // 모달 열릴 때 입력 필드에 포커스 + 전체 선택
      const id = setTimeout(() => {
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
      }, 0);
      return () => clearTimeout(id);
    }
  }, [pendingParent]);

  const handleNew = async () => {
    try {
      const parent = await open({
        directory: true,
        title: "프로젝트를 만들 부모 폴더 선택",
      });
      if (!parent || typeof parent !== "string") return;

      // 입력 모달을 열고 폴더 이름을 받는다.
      setNameInput("새-AR-작품");
      setPendingParent(parent);
    } catch (err) {
      alert(`새 프로젝트 생성 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleConfirmNew = async () => {
    if (pendingParent === null) return;

    // 파일 시스템 안전 문자만 허용
    const name = nameInput.trim().replace(/[\\/:*?"<>|]/g, "-");
    if (!name) {
      alert("프로젝트 이름이 비어 있습니다.");
      return;
    }

    // OS 경로 구분자 자동 선택
    const sep = pendingParent.includes("\\") && !pendingParent.includes("/") ? "\\" : "/";
    const projectPath = `${pendingParent}${pendingParent.endsWith(sep) ? "" : sep}${name}`;

    setIsBusy(true);
    try {
      await newProject(projectPath, name);
      setPendingParent(null);
    } catch (err) {
      alert(`새 프로젝트 생성 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleCancelNew = () => {
    if (isBusy) return;
    setPendingParent(null);
  };

  const handleOpen = async () => {
    try {
      const selectedFile = await open({
        directory: false,
        multiple: false,
        title: "프로젝트 파일 (project.webar.json) 선택",
        filters: [{ name: "Open AR Editor 프로젝트", extensions: ["json"] }],
      });
      if (!selectedFile || typeof selectedFile !== "string") return;

      // 파일의 부모 디렉토리를 프로젝트 루트로 사용
      const lastSep = Math.max(selectedFile.lastIndexOf("/"), selectedFile.lastIndexOf("\\"));
      if (lastSep < 0) {
        alert(`파일 경로에서 폴더를 추출할 수 없습니다: ${selectedFile}`);
        return;
      }
      const projectDir = selectedFile.slice(0, lastSep);

      setIsBusy(true);
      await openProject(projectDir);
    } catch (err) {
      alert(`프로젝트 열기 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsBusy(true);
      await saveProject();
    } catch (err) {
      alert(`저장 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handlePreview = async () => {
    try {
      setIsBusy(true);
      await startPreview();
      setIsPreviewModalOpen(true);
    } catch (err) {
      alert(`미리보기 시작 실패:\n${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleExport = async () => {
    try {
      const selectedDir = await open({ directory: true, title: "내보낼 폴더 선택" });
      if (!selectedDir || typeof selectedDir !== "string") return;
      setIsBusy(true);
      await exportProject(selectedDir);
      alert("웹 사이트 내보내기가 완료되었습니다.");
    } catch (err) {
      alert(`내보내기 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsBusy(false);
    }
  };

  const canSave = project !== null && isDirty && !isBusy;

  return (
    <>
      {/* 프로젝트명 */}
      <span className="top-bar__project-name">
        {project?.metadata.title ?? "프로젝트 없음"}
        {isDirty && <span className="top-bar__dirty-dot" title="저장되지 않은 변경사항">•</span>}
      </span>

      <div className="top-bar__spacer" />

      {/* 새 프로젝트 */}
      <button className="top-bar__btn" onClick={handleNew} disabled={isBusy}>
        새 프로젝트
      </button>

      {/* 열기 */}
      <button className="top-bar__btn" onClick={handleOpen} disabled={isBusy}>
        열기
      </button>

      {/* 저장 */}
      <button className="top-bar__btn" onClick={handleSave} disabled={!canSave}>
        저장
      </button>

      {/* 모바일 미리보기 */}
      <button
        className="top-bar__btn top-bar__btn--accent"
        onClick={handlePreview}
        disabled={isBusy || project === null}
      >
        모바일 미리보기
      </button>

      {/* Export */}
      <button
        className="top-bar__btn top-bar__btn--primary"
        onClick={handleExport}
        disabled={isBusy || project === null}
      >
        웹으로 내보내기
      </button>

      {/* 미리보기 모달 */}
      {isPreviewModalOpen && (
        <PreviewModal onClose={() => setIsPreviewModalOpen(false)} />
      )}

      {/* 새 프로젝트 이름 입력 모달 (window.prompt 대체) */}
      {pendingParent !== null && (
        <div className="preview-modal__overlay" onClick={handleCancelNew}>
          <div
            className="preview-modal__panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="새 프로젝트 만들기"
          >
            <div className="preview-modal__header">
              <span className="preview-modal__title">새 프로젝트 만들기</span>
              <button
                className="preview-modal__close-btn"
                onClick={handleCancelNew}
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            <div className="preview-modal__body">
              <p className="preview-modal__guide" style={{ marginTop: 0 }}>
                <strong>{pendingParent}</strong> 안에 새 폴더를 만듭니다.
              </p>
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  fontSize: 13,
                  color: "var(--color-text-muted)",
                }}
              >
                폴더 이름
                <input
                  ref={nameInputRef}
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleConfirmNew();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      handleCancelNew();
                    }
                  }}
                  disabled={isBusy}
                  style={{
                    padding: "8px 10px",
                    fontSize: 14,
                    background: "var(--color-bg)",
                    color: "var(--color-text)",
                    border: "1px solid var(--color-panel-border)",
                    borderRadius: 4,
                    outline: "none",
                  }}
                />
              </label>
            </div>

            <div
              className="preview-modal__footer"
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <button
                className="top-bar__btn"
                onClick={handleCancelNew}
                disabled={isBusy}
              >
                취소
              </button>
              <button
                className="top-bar__btn top-bar__btn--primary"
                onClick={handleConfirmNew}
                disabled={isBusy || !nameInput.trim()}
              >
                {isBusy ? "만드는 중..." : "만들기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default TopBar;
