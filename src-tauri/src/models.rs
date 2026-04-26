// open-ar-editor — 공유 데이터 모델
//
// TS 프론트엔드와 serde camelCase rename 으로 자동 매칭.
// project.webar.schema.json v0.1.0 의 MVP 2 필수 필드만 포함.

use serde::{Deserialize, Serialize};

// ── AssetType ────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "lowercase")]
pub enum AssetType {
    Target,
    Model,
    Image,
    Video,
    Audio,
}

impl AssetType {
    /// 에셋 서브폴더 이름 반환 ("targets", "models", ...)
    pub fn folder_name(&self) -> &'static str {
        match self {
            AssetType::Target => "targets",
            AssetType::Model => "models",
            AssetType::Image => "images",
            AssetType::Video => "videos",
            AssetType::Audio => "audio",
        }
    }
}

// ── Asset ─────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Asset {
    pub id: String,
    #[serde(rename = "type")]
    pub asset_type: AssetType,
    /// 프로젝트 폴더 상대 경로 (e.g. "assets/models/object.glb")
    pub path: String,
    /// import 할 때 원본 절대 경로 (보존용)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_path: Option<String>,
    /// 파일 크기 (bytes)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
    /// SHA-256 hex 체크섬
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hash: Option<String>,
}

// ── Tracking ──────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Tracking {
    #[serde(rename = "type")]
    pub tracking_type: String,
    /// MindAR .mind 파일 경로 (image 트래킹)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,
    /// 타깃 미리보기 이미지 경로
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview: Option<String>,
}

// ── Scene ────────────────────────────────────────────────────────────────────

/// scale 은 uniform scalar 또는 [x, y, z] — serde Value 로 유연하게 처리
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SceneObject {
    pub id: String,
    #[serde(rename = "type")]
    pub object_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    pub src: String,
    pub position: [f64; 3],
    pub rotation: [f64; 3],
    /// uniform scalar 또는 [x, y, z] — serde_json::Value 로 유연 처리
    pub scale: serde_json::Value,
    pub visible: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anchor_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub animation_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub autoplay: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#loop: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    /// 이벤트/인터랙션 목록 — 런타임이 해석. 자유 형식 JSON 으로 보존.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub events: Option<Vec<serde_json::Value>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Scene {
    /// "camera" | "transparent" | "color"
    pub background: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub background_color: Option<String>,
    /// "meters" | "centimeters"
    pub units: String,
    pub objects: Vec<SceneObject>,
}

// ── ProjectMetadata ───────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMetadata {
    pub title: String,
    pub artist: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub keywords: Option<Vec<String>>,
}

// ── ExportRecord ──────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ExportRecord {
    pub exported_at: String,
    pub output_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

// ── Project ───────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub schema_version: String,
    pub metadata: ProjectMetadata,
    pub tracking: Tracking,
    pub scene: Scene,
    pub assets: Vec<Asset>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exports: Option<Vec<ExportRecord>>,
}

// ── PreviewInfo ───────────────────────────────────────────────────────────────

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PreviewInfo {
    pub url: String,
    pub qr_data_url: String,
    pub port: u16,
}

// ── TunnelInfo ────────────────────────────────────────────────────────────────

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TunnelInfo {
    /// cloudflared 가 발급한 https://*.trycloudflare.com URL
    pub url: String,
    pub qr_data_url: String,
}

// ── ExportResult ──────────────────────────────────────────────────────────────

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub output_path: String,
    pub files: Vec<String>,
    /// exports[] 에 새로 추가된 기록을 반영한 갱신된 project (정식 export 시).
    /// 임시 export(.preview-tmp 등) 에서는 None.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project: Option<Project>,
}
