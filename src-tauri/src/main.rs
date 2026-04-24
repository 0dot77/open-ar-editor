// open-ar-editor — Tauri 진입점
//
// Tauri 커맨드(프로젝트 열기/저장, export, preview server, QR 생성 등)는
// 이후 에이전트에서 src-tauri/src/commands/ 아래에 구현 예정.

// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    open_ar_editor_lib::run()
}
