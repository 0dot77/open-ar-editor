// open-ar-editor — QR 코드 생성 커맨드
//
// qr_generate : 텍스트를 QR PNG 로 변환해 data:image/png;base64,... 반환.
//               preview_start 에서도 내부 재사용.

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use image::{ImageBuffer, Luma};
use qrcode::QrCode;

/// text 를 QR PNG data URL 로 변환한다.
///
/// 반환값: `data:image/png;base64,...`
pub fn generate_qr_data_url(text: &str) -> Result<String, String> {
    // QR 코드 생성
    let code = QrCode::new(text.as_bytes())
        .map_err(|e| format!("QR 코드 생성 실패: {e}"))?;

    // qrcode 의 render 를 image::Luma 로 변환
    let scale: u32 = 8; // 각 모듈 크기 (픽셀)
    let image_data = code.render::<Luma<u8>>()
        .module_dimensions(scale, scale)
        .quiet_zone(true)
        .build();

    let width = image_data.width();
    let height = image_data.height();

    // image::ImageBuffer 로 감싸서 PNG 인코딩
    let img: ImageBuffer<Luma<u8>, Vec<u8>> =
        ImageBuffer::from_raw(width, height, image_data.into_raw())
            .ok_or("QR 이미지 버퍼 생성 실패")?;

    let mut png_bytes: Vec<u8> = Vec::new();
    {
        use image::codecs::png::PngEncoder;
        use image::ImageEncoder;
        let encoder = PngEncoder::new(&mut png_bytes);
        encoder
            .write_image(img.as_raw(), width, height, image::ExtendedColorType::L8)
            .map_err(|e| format!("PNG 인코딩 실패: {e}"))?;
    }

    let b64 = BASE64.encode(&png_bytes);
    Ok(format!("data:image/png;base64,{b64}"))
}

// ── Tauri 커맨드 ──────────────────────────────────────────────────────────────

/// 텍스트를 QR PNG data URL 로 변환한다.
#[tauri::command]
pub fn qr_generate(text: String) -> Result<String, String> {
    generate_qr_data_url(&text)
}
