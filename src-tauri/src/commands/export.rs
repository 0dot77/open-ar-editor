// open-ar-editor — 정적 사이트 export 커맨드
//
// export_project : 프로젝트를 output_dir 에 정적 WebAR 사이트로 내보낸다.
//
// runtime-prototype/ 경로 해결 전략 (개발 전용):
//   - Tauri dev 시 cwd 는 src-tauri/ 이므로 "../runtime-prototype/" 를 사용.
//   - 릴리스 번들 시엔 tauri.conf.json 의 bundle.resources 에 runtime-prototype/
//     를 포함시키고 app.resource_dir() 으로 해결해야 한다.
//   TODO: 릴리스 번들에서 app_handle.resource_dir() 기반 경로 해결 구현

use crate::models::ExportResult;
use chrono::Utc;
use std::path::{Path, PathBuf};

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

/// 출력 디렉토리 생성. 이미 비어있지 않으면 에러.
fn prepare_output_dir(output: &Path) -> Result<(), String> {
    if output.exists() {
        // 내용이 있는지 검사
        let has_contents = std::fs::read_dir(output)
            .map(|mut d| d.next().is_some())
            .unwrap_or(false);
        if has_contents {
            return Err(format!(
                "출력 폴더가 비어있지 않습니다: {}. 빈 폴더 또는 존재하지 않는 경로를 지정하세요.",
                output.display()
            ));
        }
    } else {
        std::fs::create_dir_all(output)
            .map_err(|e| format!("출력 폴더 생성 실패: {e}"))?;
    }
    Ok(())
}

/// 파일 복사 + 파일 목록에 추가
fn copy_file(src: &Path, dest: &Path, files: &mut Vec<String>) -> Result<(), String> {
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("디렉토리 생성 실패 ({}): {e}", parent.display()))?;
    }
    std::fs::copy(src, dest)
        .map_err(|e| format!("파일 복사 실패 ({} → {}): {e}", src.display(), dest.display()))?;
    files.push(dest.to_string_lossy().to_string());
    Ok(())
}

/// 디렉토리 트리를 재귀 복사 (최상위 디렉토리 자체는 생성, 내부 파일 포함)
fn copy_dir_recursive(src: &Path, dest: &Path, files: &mut Vec<String>) -> Result<(), String> {
    if !src.exists() {
        return Ok(());
    }
    std::fs::create_dir_all(dest)
        .map_err(|e| format!("디렉토리 생성 실패 ({}): {e}", dest.display()))?;

    for entry in std::fs::read_dir(src)
        .map_err(|e| format!("디렉토리 읽기 실패 ({}): {e}", src.display()))?
    {
        let entry = entry.map_err(|e| format!("디렉토리 항목 읽기 실패: {e}"))?;
        let src_path = entry.path();
        let dest_path = dest.join(entry.file_name());

        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dest_path, files)?;
        } else {
            copy_file(&src_path, &dest_path, files)?;
        }
    }
    Ok(())
}

/// runtime-prototype/ 위치를 반환 (개발 전용).
///
/// Tauri dev 시 cwd = src-tauri/ → ../runtime-prototype/
/// 절대 경로로 변환한다.
fn resolve_runtime_prototype_path() -> PathBuf {
    // TODO: 릴리스 번들 대응 —
    //   app_handle.path().resource_dir()
    //     .unwrap()
    //     .join("runtime-prototype")
    // 를 사용해야 하지만 현재 커맨드에서 app_handle 을 받으려면
    // tauri::AppHandle 파라미터를 추가해야 한다. MVP 에서는 dev 경로만 지원.
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    // cwd 가 src-tauri/ 인 경우: ../runtime-prototype/
    // cwd 가 프로젝트 루트인 경우: ./runtime-prototype/
    let candidate_a = cwd.join("../runtime-prototype");
    let candidate_b = cwd.join("runtime-prototype");
    if candidate_a.exists() {
        candidate_a
    } else {
        candidate_b
    }
}

// ── Tauri 커맨드 ──────────────────────────────────────────────────────────────

