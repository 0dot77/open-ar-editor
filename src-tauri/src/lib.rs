// open-ar-editor — Tauri 2.x 라이브러리 진입점
//
// 커맨드 모듈: commands/{project, assets, preview, export, qr}
// 공유 타입:   models.rs

pub mod commands;
pub mod models;

use commands::preview::PreviewState;
use commands::tunnel::TunnelState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(PreviewState::default())
        .manage(TunnelState::default())
        .invoke_handler(tauri::generate_handler![
            commands::project::project_new,
            commands::project::project_open,
            commands::project::project_save,
            commands::project::project_needs_template_materialization,
            commands::project::project_materialize_template,
            commands::graph::graph_load,
            commands::graph::graph_save,
            commands::assets::asset_import,
            commands::preview::preview_start,
            commands::preview::preview_build_and_start,
            commands::preview::preview_stop,
            commands::export::export_project,
            commands::qr::qr_generate,
            commands::tunnel::tunnel_start,
            commands::tunnel::tunnel_stop,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
