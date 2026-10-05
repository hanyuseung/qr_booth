import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Download,
  LogOut,
  Pencil,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { api } from "../lib/api";
import { defaultSlug, isDemo, qrUrl } from "../lib/config";
import { localInputDate, messageOf } from "../lib/helpers";
import {
  BoothSymbol,
  Dialog,
  ErrorNotice,
  icons,
  Loading,
  SuccessMessage,
} from "../components/Shared";
import type {
  AdminData,
  Booth,
  BoothInput,
  EventInput,
  TourEvent,
} from "../types";

export function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [eventEditor, setEventEditor] = useState(false);
  const [boothEditor, setBoothEditor] = useState<Booth | "new" | null>(null);
  const [qrBooth, setQrBooth] = useState<Booth | null>(null);
  const [busyBooth, setBusyBooth] = useState("");
  const load = useCallback(async () => {
    try {
      setData(await api.admin());
      setError("");
    } catch (err) {
      setError(messageOf(err));
    }
  }, []);
  useEffect(() => {
    void api
      .adminSession()
      .then((session) => {
        setAuthenticated(session);
        if (session) void load();
      })
      .catch((err) => {
        setAuthenticated(false);
        setError(messageOf(err));
      });
  }, [load]);
  const saved = async (message: string) => {
    setNotice(message);
    await load();
  };
  const openQr = async (booth: Booth) => {
    setError("");
    setBusyBooth(booth.id);
    try {
      qrUrl(data!.event!.slug, "validation");
      if (!data!.qrCodes.some((q) => q.booth_id === booth.id && q.is_active)) {
        await api.rotateQr(booth.id);
        await load();
      }
      setQrBooth(booth);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusyBooth("");
    }
  };
  if (authenticated === null)
    return (
      <main className="page-shell">
        <Loading />
      </main>
    );
  if (!authenticated)
    return (
      <Login
        onSuccess={() => {
          setAuthenticated(true);
          void load();
        }}
      />
    );
  return (
    <main className="page-shell admin-page">
      <div className="admin-title">
        <div>
          <p className="eyebrow">BEHIND THE LITTLE DISCOVERIES</p>
          <h1>행사를 준비하는 공간</h1>
          <p>부스를 만들고, 즐거운 만남을 준비하세요.</p>
        </div>
        {!isDemo && (
          <button
            className="button button-secondary"
            onClick={() => {
              void api
                .logout()
                .then(() => {
                  setAuthenticated(false);
                  setData(null);
                })
                .catch((err) => setError(messageOf(err)));
            }}
          >
            <LogOut size={16} /> 로그아웃
          </button>
        )}
      </div>
      {isDemo && (
        <div className="info-notice">
          <ShieldCheck size={19} />
          <span>
            체험용 운영자 화면이에요. 변경 사항은 이 브라우저에만 반영돼요.
          </span>
        </div>
      )}
      {error && <ErrorNotice message={error} retry={() => void load()} />}
      {notice && <SuccessMessage>{notice}</SuccessMessage>}
      {!data ? (
        !error && <Loading />
      ) : (
        <>
          <section className="admin-event-panel">
            <div>
              <span className="eyebrow">YOUR EVENT</span>
              <h2>{data.event?.name || "첫 행사를 만들어볼까요?"}</h2>
              <p>
                {data.event
                  ? `${data.event.location || "장소 미설정"} · ${data.event.status === "published" ? "공개 중" : data.event.status === "ended" ? "종료" : "준비 중"}`
                  : "행사명과 운영 기간을 설정한 다음 부스를 추가해 주세요."}
              </p>
            </div>
            <div className="button-row">
              {data.event && (
                <Link
                  className="button button-secondary"
                  to={`/e/${data.event.slug}`}
                >
                  참가자 화면 <ArrowUpRight size={15} />
                </Link>
              )}
              <button
                className="button button-dark"
                onClick={() => setEventEditor(true)}
              >
                <Settings2 size={16} />
                {data.event ? "행사 설정" : "행사 만들기"}
              </button>
            </div>
          </section>
          {data.event && (
            <>
              <div className="admin-stats">
                <div>
                  <span>전체 부스</span>
                  <strong>
                    {data.booths.length}
                    <small>개</small>
                  </strong>
                </div>
                <div>
                  <span>운영 중인 부스</span>
                  <strong>
                    {data.booths.filter((b) => b.is_active).length}
                    <small>개</small>
                  </strong>
                </div>
                <div>
                  <span>발급된 QR</span>
                  <strong>
                    {data.qrCodes.filter((q) => q.is_active).length}
                    <small>개</small>
                  </strong>
                </div>
              </div>
              <section>
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">BOOTH MANAGEMENT</p>
                    <h2>부스와 QR 관리</h2>
                  </div>
                  <div className="button-row">
                    <Link
                      className="button button-secondary"
                      to={`/admin/print/${data.event.slug}`}
                    >
                      <Printer size={16} />
                      <span className="desktop-only">전체 QR </span>인쇄
                    </Link>
                    <button
                      className="button button-primary"
                      onClick={() => setBoothEditor("new")}
                    >
                      <Plus size={17} />
                      부스 추가
                    </button>
                  </div>
                </div>
                <p className="field-hint">
                  행사 중 부스 활성 상태를 바꾸면 참가자의 수집 목표와 완료
                  기준도 달라져요.
                </p>
                <div className="admin-booth-list">
                  {data.booths.map((booth) => (
                    <article className="admin-booth-row" key={booth.id}>
                      <span className={`booth-icon color-${booth.color}`}>
                        <BoothSymbol icon={booth.icon} size={25} />
                      </span>
                      <div className="admin-booth-info">
                        <h3>
                          {booth.name}{" "}
                          <span
                            className={`status-tag ${booth.is_active ? "active" : ""}`}
                          >
                            {booth.is_active ? "운영 중" : "비활성"}
                          </span>
                        </h3>
                        <p>
                          {booth.location || "위치 미설정"} · 표시 순서{" "}
                          {booth.sort_order}
                        </p>
                      </div>
                      <div className="button-row">
                        <button
                          className="button button-secondary"
                          aria-label={`${booth.name} 수정`}
                          onClick={() => setBoothEditor(booth)}
                        >
                          <Pencil size={15} />
                          <span className="desktop-only">수정</span>
                        </button>
                        <button
                          className="button button-secondary"
                          disabled={busyBooth === booth.id}
                          onClick={() => void openQr(booth)}
                          aria-label={`${booth.name} QR`}
                        >
                          <QrCode size={16} />
                          {busyBooth === booth.id ? "준비 중" : "QR"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                {!data.booths.length && (
                  <div className="empty-state">
                    <QrCode size={30} />
                    <h3>첫 번째 부스를 추가해 주세요</h3>
                    <p>부스를 만든 다음 고유 QR을 발급할 수 있어요.</p>
                  </div>
                )}
              </section>
            </>
          )}
          {eventEditor && (
            <EventEditor
              event={data.event}
              onClose={() => setEventEditor(false)}
              onSaved={() => {
                setEventEditor(false);
                void saved("행사 설정을 저장했어요.");
              }}
            />
          )}
          {boothEditor && data.event && (
            <BoothEditor
              booth={boothEditor === "new" ? null : boothEditor}
              eventId={data.event.id}
              nextOrder={
                Math.max(0, ...data.booths.map((b) => b.sort_order)) + 1
              }
              onClose={() => setBoothEditor(null)}
              onSaved={() => {
                setBoothEditor(null);
                void saved("부스 정보를 저장했어요.");
              }}
            />
          )}
          {qrBooth && data.event && (
            <QrDialog
              booth={qrBooth}
              event={data.event}
              token={
                data.qrCodes.find(
                  (q) => q.booth_id === qrBooth.id && q.is_active,
                )?.token
              }
              onClose={() => setQrBooth(null)}
              onRotate={async () => {
                await api.rotateQr(qrBooth.id);
                await load();
              }}
            />
          )}
        </>
      )}
    </main>
  );
}

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api.login(String(form.get("email")), String(form.get("password")));
      onSuccess();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="page-shell login-page">
      <section className="login-panel">
        <span className="login-icon">
          <ShieldCheck size={30} />
        </span>
        <p className="eyebrow">FOR ORGANIZERS</p>
        <h1>운영자 로그인</h1>
        <p>즐거운 하루를 준비하는 당신을 환영해요.</p>
        <form onSubmit={submit}>
          <label>
            이메일
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              placeholder="hello@example.com"
            />
          </label>
          <label>
            비밀번호
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="비밀번호를 입력하세요"
            />
          </label>
          {error && <ErrorNotice message={error} />}
          <button className="button button-primary full-width" disabled={busy}>
            {busy ? "확인 중…" : "로그인"}
          </button>
        </form>
        <p className="field-hint">
          사전에 등록된 운영자 계정만 이용할 수 있어요.
        </p>
        <Link className="text-button" to="/">
          <ArrowLeft size={14} /> 스탬프북으로 돌아가기
        </Link>
      </section>
    </main>
  );
}

function EventEditor({
  event,
  onClose,
  onSaved,
}: {
  event: TourEvent | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const values = new FormData(e.currentTarget);
    const input: EventInput = {
      id: event?.id,
      name: String(values.get("name")).trim(),
      slug: String(values.get("slug")).trim(),
      description: String(values.get("description")).trim(),
      location: String(values.get("location")).trim(),
      starts_at: new Date(String(values.get("starts_at"))).toISOString(),
      ends_at: new Date(String(values.get("ends_at"))).toISOString(),
      status: values.get("status") as EventInput["status"],
    };
    if (
      !input.name ||
      Date.parse(input.starts_at) >= Date.parse(input.ends_at)
    ) {
      setError("행사명과 시작·종료 시간을 확인해 주세요.");
      return;
    }
    setBusy(true);
    try {
      await api.saveEvent(input);
      onSaved();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={event ? "행사 설정" : "새 행사 만들기"} onClose={onClose}>
      <form onSubmit={submit} className="editor-form">
        <label>
          행사명
          <input
            name="name"
            defaultValue={event?.name}
            required
            maxLength={80}
            placeholder="우리의 특별한 하루"
          />
        </label>
        <label>
          행사 주소 이름
          <input
            name="slug"
            defaultValue={event?.slug || defaultSlug}
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            maxLength={64}
            readOnly={Boolean(event)}
          />
        </label>
        <p className="field-hint">
          QR 주소에 사용해요. 발급된 QR을 유지하기 위해 생성 후에는 변경할 수
          없어요.
        </p>
        <label>
          행사 소개
          <textarea
            name="description"
            defaultValue={event?.description}
            maxLength={240}
            rows={3}
          />
        </label>
        <label>
          장소
          <input
            name="location"
            defaultValue={event?.location}
            maxLength={100}
          />
        </label>
        <div className="form-grid">
          <label>
            시작 (현재 기기 시간)
            <input
              name="starts_at"
              type="datetime-local"
              required
              defaultValue={localInputDate(
                event?.starts_at || now.toISOString(),
              )}
            />
          </label>
          <label>
            종료 (현재 기기 시간)
            <input
              name="ends_at"
              type="datetime-local"
              required
              defaultValue={localInputDate(
                event?.ends_at || tomorrow.toISOString(),
              )}
            />
          </label>
        </div>
        <label>
          공개 상태
          <select name="status" defaultValue={event?.status || "draft"}>
            <option value="draft">준비 중 · 참가자에게 숨김</option>
            <option value="published">공개 · 운영 시간 내 적립 가능</option>
            <option value="ended">종료 · 기록 조회만 가능</option>
          </select>
        </label>
        {error && <ErrorNotice message={error} />}
        <button className="button button-primary full-width" disabled={busy}>
          <Check size={17} />
          {busy ? "저장 중…" : "행사 저장"}
        </button>
      </form>
    </Dialog>
  );
}

function BoothEditor({
  booth,
  eventId,
  nextOrder,
  onClose,
  onSaved,
}: {
  booth: Booth | null;
  eventId: string;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const values = new FormData(e.currentTarget);
    const input: BoothInput = {
      id: booth?.id,
      event_id: eventId,
      name: String(values.get("name")).trim(),
      description: String(values.get("description")).trim(),
      location: String(values.get("location")).trim(),
      sort_order: Number(values.get("sort_order")),
      icon: values.get("icon") as BoothInput["icon"],
      color: String(values.get("color")),
      is_active: values.get("is_active") === "on",
    };
    if (!input.name) {
      setError("부스명을 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.saveBooth(input);
      onSaved();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={booth ? "부스 수정" : "새로운 부스"} onClose={onClose}>
      <form className="editor-form" onSubmit={submit}>
        <label>
          부스명
          <input
            name="name"
            required
            maxLength={60}
            defaultValue={booth?.name}
            placeholder="어떤 발견이 기다리나요?"
          />
        </label>
        <label>
          한 줄 소개
          <input
            name="description"
            maxLength={160}
            defaultValue={booth?.description}
          />
        </label>
        <label>
          위치
          <input
            name="location"
            maxLength={80}
            defaultValue={booth?.location}
            placeholder="예: 중앙 광장 A-01"
          />
        </label>
        <div className="form-grid">
          <label>
            아이콘
            <select name="icon" defaultValue={booth?.icon || "sparkles"}>
              {Object.keys(icons).map((icon, i) => (
                <option key={icon} value={icon}>
                  {
                    [
                      "커피",
                      "미술",
                      "식물",
                      "사진",
                      "음악",
                      "발견",
                      "선물",
                      "하트",
                    ][i]
                  }
                </option>
              ))}
            </select>
          </label>
          <label>
            카드 색상
            <select name="color" defaultValue={booth?.color || "peach"}>
              {[
                ["peach", "피치"],
                ["lilac", "라일락"],
                ["sage", "세이지"],
                ["sky", "스카이"],
                ["butter", "버터"],
                ["rose", "로즈"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          표시 순서
          <input
            name="sort_order"
            type="number"
            required
            min={0}
            max={9999}
            step={1}
            defaultValue={booth?.sort_order ?? nextOrder}
          />
        </label>
        <label className="checkbox-label">
          <input
            name="is_active"
            type="checkbox"
            defaultChecked={booth?.is_active ?? true}
          />
          운영 중인 부스로 표시
        </label>
        <p className="field-hint">
          비활성화한 부스의 방문 기록은 보존되며, 수집 목표에서는 제외돼요.
        </p>
        {error && <ErrorNotice message={error} />}
        <button className="button button-primary full-width" disabled={busy}>
          <Check size={17} />
          {busy ? "저장 중…" : "부스 저장"}
        </button>
      </form>
    </Dialog>
  );
}

function QrDialog({
  booth,
  event,
  token,
  onClose,
  onRotate,
}: {
  booth: Booth;
  event: TourEvent;
  token?: string;
  onClose: () => void;
  onRotate: () => Promise<void>;
}) {
  const [image, setImage] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setImage("");
    if (!token) return;
    try {
      const link = qrUrl(event.slug, token);
      setUrl(link);
      void QRCode.toDataURL(link, {
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
    } catch (err) {
      setError(messageOf(err));
    }
    return () => {
      cancelled = true;
    };
  }, [token, event.slug]);
  return (
    <Dialog title={`${booth.name} QR`} onClose={onClose}>
      <div className="qr-preview">
        {image ? (
          <img src={image} alt={`${booth.name} 방문 QR코드`} />
        ) : (
          !error && <Loading text="QR을 만드는 중이에요" />
        )}
        <strong>{event.name}</strong>
        <span>{booth.name}</span>
      </div>
      {isDemo && (
        <p className="field-hint">
          체험용 QR이에요. 다른 기기에서는 별도의 체험 기록으로 열려요.
        </p>
      )}
      {error && <ErrorNotice message={error} />}
      {image && (
        <>
          <a
            className="button button-primary full-width"
            href={image}
            download={`${event.slug}-${booth.name.replace(/[^\p{L}\p{N}_-]/gu, "_")}-qr.png`}
          >
            <Download size={17} />
            QR 다운로드
          </a>
          <a
            className="qr-test-link"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            QR 링크 확인 <ArrowUpRight size={14} />
          </a>
        </>
      )}
      {confirm ? (
        <div className="rotate-confirm">
          <p>
            재발급하면 기존 QR은 사용할 수 없어요. 부스의 인쇄물도 교체해
            주세요.
          </p>
          <div className="button-row">
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              취소
            </button>
            <button
              className="button button-primary"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setError("");
                void onRotate()
                  .then(() => setConfirm(false))
                  .catch((err) => setError(messageOf(err)))
                  .finally(() => setBusy(false));
              }}
            >
              {busy ? "재발급 중…" : "QR 교체하기"}
            </button>
          </div>
        </div>
      ) : (
        <button
          className="text-button qr-rotate"
          onClick={() => setConfirm(true)}
        >
          <RefreshCw size={14} />
          QR 재발급
        </button>
      )}
    </Dialog>
  );
}
