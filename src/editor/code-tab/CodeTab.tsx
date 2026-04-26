/**
 * CodeTab.tsx — 프로젝트 폴더의 index.html / custom.js 를 Monaco 로 직접 편집.
 *
 * - 화이트리스트 파일만 읽고 쓴다 (Rust file_read / file_write 가 강제).
 * - index.html 의 `<!-- editor:managed-{name} START/END -->` 사이는 에디터 관리 영역
 *   이라는 경고 배너를 보여준다 (차단은 아님).
 * - Cmd/Ctrl+S 는 Monaco 내부에서 가로채 활성 파일만 저장한다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditorNs } from "monaco-editor";
import { openPath } from "@tauri-apps/plugin-opener";
import { useProjectStore } from "@/state/projectStore";
import { fileApi } from "@/tauri/api";
import "./CodeTab.css";

type FileKey = "index.html" | "custom.js";

const FILES: { key: FileKey; label: string; language: string }[] = [
  { key: "custom.js", label: "custom.js", language: "javascript" },
  { key: "index.html", label: "index.html", language: "html" },
];

interface FileState {
  content: string;
  isDirty: boolean;
  isLoading: boolean;
  /** 파일이 디스크에 존재하지 않거나 읽기 실패 — 저장 비활성. */
  loadError: string | null;
}

const EMPTY_STATE: FileState = {
  content: "",
  isDirty: false,
  isLoading: true,
  loadError: null,
};

/** Build line ranges of `<!-- editor:managed-* START/END -->` blocks (1-indexed, inclusive). */
function buildManagedRanges(source: string): { start: number; end: number }[] {
  const startRe = /<!--\s*editor:managed-([\w-]+)\s+START\s*-->/i;
  const endRe = /<!--\s*editor:managed-([\w-]+)\s+END\s*-->/i;
  const ranges: { start: number; end: number }[] = [];
  const lines = source.split(/\r?\n/);
  const stack: { name: string; start: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const startMatch = line.match(startRe);
    if (startMatch) {
      stack.push({ name: startMatch[1], start: i + 1 });
      continue;
    }
    const endMatch = line.match(endRe);
    if (endMatch) {
      // pop matching name (or last if mismatched)
      const idx = [...stack]
        .reverse()
        .findIndex((s) => s.name === endMatch[1]);
      if (idx === -1) {
        if (stack.length > 0) stack.pop();
      } else {
        const popAt = stack.length - 1 - idx;
        const open = stack.splice(popAt, 1)[0];
        ranges.push({ start: open.start, end: i + 1 });
      }
    }
  }
  return ranges;
}

