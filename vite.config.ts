import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const appMode = env.VITE_APP_MODE || "demo";
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
  return {
    plugins: [react()],
    test: { include: ["tests/**/*.test.ts"], testTimeout: 20000 },
  };
});
