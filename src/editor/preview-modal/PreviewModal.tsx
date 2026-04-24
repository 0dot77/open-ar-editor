import { useProjectStore } from "@/state/projectStore";
import "./PreviewModal.css";

interface PreviewModalProps {
  onClose: () => void;
}

/**
 * PreviewModal — 모바일 미리보기 모달
 *
 * previewInfo (URL, QR 이미지) 표시 + HTTPS 안내.
 * position: fixed overlay 방식 (Portal 미사용).
 */
function PreviewModal({ onClose }: PreviewModalProps) {
  const { previewInfo, stopPreview } = useProjectStore();

  const handleClose = async () => {
    await stopPreview();
    onClose();
  };

  const handleCopyUrl = () => {
    if (previewInfo?.url) {
      navigator.clipboard.writeText(previewInfo.url).then(() => {
        alert("URL 을 클립보드에 복사했습니다.");
      });
    }
  };

  return (
    <div className="preview-modal__overlay" onClick={handleClose}>
      <div
        className="preview-modal__panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="모바일 미리보기"
      >
        <div className="preview-modal__header">
          <span className="preview-modal__title">모바일 미리보기</span>
          <button className="preview-modal__close-btn" onClick={handleClose} aria-label="닫기">
            ✕
          </button>
        </div>

        <div className="preview-modal__body">
          {previewInfo ? (
            <>
              {/* QR 코드 */}
              <div className="preview-modal__qr-wrap">
                <img
                  className="preview-modal__qr"
                  src={previewInfo.qrDataUrl}
                  alt="미리보기 QR 코드"
                />
              </div>

              {/* URL */}
              <div className="preview-modal__url-row">
                <span className="preview-modal__url-text">{previewInfo.url}</span>
                <button className="preview-modal__copy-btn" onClick={handleCopyUrl}>
                  복사
                </button>
              </div>

              {/* 기본 안내 */}
              <p className="preview-modal__guide">
                같은 Wi-Fi 에 연결된 휴대폰에서 위 QR 을 스캔해 접속하세요.
                카메라 권한을 허용해야 합니다.
              </p>

              {/* HTTPS 안내 */}
              <div className="preview-modal__https-notice">
                <strong>iOS 카메라는 HTTPS 만 허용합니다.</strong>
                <br />
                mkcert 로 로컬 인증서를 만들거나 ngrok / cloudflared 로 터널링하세요.
                자세한 방법은 <code>docs/export-format.md</code> 를 참고하세요.
              </div>
            </>
          ) : (
            <p className="preview-modal__loading">미리보기 서버를 시작하는 중...</p>
          )}
        </div>

        <div className="preview-modal__footer">
          <button className="preview-modal__btn preview-modal__btn--danger" onClick={handleClose}>
            미리보기 종료
          </button>
        </div>
      </div>
    </div>
  );
}

export default PreviewModal;
