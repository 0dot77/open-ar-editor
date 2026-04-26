import { useState } from "react";
import { useProjectStore } from "@/state/projectStore";
import { tunnelApi, type TunnelInfo } from "@/tauri/api";
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

  const [tunnel, setTunnel] = useState<TunnelInfo | null>(null);
  const [tunnelBusy, setTunnelBusy] = useState(false);
  const [tunnelError, setTunnelError] = useState<string | null>(null);

  const handleClose = async () => {
    if (tunnel) {
      await tunnelApi.stop().catch(() => undefined);
    }
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

  // Mac 데스크톱에서 즉시 검증할 수 있는 secure-context URL.
  // localhost 는 카메라 권한이 자동 허용되므로 LAN IP 와 달리 HTTPS 없이도 동작.
  const localhostUrl = previewInfo
    ? `http://localhost:${previewInfo.port}/`
    : null;

  const handleCopyLocalhost = () => {
    if (localhostUrl) {
      navigator.clipboard.writeText(localhostUrl).then(() => {
        alert("localhost URL 을 클립보드에 복사했습니다.");
      });
    }
  };

  const handleStartTunnel = async () => {
    if (!previewInfo) return;
    setTunnelBusy(true);
    setTunnelError(null);
    try {
      const info = await tunnelApi.start(previewInfo.port);
      setTunnel(info);
    } catch (err) {
      setTunnelError(err instanceof Error ? err.message : String(err));
    } finally {
      setTunnelBusy(false);
    }
  };

  const handleStopTunnel = async () => {
    setTunnelBusy(true);
    try {
      await tunnelApi.stop();
      setTunnel(null);
      setTunnelError(null);
    } catch (err) {
      setTunnelError(err instanceof Error ? err.message : String(err));
    } finally {
      setTunnelBusy(false);
    }
  };

  const handleCopyTunnel = () => {
    if (tunnel?.url) {
      navigator.clipboard.writeText(tunnel.url).then(() => {
        alert("HTTPS URL 을 클립보드에 복사했습니다.");
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
              {/* QR 코드 — 터널이 있으면 HTTPS QR 우선, 없으면 LAN QR */}
              <div className="preview-modal__qr-wrap">
                <img
                  className="preview-modal__qr"
                  src={tunnel ? tunnel.qrDataUrl : previewInfo.qrDataUrl}
                  alt="미리보기 QR 코드"
                />
              </div>

              {/* 핸드폰용 HTTPS 터널 URL (있을 때만) */}
              {tunnel && (
                <div className="preview-modal__url-row">
                  <span className="preview-modal__url-text">🔒 {tunnel.url}</span>
                  <button className="preview-modal__copy-btn" onClick={handleCopyTunnel}>
                    복사
                  </button>
                </div>
              )}

              {/* 핸드폰용 LAN URL */}
              <div className="preview-modal__url-row">
                <span className="preview-modal__url-text">📱 {previewInfo.url}</span>
                <button className="preview-modal__copy-btn" onClick={handleCopyUrl}>
                  복사
                </button>
              </div>

              {/* Mac 데스크톱 즉시 검증용 localhost URL */}
              {localhostUrl && (
                <div className="preview-modal__url-row">
                  <span className="preview-modal__url-text">💻 {localhostUrl}</span>
                  <button className="preview-modal__copy-btn" onClick={handleCopyLocalhost}>
                    복사
                  </button>
                </div>
              )}

              {/* 기본 안내 */}
              <p className="preview-modal__guide">
                💻 <strong>Mac</strong>: <code>localhost</code> URL 을 브라우저에 붙여넣어 즉시 검증.<br />
                📱 <strong>핸드폰 (iOS)</strong>: HTTPS 가 필요하므로 아래 "공개 HTTPS 터널 시작" 버튼을 사용하세요.<br />
                📱 <strong>핸드폰 (Android Chrome)</strong>: LAN URL QR 스캔으로도 카메라 동작.
              </p>

              {/* cloudflared 터널 섹션 */}
              <div className="preview-modal__https-notice">
                <strong>📱 핸드폰 (iOS 포함) HTTPS 터널</strong>
                <br />
                {!tunnel && !tunnelError && (
                  <>
                    <p style={{ margin: "8px 0", fontSize: "0.85em" }}>
                      iOS Safari 카메라는 HTTPS 가 필수입니다. 아래 버튼으로
                      <code>https://*.trycloudflare.com</code> 임시 공개 URL 을 발급받으면
                      QR 스캔으로 핸드폰에서 바로 검증할 수 있습니다.
                      <br />
                      <em>처음 사용 시</em> cloudflared (~7MB) 를 자동 다운로드합니다 (1회, 30초 정도).
                    </p>
                    <button
                      className="preview-modal__btn"
                      onClick={handleStartTunnel}
                      disabled={tunnelBusy}
                    >
                      {tunnelBusy ? "준비 중... (다운로드 중일 수 있음)" : "공개 HTTPS 터널 시작"}
                    </button>
                  </>
                )}
                {tunnel && (
                  <>
                    <p style={{ margin: "8px 0", fontSize: "0.85em" }}>
                      ✅ HTTPS 터널 활성화. 위 QR/URL 을 사용하세요.
                    </p>
                    <button
                      className="preview-modal__btn preview-modal__btn--danger"
                      onClick={handleStopTunnel}
                      disabled={tunnelBusy}
                    >
                      {tunnelBusy ? "종료 중..." : "터널 종료"}
                    </button>
                  </>
                )}
                {tunnelError && (
                  <>
                    <p style={{ margin: "8px 0", fontSize: "0.85em", color: "#ff9999", whiteSpace: "pre-wrap" }}>
                      ⚠️ {tunnelError}
                    </p>
                    <button
                      className="preview-modal__btn"
                      onClick={handleStartTunnel}
                      disabled={tunnelBusy}
                    >
                      다시 시도
                    </button>
                  </>
                )}
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
