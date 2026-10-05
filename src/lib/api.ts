import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  AppError,
  type AdminData,
  type BoothInput,
  type ClaimResult,
  type EventInput,
  type TourData,
} from "../types";
import { isDemo } from "./config";
import { demo } from "./demo";
import { errorMessages } from "./helpers";

function makeClient(key: string) {
  return isDemo
    ? null
    : createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        {
          auth: {
            storageKey: key,
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
          },
        },
      );
}
const participant = makeClient("moa-participant-auth");
const admin = makeClient("moa-admin-auth");
let signInPromise: Promise<void> | null = null;

async function ensureParticipant(captchaToken?: string) {
  if (isDemo) return;
  const run = async () => {
    const { data, error } = await participant!.auth.getSession();
    if (error)
      throw new Error("참가 세션을 확인하지 못했어요. 다시 시도해 주세요.");
    if (data.session) return;
    const result = await participant!.auth.signInAnonymously({
      options: { captchaToken },
    });
    if (result.error)
      throw new Error(
        "참가 인증을 시작하지 못했어요. 연결과 인증 확인 후 다시 시도해 주세요.",
      );
  };
  if (!signInPromise) {
    signInPromise = (async () => {
      if (navigator.locks)
        await navigator.locks.request("moa-participant-sign-in", run);
      else await run();
    })().finally(() => {
      signInPromise = null;
    });
  }
  return signInPromise;
}
async function invoke<T>(
  client: SupabaseClient,
  name: string,
  body: object,
): Promise<T> {
  const { data, error } = await client.functions.invoke(name, { body });
  if (error) {
    let code = "UNKNOWN";
    if (error.context instanceof Response) {
      const response = await error.context.json().catch(() => ({}));
      code = response.code || "UNKNOWN";
    }
    throw new AppError(
      code,
      errorMessages[code] ||
        "요청에 실패했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.",
    );
  }
  return data as T;
}
export const api = {
  async needsParticipantSession() {
    if (isDemo) return false;
    const { data, error } = await participant!.auth.getSession();
    if (error) throw error;
    return !data.session;
  },
  async tour(slug: string): Promise<TourData> {
    if (isDemo) return demo.tour(slug);
    const eventResult = await participant!
      .from("events")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (eventResult.error)
      throw new Error("행사를 불러오지 못했어요. 연결을 확인해 주세요.");
    const event = eventResult.data;
    if (!event) throw new AppError("NOT_FOUND", errorMessages.NOT_FOUND);
    const boothsResult = await participant!
      .from("booths")
      .select("*")
      .eq("event_id", event.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("name");
    if (boothsResult.error) throw new Error("부스 목록을 불러오지 못했어요.");
    const { data: auth, error: authError } =
      await participant!.auth.getSession();
    if (authError) throw new Error("참가 세션을 확인하지 못했어요.");
    const booths = boothsResult.data || [];
    let stamps = [];
    if (auth.session && booths.length) {
      const result = await participant!
        .from("stamps")
        .select("*")
        .eq("participant_id", auth.session.user.id)
        .in(
          "booth_id",
          booths.map((b) => b.id),
        );
      if (result.error) throw new Error("스탬프 기록을 불러오지 못했어요.");
      stamps = result.data || [];
    }
    return { event, booths, stamps } as TourData;
  },
  async claim(
    slug: string,
    token: string,
    captchaToken?: string,
  ): Promise<ClaimResult> {
    if (isDemo) return demo.claim(slug, token);
    await ensureParticipant(captchaToken);
    return invoke(participant!, "claim-stamp", { slug, token });
  },
  async adminSession() {
    if (isDemo) return true;
    const { data, error } = await admin!.auth.getSession();
    if (error) throw error;
    return Boolean(data.session);
  },
  async login(email: string, password: string, captchaToken?: string) {
    if (isDemo) return;
    const { error } = await admin!.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken },
    });
    if (error?.code === "captcha_failed")
      throw new Error(
        "인증 확인에 실패했어요. 다시 인증한 뒤 로그인해 주세요.",
      );
    if (error) throw new Error("이메일과 비밀번호를 확인해 주세요.");
    try {
      await this.admin();
    } catch (error) {
      await admin!.auth.signOut();
      throw error;
    }
  },
  async logout() {
    if (!isDemo) {
      const { error } = await admin!.auth.signOut();
      if (error) throw error;
    }
  },
  async admin(): Promise<AdminData> {
    return isDemo
      ? demo.admin()
      : invoke(admin!, "admin-action", { action: "snapshot" });
  },
  async saveEvent(event: EventInput) {
    return isDemo
      ? demo.saveEvent(event)
      : invoke<void>(admin!, "admin-action", { action: "save-event", event });
  },
  async saveBooth(booth: BoothInput) {
    return isDemo
      ? demo.saveBooth(booth)
      : invoke<void>(admin!, "admin-action", { action: "save-booth", booth });
  },
  async rotateQr(boothId: string) {
    return isDemo
      ? demo.rotateQr(boothId)
      : invoke<void>(admin!, "admin-action", {
          action: "rotate-qr",
          booth_id: boothId,
        });
  },
};
