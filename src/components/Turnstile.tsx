import { useEffect, useRef } from "react";
import { turnstileSiteKey } from "../lib/config";
type TurnstileApi = {
  render: (node: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}
let scriptPromise: Promise<void> | undefined;
function loadScript() {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise)
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        scriptPromise = undefined;
        reject(new Error("인증 확인을 불러오지 못했어요."));
      };
      document.head.append(script);
    });
  return scriptPromise;
}
export function Turnstile({
  onToken,
  onError,
}: {
  onToken: (token: string) => void;
  onError: (message: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onToken, onError });
  callbacks.current = { onToken, onError };
  useEffect(() => {
    let cancelled = false;
    let id: string | undefined;
    void loadScript()
      .then(() => {
        if (cancelled || !ref.current) return;
        id = window.turnstile!.render(ref.current, {
          sitekey: turnstileSiteKey,
          theme: "light",
          callback: (token: string) => callbacks.current.onToken(token),
          "expired-callback": () => callbacks.current.onToken(""),
          "error-callback": () =>
            callbacks.current.onError(
              "인증 확인에 실패했어요. 다시 시도해 주세요.",
            ),
        });
      })
      .catch((error) => {
        if (!cancelled) callbacks.current.onError(error.message);
      });
    return () => {
      cancelled = true;
      if (id) window.turnstile?.remove(id);
    };
  }, []);
  return <div className="captcha" ref={ref} />;
}
