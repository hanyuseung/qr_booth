import type { TourEvent } from "../types";
export function eventPhase(event: TourEvent, now = Date.now()) {
  if (event.status === "ended" || now >= Date.parse(event.ends_at))
    return "ended";
  if (event.status !== "published" || now < Date.parse(event.starts_at))
    return "upcoming";
  return "open";
}
export function dateLabel(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}
export function dateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
export function localInputDate(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function messageOf(error: unknown) {
  return error instanceof Error
    ? error.message
    : "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
}
export const errorMessages: Record<string, string> = {
  INVALID_QR:
    "유효하지 않거나 교체된 QR이에요. 부스에 부착된 QR을 다시 확인해 주세요.",
  EVENT_CLOSED: "지금은 스탬프를 받을 수 있는 행사 운영 시간이 아니에요.",
  BOOTH_INACTIVE: "현재 운영하지 않는 부스예요.",
  UNAUTHORIZED: "인증을 확인하지 못했어요. 다시 시도해 주세요.",
  FORBIDDEN: "운영자 권한이 있는 계정으로 로그인해 주세요.",
  NOT_FOUND: "행사를 찾을 수 없어요. QR이나 주소를 확인해 주세요.",
  RATE_LIMITED: "요청이 잠시 몰렸어요. 1분 후 다시 시도해 주세요.",
  INVALID_INPUT: "입력한 내용을 다시 확인해 주세요.",
  BOOTH_CHANGED:
    "다른 화면에서 부스가 변경되었어요. 창을 닫고 새로고침한 뒤 다시 수정해 주세요.",
};
