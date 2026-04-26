// open-ar-editor — cloudflared 터널 헬퍼
//
// `cloudflared tunnel --url http://localhost:<port>` 를 자식 프로세스로 띄우고
// stderr 에서 `https://*.trycloudflare.com` URL 을 파싱해 반환한다.
// account 가 필요 없는 quick tunnel 모드.
//
// cloudflared 가 PATH 또는 캐시에 없으면 GitHub Release 에서 platform 별 binary 를
// 자동 다운로드해 `<app_data>/bin/cloudflared` 에 저장한다 (1회). 이후엔 즉시 재사용.

use crate::commands::qr::generate_qr_data_url;
use crate::models::TunnelInfo;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Mutex;
use tauri::Manager;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::time::{timeout, Duration};

// ── TunnelState (Tauri managed state) ─────────────────────────────────────────

pub struct TunnelState {
    child: Mutex<Option<Child>>,
}

impl Default for TunnelState {
    fn default() -> Self {
        TunnelState {
            child: Mutex::new(None),
        }
    }
}

// ── cloudflared 바이너리 확보 ─────────────────────────────────────────────────

/// PATH 의 `cloudflared` 가 동작하는지 검사.
fn cloudflared_in_path() -> bool {
    std::process::Command::new("cloudflared")
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// 현재 platform 에 맞는 cloudflared GitHub Release URL.
fn cloudflared_download_url() -> Result<&'static str, String> {
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    return Ok("https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz");

    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    return Ok("https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz");

    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    return Ok("https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64");

    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    return Ok("https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64");

    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    return Ok("https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe");

    #[cfg(not(any(
        all(target_os = "macos", target_arch = "aarch64"),
        all(target_os = "macos", target_arch = "x86_64"),
        all(target_os = "linux", target_arch = "x86_64"),
        all(target_os = "linux", target_arch = "aarch64"),
        all(target_os = "windows", target_arch = "x86_64"),
    )))]
    return Err(
        "이 플랫폼에서는 cloudflared 자동 다운로드를 지원하지 않습니다.\n\
         직접 cloudflared 를 설치하고 PATH 에 등록해 주세요."
            .to_string(),
    );
}

/// cloudflared 캐시 폴더: `<app_data_dir>/bin/`
fn cache_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("앱 데이터 폴더 확인 실패: {e}"))?
        .join("bin");
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("캐시 폴더 생성 실패 ({}): {e}", dir.display()))?;
    Ok(dir)
}

/// 캐시 폴더 안의 cloudflared 바이너리 경로 (Windows 는 .exe).
fn cached_binary_path(cache_dir: &Path) -> PathBuf {
    if cfg!(windows) {
        cache_dir.join("cloudflared.exe")
    } else {
        cache_dir.join("cloudflared")
    }
}

/// cloudflared 를 PATH → 캐시 → 자동 다운로드 순서로 확보하고 그 경로를 반환한다.
async fn ensure_cloudflared(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if cloudflared_in_path() {
        log::info!("cloudflared: PATH 에서 발견");
        return Ok(PathBuf::from("cloudflared"));
    }

    let cache = cache_dir(app)?;
    let cached = cached_binary_path(&cache);

    if cached.exists() {
        log::info!("cloudflared: 캐시 사용 ({})", cached.display());
        return Ok(cached);
    }

    log::info!("cloudflared: 자동 다운로드 시작 ({})", cached.display());
    download_cloudflared(&cache, &cached).await?;
    log::info!("cloudflared: 자동 다운로드 완료");

    Ok(cached)
}

/// platform 에 맞는 cloudflared 를 다운로드해 `target` 에 실행 가능 상태로 저장한다.
async fn download_cloudflared(cache_dir: &Path, target: &Path) -> Result<(), String> {
    let url = cloudflared_download_url()?;

    let bytes = reqwest::get(url)
        .await
        .map_err(|e| format!("cloudflared 다운로드 요청 실패: {e}"))?
        .error_for_status()
        .map_err(|e| format!("cloudflared 다운로드 응답 오류: {e}"))?
        .bytes()
        .await
        .map_err(|e| format!("cloudflared 응답 본문 읽기 실패: {e}"))?;

    if url.ends_with(".tgz") {
        // tar.gz — macOS 는 'tar' 가 기본 설치되어 있음.
        let tmp = cache_dir.join("cloudflared-download.tgz");
        std::fs::write(&tmp, &bytes)
            .map_err(|e| format!("임시 파일 저장 실패: {e}"))?;

        let status = std::process::Command::new("tar")
            .arg("-xzf")
            .arg(&tmp)
            .arg("-C")
            .arg(cache_dir)
            .status()
            .map_err(|e| format!("tar 실행 실패: {e}"))?;

        std::fs::remove_file(&tmp).ok();

        if !status.success() {
            return Err("cloudflared tgz 압축 해제 실패".to_string());
        }
    } else {
        // 단일 바이너리 (Linux/Windows)
        std::fs::write(target, &bytes)
            .map_err(|e| format!("cloudflared 바이너리 쓰기 실패: {e}"))?;
    }

    if !target.exists() {
        return Err(format!(
            "cloudflared 다운로드 후 바이너리를 찾을 수 없습니다: {}",
            target.display()
        ));
    }

    // Unix: 실행 권한 부여
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(target)
            .map_err(|e| format!("권한 조회 실패: {e}"))?
            .permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(target, perms)
            .map_err(|e| format!("실행 권한 설정 실패: {e}"))?;
    }

    Ok(())
}

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────

