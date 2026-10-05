import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  Compass,
  MapPin,
  QrCode,
  ScanLine,
  Sparkles,
  Ticket,
  Trophy,
} from "lucide-react";
import { api } from "../lib/api";
import { defaultSlug, isDemo } from "../lib/config";
import {
  dateLabel,
  dateTimeLabel,
  eventPhase,
  messageOf,
} from "../lib/helpers";
import {
  BoothVisual,
  Dialog,
  ErrorNotice,
  Loading,
} from "../components/Shared";
import type { TourData } from "../types";

type Filter = "all" | "remaining" | "visited";
export function TourPage() {
  const { slug = defaultSlug } = useParams();
  const location = useLocation();
  const [data, setData] = useState<TourData | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [helpOpen, setHelpOpen] = useState(false);
  const load = useCallback(async () => {
    try {
      setData(await api.tour(slug));
      setError("");
    } catch (err) {
      setError(messageOf(err));
    }
  }, [slug]);
  useEffect(() => {
    setData(null);
    void load();
    const onFocus = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("storage", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("storage", onFocus);
    };
  }, [load]);
  if (!data)
    return (
      <main className="page-shell">
        {error ? (
          <ErrorNotice message={error} retry={() => void load()} />
        ) : (
          <Loading text="나의 스탬프북을 펼치는 중이에요" />
        )}
      </main>
    );
  const stamps = new Map(data.stamps.map((s) => [s.booth_id, s]));
  const count = data.booths.filter((b) => stamps.has(b.id)).length;
  const total = data.booths.length;
  const complete = total > 0 && count === total;
  const phase = eventPhase(data.event);
  const highlighted = (location.state as { boothId?: string } | null)?.boothId;
  const result = (location.state as { result?: string } | null)?.result;
  const filtered = data.booths.filter(
    (b) =>
      filter === "all" ||
      (filter === "visited" ? stamps.has(b.id) : !stamps.has(b.id)),
  );
  return (
    <main className="page-shell tour-page">
      <section className="event-heading">
        <div className="event-kicker">
          <span className={`live-dot ${phase}`} />
          {phase === "open"
            ? "지금, 함께하는 중"
            : phase === "ended"
              ? "다음에 또 만나요"
              : "곧 만나요"}
          <span className="kicker-divider" />
          {dateLabel(data.event.starts_at)} — {dateLabel(data.event.ends_at)}
        </div>
        <div className="event-title-row">
          <div>
            <p className="eyebrow">COLLECT MOMENTS, NOT THINGS</p>
            <h1>
              {data.event.name}
              <span className="title-sparkle">✳</span>
            </h1>
            <p className="event-description">{data.event.description}</p>
          </div>
          <div className="location-pill">
            <MapPin size={16} />
            {data.event.location || "행사 현장"}
          </div>
        </div>
      </section>
      {error && <ErrorNotice message={error} retry={() => void load()} />}
      {result && (
        <div className="claim-toast" role="status">
          <CheckCheck size={20} />
          {result === "claimed"
            ? "새로운 스탬프를 모았어요. 다음 발견을 만나볼까요?"
            : "이미 모은 스탬프예요. 다른 부스를 만나보세요."}
        </div>
      )}
      <section
        className={`passport ${complete ? "passport-complete" : ""}`}
        aria-label="나의 스탬프 수집 현황"
      >
        <div className="passport-main">
          <div className="passport-label">
            <Ticket size={18} /> MY STAMP PASSPORT <span>나만의 작은 여정</span>
          </div>
          <h2>
            {complete
              ? "모든 순간을 모았어요!"
              : count
                ? "차곡차곡, 나만의 발견"
                : "오늘의 발견을 모아볼까요?"}
          </h2>
          <p>
            {complete
              ? "모든 부스를 만난 당신에게, 즐거운 추억이 가득하길."
              : "부스의 QR을 찍으면, 이곳에 스탬프가 쏙."}
          </p>
          <div className="passport-bottom">
            <div className="progress-info">
              <strong>
                {count}
                <span> / {total}</span>
              </strong>
              <span>
                {complete ? "스탬프 투어 완료" : "개의 스탬프를 모았어요"}
              </span>
            </div>
            <span className="progress-percent">
              {total ? Math.round((count / total) * 100) : 0}%
            </span>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="스탬프 수집 진행률"
            aria-valuenow={count}
            aria-valuemin={0}
            aria-valuemax={total || 1}
          >
            <div style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="passport-art" aria-hidden="true">
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <div className="mini-ticket ticket-back">
            <span>little discoveries</span>
            <Sparkles size={44} />
          </div>
          <div className="mini-ticket ticket-front">
            <span>HAVE A GOOD DAY</span>
            <div className="art-stamp">
              <Sparkles size={40} strokeWidth={1.4} />
            </div>
            <strong>모든 순간을, 모아</strong>
            <span>YOUR OWN JOURNEY</span>
          </div>
          <span className="art-star star-one">✦</span>
          <span className="art-star star-two">✳</span>
        </div>
      </section>
      <button className="how-to-strip" onClick={() => setHelpOpen(true)}>
        <span className="how-to-icon">
          <ScanLine size={23} />
        </span>
        <span>
          <strong>스탬프는 어떻게 모으나요?</strong>
          <span>부스에서 QR을 찾고, 카메라로 찰칵!</span>
        </span>
        <span className="how-to-action">
          참여 방법 <ChevronRight size={16} />
        </span>
      </button>
      <section className="booths-section" aria-labelledby="booths-heading">
        <div className="section-heading">
          <div>
            <span className="eyebrow">EXPLORE THE BOOTHS</span>
            <h2 id="booths-heading">
              오늘의 부스 <span>{total}</span>
            </h2>
          </div>
          <div className="filter-group" aria-label="부스 필터">
            {(
              [
                ["all", "전체"],
                ["remaining", "미방문"],
                ["visited", "방문 완료"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                aria-pressed={filter === value}
                className={filter === value ? "active" : ""}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="booth-grid">
          {filtered.map((booth, index) => {
            const stamp = stamps.get(booth.id);
            return (
              <article
                key={booth.id}
                className={`booth-card ${stamp ? "is-stamped" : ""} ${highlighted === booth.id ? "just-stamped" : ""}`}
                data-testid={`booth-${booth.id}`}
                style={{
                  gridColumn: (index % 2) + 1,
                  gridRow: Math.floor(index / 2) + 1,
                }}
              >
                <div className="booth-card-top">
                  <span className={`booth-icon color-${booth.color}`}>
                    <BoothVisual booth={booth} />
                  </span>
                  <span className="booth-number">
                    {String(data.booths.indexOf(booth) + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3>{booth.name}</h3>
                <p className="booth-description">{booth.description}</p>
                <div className="booth-location">
                  <MapPin size={13} />
                  {booth.location || `부스 ${index + 1}`}
                </div>
                <div className="booth-card-bottom">
                  {stamp ? (
                    <>
                      <span className="visited-label">
                        <Check size={14} /> 방문 완료
                      </span>
                      <time dateTime={stamp.created_at}>
                        {dateTimeLabel(stamp.created_at)}
                      </time>
                    </>
                  ) : (
                    <>
                      <span className="unvisited-label">
                        아직 만나기 전이에요
                      </span>
                      <span className="empty-stamp">
                        <Sparkles size={15} />
                      </span>
                    </>
                  )}
                </div>
                {stamp && (
                  <div className="collected-seal" aria-label="스탬프 획득">
                    <Check size={25} />
                    <span>COLLECTED</span>
                  </div>
                )}
              </article>
            );
          })}
          {complete && filtered.length > 0 && (
            <div
              className="completion-stamp-overlay"
              style={{
                gridRow: `1 / ${Math.min(2, Math.ceil(filtered.length / 2)) + 1}`,
              }}
              role="status"
              aria-label="모든 부스 방문 완료 도장"
            >
              <div className="completion-stamp">
                <span>보령의 순간을 모아</span>
                <Trophy aria-hidden="true" />
                <strong>전체 완료</strong>
                <span>모든 부스 방문 인증</span>
              </div>
            </div>
          )}
        </div>
        {filtered.length === 0 && (
          <div className="empty-state">
            <Compass size={32} />
            <h3>
              {!total
                ? "새로운 만남을 준비하고 있어요"
                : filter === "visited"
                  ? "첫 번째 발견을 기다리고 있어요"
                  : "모든 부스를 만났어요!"}
            </h3>
            <p>
              {!total
                ? "부스가 준비되면 이곳에 보여드릴게요."
                : filter === "visited"
                  ? "부스의 QR을 찍어 첫 스탬프를 모아보세요."
                  : "오늘 모은 스탬프를 천천히 둘러보세요."}
            </p>
          </div>
        )}
      </section>
      <div className="completion-note">
        <span className="completion-icon">
          <Trophy size={24} />
        </span>
        <div>
          <strong>
            {complete
              ? "당신의 스탬프북이 완성됐어요"
              : "하나씩 모으는 재미, 모두 모았을 때의 뿌듯함"}
          </strong>
          <p>
            {complete
              ? "오늘의 발견이 오래도록 좋은 기억으로 남기를 바라요."
              : "모든 부스를 방문하고 나만의 스탬프북을 완성해 보세요."}
          </p>
        </div>
        <Sparkles className="completion-sparkle" size={24} />
      </div>
      <p className="session-note">
        같은 브라우저로 참여해 주세요. 브라우저 데이터를 지우면 기록을 다시 찾기
        어려워요.
      </p>
      {helpOpen && (
        <Dialog
          title="작은 발견을 모으는 방법"
          onClose={() => setHelpOpen(false)}
        >
          <div className="help-steps">
            <div>
              <span>01</span>
              <div>
                <h3>마음이 가는 부스를 만나요</h3>
                <p>부스에 준비된 체험을 즐겨보세요.</p>
              </div>
            </div>
            <div>
              <span>02</span>
              <div>
                <h3>부스의 QR을 카메라로 찍어요</h3>
                <p>스마트폰 기본 카메라에서 링크를 열어주세요.</p>
              </div>
            </div>
            <div>
              <span>03</span>
              <div>
                <h3>나의 스탬프북에 쏙!</h3>
                <p>스탬프가 자동으로 쌓여요. 같은 부스는 한 번만 적립돼요.</p>
              </div>
            </div>
          </div>
          <p className="field-hint">
            인터넷 연결이 필요해요. 여러 QR을 열 때도 같은 브라우저를 이용해
            주세요.
          </p>
          {isDemo && (
            <div className="demo-experience">
              <strong>
                <QrCode size={16} /> 체험용 QR 링크
              </strong>
              <p>현장 QR을 스캔한 것처럼 적립 과정을 확인해 보세요.</p>
              <Link
                className="button button-primary"
                to={`/e/${slug}/scan/demo-booth-1-token`}
              >
                첫 부스 체험하기 <ArrowRight size={16} />
              </Link>
            </div>
          )}
          <button
            className="button button-secondary full-width"
            onClick={() => setHelpOpen(false)}
          >
            이제 둘러볼게요
          </button>
        </Dialog>
      )}
    </main>
  );
}
