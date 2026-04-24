// open-ar-editor — 프로젝트 CRUD 커맨드
//
// project_new  : 새 프로젝트 폴더 + 초기 파일 생성
// project_open : 기존 project.webar.json 파싱
// project_save : project.webar.json 덮어쓰기 (updatedAt 서버 side 결정)

use crate::models::{Project, ProjectMetadata, Scene, Tracking};
use chrono::Utc;
use std::path::Path;

const SCHEMA_VERSION: &str = "0.1.0";

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

fn write_json_pretty<T: serde::Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let json = serde_json::to_string_pretty(value)
        .map_err(|e| format!("JSON 직렬화 실패: {e}"))?;
    std::fs::write(path, json).map_err(|e| format!("파일 쓰기 실패 ({}): {e}", path.display()))
}

fn read_project_file(project_dir: &Path) -> Result<Project, String> {
    let json_path = project_dir.join("project.webar.json");
    let content = std::fs::read_to_string(&json_path)
        .map_err(|e| format!("project.webar.json 을 읽을 수 없습니다: {e}"))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("project.webar.json 파싱 오류: {e}"))
}

/// schemaVersion 호환성 검사 — MAJOR 버전 일치 필요
fn check_schema_version(version: &str) -> Result<(), String> {
    let current_major: u64 = SCHEMA_VERSION
        .split('.')
        .next()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    let file_major: u64 = version
        .split('.')
        .next()
        .and_then(|s| s.parse().ok())
        .ok_or_else(|| format!("스키마 버전 형식이 올바르지 않습니다: {version}"))?;

    if file_major != current_major {
        return Err(format!(
            "스키마 버전이 호환되지 않습니다. 현재 에디터는 MAJOR {current_major}를 지원하지만, 파일의 MAJOR 버전은 {file_major}입니다."
        ));
    }
    Ok(())
}

// ── Tauri 커맨드 ──────────────────────────────────────────────────────────────

/// 새 프로젝트를 생성하고 초기화된 Project 를 반환한다.
///
/// `path` 가 존재하지 않으면 디렉토리를 생성한다.
/// 이미 `project.webar.json` 이 있으면 에러를 반환한다.
#[tauri::command]
pub fn project_new(path: String, title: String) -> Result<Project, String> {
    let project_dir = Path::new(&path);

    // 디렉토리 생성 (없으면)
    if !project_dir.exists() {
        std::fs::create_dir_all(project_dir)
            .map_err(|e| format!("프로젝트 폴더를 만들 수 없습니다: {e}"))?;
    }

    // 이미 프로젝트가 있으면 거부
    let project_json_path = project_dir.join("project.webar.json");
    if project_json_path.exists() {
        return Err("이미 project.webar.json 이 존재합니다. 다른 폴더를 선택하거나 project_open 을 사용하세요.".to_string());
    }

    // 내부 디렉토리 구조 생성
    let subdirs = [
        "assets/targets",
        "assets/models",
        "assets/images",
        "assets/videos",
        "assets/audio",
        "exports",
    ];
    for subdir in &subdirs {
        std::fs::create_dir_all(project_dir.join(subdir))
            .map_err(|e| format!("서브폴더 생성 실패 ({subdir}): {e}"))?;
    }

    let now = Utc::now().to_rfc3339();

    // project.webar.json 초기 내용
    let project = Project {
        schema_version: SCHEMA_VERSION.to_string(),
        metadata: ProjectMetadata {
            title: title.clone(),
            artist: String::new(),
            description: None,
            created_at: now.clone(),
            updated_at: now.clone(),
            keywords: None,
        },
        tracking: Tracking {
            tracking_type: "image".to_string(),
            target: Some(String::new()),
            preview: Some(String::new()),
        },
        scene: Scene {
            background: "camera".to_string(),
            background_color: None,
            units: "meters".to_string(),
            objects: vec![],
        },
        assets: vec![],
        exports: None,
    };

    write_json_pretty(&project_json_path, &project)?;

    // graph.webar.json — 빈 노드 그래프
    let graph_json = serde_json::json!({
        "schemaVersion": SCHEMA_VERSION,
        "nodes": [],
        "edges": []
    });
    write_json_pretty(&project_dir.join("graph.webar.json"), &graph_json)?;

    // bindings.webar.json — 빈 Signal Binding
    let bindings_json = serde_json::json!({
        "schemaVersion": SCHEMA_VERSION,
        "bindings": []
    });
    write_json_pretty(&project_dir.join("bindings.webar.json"), &bindings_json)?;

    log::info!("새 프로젝트 생성됨: {:?} (제목: {})", project_dir, title);
    Ok(project)
}

/// 기존 프로젝트를 열고 Project 를 반환한다.
#[tauri::command]
pub fn project_open(path: String) -> Result<Project, String> {
    let project_dir = Path::new(&path);

    if !project_dir.exists() {
        return Err(format!("폴더가 존재하지 않습니다: {path}"));
    }

    let project = read_project_file(project_dir)?;

    // schemaVersion 호환성 검사
    check_schema_version(&project.schema_version)?;

    log::info!("프로젝트 열림: {:?}", project_dir);
    Ok(project)
}

/// 프로젝트를 저장한다.
///
/// updatedAt 은 프론트엔드가 보낸 값을 무시하고 서버 side 현재 시각으로 덮어씀.
#[tauri::command]
pub fn project_save(path: String, project: Project) -> Result<(), String> {
    let project_dir = Path::new(&path);

    if !project_dir.exists() {
        return Err(format!("프로젝트 폴더가 존재하지 않습니다: {path}"));
    }

    // updatedAt 서버 side 결정
    let mut updated = project.clone();
    updated.metadata.updated_at = Utc::now().to_rfc3339();

    let json_path = project_dir.join("project.webar.json");
    write_json_pretty(&json_path, &updated)?;

    log::info!("프로젝트 저장됨: {:?}", project_dir);
    Ok(())
}