/// 한 줄에서 trycloudflare.com URL 을 추출 (예: "| https://foo-bar.trycloudflare.com |").
fn extract_tunnel_url(line: &str) -> Option<String> {
    let mut idx = 0usize;
    while let Some(start) = line[idx..].find("https://") {
        let abs_start = idx + start;
        let tail = &line[abs_start..];
        let end = tail
            .find(|c: char| c.is_whitespace() || c == '|' || c == '"')
            .unwrap_or(tail.len());
        let candidate = &tail[..end];
        if candidate.contains("trycloudflare.com") {
            return Some(candidate.to_string());
        }
        idx = abs_start + end;
    }
    None
}

// ── Tauri 커맨드 ──────────────────────────────────────────────────────────────

/// preview server 포트를 cloudflared quick tunnel 로 노출하고 HTTPS URL 을 반환한다.
///
/// 흐름:
/// 1. cloudflared 확보 (PATH → 캐시 → 자동 다운로드)
/// 2. 기존 터널이 떠있으면 먼저 종료
/// 3. `cloudflared tunnel --url http://localhost:<port>` spawn
/// 4. stderr 를 한 줄씩 읽으며 trycloudflare.com URL 을 찾음 (최대 30초)
/// 5. 찾으면 QR 생성 후 TunnelInfo 반환
#[tauri::command]
pub async fn tunnel_start(
    app: tauri::AppHandle,
    port: u16,
    state: tauri::State<'_, TunnelState>,
) -> Result<TunnelInfo, String> {
    let cloudflared_path = ensure_cloudflared(&app).await?;

    // 기존 터널 종료 — MutexGuard 는 .await 전에 드랍
    let prev_child = {
        let mut guard = state
            .child
            .lock()
            .map_err(|_| "내부 상태 잠금 실패".to_string())?;
        guard.take()
    };
    if let Some(mut c) = prev_child {
        let _ = c.kill().await;
    }

    // stdout 은 사용하지 않으므로 null 로 — pipe 가 차서 child 가 block 되지 않게 함.
    let mut child = Command::new(&cloudflared_path)
        .args([
            "tunnel",
            "--url",
            &format!("http://localhost:{port}"),
            "--no-autoupdate",
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("cloudflared 실행 실패: {e}"))?;

    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "cloudflared stderr 를 읽을 수 없습니다.".to_string())?;
    let mut reader = BufReader::new(stderr).lines();

    // 30초 안에 https URL 찾기
    let url_result = timeout(Duration::from_secs(30), async {
        while let Ok(Some(line)) = reader.next_line().await {
            log::debug!("[cloudflared] {line}");
            if let Some(url) = extract_tunnel_url(&line) {
                return Some(url);
            }
        }
        None
    })
    .await;

    let url = match url_result {
        Ok(Some(u)) => u,
        Ok(None) => {
            let _ = child.kill().await;
            return Err(
                "cloudflared 가 터널 URL 을 출력하지 않았습니다. 네트워크 연결을 확인하세요."
                    .to_string(),
            );
        }
        Err(_) => {
            let _ = child.kill().await;
            return Err(
                "cloudflared 터널 생성이 30초 안에 완료되지 않았습니다.".to_string(),
            );
        }
    };

    // URL 을 찾은 뒤에도 stderr 를 계속 소비해야 cloudflared 가 SIGPIPE 로 종료되지 않는다.
    // reader 를 백그라운드 task 로 넘겨 EOF 까지 흘려보낸다.
    tokio::spawn(async move {
        while let Ok(Some(line)) = reader.next_line().await {
            log::debug!("[cloudflared] {line}");
        }
        log::info!("[cloudflared] stderr EOF — 프로세스 종료");
    });

    // 자식 프로세스 보존 (drop 시 kill_on_drop 으로 함께 종료)
    {
        let mut guard = state
            .child
            .lock()
            .map_err(|_| "내부 상태 잠금 실패".to_string())?;
        *guard = Some(child);
    }

    let qr_data_url = generate_qr_data_url(&url).unwrap_or_else(|_| String::new());

    log::info!("cloudflared 터널 시작됨: {url}");

    Ok(TunnelInfo { url, qr_data_url })
}

/// 실행 중인 cloudflared 터널을 종료한다.
#[tauri::command]
pub async fn tunnel_stop(state: tauri::State<'_, TunnelState>) -> Result<(), String> {
    let prev = {
        let mut guard = state
            .child
            .lock()
            .map_err(|_| "내부 상태 잠금 실패".to_string())?;
        guard.take()
    };
    if let Some(mut c) = prev {
        let _ = c.kill().await;
        log::info!("cloudflared 터널 종료됨");
    }
    Ok(())
}
