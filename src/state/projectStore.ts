/**
 * projectStore.ts — Zustand 기반 프로젝트 전역 상태.
 *
 * 실제 Tauri 파일 시스템 호출은 src/tauri/api.ts 를 통해서만 수행한다.
 * 현재 모든 action 은 stub 상태이며 TODO 주석으로 구현 위치를 표시한다.
 */

import { create } from "zustand";
import type { Project, SceneObject, Asset, AssetType } from "@/shared/types";
import { projectApi, assetApi } from "@/tauri/api";
import { newId } from "@/shared/ids";
import { injectSchemaVersion } from "@/shared/schemaVersion";

// ============================================================
// 상태 인터페이스
// ============================================================

interface ProjectState {
  /** 현재 열린 프로젝트 디렉토리 경로 (미열림 시 null) */
  projectPath: string | null;

  /** 현재 프로젝트 데이터 (미열림 시 null) */
  project: Project | null;

  /** 뷰포트에서 선택된 오브젝트 ID (없으면 null) */
  selectedObjectId: string | null;

  /** 마지막 저장 이후 변경이 있으면 true */
  isDirty: boolean;

  // --- 프로젝트 수준 액션 ---

  /** 새 프로젝트를 생성하고 지정 경로에 저장한다. */
  newProject: (path: string, title: string) => Promise<void>;

  /** 기존 프로젝트 폴더를 열어 상태를 로드한다. */
  openProject: (path: string) => Promise<void>;

  /** 현재 프로젝트를 저장한다. */
  saveProject: () => Promise<void>;

  /** 에셋을 프로젝트에 추가하고 Asset 메타데이터를 반환한다. */
  importAsset: (sourcePath: string, assetType: AssetType) => Promise<Asset>;

  // --- 오브젝트 수준 액션 ---

  /** 오브젝트를 선택하거나 선택 해제한다 (null 전달 시 해제). */
  selectObject: (id: string | null) => void;

  /** 선택된 오브젝트의 속성을 patch 로 업데이트한다. */
  updateObject: (id: string, patch: Partial<SceneObject>) => void;

  /** 장면에 새 오브젝트를 추가한다. */
  addObject: (obj: SceneObject) => void;

  /** 장면에서 오브젝트를 제거한다. */
  removeObject: (id: string) => void;
}

// ============================================================
// Zustand Store
// ============================================================

export const useProjectStore = create<ProjectState>((set, get) => ({
  // --- 초기 상태 ---
  projectPath: null,
  project: null,
  selectedObjectId: null,
  isDirty: false,

  // ----------------------------------------------------------------
  // newProject
  // Tauri 커맨드: project_new (에이전트 D 구현)
  // ----------------------------------------------------------------
  newProject: async (path: string, title: string) => {
    // TODO: 에이전트 D 가 project_new 커맨드를 구현하면 아래 호출로 교체
    const project = await projectApi.new(path, title);
    set({
      projectPath: path,
      project,
      isDirty: false,
      selectedObjectId: null,
    });
  },

  // ----------------------------------------------------------------
  // openProject
  // Tauri 커맨드: project_open (에이전트 D 구현)
  // ----------------------------------------------------------------
  openProject: async (path: string) => {
    // TODO: 에이전트 D 가 project_open 커맨드를 구현하면 아래 호출로 교체
    const project = await projectApi.open(path);
    set({
      projectPath: path,
      project,
      isDirty: false,
      selectedObjectId: null,
    });
  },

  // ----------------------------------------------------------------
  // saveProject
  // Tauri 커맨드: project_save (에이전트 D 구현)
  // ----------------------------------------------------------------
  saveProject: async () => {
    const { projectPath, project } = get();
    if (!projectPath || !project) {
      // TODO: 저장 전 유효성 검사 에러 처리
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
    set({ project: updated, isDirty: false });
  },

  // ----------------------------------------------------------------
  // importAsset
  // Tauri 커맨드: asset_import (에이전트 D 구현)
  // ----------------------------------------------------------------
  importAsset: async (sourcePath: string, assetType: AssetType): Promise<Asset> => {
    const { projectPath, project } = get();
    if (!projectPath || !project) {
      throw new Error("[projectStore] 프로젝트가 열려 있지 않습니다.");
    }
    // TODO: 에이전트 D 가 asset_import 커맨드를 구현하면 아래 호출로 교체
    const asset = await assetApi.import(projectPath, sourcePath, assetType);
    set((state) => ({
      project: state.project
        ? { ...state.project, assets: [...state.project.assets, asset] }
        : null,
      isDirty: true,
    }));
    return asset;
  },

  // ----------------------------------------------------------------
  // selectObject — 순수 UI 상태, Tauri 호출 없음
  // ----------------------------------------------------------------
  selectObject: (id: string | null) => {
    set({ selectedObjectId: id });
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
