// open-ar-editor — 로컬 preview server 커맨드
//
// preview_start : 프로젝트 폴더를 정적 HTTP 서빙. LAN IP + QR 반환.
// preview_stop  : 서버 종료.
//
// HTTPS 는 이번 MVP 에서 구현하지 않는다.
// 모바일에서 카메라/fetch 가 필요한 경우 사용자가 mkcert 또는 ngrok/cloudflared 같은
// 터널링 도구를 직접 설정해야 한다. UI 에서 해당 안내를 표시할 것 (프론트엔드 담당).

use crate::commands::qr::generate_qr_data_url;
use crate::models::PreviewInfo;
use axum::Router;
use std::net::SocketAddr;
use std::sync::Mutex;
use tokio::sync::oneshot;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;

// ── PreviewState (Tauri managed state) ───────────────────────────────────────

/// 현재 실행 중인 preview server 의 종료 채널 핸들.
pub struct PreviewState {
    shutdown_tx: Mutex<Option<oneshot::Sender<()>>>,
    port: Mutex<Option<u16>>,
}

impl Default for PreviewState {
    fn default() -> Self {
        PreviewState {
            shutdown_tx: Mutex::new(None),
            port: Mutex::new(None),
        }
    }
}

// ── 포트 탐색 헬퍼 ────────────────────────────────────────────────────────────

/// 37000번부터 시작해 bind 가능한 포트를 찾는다.
fn find_available_port(start: u16) -> Result<u16, String> {
    for port in start..start + 200 {
        let addr: SocketAddr = format!("0.0.0.0:{port}").parse().unwrap();
        if std::net::TcpListener::bind(addr).is_ok() {
            return Ok(port);
        }
    }
    Err(format!(
        "포트 {start}–{} 범위에서 사용 가능한 포트를 찾을 수 없습니다.",
        start + 199
    ))
}

// ── LAN IP 감지 ──────────────────────────────────────────────────────────────

fn get_lan_ip() -> String {
    match local_ip_address::local_ip() {
        Ok(ip) => ip.to_string(),
        Err(_) => "127.0.0.1".to_string(),
    }
}

// ── Tauri 커맨드 ──────────────────────────────────────────────────────────────

/// 프로젝트 폴더를 정적 HTTP 로 서빙하고 LAN URL 및 QR data URL 을 반환한다.
///
/// 이미 서버가 실행 중이면 기존 서버를 먼저 중지하고 재시작한다.
#[tauri::command]
pub async fn preview_start(
    project_path: String,
    state: tauri::State<'_, PreviewState>,
) -> Result<PreviewInfo, String> {
    // 기존 서버 종료
    {
        let mut tx_guard = state
            .shutdown_tx
            .lock()
            .map_err(|_| "내부 상태 잠금 실패".to_string())?;
        if let Some(tx) = tx_guard.take() {
            let _ = tx.send(());
            // 짧게 대기 — 포트 해제 여유
            tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
        }
        *state.port.lock().map_err(|_| "내부 상태 잠금 실패")? = None;
    }

    // 포트 탐색
    let port = find_available_port(37000)?;

    // CORS 설정 — access-control-allow-origin: * (모바일 접근 허용)
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // 정적 파일 서빙 — ServeDir
    let serve_dir = ServeDir::new(&project_path);
    let app = Router::new()
        .fallback_service(serve_dir)
        .layer(cors);

    let addr: SocketAddr = format!("0.0.0.0:{port}").parse().unwrap();
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| format!("포트 {port} 에 바인딩 실패: {e}"))?;

    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

    // 서버를 별도 태스크로 실행
    tokio::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(async move {
                let _ = shutdown_rx.await;
            })
            .await
            .ok();
        log::info!("preview server 종료됨 (포트 {})", port);
    });

    // 상태 저장
    {
        *state.shutdown_tx.lock().map_err(|_| "내부 상태 잠금 실패")? = Some(shutdown_tx);
        *state.port.lock().map_err(|_| "내부 상태 잠금 실패")? = Some(port);
    }

    let lan_ip = get_lan_ip();
    let url = format!("http://{lan_ip}:{port}/");

    let qr_data_url = generate_qr_data_url(&url)
        .unwrap_or_else(|_| String::new());

    log::info!("preview server 시작됨: {url}");

    Ok(PreviewInfo {
        url,
        qr_data_url,
        port,
    })
}

/// 실행 중인 preview server 를 종료한다. 이미 중지된 상태도 OK.
#[tauri::command]
pub async fn preview_stop(
    state: tauri::State<'_, PreviewState>,
) -> Result<(), String> {
    let mut tx_guard = state
        .shutdown_tx
        .lock()
        .map_err(|_| "내부 상태 잠금 실패".to_string())?;

    if let Some(tx) = tx_guard.take() {
        let _ = tx.send(());
        log::info!("preview server 종료 요청 전송됨");
    } else {
        log::info!("preview server 가 실행 중이지 않습니다.");
    }

    *state.port.lock().map_err(|_| "내부 상태 잠금 실패")? = None;

    Ok(())
}
