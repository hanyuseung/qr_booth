import { endpoint } from "../../supabase/functions/_shared/http.ts";

function assert(
  condition: unknown,
  message = "Assertion failed",
): asserts condition {
  if (!condition) throw new Error(message);
}
const origin = "https://stamp.example.com";
const userId = "30000000-0000-4000-8000-000000000001";
function request(
  options: {
    method?: string;
    token?: string | null;
    origin?: string;
    body?: string;
  } = {},
) {
  const method = options.method || "POST";
  return new Request("https://api.example.com/functions/v1/claim-stamp", {
    method,
    headers: {
      origin: options.origin || origin,
      "content-type": "application/json",
      ...(options.token !== null
        ? { authorization: `Bearer ${options.token || "valid-user-jwt"}` }
        : {}),
    },
    ...(method === "POST" ? { body: options.body || "{}" } : {}),
  });
}
async function withAuth<T>(
  options: { valid?: boolean; anonymous?: boolean; admin?: boolean },
  run: (calls: string[]) => Promise<T>,
) {
  Deno.env.set("ALLOWED_ORIGINS", origin);
  Deno.env.set("SUPABASE_URL", "https://api.example.com");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = ((input: Request | URL | string, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push(url);
    if (url.endsWith("/auth/v1/user")) {
      const headers = new Headers(
        init?.headers || (input instanceof Request ? input.headers : {}),
      );
      assert(
        headers.get("authorization") === "Bearer valid-user-jwt",
        "Must verify the caller JWT, not the service key",
      );
      return Promise.resolve(
        Response.json(
          options.valid === false
            ? { message: "Invalid JWT" }
            : { id: userId, is_anonymous: options.anonymous || false },
          { status: options.valid === false ? 401 : 200 },
        ),
      );
    }
    if (url.includes("/rest/v1/admin_users"))
      return Promise.resolve(
        Response.json(options.admin ? [{ user_id: userId }] : []),
      );
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = original;
  }
}

Deno.test("GET and preflight cannot invoke an action", async () => {
  await withAuth({}, async (calls) => {
    let invoked = false;
    const handler = endpoint(async () => {
      invoked = true;
      return {};
    });
    assert((await handler(request({ method: "GET" }))).status === 405);
    const preflight = await handler(request({ method: "OPTIONS" }));
    assert(preflight.status === 204);
    assert(preflight.headers.get("access-control-allow-origin") === origin);
    assert(!invoked && calls.length === 0);
  });
});
Deno.test("missing and invalid JWTs never reach business logic", async () => {
  await withAuth({ valid: false }, async () => {
    const handler = endpoint(async () => {
      throw new Error("Should not execute");
    });
    assert((await handler(request({ token: null }))).status === 401);
    const invalid = await handler(request());
    assert(invalid.status === 401);
    assert((await invalid.json()).code === "UNAUTHORIZED");
  });
});
Deno.test(
  "untrusted origin is rejected without exposing CORS credentials",
  async () => {
    await withAuth({}, async (calls) => {
      const handler = endpoint(async () => ({}));
      const result = await handler(
        request({ origin: "https://other.example.com" }),
      );
      assert(result.status === 403);
      assert(!result.headers.has("access-control-allow-origin"));
      assert(calls.length === 0);
    });
  },
);
Deno.test(
  "anonymous authenticated users may claim using verified identity",
  async () => {
    await withAuth({ anonymous: true }, async () => {
      const handler = endpoint(async (_body, _db, user) => ({
        participant_id: user.id,
      }));
      const result = await handler(
        request({ body: JSON.stringify({ participant_id: "forged-user" }) }),
      );
      assert(result.status === 200);
      assert((await result.json()).participant_id === userId);
      assert(result.headers.get("cache-control") === "no-store");
    });
  },
);
Deno.test(
  "anonymous users and non-allowlisted accounts cannot run admin actions",
  async () => {
    for (const anonymous of [true, false]) {
      await withAuth({ anonymous }, async () => {
        const handler = endpoint(async () => {
          throw new Error("Should not execute");
        }, true);
        const result = await handler(request());
        assert(result.status === 403);
      });
    }
  },
);
Deno.test("allowlisted permanent administrator may run actions", async () => {
  await withAuth({ admin: true }, async () => {
    const handler = endpoint(async () => ({ ok: true }), true);
    const result = await handler(request());
    assert(result.status === 200);
    assert((await result.json()).ok);
  });
});
Deno.test(
  "malformed and oversized payloads are rejected before action",
  async () => {
    await withAuth({}, async () => {
      const handler = endpoint(async () => {
        throw new Error("Should not execute");
      });
      assert((await handler(request({ body: "not-json" }))).status === 400);
      assert((await handler(request({ body: "[]" }))).status === 400);
      assert(
        (
          await handler(
            request({ body: JSON.stringify({ name: "x".repeat(17000) }) }),
          )
        ).status === 413,
      );
    });
  },
);
