// open-ar-editor — 에셋 임포트 커맨드
//
// asset_import : 원본 파일을 프로젝트 assets/{type}s/ 로 복사하고 Asset 메타데이터 반환.
//                project.webar.json 에 추가하지 않음 — 프론트엔드 책임.

use crate::models::{Asset, AssetType};
use sha2::{Digest, Sha256};
use std::io::Read;
use std::path::{Path, PathBuf};

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

/// 충돌 없는 대상 경로를 반환한다.
/// 이미 파일이 있으면 stem 에 `-1`, `-2`, ... 을 붙인다.
fn resolve_unique_path(dir: &Path, filename: &str) -> PathBuf {
    let candidate = dir.join(filename);
    if !candidate.exists() {
        return candidate;
    }

    let path = Path::new(filename);
    let stem = path.file_stem().unwrap_or_default().to_string_lossy();
    let ext = path.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();

    for i in 1u32.. {
        let new_name = format!("{stem}-{i}{ext}");
        let new_path = dir.join(&new_name);
        if !new_path.exists() {
            return new_path;
        }
    }
    // 이론상 도달하지 않음
    candidate
}

/// SHA-256 해시를 hex string 으로 반환
fn sha256_hex(path: &Path) -> Result<String, String> {
    let mut file = std::fs::File::open(path)
        .map_err(|e| format!("파일을 열 수 없습니다 ({}): {e}", path.display()))?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = file.read(&mut buf).map_err(|e| format!("파일 읽기 오류: {e}"))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
}

/// 16자 nanoid 스타일 랜덤 ID 생성 (소문자 + 숫자)
fn generate_id() -> String {
    nanoid::nanoid!(16, &nanoid::alphabet::SAFE)
}

// ── Tauri 커맨드 ──────────────────────────────────────────────────────────────

/// 원본 파일을 프로젝트 에셋 폴더로 복사하고 Asset 메타데이터를 반환한다.
///
/// - project.webar.json 수정은 하지 않는다 (프론트엔드 책임).
/// - 파일명 충돌 시 `-1`, `-2` 접미사를 붙인다.
#[tauri::command]
pub fn asset_import(
    project_path: String,
    source_path: String,
    asset_type: AssetType,
) -> Result<Asset, String> {
    let project_dir = Path::new(&project_path);
    let source = Path::new(&source_path);

    // 원본 파일 존재 확인
    if !source.exists() {
        return Err(format!(
            "원본 파일을 찾을 수 없습니다: {source_path}"
        ));
    }
    if !source.is_file() {
        return Err(format!("원본 경로가 파일이 아닙니다: {source_path}"));
    }

    // 대상 디렉토리
    let dest_dir = project_dir.join("assets").join(asset_type.folder_name());
    if !dest_dir.exists() {
        std::fs::create_dir_all(&dest_dir)
            .map_err(|e| format!("에셋 폴더 생성 실패: {e}"))?;
    }

    // 파일명 결정 (충돌 없는 경로)
    let filename = source
        .file_name()
        .ok_or("원본 파일명을 확인할 수 없습니다")?
        .to_string_lossy()
        .to_string();

    let dest_path = resolve_unique_path(&dest_dir, &filename);
    let dest_filename = dest_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    // 복사
    std::fs::copy(source, &dest_path)
        .map_err(|e| format!("에셋 복사 실패: {e}"))?;

    // 파일 크기
    let size = std::fs::metadata(&dest_path)
        .map(|m| m.len())
        .unwrap_or(0);

    // SHA-256 해시
    let hash = sha256_hex(&dest_path)
        .unwrap_or_else(|_| String::new());

    // 프로젝트 폴더 상대 경로 (슬래시 통일)
    let relative_path = format!("assets/{}/{}", asset_type.folder_name(), dest_filename);

    let asset = Asset {
        id: generate_id(),
        asset_type,
        path: relative_path,
        original_path: Some(source_path.clone()),
        size: Some(size),
        hash: Some(hash),
    };

    log::info!(
        "에셋 임포트 완료: {} → {}",
        source_path,
        dest_path.display()
    );

    Ok(asset)
}
