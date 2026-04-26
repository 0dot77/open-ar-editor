// open-ar-editor — 프로젝트 CRUD 커맨드
//
// project_new  : 새 프로젝트 폴더 + 초기 파일 생성
// project_open : 기존 project.webar.json 파싱
// project_save : project.webar.json 덮어쓰기 (updatedAt 서버 side 결정)

use crate::commands::template;
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
/// `path` 는 새로 만들 프로젝트 루트 폴더 경로다.
/// - 존재하지 않으면 새로 생성한다.
/// - 이미 존재하더라도 **비어 있으면** 재사용한다.
/// - 비어 있지 않으면 사용자 데이터 보호를 위해 거부한다.
#[tauri::command]
pub fn project_new(path: String, title: String) -> Result<Project, String> {
    let project_dir = Path::new(&path);

    if project_dir.exists() {
        // 디렉토리가 비어있는지 검사 (file/symlink 면 거부)
        if !project_dir.is_dir() {
            return Err(format!("경로가 폴더가 아닙니다: {path}"));
        }
        let mut entries = std::fs::read_dir(project_dir)
            .map_err(|e| format!("폴더를 읽을 수 없습니다 ({path}): {e}"))?;
        if entries.next().is_some() {
            return Err(format!(
                "이미 폴더가 존재하고 비어 있지 않습니다: {path}\n다른 이름을 사용하거나, 빈 폴더를 선택하세요."
            ));
        }
    } else {
        std::fs::create_dir_all(project_dir)
            .map_err(|e| format!("프로젝트 폴더를 만들 수 없습니다: {e}"))?;
    }

    // (이중 안전망) project.webar.json 이 이미 있으면 거부
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

    // index.html / custom.js 머터리얼라이즈 — "project-as-site" Phase 1.
    // 작가가 VS Code 등으로 직접 편집할 수 있는 상태로 프로젝트 폴더에 살아 있다.
    // 템플릿(runtime-prototype/index.html) 을 못 찾는 경우 (릴리스 번들 등) 는
    // graceful 하게 skip — project_new 자체는 실패시키지 않는다.
    match template::render_initial_index_html(&title) {
        Ok(html) => {
            let index_path = project_dir.join("index.html");
            if let Err(e) = std::fs::write(&index_path, html) {
                log::warn!("index.html 쓰기 실패 ({}): {e}", index_path.display());
            }
        }
        Err(e) => {
            log::warn!(
                "index.html 머터리얼라이즈 skip — 템플릿을 찾을 수 없습니다: {e}. \
                 추후 project_materialize_template 로 보충 가능."
            );
        }
    }

    let custom_js_path = project_dir.join("custom.js");
    if let Err(e) = std::fs::write(&custom_js_path, template::render_initial_custom_js()) {
        log::warn!("custom.js 쓰기 실패 ({}): {e}", custom_js_path.display());
    }

    log::info!("새 프로젝트 생성됨: {:?} (제목: {})", project_dir, title);
    Ok(project)
}

/// 기존 프로젝트를 열고 Project 를 반환한다.
///
/// `path` 는 프로젝트 루트 폴더 또는 그 안의 `project.webar.json` 파일 경로 어느 쪽이든 받는다.
/// 파일이 전달되면 부모 디렉토리를 프로젝트 루트로 사용한다.
#[tauri::command]
pub fn project_open(path: String) -> Result<Project, String> {
    let raw = Path::new(&path);

    if !raw.exists() {
        return Err(format!("경로가 존재하지 않습니다: {path}"));
    }

    // 파일이면 부모 디렉토리를 루트로 사용
    let project_dir = if raw.is_file() {
        raw.parent()
            .ok_or_else(|| format!("부모 폴더를 찾을 수 없습니다: {path}"))?
    } else {
        raw
    };

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

// ── "project-as-site" 머터리얼라이즈 마이그레이션 ──────────────────────────────
//
// project_new 가 도입되기 전에 만들어진 프로젝트는 index.html / custom.js 가
// 폴더에 없을 수 있다. 프론트엔드가 project_open 직후 needs 를 체크하고,
// 필요 시 사용자에게 "이 프로젝트를 site 화 할까요?" 를 묻고 머터리얼라이즈한다.

/// 프로젝트 폴더에 index.html 또는 custom.js 가 없으면 true.
///
/// 둘 중 하나라도 빠져 있으면 머터리얼라이즈 후보로 본다.
#[tauri::command]
pub fn project_needs_template_materialization(project_path: String) -> Result<bool, String> {
    let project_dir = Path::new(&project_path);
    if !project_dir.is_dir() {
        return Err(format!("프로젝트 폴더가 아닙니다: {project_path}"));
    }

    let index_missing = !project_dir.join("index.html").exists();
    let custom_missing = !project_dir.join("custom.js").exists();
    Ok(index_missing || custom_missing)
}

/// 빠진 index.html / custom.js 를 채워 넣는다.
///
/// - 이미 존재하는 파일은 절대 덮어쓰지 않는다 (사용자 편집 보호).
/// - 템플릿 (runtime-prototype/index.html) 을 못 찾으면 index.html 만 skip 하고
///   custom.js 는 가능한 한 생성한다.
/// - title 은 project.webar.json 에서 읽어온다. 실패 시 "open-ar-editor" 로 fallback.
#[tauri::command]
pub fn project_materialize_template(project_path: String) -> Result<(), String> {
    let project_dir = Path::new(&project_path);
    if !project_dir.is_dir() {
        return Err(format!("프로젝트 폴더가 아닙니다: {project_path}"));
    }

    // 제목 결정 — project.webar.json 에서 읽되, 못 읽으면 fallback.
    let title = match read_project_file(project_dir) {
        Ok(p) => {
            let t = p.metadata.title.trim().to_string();
            if t.is_empty() { "open-ar-editor".to_string() } else { t }
        }
        Err(e) => {
            log::warn!(
                "project.webar.json 을 읽지 못해 기본 제목으로 머터리얼라이즈합니다: {e}"
            );
            "open-ar-editor".to_string()
        }
    };

    let index_path = project_dir.join("index.html");
    if !index_path.exists() {
        match template::render_initial_index_html(&title) {
            Ok(html) => {
                std::fs::write(&index_path, html).map_err(|e| {
                    format!("index.html 쓰기 실패 ({}): {e}", index_path.display())
                })?;
                log::info!("index.html 머터리얼라이즈됨: {}", index_path.display());
            }
            Err(e) => {
                log::warn!("index.html 머터리얼라이즈 skip — 템플릿 부재: {e}");
            }
        }
    }

    let custom_js_path = project_dir.join("custom.js");
    if !custom_js_path.exists() {
        std::fs::write(&custom_js_path, template::render_initial_custom_js()).map_err(|e| {
            format!("custom.js 쓰기 실패 ({}): {e}", custom_js_path.display())
        })?;
        log::info!("custom.js 머터리얼라이즈됨: {}", custom_js_path.display());
    }

    Ok(())
}
