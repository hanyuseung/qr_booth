import { endpoint, checkRpc } from "../_shared/http.ts";
import {
  parseBooth,
  parseEvent,
  parseThumbnail,
  RequestError,
  uuid,
} from "../_shared/validation.ts";

function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}

export const adminHandler = endpoint(
  async (body, db) => {
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
      return {
        event: eventResult.data,
        booths,
        qrCodes: qrResult.data || [],
      };
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
      const thumbnail = parseThumbnail(body.thumbnail);
      const storage = db.storage.from("booth-thumbnails");
      let oldPath: string | null = null;
      if (id) {
        const existing = await db
          .from("booths")
          .select("thumbnail_path")
          .eq("id", id)
          .eq("event_id", event_id)
          .maybeSingle();
        if (existing.error) throw existing.error;
        if (!existing.data) throw new RequestError("NOT_FOUND", 404);
        oldPath = existing.data.thumbnail_path;
      }
      const newPath = thumbnail
        ? `${event_id}/${crypto.randomUUID()}.webp`
        : null;
      if (thumbnail && newPath) {
        const { error } = await storage.upload(newPath, thumbnail, {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: false,
        });
        if (error) throw error;
      }
      try {
        const values = {
          ...booth,
          ...(thumbnail !== undefined ? { thumbnail_path: newPath } : {}),
        };
        if (id) {
          let update = db
            .from("booths")
            .update(values)
            .eq("id", id)
            .eq("event_id", event_id);
          // Compare-and-swap prevents concurrent photo edits from orphaning
          // the winning upload or cleaning up an image still in use.
          if (thumbnail !== undefined) {
            update =
              oldPath === null
                ? update.is("thumbnail_path", null)
                : update.eq("thumbnail_path", oldPath);
          }
          const { data, error } = await update.select("id").maybeSingle();
          if (error) throw error;
          if (!data) throw new RequestError("BOOTH_CHANGED", 409);
        } else {
          const { error } = await db
            .from("booths")
            .insert({ ...values, event_id });
          if (error) throw error;
        }
      } catch (error) {
        if (newPath) {
          const cleanup = await storage
            .remove([newPath])
            .catch(() => ({ error: true }));
          if (cleanup.error) console.error("Thumbnail rollback cleanup failed");
        }
        throw error;
      }
      if (thumbnail !== undefined && oldPath) {
        const cleanup = await storage
          .remove([oldPath])
          .catch(() => ({ error: true }));
        if (cleanup.error) console.error("Thumbnail cleanup failed");
      }
      return { ok: true };
    }
    if (body.action === "delete-booth") {
      const boothId = uuid(body.booth_id);
      const { data, error } = await db
        .from("booths")
        .delete()
        .eq("id", boothId)
        .select("thumbnail_path")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new RequestError("NOT_FOUND", 404);
      if (data.thumbnail_path) {
        const cleanup = await db.storage
          .from("booth-thumbnails")
          .remove([data.thumbnail_path])
          .catch(() => ({ error: true }));
        if (cleanup.error) console.error("Thumbnail cleanup failed");
      }
      return { ok: true };
    }
    if (body.action === "generate-all-qr") {
      const eventId = uuid(body.event_id);
      const booths = await db
        .from("booths")
        .select("id")
        .eq("event_id", eventId)
        .eq("is_active", true);
      if (booths.error) throw booths.error;
      const { data, error } = await db.rpc("generate_missing_booth_qrs", {
        p_event: eventId,
        p_codes: (booths.data || []).map((b) => ({
          booth_id: b.id,
          token: randomToken(),
        })),
      });
      return checkRpc(data, error);
    }
    if (body.action === "rotate-qr") {
      const boothId = uuid(body.booth_id);
      const token = randomToken();
      const { data, error } = await db.rpc("rotate_booth_qr", {
        p_booth: boothId,
        p_token: token,
      });
      return checkRpc(data, error);
    }
    throw new RequestError("INVALID_INPUT", 400);
  },
  true,
  370000,
);
