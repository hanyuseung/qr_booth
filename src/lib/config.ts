export const isDemo = (import.meta.env.VITE_APP_MODE || "demo") === "demo";
export const defaultSlug =
  import.meta.env.VITE_DEFAULT_EVENT_SLUG || "fall-festival";
export const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";
export const publicSiteUrl = "https://boryeongculture.site";
export function siteUrl() {
  const configured = isDemo
    ? undefined
    : import.meta.env.VITE_PUBLIC_SITE_URL?.trim() || publicSiteUrl;
  const url = new URL(configured || window.location.origin);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("QR 기준 주소는 경로 없는 http(s) 도메인이어야 합니다.");
  }
  if (!isDemo && (!configured || url.protocol !== "https:")) {
    throw new Error(
      "운영용 QR 발급 전에 VITE_PUBLIC_SITE_URL에 최종 HTTPS 도메인을 설정하세요.",
    );
  }
  return url.origin;
}
export function qrUrl(slug: string, token: string) {
  return `${siteUrl()}/e/${encodeURIComponent(slug)}/scan/${encodeURIComponent(token)}`;
}
