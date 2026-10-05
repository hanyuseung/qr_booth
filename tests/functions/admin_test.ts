import { adminHandler } from "../../supabase/functions/admin-action/handler.ts";

function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
const eventId = "10000000-0000-4000-8000-000000000001";
const boothId = "20000000-0000-4000-8000-000000000001";
const oldPath = `${eventId}/${boothId}.webp`;
const webp =
  "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";
const booth = {
  id: boothId,
  event_id: eventId,
  name: "Photo booth",
  description: "",
  location: "",
  icon: "coffee",
  color: "peach",
  sort_order: 1,
  is_active: true,
};

type Call = { url: URL; method: string; body: unknown; headers: Headers };
async function withBackend(
  options: {
    failSave?: boolean;
    conflict?: boolean;
    anonymous?: boolean;
    failCleanup?: boolean;
  },
  run: (calls: Call[]) => Promise<void>,
) {
  Deno.env.set("ALLOWED_ORIGINS", "https://boryeongculture.site");
  Deno.env.set("SUPABASE_URL", "https://api.example.com");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
  const original = globalThis.fetch;
  const calls: Call[] = [];
  globalThis.fetch = (async (
    input: Request | URL | string,
    init?: RequestInit,
  ) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method || "GET";
    let body: unknown = init?.body;
    if (typeof body === "string") body = JSON.parse(body);
    const headers = new Headers(init?.headers);
    calls.push({ url, method, body, headers });
    if (url.pathname === "/auth/v1/user")
      return Response.json({
        id: boothId,
        is_anonymous: options.anonymous || false,
      });
    if (url.pathname === "/rest/v1/admin_users")
      return Response.json([{ user_id: boothId }]);
    if (url.pathname.startsWith("/storage/v1/object/booth-thumbnails")) {
      if (method === "DELETE" && options.failCleanup)
        return Response.json({ message: "Failure" }, { status: 400 });
      return Response.json(method === "DELETE" ? [] : { Key: url.pathname });
    }
    if (url.pathname === "/rest/v1/booths") {
      if (method === "GET")
        return Response.json([{ id: boothId, thumbnail_path: oldPath }]);
      if (options.failSave)
        return Response.json(
          { code: "23514", message: "Invalid data" },
          { status: 400 },
        );
      if (options.conflict) return Response.json([]);
      return Response.json([{ id: boothId, thumbnail_path: oldPath }]);
    }
    if (url.pathname === "/rest/v1/rpc/generate_missing_booth_qrs")
      return Response.json({ generated: 1 });
    throw new Error(`Unexpected request ${method} ${url.pathname}`);
  }) as typeof fetch;
  try {
    await run(calls);
  } finally {
    globalThis.fetch = original;
  }
}
function call(body: object) {
  return adminHandler(
    new Request("https://api.example.com/functions/v1/admin-action", {
      method: "POST",
      headers: {
        authorization: "Bearer test-jwt",
        origin: "https://boryeongculture.site",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );
}

Deno.test(
  "thumbnail replacement uploads WebP, saves only path and removes old object",
  async () => {
    await withBackend({}, async (calls) => {
      assert(
        (await call({ action: "save-booth", booth, thumbnail: webp }))
          .status === 200,
      );
      const upload = calls.find(
        (c) => c.method === "POST" && c.url.pathname.startsWith("/storage"),
      )!;
      assert(upload.headers.get("content-type") === "image/webp");
      const update = calls.find((c) => c.method === "PATCH")!;
      const path = (update.body as { thumbnail_path: string }).thumbnail_path;
      assert(
        path.startsWith(eventId) && path.endsWith(".webp") && path !== oldPath,
      );
      assert(update.url.searchParams.get("thumbnail_path") === `eq.${oldPath}`);
      const cleanup = calls.find((c) => c.method === "DELETE")!;
      assert(
        JSON.stringify(cleanup.body) ===
          JSON.stringify({ prefixes: [oldPath] }),
      );
      assert(
        calls.indexOf(upload) < calls.indexOf(update) &&
          calls.indexOf(update) < calls.indexOf(cleanup),
      );
    });
  },
);
Deno.test(
  "failed save and concurrent photo edit clean the new upload and preserve the old image",
  async () => {
    for (const options of [{ failSave: true }, { conflict: true }]) {
      await withBackend(options, async (calls) => {
        const response = await call({
          action: "save-booth",
          booth,
          thumbnail: webp,
        });
        assert(response.status === (options.failSave ? 500 : 409));
        const path = (
          calls.find((c) => c.method === "PATCH")!.body as {
            thumbnail_path: string;
          }
        ).thumbnail_path;
        assert(path !== oldPath);
        const cleanup = calls.filter((c) => c.method === "DELETE");
        assert(
          cleanup.length === 1 &&
            JSON.stringify(cleanup[0].body) ===
              JSON.stringify({ prefixes: [path] }),
        );
      });
    }
  },
);
Deno.test(
  "ordinary edits preserve the thumbnail and explicit removal clears it",
  async () => {
    await withBackend({}, async (calls) => {
      assert(
        (
          await call({
            action: "save-booth",
            booth: { ...booth, thumbnail_path: "spoofed" },
          })
        ).status === 200,
      );
      assert(!calls.some((c) => c.url.pathname.startsWith("/storage")));
      assert(
        !(
          "thumbnail_path" in
          (calls.find((c) => c.method === "PATCH")!.body as object)
        ),
      );
    });
    await withBackend({}, async (calls) => {
      assert(
        (await call({ action: "save-booth", booth, thumbnail: null }))
          .status === 200,
      );
      assert(
        (
          calls.find((c) => c.method === "PATCH")!.body as {
            thumbnail_path: null;
          }
        ).thumbnail_path === null,
      );
      assert(
        calls.filter((c) => c.url.pathname.startsWith("/storage")).length === 1,
      );
    });
  },
);
Deno.test(
  "invalid photos and unauthorized users cannot write booth or Storage data",
  async () => {
    await withBackend({}, async (calls) => {
      assert(
        (
          await call({
            action: "save-booth",
            booth,
            thumbnail: "data:image/webp;base64,AAAA",
          })
        ).status === 400,
      );
      assert(
        !calls.some(
          (c) => c.url.pathname.startsWith("/storage") || c.method === "PATCH",
        ),
      );
    });
    await withBackend({ anonymous: true }, async (calls) => {
      for (const body of [
        { action: "save-booth", booth, thumbnail: webp },
        { action: "delete-booth", booth_id: boothId },
        { action: "generate-all-qr", event_id: eventId },
      ])
        assert((await call(body)).status === 403);
      assert(calls.every((c) => c.url.pathname === "/auth/v1/user"));
    });
  },
);
Deno.test(
  "booth deletion cleans the image after DB success and never before failed deletion",
  async () => {
    for (const failSave of [false, true]) {
      await withBackend({ failSave }, async (calls) => {
        assert(
          (await call({ action: "delete-booth", booth_id: boothId })).status ===
            (failSave ? 500 : 200),
        );
        const deletes = calls.filter((c) => c.method === "DELETE");
        assert(deletes[0].url.pathname === "/rest/v1/booths");
        assert(deletes.length === (failSave ? 1 : 2));
      });
    }
  },
);
Deno.test(
  "Storage cleanup failure does not report an already committed save as failed",
  async () => {
    await withBackend({ failCleanup: true }, async () => {
      assert(
        (await call({ action: "save-booth", booth, thumbnail: null }))
          .status === 200,
      );
    });
  },
);
Deno.test(
  "bulk generation supplies fresh 256-bit tokens only through the protected RPC",
  async () => {
    await withBackend({}, async (calls) => {
      const response = await call({
        action: "generate-all-qr",
        event_id: eventId,
      });
      assert(
        response.status === 200 && (await response.json()).generated === 1,
      );
      const rpc = calls.find((c) => c.url.pathname.includes("/rpc/"))!;
      const body = rpc.body as {
        p_event: string;
        p_codes: { booth_id: string; token: string }[];
      };
      assert(body.p_event === eventId && body.p_codes[0].booth_id === boothId);
      assert(/^[a-f0-9]{64}$/.test(body.p_codes[0].token));
    });
  },
);
