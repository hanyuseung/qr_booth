import {
  createClient,
  type SupabaseClient,
  type User,
} from "npm:@supabase/supabase-js@2.117.2";
import { object, RequestError } from "./validation.ts";

type Handler = (
  body: Record<string, unknown>,
  db: SupabaseClient,
  user: User,
) => Promise<unknown>;
export function endpoint(handler: Handler, adminOnly = false) {
  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get("origin");
    const allowed = (Deno.env.get("ALLOWED_ORIGINS") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
      "Access-Control-Allow-Headers":
        "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
    const respond = (body: unknown, status: number) =>
      new Response(JSON.stringify(body), { status, headers });
    if (!allowed.length) return respond({ code: "CONFIG_ERROR" }, 500);
    if (origin && !allowed.includes(origin))
      return respond({ code: "FORBIDDEN" }, 403);
    if (origin) headers["Access-Control-Allow-Origin"] = origin;
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (req.method !== "POST")
      return respond({ code: "METHOD_NOT_ALLOWED" }, 405);
    try {
      const authorization = req.headers.get("authorization") || "";
      if (!authorization.startsWith("Bearer ") || authorization.length > 8192)
        throw new RequestError("UNAUTHORIZED", 401);
      const db = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      // Always verify the caller with Auth; never trust decoded claims or a body user_id.
      const {
        data: { user },
        error,
      } = await db.auth.getUser(authorization.slice(7));
      if (error || !user) throw new RequestError("UNAUTHORIZED", 401);
      if (adminOnly) {
        if (user.is_anonymous) throw new RequestError("FORBIDDEN", 403);
        const check = await db
          .from("admin_users")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (check.error) throw check.error;
        if (!check.data) throw new RequestError("FORBIDDEN", 403);
      }
      if (!req.headers.get("content-type")?.includes("application/json"))
        throw new RequestError("INVALID_INPUT", 400);
      if (Number(req.headers.get("content-length") || 0) > 16384)
        throw new RequestError("INVALID_INPUT", 413);
      const raw = await req.text();
      if (raw.length > 16384) throw new RequestError("INVALID_INPUT", 413);
      let body: Record<string, unknown>;
      try {
        body = object(JSON.parse(raw));
      } catch {
        throw new RequestError("INVALID_INPUT", 400);
      }
      return respond(await handler(body, db, user), 200);
    } catch (error) {
      if (error instanceof RequestError)
        return respond({ code: error.code }, error.status);
      // Log only the database error code, never QR tokens, bearer tokens, or request bodies.
      console.error(
        "Endpoint failure",
        (error as { code?: string })?.code || "UNEXPECTED",
      );
      return respond({ code: "INTERNAL_ERROR" }, 500);
    }
  };
}
export function checkRpc(data: unknown, error: unknown) {
  if (error) throw error;
  const result = object(data);
  if (typeof result.code === "string")
    throw new RequestError(
      result.code,
      result.code === "RATE_LIMITED" ? 429 : 400,
    );
  return result;
}
