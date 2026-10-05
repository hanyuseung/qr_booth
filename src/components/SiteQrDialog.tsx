import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { ArrowUpRight, Download, Printer } from "lucide-react";
import { publicSiteUrl } from "../lib/config";
import { messageOf } from "../lib/helpers";
import { Dialog, ErrorNotice, Loading } from "./Shared";

export function SiteQrDialog({
  slug,
  onClose,
}: {
  slug: string;
  onClose: () => void;
}) {
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(publicSiteUrl, {
      width: 1024,
      margin: 4,
      errorCorrectionLevel: "M",
    })
      .then((value) => {
        if (!cancelled) setImage(value);
      })
      .catch((err) => {
        if (!cancelled) setError(messageOf(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <Dialog title="사이트 접속 QR" onClose={onClose}>
      <div className="qr-preview">
        {image ? (
          <img src={image} alt="boryeongculture.site 접속 QR코드" />
        ) : (
          !error && <Loading text="QR을 만드는 중이에요" />
        )}
        <strong>{publicSiteUrl}</strong>
      </div>
      <p className="field-hint">
        스탬프북을 여는 안내용 QR이에요. 부스 방문 스탬프는 적립되지 않아요.
      </p>
      {error && <ErrorNotice message={error} />}
      {image && (
        <div className="site-qr-actions">
          <a
            className="button button-primary full-width"
            href={image}
            download="boryeongculture-site-qr.png"
          >
            <Download size={17} />
            QR 다운로드
          </a>
          <Link
            className="button button-secondary full-width"
            to={`/admin/print/${slug}?site=1`}
          >
            <Printer size={17} />
            사이트 QR 인쇄
          </Link>
          <a
            className="qr-test-link"
            href={publicSiteUrl}
            target="_blank"
            rel="noreferrer"
          >
            사이트 링크 확인 <ArrowUpRight size={14} />
          </a>
        </div>
      )}
    </Dialog>
  );
}