function CodeTab() {
  const projectPath = useProjectStore((s) => s.projectPath);

  const [activeFile, setActiveFile] = useState<FileKey>("custom.js");
  const [files, setFiles] = useState<Record<FileKey, FileState>>({
    "index.html": { ...EMPTY_STATE },
    "custom.js": { ...EMPTY_STATE },
  });
  const [cursorLine, setCursorLine] = useState<number | null>(null);

  const editorRef = useRef<MonacoEditorNs.IStandaloneCodeEditor | null>(null);

  // ----------------------------------------------------------
  // Load both files when projectPath becomes available / changes.
  // ----------------------------------------------------------
  const loadFile = useCallback(
    async (path: string, key: FileKey) => {
      setFiles((prev) => ({
        ...prev,
        [key]: { ...prev[key], isLoading: true, loadError: null },
      }));
      try {
        const content = await fileApi.read(path, key);
        setFiles((prev) => ({
          ...prev,
          [key]: { content, isDirty: false, isLoading: false, loadError: null },
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setFiles((prev) => ({
          ...prev,
          [key]: {
            content: "",
            isDirty: false,
            isLoading: false,
            loadError: message,
          },
        }));
      }
    },
    [],
  );

  useEffect(() => {
    if (!projectPath) {
      setFiles({
        "index.html": { ...EMPTY_STATE, isLoading: false },
        "custom.js": { ...EMPTY_STATE, isLoading: false },
      });
      return;
    }
    void loadFile(projectPath, "index.html");
    void loadFile(projectPath, "custom.js");
  }, [projectPath, loadFile]);

  // ----------------------------------------------------------
  // Save / Reload handlers.
  // ----------------------------------------------------------
  const saveActive = useCallback(async () => {
    if (!projectPath) return;
    const current = filesRef.current[activeFileRef.current];
    if (!current || current.isLoading || current.loadError) return;
    try {
      await fileApi.write(
        projectPath,
        activeFileRef.current,
        current.content,
      );
      setFiles((prev) => ({
        ...prev,
        [activeFileRef.current]: { ...prev[activeFileRef.current], isDirty: false },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[CodeTab] save failed:", err);
      alert(`Save failed: ${message}`);
    }
  }, [projectPath]);

  const reloadActive = useCallback(async () => {
    if (!projectPath) return;
    const current = filesRef.current[activeFileRef.current];
    if (current?.isDirty) {
      const ok = window.confirm("Discard changes and reload from disk?");
      if (!ok) return;
    }
    await loadFile(projectPath, activeFileRef.current);
  }, [projectPath, loadFile]);

  const onRevealFolder = useCallback(() => {
    if (!projectPath) return;
    openPath(projectPath).catch((e) => console.warn("openPath failed:", e));
  }, [projectPath]);

  // Refs so Monaco's command callback (registered once) sees latest state.
  const activeFileRef = useRef(activeFile);
  const filesRef = useRef(files);
  useEffect(() => {
    activeFileRef.current = activeFile;
  }, [activeFile]);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  // ----------------------------------------------------------
  // Monaco mount: register Cmd/Ctrl+S, hook cursor position events.
  // ----------------------------------------------------------
  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      // Cmd/Ctrl+S → save active file. Prevents browser/window-level handler.
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        void saveActive();
      });
      editor.onDidChangeCursorPosition((e) => {
        setCursorLine(e.position.lineNumber);
      });
      const pos = editor.getPosition();
      if (pos) setCursorLine(pos.lineNumber);
    },
    [saveActive],
  );

  // ----------------------------------------------------------
  // Editor change → update content + dirty.
  // ----------------------------------------------------------
  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value === undefined) return;
      setFiles((prev) => {
        const file = prev[activeFile];
        if (!file) return prev;
        if (file.content === value) return prev;
        return {
          ...prev,
          [activeFile]: { ...file, content: value, isDirty: true },
        };
      });
    },
    [activeFile],
  );

  // ----------------------------------------------------------
  // Sentinel detection for index.html.
  // ----------------------------------------------------------
  const activeState = files[activeFile];
  const managedRanges = useMemo(() => {
    if (activeFile !== "index.html") return [];
    return buildManagedRanges(activeState.content);
  }, [activeFile, activeState.content]);

  const inManagedSection = useMemo(() => {
    if (activeFile !== "index.html") return false;
    if (cursorLine == null) return false;
    return managedRanges.some(
      (r) => cursorLine >= r.start && cursorLine <= r.end,
    );
  }, [activeFile, cursorLine, managedRanges]);

  // ----------------------------------------------------------
  // Switch file: reset cursorLine so banner re-evaluates from new editor model.
  // ----------------------------------------------------------
  const switchFile = useCallback((key: FileKey) => {
    setActiveFile(key);
    setCursorLine(null);
  }, []);

  // ----------------------------------------------------------
  // Render.
  // ----------------------------------------------------------
  if (!projectPath) {
    return (
      <div className="code-tab code-tab--empty">
        <p>Open a project to edit its source files.</p>
      </div>
    );
  }

  const activeMeta = FILES.find((f) => f.key === activeFile)!;
  const saveDisabled =
    activeState.isLoading ||
    !!activeState.loadError ||
    !activeState.isDirty;

  return (
    <div className="code-tab">
      <div className="code-tab__toolbar">
        <div className="code-tab__file-tabs">
          {FILES.map((file) => {
            const state = files[file.key];
            const isActive = file.key === activeFile;
            return (
              <button
                key={file.key}
                className={`code-tab__file-tab${isActive ? " code-tab__file-tab--active" : ""}`}
                onClick={() => switchFile(file.key)}
              >
                <span>{file.label}</span>
                {state.isDirty && <span className="code-tab__dirty">•</span>}
              </button>
            );
          })}
        </div>

        <div className="code-tab__actions">
          <button
            className="code-tab__btn"
            onClick={() => void saveActive()}
            disabled={saveDisabled}
            title="Save (Cmd/Ctrl+S)"
          >
            Save
          </button>
          <button
            className="code-tab__btn"
            onClick={() => void reloadActive()}
            disabled={activeState.isLoading}
          >
            Reload
          </button>
          <button className="code-tab__btn" onClick={onRevealFolder}>
            Open in Finder
          </button>
        </div>
      </div>

      {inManagedSection && (
        <div className="code-tab__warning">
          This area is managed by the editor and may be overwritten on runtime updates. Edit cautiously.
        </div>
      )}

      {activeState.loadError && (
        <div className="code-tab__error">
          Failed to read {activeFile}: {activeState.loadError}
        </div>
      )}

      <div className="code-tab__editor">
        <Editor
          height="100%"
          theme="vs-dark"
          path={activeFile}
          language={activeMeta.language}
          value={activeState.content}
          onChange={handleChange}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            tabSize: 2,
            wordWrap: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
}

export default CodeTab;
