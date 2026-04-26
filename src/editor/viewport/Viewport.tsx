/**
 * Viewport — R3F Canvas 기반 3D 편집 뷰포트.
 *
 * MVP 2 Wave 2: react-three-fiber 실제 3D 편집 캔버스.
 */

import { Suspense, useCallback, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, useTexture, Grid } from "@react-three/drei";
import { convertFileSrc } from "@tauri-apps/api/core";

import { useProjectStore } from "@/state/projectStore";
import type { SceneObject, Asset } from "@/shared/types";

import { SceneObject3D } from "./SceneObject3D";
import { GizmoControls, GizmoButtons } from "./GizmoControls";
import type { GizmoMode } from "./GizmoControls";

import "./Viewport.css";

// ────────────────────────────────────────────────────────
// 경로 변환 유틸
// ────────────────────────────────────────────────────────

/** Tauri 환경에서 동작 중인지 (`__TAURI_INTERNALS__` 존재 여부로 판단). */
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * asset 경로를 브라우저가 로드할 수 있는 URL 로 변환.
 *
 * Tauri 환경: `convertFileSrc` 로 asset:// 또는 https://asset.localhost URL 생성.
 *   tauri.conf.json 의 `app.security.assetProtocol.scope` 안의 경로만 허용된다.
 * 웹 환경 폴백: file:// URL (vite dev 단독으로 띄워 디버깅할 때만 의미가 있음).
 */
function makeAssetUrl(projectPath: string | null, relative: string): string {
  // 이미 절대 URL 이면 그대로
  if (
    relative.startsWith("http://") ||
    relative.startsWith("https://") ||
    relative.startsWith("blob:") ||
    relative.startsWith("data:")
  ) {
    return relative;
  }
  if (!projectPath) return relative;

  // 절대 경로 조립 (Windows 백슬래시는 슬래시로 통일)
  const normalizedRoot = projectPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedRel = relative.replace(/\\/g, "/").replace(/^\/+/, "");
  const absolute = `${normalizedRoot}/${normalizedRel}`;

  if (isTauri()) {
    return convertFileSrc(absolute);
  }
  return `file:///${absolute}`;
}

/**
 * 에셋 ID 또는 직접 path 를 받아 브라우저 로드 가능한 URL 을 반환한다.
 *
 * `SceneObject.src` 는 스키마상 에셋 ID 참조이므로, 먼저 ID 로 lookup 해
 * `asset.path` 를 얻고 실패 시 입력값을 path 로 간주해 폴백한다
 * (예: `tracking.preview` 처럼 직접 path 가 들어오는 경우 호환).
 */
function useAssetUrl(projectPath: string | null, assets: Asset[]) {
  return useCallback(
    (idOrPath: string) => {
      const asset = assets.find((a) => a.id === idOrPath);
      const relative = asset ? asset.path : idOrPath;
      return makeAssetUrl(projectPath, relative);
    },
    [projectPath, assets]
  );
}

// ────────────────────────────────────────────────────────
// 타깃 이미지 미리보기 plane
// ────────────────────────────────────────────────────────

interface TargetPreviewProps {
  url: string;
}

/** 텍스처 로드 성공 시 렌더 (Suspense 안에서 사용) */
function TargetPreviewWithTexture({ url }: TargetPreviewProps) {
  const texture = useTexture(url);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} transparent />
    </mesh>
  );
}

/** 텍스처 로드 실패 시 단색 플레이스홀더 */
function TargetPreviewFallback() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#6699aa" side={THREE.DoubleSide} opacity={0.5} transparent />
    </mesh>
  );
}

function TargetPreviewPlane({ url }: TargetPreviewProps) {
  return (
    <Suspense fallback={<TargetPreviewFallback />}>
      <TargetPreviewWithTexture url={url} />
    </Suspense>
  );
}

// ────────────────────────────────────────────────────────
// 빈 상태 오버레이
// ────────────────────────────────────────────────────────

