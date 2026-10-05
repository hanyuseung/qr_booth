import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const appMode = env.VITE_APP_MODE || "demo";
  if (env.VERCEL === "1" && appMode !== "live") {
    throw new Error(
      "Vercel 배포에는 VITE_APP_MODE=live를 설정하세요. 체험 모드 배포를 중단했습니다.",
    );
  }
  if (!["demo", "live"].includes(appMode))
    throw new Error("VITE_APP_MODE must be demo or live");
  if (
    appMode === "live" &&
    (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY)
  ) {
    throw new Error(
      "live 모드는 VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY가 필요합니다.",
    );
  }
  if (env.VERCEL === "1") {
    let site: URL;
    try {
      site = new URL(env.VITE_PUBLIC_SITE_URL || "");
    } catch {
      throw new Error(
        "Vercel 배포에는 VITE_PUBLIC_SITE_URL에 최종 HTTPS 주소를 설정하세요.",
      );
    }
    if (
      site.protocol !== "https:" ||
      site.pathname !== "/" ||
      site.search ||
      site.hash ||
      site.username ||
      site.password
    ) {
      throw new Error(
        "VITE_PUBLIC_SITE_URL은 경로 없는 HTTPS 주소여야 합니다.",
      );
    }
  }
  return {
    plugins: [react()],
    test: { include: ["tests/**/*.test.ts"], testTimeout: 20000 },
  };
});
