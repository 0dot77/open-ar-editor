// open-ar-editor — Event Graph CRUD 커맨드
//
// graph_load : graph.webar.json 을 raw JSON 으로 읽어 반환
// graph_save : 프론트가 보낸 JSON 을 graph.webar.json 으로 덮어쓰기
//
// 노드/엣지의 구조는 프론트엔드 (src/shared/types.ts) 가 단일 진실 원천이며
// Rust 는 단순 패스스루 — 디스크 ↔ JSON 사이의 셔틀 역할만 한다.

use serde_json::Value;
use std::path::Path;

const GRAPH_FILE: &str = "graph.webar.json";

#[tauri::command]
pub fn graph_load(project_path: String) -> Result<Value, String> {
    let dir = Path::new(&project_path);
    if !dir.exists() {
        return Err(format!("프로젝트 폴더가 존재하지 않습니다: {project_path}"));
    }

    let path = dir.join(GRAPH_FILE);
    if !path.exists() {
        // 그래프 파일이 없으면 빈 그래프 반환 (이전 버전 프로젝트 호환)
        return Ok(serde_json::json!({
            "schemaVersion": "0.1.0",
            "nodes": [],
            "edges": []
        }));
    }

    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("{GRAPH_FILE} 을 읽을 수 없습니다: {e}"))?;
    serde_json::from_str(&content).map_err(|e| format!("{GRAPH_FILE} 파싱 오류: {e}"))
}

#[tauri::command]
pub fn graph_save(project_path: String, graph: Value) -> Result<(), String> {
    let dir = Path::new(&project_path);
    if !dir.exists() {
        return Err(format!("프로젝트 폴더가 존재하지 않습니다: {project_path}"));
    }

    let path = dir.join(GRAPH_FILE);
    let json = serde_json::to_string_pretty(&graph)
        .map_err(|e| format!("JSON 직렬화 실패: {e}"))?;
    std::fs::write(&path, json)
        .map_err(|e| format!("{GRAPH_FILE} 쓰기 실패: {e}"))?;

    log::info!("그래프 저장됨: {:?}", path);
    Ok(())
}
