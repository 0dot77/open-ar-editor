import { useState } from "react";
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

  const handleNew = async () => {
    try {
      const selectedPath = await open({ directory: true, title: "새 프로젝트 폴더 선택" });
      if (!selectedPath || typeof selectedPath !== "string") return;
      const title = window.prompt("프로젝트 제목을 입력하세요", "새 AR 작품");
      if (!title) return;
      setIsBusy(true);
      await newProject(selectedPath, title);
    } catch (err) {
      alert(`새 프로젝트 생성 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleOpen = async () => {
    try {
      const selectedPath = await open({ directory: true, title: "프로젝트 폴더 열기" });
      if (!selectedPath || typeof selectedPath !== "string") return;
      setIsBusy(true);
      await openProject(selectedPath);
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
    </>
  );
}

export default TopBar;