function EmptyStateOverlay() {
  return (
    <div className="viewport__empty">
      <div className="viewport__empty-icon">◻</div>
      <p className="viewport__empty-title">프로젝트를 열어주세요</p>
      <span className="viewport__empty-desc">
        상단 메뉴에서 새 프로젝트를 만들거나 기존 프로젝트를 열면 여기에 3D 장면이 표시됩니다.
      </span>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// 3D Scene 내부 (Canvas 안)
// ────────────────────────────────────────────────────────

interface SceneContentProps {
  objects: SceneObject[];
  selectedId: string | null;
  assetUrl: (rel: string) => string;
  targetPreviewUrl: string | null;
  meshMap: React.MutableRefObject<Map<string, THREE.Object3D>>;
  onSelect: (id: string | null) => void;
  onMeshReady: (id: string, mesh: THREE.Object3D | null) => void;
  gizmoMode: GizmoMode;
  onDraggingChange: (dragging: boolean) => void;
  onObjectChange: () => void;
  isDragging: boolean;
}

function SceneContent({
  objects,
  selectedId,
  assetUrl,
  targetPreviewUrl,
  onSelect,
  onMeshReady,
  gizmoMode,
  onDraggingChange,
  onObjectChange,
  isDragging,
  meshMap,
}: SceneContentProps) {
  const selectedMesh = selectedId ? (meshMap.current.get(selectedId) ?? null) : null;

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 1.5, 3]} fov={60} />
      <OrbitControls makeDefault enabled={!isDragging} />

      {/* 조명 */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={0.8} castShadow />

      {/* 그리드 */}
      <Grid
        args={[10, 10]}
        cellColor="#333"
        sectionColor="#555"
        fadeDistance={20}
        position={[0, -0.001, 0]}
      />

      {/* 타깃 이미지 미리보기 (TargetPreviewPlane 내부에서 Suspense 처리) */}
      {targetPreviewUrl && <TargetPreviewPlane url={targetPreviewUrl} />}

      {/* 장면 오브젝트 */}
      {objects.map((obj) => (
        <SceneObject3D
          key={obj.id}
          obj={obj}
          isSelected={obj.id === selectedId}
          onSelect={onSelect}
          assetUrl={assetUrl}
          onMeshReady={onMeshReady}
        />
      ))}

      {/* TransformControls */}
      {selectedMesh && (
        <GizmoControls
          target={selectedMesh}
          mode={gizmoMode}
          onModeChange={() => {}}
          onDraggingChange={onDraggingChange}
          onObjectChange={onObjectChange}
        />
      )}

      {/* 빈 공간 클릭 → 선택 해제 */}
      <mesh
        visible={false}
        scale={[100, 100, 100]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(null);
        }}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial />
      </mesh>
    </>
  );
}

// ────────────────────────────────────────────────────────
// Viewport 루트
// ────────────────────────────────────────────────────────

function Viewport() {
  const { project, projectPath, selectedObjectId, selectObject, updateObject } =
    useProjectStore();

  const [gizmoMode, setGizmoMode] = useState<GizmoMode>("translate");
  const [isDragging, setIsDragging] = useState(false);

  // id → Three.js Object3D 맵
  const meshMap = useRef<Map<string, THREE.Object3D>>(new Map());

  const assetUrl = useAssetUrl(projectPath, project?.assets ?? []);

  // mesh 등록 콜백
  const handleMeshReady = useCallback(
    (id: string, mesh: THREE.Object3D | null) => {
      if (mesh) {
        meshMap.current.set(id, mesh);
      } else {
        meshMap.current.delete(id);
      }
    },
    []
  );

  // 드래그 중 OrbitControls 비활성화
  const handleDraggingChange = useCallback((dragging: boolean) => {
    setIsDragging(dragging);
  }, []);

  // 기즈모 조작 후 오브젝트 transform 업데이트
  const handleObjectChange = useCallback(() => {
    if (!selectedObjectId) return;
    const mesh = meshMap.current.get(selectedObjectId);
    if (!mesh) return;

    // mesh 의 부모(group) 기준 position/rotation/scale 읽기
    const pos = mesh.position.toArray() as [number, number, number];
    const euler = mesh.rotation;
    const rot: [number, number, number] = [euler.x, euler.y, euler.z];
    const scl = mesh.scale.toArray() as [number, number, number];

    updateObject(selectedObjectId, { position: pos, rotation: rot, scale: scl });
  }, [selectedObjectId, updateObject]);

  // 타깃 이미지 미리보기 URL
  const targetPreviewUrl: string | null = (() => {
    if (!project) return null;
    const { tracking } = project;
    if (tracking.type === "image" && tracking.preview) {
      return assetUrl(tracking.preview);
    }
    return null;
  })();

  const hasProject = project !== null;

  return (
    <div className="viewport">
      {/* 빈 상태 안내 */}
      {!hasProject && <EmptyStateOverlay />}

      {/* 기즈모 모드 버튼 (선택 오브젝트가 있을 때만) */}
      <GizmoButtons
        mode={gizmoMode}
        visible={hasProject && selectedObjectId !== null}
        onModeChange={setGizmoMode}
      />

      {/* R3F Canvas */}
      <Canvas
        className="viewport__canvas"
        gl={{ antialias: true }}
        style={{ background: "#1a1a1a" }}
        onPointerMissed={() => selectObject(null)}
      >
        {hasProject && (
          <SceneContent
            objects={project.scene.objects}
            selectedId={selectedObjectId}
            assetUrl={assetUrl}
            targetPreviewUrl={targetPreviewUrl}
            meshMap={meshMap}
            onSelect={(id) => selectObject(id)}
            onMeshReady={handleMeshReady}
            gizmoMode={gizmoMode}
            onDraggingChange={handleDraggingChange}
            onObjectChange={handleObjectChange}
            isDragging={isDragging}
          />
        )}

        {/* 프로젝트 없을 때도 최소 그리드 표시 */}
        {!hasProject && (
          <>
            <PerspectiveCamera makeDefault position={[0, 1.5, 3]} fov={60} />
            <OrbitControls makeDefault />
            <ambientLight intensity={0.4} />
            <Grid
              args={[10, 10]}
              cellColor="#2a2a2a"
              sectionColor="#444"
              fadeDistance={20}
              position={[0, -0.001, 0]}
            />
          </>
        )}
      </Canvas>
    </div>
  );
}

export default Viewport;
