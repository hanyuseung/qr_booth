import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ScanLine } from "lucide-react";
import { api } from "../lib/api";
import { defaultSlug, isDemo, turnstileSiteKey } from "../lib/config";
import { messageOf } from "../lib/helpers";
import { ErrorNotice, Loading } from "../components/Shared";
import { Turnstile } from "../components/Turnstile";
import type { ClaimResult } from "../types";

export function ScanPage() {
  const { slug = defaultSlug, token = "" } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [needsCaptcha, setNeedsCaptcha] = useState(false);
  const [captcha, setCaptcha] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [checked, setChecked] = useState(false);
  const pending = useRef<{ key: string; promise: Promise<ClaimResult> } | null>(
    null,
  );
  useEffect(() => {
    let cancelled = false;
    void api
      .needsParticipantSession()
      .then((needed) => {
        if (!cancelled) {
          setNeedsCaptcha(!isDemo && Boolean(turnstileSiteKey) && needed);
          setChecked(true);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(messageOf(err));
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  useEffect(() => {
    if (!checked || (needsCaptcha && !captcha)) return;
    const key = `${slug}:${token}:${attempt}:${captcha}`;
    if (pending.current?.key !== key)
      pending.current = {
        key,
        promise: api.claim(slug, token, captcha || undefined),
      };
    let cancelled = false;
    void pending.current.promise
      .then((result) => {
        if (cancelled) return;
        navigate(`/e/${encodeURIComponent(slug)}`, {
          replace: true,
          state: { boothId: result.booth_id, result: result.status },
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(messageOf(err));
          setCaptcha("");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug, token, checked, captcha, needsCaptcha, attempt, navigate]);
  const retry = () => {
    setError("");
    setCaptcha("");
    setChecked(false);
    setAttempt((n) => n + 1);
  };
  return (
    <main className="page-shell scan-page">
      <section className="scan-panel">
        <span className="scan-illustration">
          <ScanLine size={42} />
        </span>
        <p className="eyebrow">A NEW LITTLE DISCOVERY</p>
        <h1>반가워요, 새로운 발견!</h1>
        <p>부스를 확인하고 스탬프를 모으고 있어요.</p>
        {error ? (
          <ErrorNotice message={error} retry={retry} />
        ) : checked && needsCaptcha && !captcha ? (
          <>
            <p className="field-hint">
              처음 참여할 때 한 번, 아래 인증을 완료해 주세요.
            </p>
            <Turnstile key={attempt} onToken={setCaptcha} onError={setError} />
          </>
        ) : (
          <Loading text="스탬프를 확인하는 중이에요" />
        )}
        <Link className="text-button" to={`/e/${encodeURIComponent(slug)}`}>
          나의 스탬프북으로 돌아가기
        </Link>
      </section>
    </main>
  );
}
