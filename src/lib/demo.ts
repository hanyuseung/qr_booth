import {
  AppError,
  type AdminData,
  type BoothInput,
  type ClaimResult,
  type EventInput,
  type Stamp,
  type TourData,
} from "../types";
import { defaultSlug } from "./config";
import { eventPhase, errorMessages } from "./helpers";

export const DEMO_KEY = "moa-demo-v1";
type DemoState = AdminData & { stamps: Stamp[]; participantId: string };
function seed(): DemoState {
  const today = new Date();
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return {
    event: {
      id: "demo-event",
      slug: defaultSlug,
      name: "가을의 조각을 모아",
      description:
        "취향을 발견하는 작은 여행.\n부스마다 준비된 즐거움을 만나보세요.",
      location: "모아 페스티벌 · 중앙 광장",
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      status: "published",
    },
    booths: [
      [
        "coffee",
        "커피 한 모금",
        "나에게 꼭 맞는 커피 취향 찾기",
        "입구 왼쪽",
        "peach",
      ],
      [
        "palette",
        "색을 담는 시간",
        "작은 엽서에 오늘의 색을 담아요",
        "체험존 A",
        "lilac",
      ],
      [
        "leaf",
        "초록의 쉼표",
        "작은 식물과 함께 잠깐 쉬어가기",
        "가든존",
        "sage",
      ],
      [
        "camera",
        "오늘의 한 장",
        "지금 이 순간을 사진으로 남겨요",
        "포토존",
        "sky",
      ],
      [
        "music",
        "취향의 플레이리스트",
        "당신의 가을은 어떤 소리인가요?",
        "라운지",
        "butter",
      ],
      [
        "sparkles",
        "작은 발견 상점",
        "일상에 반짝임을 더하는 소품들",
        "마켓존",
        "rose",
      ],
    ].map(([icon, name, description, location, color], i) => ({
      id: `demo-booth-${i + 1}`,
      event_id: "demo-event",
      name,
      description,
      location,
      icon: icon as BoothInput["icon"],
      color,
      sort_order: i + 1,
      is_active: true,
    })),
    qrCodes: Array.from({ length: 6 }, (_, i) => ({
      id: `demo-qr-${i + 1}`,
      booth_id: `demo-booth-${i + 1}`,
      token: `demo-booth-${i + 1}-token`,
      is_active: true,
      created_at: today.toISOString(),
    })),
    stamps: [],
    participantId: crypto.randomUUID(),
  };
}
function read(): DemoState {
  const raw = localStorage.getItem(DEMO_KEY);
  if (raw) return JSON.parse(raw);
  const state = seed();
  write(state);
  return state;
}
function write(state: DemoState) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(state));
}
// Web Locks serialize simultaneous demo writes from multiple tabs.
async function mutate<T>(fn: (state: DemoState) => T): Promise<T> {
  const run = () => {
    const state = read();
    const result = fn(state);
    write(state);
    return result;
  };
  return navigator.locks ? navigator.locks.request(DEMO_KEY, run) : run();
}
export const demo = {
  async tour(slug: string): Promise<TourData> {
    const state = read();
    if (
      !state.event ||
      state.event.slug !== slug ||
      state.event.status === "draft"
    )
      throw new AppError("NOT_FOUND", errorMessages.NOT_FOUND);
    return {
      event: state.event,
      booths: state.booths
        .filter((b) => b.is_active)
        .sort((a, b) => a.sort_order - b.sort_order),
      stamps: state.stamps,
    };
  },
  async claim(slug: string, token: string): Promise<ClaimResult> {
    if (!navigator.onLine)
      throw new Error("인터넷 연결을 확인하고 다시 시도해 주세요.");
    return mutate((state) => {
      const qr = state.qrCodes.find((q) => q.token === token && q.is_active);
      const booth = state.booths.find((b) => b.id === qr?.booth_id);
      if (!qr || !booth || state.event?.slug !== slug)
        throw new AppError("INVALID_QR", errorMessages.INVALID_QR);
      if (!booth.is_active)
        throw new AppError("BOOTH_INACTIVE", errorMessages.BOOTH_INACTIVE);
      if (eventPhase(state.event) !== "open")
        throw new AppError("EVENT_CLOSED", errorMessages.EVENT_CLOSED);
      const existing = state.stamps.find((s) => s.booth_id === booth.id);
      if (existing)
        return {
          status: "already_claimed",
          booth_id: booth.id,
          created_at: existing.created_at,
        };
      const stamp = {
        id: crypto.randomUUID(),
        participant_id: state.participantId,
        booth_id: booth.id,
        created_at: new Date().toISOString(),
      };
      state.stamps.push(stamp);
      return {
        status: "claimed",
        booth_id: booth.id,
        created_at: stamp.created_at,
      };
    });
  },
  async admin(): Promise<AdminData> {
    const { event, booths, qrCodes } = read();
    return {
      event,
      booths: booths.sort((a, b) => a.sort_order - b.sort_order),
      qrCodes,
    };
  },
  async saveEvent(input: EventInput) {
    return mutate((state) => {
      state.event = { ...input, id: state.event?.id || crypto.randomUUID() };
    });
  },
  async saveBooth(input: BoothInput) {
    return mutate((state) => {
      const booth = { ...input, id: input.id || crypto.randomUUID() };
      const index = state.booths.findIndex((b) => b.id === booth.id);
      if (index < 0) state.booths.push(booth);
      else state.booths[index] = booth;
    });
  },
  async rotateQr(boothId: string) {
    return mutate((state) => {
      state.qrCodes
        .filter((q) => q.booth_id === boothId)
        .forEach((q) => {
          q.is_active = false;
        });
      state.qrCodes.push({
        id: crypto.randomUUID(),
        booth_id: boothId,
        token:
          crypto.randomUUID().replaceAll("-", "") +
          crypto.randomUUID().replaceAll("-", ""),
        is_active: true,
        created_at: new Date().toISOString(),
      });
    });
  },
};
