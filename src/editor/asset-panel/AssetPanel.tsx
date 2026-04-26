import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useProjectStore } from "@/state/projectStore";
import type { AssetType, Asset } from "@/shared/types";
import "./AssetPanel.css";

// ============================================================
// 타입 설정
// ============================================================

interface AssetTypeOption {
  value: AssetType;
  label: string;
  extensions: string[];
  filterName: string;
}

const ASSET_TYPE_OPTIONS: AssetTypeOption[] = [
  { value: "target",  label: "이미지 타깃 (.mind)",  extensions: ["mind"], filterName: "MindAR 타깃 파일 (.mind)" },
  { value: "model",   label: "3D 모델",      extensions: ["glb", "gltf"],         filterName: "3D 모델 (GLB)" },
  { value: "image",   label: "이미지",        extensions: ["png", "jpg", "jpeg", "webp"], filterName: "이미지" },
  { value: "video",   label: "영상",          extensions: ["mp4", "webm"],         filterName: "영상" },
  { value: "audio",   label: "사운드",        extensions: ["mp3", "wav", "ogg"],   filterName: "사운드" },
];

/** 파일 크기를 사람이 읽기 쉬운 형식으로 변환 */
function formatSize(bytes: number | undefined): string {
  if (bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 에셋 파일명 추출 */
function basename(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() ?? path;
}

/** 타입 아이콘 (텍스트) */
function assetTypeIcon(type: AssetType): string {
  switch (type) {
    case "target": return "[T]";
    case "model":  return "[M]";
    case "image":  return "[I]";
    case "video":  return "[V]";
    case "audio":  return "[A]";
    default:       return "[?]";
  }
}

/** 장면에 추가 가능한 타입인지 확인 (target, audio 는 불가) */
function canAddToScene(type: AssetType): boolean {
  return type === "model" || type === "image" || type === "video";
}

// ============================================================
// AssetPanel 본체
// ============================================================

/**
 * AssetPanel — 에셋 패널
 *
 * 프로젝트 에셋 목록 + 파일 추가 + "장면에 추가" 버튼.
 */
function AssetPanel() {
  const { project, importAsset, addObjectFromAsset } = useProjectStore();

  const [isAdding, setIsAdding] = useState(false);
  const [selectedType, setSelectedType] = useState<AssetType>("model");

  const assets: Asset[] = project?.assets ?? [];

  const handleAddAsset = async () => {
    if (!project) {
      alert("먼저 프로젝트를 열거나 새로 만들어주세요.");
      return;
    }

    const typeOption = ASSET_TYPE_OPTIONS.find((o) => o.value === selectedType)!;

    try {
      const selectedPath = await open({
        // macOS NSOpenPanel 은 등록 안 된 확장자를 회색 처리해 선택을 막는다.
        // .mind 처럼 비표준 확장자도 다이얼로그에서 보일 수 있게 "모든 파일" 옵션을 동봉.
        filters: [
          { name: typeOption.filterName, extensions: typeOption.extensions },
          { name: "모든 파일", extensions: ["*"] },
        ],
        title: `${typeOption.label} 파일 선택`,
      });
      if (!selectedPath || typeof selectedPath !== "string") return;

      setIsAdding(true);
      await importAsset(selectedPath, selectedType);
    } catch (err) {
      alert(`에셋 추가 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddToScene = (asset: Asset) => {
    addObjectFromAsset(asset);
  };

  return (
    <div className="asset-panel">
      {/* 추가 컨트롤 */}
      <div className="asset-panel__toolbar">
        <select
          className="asset-panel__type-select"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as AssetType)}
          disabled={isAdding}
          aria-label="에셋 종류 선택"
        >
          {ASSET_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          className="asset-panel__add-btn"
          onClick={handleAddAsset}
          disabled={isAdding || !project}
          title={!project ? "프로젝트를 먼저 여세요" : "에셋 추가"}
        >
          {isAdding ? "추가 중..." : "에셋 추가"}
        </button>
      </div>

      {/* 에셋 목록 */}
      {assets.length === 0 ? (
        <div className="asset-panel__empty">
          <p className="asset-panel__empty-text">에셋이 없습니다.</p>
          <span className="asset-panel__empty-hint">위 버튼으로 파일을 추가하세요.</span>
        </div>
      ) : (
        <ul className="asset-panel__list">
          {assets.map((asset) => (
            <li key={asset.id} className="asset-panel__item">
              <div className="asset-panel__item-info">
                <span className="asset-panel__item-icon" aria-hidden="true">
                  {assetTypeIcon(asset.type)}
                </span>
                <div className="asset-panel__item-meta">
                  <span className="asset-panel__item-name" title={asset.path}>
                    {basename(asset.path)}
                  </span>
                  {asset.size !== undefined && (
                    <span className="asset-panel__item-size">{formatSize(asset.size)}</span>
                  )}
                </div>
              </div>
              {canAddToScene(asset.type) && (
                <button
                  className="asset-panel__scene-btn"
                  onClick={() => handleAddToScene(asset)}
                  title="장면에 올리기"
                >
                  장면에 올리기
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default AssetPanel;
