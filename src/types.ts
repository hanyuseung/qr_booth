export type EventStatus = "draft" | "published" | "ended";
export type BoothIcon =
  | "coffee"
  | "palette"
  | "leaf"
  | "camera"
  | "music"
  | "sparkles"
  | "gift"
  | "heart";
export interface TourEvent {
  id: string;
  slug: string;
  name: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string;
  status: EventStatus;
}
export interface Booth {
  id: string;
  event_id: string;
  name: string;
  description: string;
  location: string;
  icon: BoothIcon;
  color: string;
  sort_order: number;
  is_active: boolean;
  thumbnail_path?: string | null;
}
export interface Stamp {
  id: string;
  participant_id: string;
  booth_id: string;
  created_at: string;
}
export interface QrCode {
  id: string;
  booth_id: string;
  token: string;
  is_active: boolean;
  created_at: string;
}
export interface TourData {
  event: TourEvent;
  booths: Booth[];
  stamps: Stamp[];
}
export interface AdminData {
  event: TourEvent | null;
  booths: Booth[];
  qrCodes: QrCode[];
}
export interface ClaimResult {
  status: "claimed" | "already_claimed";
  booth_id: string;
  created_at: string;
}
export type EventInput = Omit<TourEvent, "id"> & { id?: string };
export type BoothInput = Omit<Booth, "id"> & { id?: string };
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
