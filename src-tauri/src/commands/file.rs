// open-ar-editor — 화이트리스트 기반 프로젝트 파일 읽기/쓰기 커맨드
//
// "Code" 탭에서 작가가 직접 편집할 수 있는 파일은 두 개로 고정한다:
//   - index.html  : 프로젝트의 관리되는 페이지 chrome
//   - custom.js   : 런타임 훅 스텁
//
// 프론트엔드가 임의 파일에 접근하지 못하도록 다음 두 가지 방어선을 둔다:
//   1) 화이트리스트 — relative_path 가 ALLOWED 에 없으면 즉시 거부.
//   2) 경로 정규화 — project_path 를 canonicalize 한 뒤, 결과 경로가
//      그 prefix 밖으로 벗어나면 거부 (defense in depth).
//
// 화이트리스트를 확장할 일이 생기면 ALLOWED 상수를 의식적으로 갱신한다.

use std::path::{Path, PathBuf};

/// 편집 가능 파일 화이트리스트 (LOCKED v1).
const ALLOWED: &[&str] = &["index.html", "custom.js"];

/// project_path + relative_path 를 안전하게 결합하여 절대 경로를 돌려준다.
///
/// - relative_path 가 화이트리스트에 없으면 거부.
/// - project_path 가 디렉토리가 아니면 거부.
/// - 정규화된 project 디렉토리 prefix 안에 머무는지 확인 (.. 트래버설 차단).
///
/// 쓰기 시 target 자체는 아직 존재하지 않을 수 있으므로 target 은 canonicalize
/// 하지 않는다. project_dir 만 canonicalize 하고 거기에 relative_path 를 붙여
/// prefix 검사를 수행한다.
fn resolve_safe_path(project_path: &str, relative_path: &str) -> Result<PathBuf, String> {
    if !ALLOWED.contains(&relative_path) {
        return Err(format!(
            "허용되지 않는 파일 경로입니다: {relative_path}"
        ));
    }

    let project_dir = Path::new(project_path);
    if !project_dir.is_dir() {
        return Err(format!("프로젝트 폴더가 아닙니다: {project_path}"));
    }

    let project_canon = project_dir
        .canonicalize()
        .map_err(|e| format!("프로젝트 경로 정규화 실패: {e}"))?;

    let intended = project_canon.join(relative_path);
    if !intended.starts_with(&project_canon) {
        return Err("경로가 프로젝트 폴더 밖을 벗어납니다.".to_string());
    }

    Ok(intended)
}

/// 화이트리스트된 파일을 UTF-8 문자열로 읽어 반환한다.
#[tauri::command]
pub fn file_read(project_path: String, relative_path: String) -> Result<String, String> {
    let target = resolve_safe_path(&project_path, &relative_path)?;

    if !target.exists() {
        return Err(format!("파일이 존재하지 않습니다: {relative_path}"));
    }

    std::fs::read_to_string(&target)
        .map_err(|e| format!("파일을 읽을 수 없습니다 ({}): {e}", target.display()))
}

/// 화이트리스트된 파일에 UTF-8 문자열을 덮어쓴다 (atomic 보장 없음 — v1).
#[tauri::command]
pub fn file_write(
    project_path: String,
    relative_path: String,
    content: String,
) -> Result<(), String> {
    let target = resolve_safe_path(&project_path, &relative_path)?;

    // 화이트리스트 파일은 모두 프로젝트 루트 직속이라 부모 = project_dir.
    // 그래도 방어적으로 부모 존재를 확인한다.
    if let Some(parent) = target.parent() {
        if !parent.is_dir() {
            return Err(format!(
                "부모 폴더가 존재하지 않습니다: {}",
                parent.display()
            ));
        }
    }

    std::fs::write(&target, content)
        .map_err(|e| format!("파일 쓰기 실패 ({}): {e}", target.display()))?;

    log::info!("파일 저장됨: {}", target.display());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_non_whitelisted_path() {
        // tempdir 없이도 화이트리스트 검사는 디렉토리 검사보다 먼저 일어남.
        let err = resolve_safe_path("/tmp", "secret.txt").unwrap_err();
        assert!(err.contains("허용되지 않는 파일 경로"));
    }

    #[test]
    fn rejects_path_traversal_via_relative() {
        // 화이트리스트에 ../foo 가 없으므로 1차에서 차단됨.
        let err = resolve_safe_path("/tmp", "../etc/passwd").unwrap_err();
        assert!(err.contains("허용되지 않는 파일 경로"));
    }
}
