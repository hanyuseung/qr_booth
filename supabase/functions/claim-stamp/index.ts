import { endpoint, checkRpc } from "../_shared/http.ts";
import { parseClaim } from "../_shared/validation.ts";

Deno.serve(
  endpoint(async (body, db, user) => {
    const { slug, token } = parseClaim(body);
    const { data, error } = await db.rpc("claim_stamp", {
      p_participant: user.id,
      p_slug: slug,
      p_token: token,
    });
    return checkRpc(data, error);
  }),
);
