/**
 * projectStore.ts — Zustand 기반 프로젝트 전역 상태.
 *
 * 실제 Tauri 파일 시스템 호출은 src/tauri/api.ts 를 통해서만 수행한다.
 */

import { create } from "zustand";
import type { Project, SceneObject, Asset, AssetType, TrackingConfig, Graph, GraphNode } from "@/shared/types";
import { projectApi, assetApi, previewApi, exportApi, graphApi, type PreviewInfo, type ExportResult } from "@/tauri/api";
import { newId } from "@/shared/ids";
import { injectSchemaVersion } from "@/shared/schemaVersion";

const EMPTY_GRAPH: Graph = {
  schemaVersion: "0.1.0",
  nodes: [],
  edges: [],
};

// ============================================================
// 상태 인터페이스
// ============================================================

interface ProjectState {
  /** 현재 열린 프로젝트 디렉토리 경로 (미열림 시 null) */
  projectPath: string | null;

  /** 현재 프로젝트 데이터 (미열림 시 null) */
  project: Project | null;

  /** Event Graph (graph.webar.json). 프로젝트가 열려 있으면 항상 객체. */
  graph: Graph | null;

  /** 뷰포트에서 선택된 오브젝트 ID (없으면 null) */
  selectedObjectId: string | null;

  /** 노드 그래프에서 선택된 그래프 노드 ID. selectedObjectId 와 상호 배타. */
  selectedGraphNodeId: string | null;

  /** 마지막 저장 이후 변경이 있으면 true */
  isDirty: boolean;

  // --- preview slice ---
  isPreviewRunning: boolean;
  previewInfo: PreviewInfo | null;

  /**
   * When non-null, the project at this path is missing template files
   * (index.html / custom.js) and the user should be asked to materialize.
   */
  pendingMigrationPath: string | null;

  // --- 프로젝트 수준 액션 ---

  /** 새 프로젝트를 생성하고 지정 경로에 저장한다. */
  newProject: (path: string, title: string) => Promise<void>;

  /** 기존 프로젝트 폴더를 열어 상태를 로드한다. */
  openProject: (path: string) => Promise<void>;

  /** 현재 프로젝트를 저장한다. */
  saveProject: () => Promise<void>;

  /** 에셋을 프로젝트에 추가하고 Asset 메타데이터를 반환한다. */
  importAsset: (sourcePath: string, assetType: AssetType) => Promise<Asset>;

  /** 프로젝트의 tracking 설정을 patch 로 갱신한다. */
  setTracking: (patch: Partial<TrackingConfig>) => void;

  /** Event Graph 전체를 교체. saveProject 호출 전까지 메모리에만 반영. */
  setGraph: (graph: Graph) => void;

  /** 그래프 노드를 patch 로 업데이트. `id` 와 `type` 는 보존. */
  updateGraphNode: (id: string, patch: Partial<GraphNode>) => void;

  /** 그래프 노드를 선택 (null 전달 시 해제). 선택 시 selectedObjectId 는 자동 해제. */
  selectGraphNode: (id: string | null) => void;

  // --- 오브젝트 수준 액션 ---

  /** 오브젝트를 선택하거나 선택 해제한다 (null 전달 시 해제). */
  selectObject: (id: string | null) => void;

  /** 선택된 오브젝트의 속성을 patch 로 업데이트한다. */
  updateObject: (id: string, patch: Partial<SceneObject>) => void;

  /** 장면에 새 오브젝트를 추가한다. */
  addObject: (obj: SceneObject) => void;

  /** 장면에서 오브젝트를 제거한다. */
  removeObject: (id: string) => void;

  // --- preview slice 액션 ---

  /**
   * 미리보기 서버를 시작한다.
   *
   * 내부 흐름:
   * 1. ${projectPath}/.preview-tmp 에 export 시도
   * 2. export 성공 후 previewApi.start(tmpDir) 호출
   * 3. previewInfo, isPreviewRunning 상태 갱신
   *
   * TODO: 향후 Rust 측에 preview_build_and_start 단일 커맨드를 추가해
   *       export + serve 를 원자적으로 처리하고 .preview-tmp 중복 오류를
   *       Rust 레벨에서 자동 처리하도록 개선할 것.
   */
  startPreview: () => Promise<void>;