/// 프로젝트를 output_dir 에 정적 WebAR 사이트로 내보낸다.
///
/// 출력 구조:
/// ```
/// {output_dir}/
///   index.html         ← runtime-prototype/index.html
///   config.json        ← project 의 tracking + scene 추출
///   manifest.json      ← export 메타정보
///   runtime/           ← runtime-prototype/runtime/*.js
///   assets/            ← 프로젝트 에셋 트리
///   source/            ← project.webar.json + graph.webar.json + bindings.webar.json (보존)
/// ```
#[tauri::command]
pub fn export_project(
    project_path: String,
    output_dir: String,
) -> Result<ExportResult, String> {
    let project_dir = Path::new(&project_path);
    let output = Path::new(&output_dir);

    // 1. project.webar.json 읽기
    let project_json_path = project_dir.join("project.webar.json");
    let project_str = std::fs::read_to_string(&project_json_path)
        .map_err(|e| format!("project.webar.json 을 읽을 수 없습니다: {e}"))?;
    let project_val: serde_json::Value = serde_json::from_str(&project_str)
        .map_err(|e| format!("project.webar.json 파싱 오류: {e}"))?;

    // 2. 출력 디렉토리 준비
    prepare_output_dir(output)?;

    let mut files: Vec<String> = Vec::new();
    let now = Utc::now().to_rfc3339();

    // 3. runtime-prototype/ 경로 해결
    let runtime_prototype = resolve_runtime_prototype_path();
    if !runtime_prototype.exists() {
        return Err(format!(
            "runtime-prototype/ 폴더를 찾을 수 없습니다 (탐색 경로: {}). \
            pnpm tauri dev 로 실행하거나 runtime-prototype/ 폴더가 프로젝트 루트에 있는지 확인하세요.",
            runtime_prototype.display()
        ));
    }

    // 4. index.html 복사
    let index_src = runtime_prototype.join("index.html");
    if index_src.exists() {
        copy_file(&index_src, &output.join("index.html"), &mut files)?;
    } else {
        log::warn!("runtime-prototype/index.html 이 없습니다. export 결과물에 index.html 이 빠집니다.");
    }

    // 5. runtime/ 복사
    let runtime_src = runtime_prototype.join("runtime");
    if runtime_src.exists() {
        copy_dir_recursive(&runtime_src, &output.join("runtime"), &mut files)?;
    }

    // 6. assets/ 트리 복사
    let assets_src = project_dir.join("assets");
    if assets_src.exists() {
        copy_dir_recursive(&assets_src, &output.join("assets"), &mut files)?;
    }

    // 7. config.json 생성 (schemaVersion + tracking + scene)
    let config = serde_json::json!({
        "schemaVersion": project_val["schemaVersion"],
        "tracking": project_val["tracking"],
        "scene": project_val["scene"]
    });
    let config_path = output.join("config.json");
    std::fs::write(
        &config_path,
        serde_json::to_string_pretty(&config)
            .map_err(|e| format!("config.json 직렬화 실패: {e}"))?,
    )
    .map_err(|e| format!("config.json 쓰기 실패: {e}"))?;
    files.push(config_path.to_string_lossy().to_string());

    // 8. manifest.json 생성
    let manifest = serde_json::json!({
        "runtimeVersion": "0.1.0",
        "schemaVersions": {
            "project": "0.1.0",
            "config": "0.1.0",
            "graph": "0.1.0",
            "bindings": "0.1.0"
        },
        "libraries": {
            "mindar": "1.2.5",
            "three": "0.160.0"
        },
        "exportedAt": now
    });
    let manifest_path = output.join("manifest.json");
    std::fs::write(
        &manifest_path,
        serde_json::to_string_pretty(&manifest)
            .map_err(|e| format!("manifest.json 직렬화 실패: {e}"))?,
    )
    .map_err(|e| format!("manifest.json 쓰기 실패: {e}"))?;
    files.push(manifest_path.to_string_lossy().to_string());

    // 9. source/ — 원본 편집 파일 보존
    let source_dir = output.join("source");
    std::fs::create_dir_all(&source_dir)
        .map_err(|e| format!("source/ 폴더 생성 실패: {e}"))?;

    for src_filename in &["project.webar.json", "graph.webar.json", "bindings.webar.json"] {
        let src_path = project_dir.join(src_filename);
        if src_path.exists() {
            copy_file(&src_path, &source_dir.join(src_filename), &mut files)?;
        }
    }

    log::info!("export 완료: {} (파일 {}개)", output.display(), files.len());

    Ok(ExportResult {
        output_path: output.to_string_lossy().to_string(),
        files,
    })
}
