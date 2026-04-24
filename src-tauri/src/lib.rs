// open-ar-editor — Tauri 2.x 라이브러리 진입점
//
// Tauri 2.x 관례: lib.rs 에서 Builder 를 설정하고, main.rs 에서 run() 을 호출.
// 커맨드(project / export / preview / assets)는 이후 에이전트에서 구현 예정.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