  /** 실행 중인 미리보기 서버를 중지한다. */
  stopPreview: () => Promise<void>;

  // --- export slice 액션 ---

  /** 프로젝트를 outputDir 에 정적 사이트로 export 한다. */
  exportProject: (outputDir: string) => Promise<ExportResult>;

  // --- migration slice 액션 ---

  /** Confirm and run the template materialization. Idempotent. Clears pendingMigrationPath. */
  runPendingMigration: () => Promise<void>;

  /** Dismiss without migrating (user said "later"). Clears pendingMigrationPath. */
  dismissPendingMigration: () => void;

  // --- scene 편집 액션 ---

  /**
   * 에셋으로부터 기본값을 가진 SceneObject 를 생성해 장면에 추가한다.
   * model / image / video 타입만 지원한다 (target / audio 는 장면 오브젝트 아님).
   */
  addObjectFromAsset: (asset: Asset) => void;
}

// ============================================================
// Zustand Store
// ============================================================

export const useProjectStore = create<ProjectState>((set, get) => ({
  // --- 초기 상태 ---
  projectPath: null,
  project: null,
  graph: null,
  selectedObjectId: null,
  selectedGraphNodeId: null,
  isDirty: false,
  isPreviewRunning: false,
  previewInfo: null,
  pendingMigrationPath: null,

  // ----------------------------------------------------------------
  // newProject
  // Tauri 커맨드: project_new (에이전트 D 구현)
  // ----------------------------------------------------------------
  newProject: async (path: string, title: string) => {
    const project = await projectApi.new(path, title);
    // Rust 의 project_new 가 빈 graph.webar.json 을 동시에 생성하므로 메모리에도 빈 그래프 세팅.
    set({
      projectPath: path,
      project,
      graph: { ...EMPTY_GRAPH },
      isDirty: false,
      selectedObjectId: null,
    });
  },

  // ----------------------------------------------------------------
  // openProject
  // Tauri 커맨드: project_open (에이전트 D 구현)
  // ----------------------------------------------------------------
  openProject: async (path: string) => {
    const project = await projectApi.open(path);
    // graph.webar.json 을 별도 로드. Rust 측 graph_load 가 파일 부재 시 빈 그래프 fallback 반환.
    const graph = await graphApi.load(path);
    set({
      projectPath: path,
      project,
      graph,
      isDirty: false,
      selectedObjectId: null,
    });

    // 구프로젝트 호환: index.html / custom.js 가 없으면 사용자에게 마이그레이션 제안.
    // Rust 커맨드가 아직 등록 안 됐을 수 있으므로 실패해도 openProject 자체는 성공시킨다.
    try {
      const needs = await projectApi.needsTemplateMaterialization(path);
      if (needs) {
        set({ pendingMigrationPath: path });
      }
    } catch (err) {
      console.warn(
        "[projectStore] needsTemplateMaterialization 호출 실패 — 마이그레이션 검사 건너뜀.",
        err,
      );
    }
  },

  // ----------------------------------------------------------------
  // saveProject
  // Tauri 커맨드: project_save (에이전트 D 구현)
  // ----------------------------------------------------------------
  saveProject: async () => {
    const { projectPath, project, graph } = get();
    if (!projectPath || !project) {
      return;
    }
    // updatedAt 갱신 + schemaVersion 재주입
    const updated: Project = injectSchemaVersion({
      ...project,
      metadata: {
        ...project.metadata,
        updatedAt: new Date().toISOString(),
      },
    });
    await projectApi.save(projectPath, updated);
    // graph 도 함께 디스크 동기화 (있을 때만)
    if (graph) {
      await graphApi.save(projectPath, graph);
    }
    set({ project: updated, isDirty: false });
  },

  // ----------------------------------------------------------------
  // importAsset
  //
  // 1. Rust asset_import 호출 → assets/ 로 복사된 Asset 메타데이터 획득
  // 2. project.assets 에 추가
  // 3. 자동 wiring — target 타입이고 image 트래킹의 target 이 비어있으면
  //    그 에셋 path 로 tracking.target 을 채운다. 이후 추가 임포트는
  //    Inspector 에서 사용자가 직접 변경.
  // ----------------------------------------------------------------
  importAsset: async (sourcePath: string, assetType: AssetType): Promise<Asset> => {
    const { projectPath, project } = get();
    if (!projectPath || !project) {
      throw new Error("[projectStore] 프로젝트가 열려 있지 않습니다.");
    }
    const asset = await assetApi.import(projectPath, sourcePath, assetType);

    set((state) => {
      if (!state.project) return {};

      const newAssets = [...state.project.assets, asset];
      let newTracking = state.project.tracking;

      if (
        assetType === "target" &&
        state.project.tracking.type === "image" &&
        !state.project.tracking.target
      ) {
        newTracking = { ...state.project.tracking, target: asset.path };
      }

      return {
        project: {
          ...state.project,
          assets: newAssets,
          tracking: newTracking,
        },
        isDirty: true,
      };
    });

    return asset;
  },

  // ----------------------------------------------------------------
  // setGraph — Event Graph 전체 교체. NodeGraph 가 React Flow 상태 변경 시 호출.
  // 디스크 저장은 saveProject 가 일괄 처리.
  // ----------------------------------------------------------------
  setGraph: (graph: Graph) => {
    set({ graph, isDirty: true });
  },

  updateGraphNode: (id: string, patch: Partial<GraphNode>) => {
    set((state) => {
      if (!state.graph) return {};
      const nodes = state.graph.nodes.map((n) =>
        n.id === id ? ({ ...n, ...patch, id: n.id, type: n.type } as GraphNode) : n,
      );
      return {
        graph: { ...state.graph, nodes },
        isDirty: true,
      };
    });
  },

  selectGraphNode: (id: string | null) => {
    set({
      selectedGraphNodeId: id,
      selectedObjectId: id ? null : useProjectStore.getState().selectedObjectId,
    });
  },

  // ----------------------------------------------------------------
  // setTracking — tracking 설정 patch (Inspector tracking 영역 등에서 사용)
  // ----------------------------------------------------------------
  setTracking: (patch) => {
    set((state) => {
      if (!state.project) return {};
      const merged = {
        ...state.project.tracking,
        ...patch,
      } as TrackingConfig;
      return {
        project: { ...state.project, tracking: merged },
        isDirty: true,
      };
    });
  },

  // ----------------------------------------------------------------
  // selectObject — 순수 UI 상태, Tauri 호출 없음. 그래프 선택 자동 해제.
  // ----------------------------------------------------------------
  selectObject: (id: string | null) => {
    set({
      selectedObjectId: id,
      selectedGraphNodeId: id ? null : get().selectedGraphNodeId,
    });
  },

  // ----------------------------------------------------------------
  // updateObject — 메모리 업데이트. saveProject() 별도 호출 필요.
  // ----------------------------------------------------------------
  updateObject: (id: string, patch: Partial<SceneObject>) => {
    set((state) => {
      if (!state.project) return {};
      const objects = state.project.scene.objects.map((obj) =>
        obj.id === id ? { ...obj, ...patch } : obj
      );
      return {
        project: {
          ...state.project,
          scene: { ...state.project.scene, objects },
        },
        isDirty: true,
      };
    });
  },

  // ----------------------------------------------------------------
  // addObject — ID 는 호출자가 newId() 로 생성해 전달.
  // ----------------------------------------------------------------
  addObject: (obj: SceneObject) => {
    set((state) => {
      if (!state.project) return {};
      return {
        project: {
          ...state.project,
          scene: {
            ...state.project.scene,
            objects: [...state.project.scene.objects, obj],
          },
        },
        isDirty: true,
      };
    });
  },

  // ----------------------------------------------------------------
  // removeObject — 삭제 후 선택 해제
  // ----------------------------------------------------------------
  removeObject: (id: string) => {
    set((state) => {
      if (!state.project) return {};
      const objects = state.project.scene.objects.filter((obj) => obj.id !== id);
      return {
        project: {
          ...state.project,
          scene: { ...state.project.scene, objects },
        },
        isDirty: true,
        selectedObjectId:
          state.selectedObjectId === id ? null : state.selectedObjectId,
      };
    });
  },

  // ----------------------------------------------------------------
  // startPreview
  //
  // 1. 변경 사항이 있으면 먼저 자동 저장 (export 는 디스크의 project.webar.json 읽음)
  // 2. preview_build_and_start 호출 — 내부에서 export → .preview-tmp 정리 → 서빙
  // ----------------------------------------------------------------
  startPreview: async () => {
    const { projectPath, project, isDirty, saveProject } = get();
    if (!projectPath || !project) {
      throw new Error("[미리보기] 프로젝트가 열려 있지 않습니다.");
    }

    if (isDirty) {
      await saveProject();
    }

    const previewInfo = await previewApi.buildAndStart(projectPath);
    set({ previewInfo, isPreviewRunning: true });
  },

  // ----------------------------------------------------------------
  // stopPreview
  // ----------------------------------------------------------------
  stopPreview: async () => {
    await previewApi.stop();
    set({ previewInfo: null, isPreviewRunning: false });
  },

  // ----------------------------------------------------------------
  // exportProject
  //
  // 1. 변경 사항이 있으면 먼저 자동 저장
  // 2. export_project 호출 — Rust 가 exports[] 에 기록을 추가하고 갱신된
  //    project 를 반환하므로, store.project 를 그 값으로 동기화한다.
  // ----------------------------------------------------------------
  exportProject: async (outputDir: string): Promise<ExportResult> => {
    const { projectPath, project, isDirty, saveProject } = get();
    if (!projectPath || !project) {
      throw new Error("[내보내기] 프로젝트가 열려 있지 않습니다.");
    }

    if (isDirty) {
      await saveProject();
    }

    const result = await exportApi.project(projectPath, outputDir);

    // Rust 가 exports[] 추가 + updatedAt 갱신한 최신 project 를 함께 돌려준다.
    if (result.project) {
      set({ project: result.project, isDirty: false });
    }

    return result;
  },

  // ----------------------------------------------------------------
  // runPendingMigration / dismissPendingMigration
  //
  // openProject 가 감지한 누락 템플릿 파일을 사용자가 동의했을 때 채워 넣는다.
  // materializeTemplate 은 Rust 측에서 idempotent 하게 구현되어 있다.
  // ----------------------------------------------------------------
  runPendingMigration: async () => {
    const path = get().pendingMigrationPath;
    if (!path) return;
    await projectApi.materializeTemplate(path);
    set({ pendingMigrationPath: null });
  },

  dismissPendingMigration: () => {
    set({ pendingMigrationPath: null });
  },

  // ----------------------------------------------------------------
  // addObjectFromAsset
  // model / image / video 타입만 장면 오브젝트로 추가한다.
  // target 은 tracking 에서 참조, audio 는 action 쪽에서 처리.
  // ----------------------------------------------------------------
  addObjectFromAsset: (asset: Asset) => {
    const allowedTypes = ["model", "image", "video"] as const;
    type AllowedType = (typeof allowedTypes)[number];

    if (!(allowedTypes as readonly string[]).includes(asset.type)) {
      console.warn(`[addObjectFromAsset] ${asset.type} 타입은 장면에 직접 추가할 수 없습니다.`);
      return;
    }

    const obj: SceneObject = {
      id: newId("obj"),
      type: asset.type as AllowedType,
      src: asset.id,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      visible: true,
    };

    set((state) => {
      if (!state.project) return {};
      return {
        project: {
          ...state.project,
          scene: {
            ...state.project.scene,
            objects: [...state.project.scene.objects, obj],
          },
        },
        isDirty: true,
      };
    });
  },
}));

// ============================================================
// 편의 selector (필요 시 확장)
// ============================================================

/** 현재 선택된 오브젝트를 반환한다. */
export function useSelectedObject(): SceneObject | null {
  const { project, selectedObjectId } = useProjectStore();
  if (!project || !selectedObjectId) return null;
  return project.scene.objects.find((o) => o.id === selectedObjectId) ?? null;
}
