import { endpoint, checkRpc } from "../_shared/http.ts";
import {
  parseBooth,
  parseEvent,
  RequestError,
  uuid,
} from "../_shared/validation.ts";

Deno.serve(
  endpoint(async (body, db) => {
    if (body.action === "snapshot") {
      const eventResult = await db
        .from("events")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (eventResult.error) throw eventResult.error;
      if (!eventResult.data) return { event: null, booths: [], qrCodes: [] };
      const boothsResult = await db
        .from("booths")
        .select("*")
        .eq("event_id", eventResult.data.id)
        .order("sort_order")
        .order("name");
      if (boothsResult.error) throw boothsResult.error;
      const booths = boothsResult.data || [];
      const qrResult = booths.length
        ? await db
            .from("booth_qr_codes")
            .select("*")
            .in(
              "booth_id",
              booths.map((b) => b.id),
            )
            .eq("is_active", true)
        : { data: [], error: null };
      if (qrResult.error) throw qrResult.error;
      return { event: eventResult.data, booths, qrCodes: qrResult.data || [] };
    }
    if (body.action === "save-event") {
      const { id, ...event } = parseEvent(body.event);
      // Never change an existing event's public slug (the DB enforces this too).
      if (id) {
        const { data, error } = await db
          .from("events")
          .update(event)
          .eq("id", id)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new RequestError("NOT_FOUND", 404);
      } else {
        const { error } = await db.from("events").insert(event);
        if (error?.code === "23505")
          throw new RequestError("INVALID_INPUT", 409);
        if (error) throw error;
      }
      return { ok: true };
    }
    if (body.action === "save-booth") {
      const { id, event_id, ...booth } = parseBooth(body.booth);
      if (id) {
        const { data, error } = await db
          .from("booths")
          .update(booth)
          .eq("id", id)
          .eq("event_id", event_id)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new RequestError("NOT_FOUND", 404);
      } else {
        const { error } = await db
          .from("booths")
          .insert({ ...booth, event_id });
        if (error) throw error;
      }
      return { ok: true };
    }
    if (body.action === "rotate-qr") {
      const boothId = uuid(body.booth_id);
      const token = Array.from(
        crypto.getRandomValues(new Uint8Array(32)),
        (n) => n.toString(16).padStart(2, "0"),
      ).join("");
      const { data, error } = await db.rpc("rotate_booth_qr", {
        p_booth: boothId,
        p_token: token,
      });
      return checkRpc(data, error);
    }
    throw new RequestError("INVALID_INPUT", 400);
  }, true),
);
