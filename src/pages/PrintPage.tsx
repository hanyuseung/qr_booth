import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import QRCode from "qrcode";
import { ArrowLeft, Printer, Star } from "lucide-react";
import { api } from "../lib/api";
import { isDemo, qrUrl } from "../lib/config";
import { messageOf } from "../lib/helpers";
import { ErrorNotice, Loading } from "../components/Shared";
import type { AdminData, Booth } from "../types";

export function PrintPage() {
  const { slug } = useParams();
  const [data, setData] = useState<AdminData | null>(null);
  const [cards, setCards] = useState<{ booth: Booth; image: string }[]>([]);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!(await api.adminSession()))
        throw new Error("운영자 로그인 후 인쇄 화면을 열어 주세요.");
      const snapshot = await api.admin();
      if (!snapshot.event || snapshot.event.slug !== slug)
        throw new Error("인쇄할 행사를 찾을 수 없어요.");
      const missingNames: string[] = [];
      const results = await Promise.all(
        snapshot.booths
          .filter((b) => b.is_active)
          .map(async (booth) => {
            const qr = snapshot.qrCodes.find(
              (q) => q.booth_id === booth.id && q.is_active,
            );
            if (!qr) {
              missingNames.push(booth.name);
              return null;
            }
            const image = await QRCode.toDataURL(
              qrUrl(snapshot.event!.slug, qr.token),
              { width: 1024, margin: 4, errorCorrectionLevel: "M" },
            );
            return { booth, image };
          }),
      );
      if (!cancelled) {
        setData(snapshot);
        setCards(results.filter((v): v is NonNullable<typeof v> => Boolean(v)));
        setMissing(missingNames);
      }
    })().catch((err) => {
      if (!cancelled) setError(messageOf(err));
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);
  return (
    <main className="page-shell print-page">
      <div className="print-toolbar no-print">
        <div>
          <Link className="text-button" to="/admin">
            <ArrowLeft size={15} />
            운영자 화면으로
          </Link>
          <h1>부스 QR 인쇄</h1>
          <p>A4 한 장에 부스 2개씩 인쇄해요. 배율은 100%로 설정해 주세요.</p>
        </div>
        <button
          className="button button-primary"
          disabled={!cards.length || missing.length > 0}
          onClick={() => window.print()}
        >
          <Printer size={17} />
          인쇄하기
        </button>
      </div>
      {error && <ErrorNotice message={error} />}
      {!data && !error && <Loading text="인쇄물을 준비하는 중이에요" />}
      {missing.length > 0 && (
        <div className="no-print">
          <ErrorNotice
            message={`QR이 없는 부스: ${missing.join(", ")}. 운영자 화면에서 QR을 먼저 발급해 주세요.`}
          />
        </div>
      )}
      {data && cards.length === 0 && !missing.length && (
        <p className="empty-state">운영 중인 부스를 먼저 추가해 주세요.</p>
      )}
      <div className="print-grid">
        {cards.map(({ booth, image }) => (
          <article className="print-card" key={booth.id}>
            <div className="print-brand">
              <Star size={21} fill="currentColor" /> 모아{" "}
              <span>STAMP TOUR</span>
            </div>
            {isDemo && (
              <span className="print-demo">
                체험용 · 운영용으로 사용하지 마세요
              </span>
            )}
            <p>{data?.event?.name}</p>
            <h2>{booth.name}</h2>
            <img src={image} alt={`${booth.name} 방문 QR`} />
            <h3>오늘의 발견을 스탬프로 모아보세요</h3>
            <p>
              스마트폰 카메라로 QR을 찍고
              <br />
              링크를 열면 스탬프가 쏙!
            </p>
            <small>같은 브라우저로 참여해 주세요 · 부스당 1회 적립</small>
          </article>
        ))}
      </div>
    </main>
  );
}
