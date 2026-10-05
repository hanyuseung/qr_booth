import { describe, expect, it } from "vitest";
import {
  parseBooth,
  parseClaim,
  parseEvent,
} from "../supabase/functions/_shared/validation";
describe("untrusted API input", () => {
  it("accepts only a valid event and random QR token, ignoring spoofed identity", () => {
    const parsed = parseClaim({
      slug: "fall-festival",
      token: "a".repeat(64),
      participant_id: "someone-else",
    });
    expect(parsed).toEqual({ slug: "fall-festival", token: "a".repeat(64) });
    for (const input of [
      null,
      [],
      { slug: "../admin", token: "a".repeat(64) },
      { slug: "fall", token: "short" },
    ])
      expect(() => parseClaim(input)).toThrow();
  });
  it("requires valid increasing event times and a stable slug format", () => {
    const event = {
      slug: "fall",
      name: "Test",
      description: "",
      location: "",
      starts_at: "2026-10-01T09:00:00Z",
      ends_at: "2026-10-01T18:00:00Z",
      status: "published",
    };
    expect(parseEvent(event).name).toBe("Test");
    expect(() => parseEvent({ ...event, ends_at: event.starts_at })).toThrow();
    expect(() => parseEvent({ ...event, starts_at: "not-a-date" })).toThrow();
    expect(() => parseEvent({ ...event, status: "anything" })).toThrow();
  });
  it("rejects arbitrary style values and coerced administrative fields", () => {
    const booth = {
      event_id: "10000000-0000-4000-8000-000000000001",
      name: "Test",
      description: "",
      location: "",
      icon: "coffee",
      color: "peach",
      is_active: true,
      sort_order: 1,
    };
    expect(parseBooth(booth).name).toBe("Test");
    expect(() => parseBooth({ ...booth, color: "anything" })).toThrow();
    expect(() => parseBooth({ ...booth, is_active: "true" })).toThrow();
    expect(() => parseBooth({ ...booth, sort_order: 0.1 })).toThrow();
    expect(() => parseBooth({ ...booth, name: " " })).toThrow();
  });
});
