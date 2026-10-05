import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Execute the actual migration in embedded PostgreSQL, including roles and RLS.
// Only Supabase's externally owned auth schema is reproduced for isolation tests.
const db = new PGlite();
const eventId = "10000000-0000-4000-8000-000000000001";
const boothId = "20000000-0000-4000-8000-000000000001";
const alice = "30000000-0000-4000-8000-000000000001";
const bob = "30000000-0000-4000-8000-000000000002";
const token = "a".repeat(64);
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;`);
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/202610030001_initial.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
});
beforeEach(async () => {
  await db.exec(
    "reset role; truncate public.events, public.booths, public.stamps, public.booth_qr_codes, public.claim_rate_limits, public.admin_users, auth.users cascade;",
  );
  await db.query("insert into auth.users(id) values ($1), ($2)", [alice, bob]);
  await db.query(
    `insert into public.events(id, slug, name, starts_at, ends_at, status) values ($1,'festival','Test',now()-interval '1 day',now()+interval '1 day','published')`,
    [eventId],
  );
  await db.query(
    `insert into public.booths(id,event_id,name) values($1,$2,'Booth A')`,
    [boothId, eventId],
  );
  await db.query("select public.rotate_booth_qr($1,$2)", [boothId, token]);
});
afterAll(async () => {
  await db.close();
});
async function claim(user = alice, qr = token, slug = "festival") {
  const result = await db.query<{
    result: {
      code?: string;
      status?: string;
      booth_id?: string;
      created_at?: string;
    };
  }>("select public.claim_stamp($1,$2,$3) as result", [user, slug, qr]);
  return result.rows[0].result;
}
async function asUser(user: string, role = "authenticated") {
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [user]);
  await db.exec(`set role ${role}`);
}
describe("stamp transactions and permissions", () => {
  it("persists one stamp across repeated and queued concurrent requests", async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, () => claim()),
    );
    expect(results.filter((r) => r.status === "claimed")).toHaveLength(1);
    expect(results.filter((r) => r.status === "already_claimed")).toHaveLength(
      11,
    );
    expect(new Set(results.map((r) => r.created_at)).size).toBe(1);
    expect((await db.query("select * from public.stamps")).rows).toHaveLength(
      1,
    );
  });
  it("keeps each participant independent", async () => {
    expect((await claim(alice)).status).toBe("claimed");
    expect((await claim(bob)).status).toBe("claimed");
  });
  it("rejects wrong event and unknown or rotated tokens", async () => {
    expect((await claim(alice, token, "other")).code).toBe("INVALID_QR");
    expect((await claim(alice, "b".repeat(64))).code).toBe("INVALID_QR");
    await db.query("select public.rotate_booth_qr($1,$2)", [
      boothId,
      "c".repeat(64),
    ]);
    expect((await claim()).code).toBe("INVALID_QR");
    expect((await claim(alice, "c".repeat(64))).status).toBe("claimed");
  });
  it("rolls back a failed rotation without losing the current QR", async () => {
    await expect(
      db.query("select public.rotate_booth_qr($1,$2)", [boothId, "bad"]),
    ).rejects.toThrow();
    expect((await claim()).status).toBe("claimed");
  });
  it.each(["draft", "ended"])("rejects %s events", async (status) => {
    await db.query("update public.events set status=$1", [status]);
    expect((await claim()).code).toBe("EVENT_CLOSED");
  });
  it("rejects before start, after end, and disabled booths", async () => {
    await db.exec("update public.events set starts_at=now()+interval '1 hour'");
    expect((await claim()).code).toBe("EVENT_CLOSED");
    await db.exec(
      "update public.events set starts_at=now()-interval '2 days',ends_at=now()-interval '1 day'",
    );
    expect((await claim()).code).toBe("EVENT_CLOSED");
    await db.exec(
      "update public.events set ends_at=now()+interval '1 day'; update public.booths set is_active=false",
    );
    expect((await claim()).code).toBe("BOOTH_INACTIVE");
    expect((await db.query("select * from public.stamps")).rows).toHaveLength(
      0,
    );
  });
  it("hides other participants stamps through RLS", async () => {
    await claim(alice);
    await claim(bob);
    await asUser(alice);
    const records = await db.query<{ participant_id: string }>(
      "select * from public.stamps",
    );
    expect(records.rows).toHaveLength(1);
    expect(records.rows[0].participant_id).toBe(alice);
  });
  it("does not expose QR tokens, roles, rate records, or any stamp writes to participants", async () => {
    await asUser(alice);
    for (const table of [
      "booth_qr_codes",
      "admin_users",
      "claim_rate_limits",
    ]) {
      await expect(db.query(`select * from public.${table}`)).rejects.toThrow(
        /permission denied/,
      );
    }
    await expect(
      db.query(
        "insert into public.stamps(participant_id,booth_id) values($1,$2)",
        [alice, boothId],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query("update public.stamps set participant_id=$1", [bob]),
    ).rejects.toThrow(/permission denied/);
    await expect(db.query("delete from public.stamps")).rejects.toThrow(
      /permission denied/,
    );
    await expect(claim()).rejects.toThrow(/permission denied/);
    await expect(
      db.query("select public.rotate_booth_qr($1,$2)", [boothId, token]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query("insert into public.admin_users(user_id) values($1)", [alice]),
    ).rejects.toThrow(/permission denied/);
  });
  it("allows service execution, and denies direct anonymous access to stamps", async () => {
    await db.exec("set role service_role");
    expect((await claim()).status).toBe("claimed");
    await db.exec("reset role; set role anon");
    expect((await db.query("select * from public.events")).rows).toHaveLength(
      1,
    );
    await expect(db.query("select * from public.stamps")).rejects.toThrow(
      /permission denied/,
    );
    await expect(claim()).rejects.toThrow(/permission denied/);
  });
  it("hides draft events and inactive booths from public reads", async () => {
    await db.exec("update public.booths set is_active=false; set role anon");
    expect((await db.query("select * from public.booths")).rows).toHaveLength(
      0,
    );
    await db.exec(
      "reset role; update public.events set status='draft'; set role anon",
    );
    expect((await db.query("select * from public.events")).rows).toHaveLength(
      0,
    );
  });
  it("rate limits invalid claims too, then resets the next window", async () => {
    await db.query(
      "insert into public.claim_rate_limits values($1,date_trunc('minute',statement_timestamp()),60)",
      [alice],
    );
    expect((await claim()).code).toBe("RATE_LIMITED");
    await db.exec(
      "update public.claim_rate_limits set window_start=window_start-interval '1 minute'",
    );
    expect((await claim(alice, "b".repeat(64))).code).toBe("INVALID_QR");
    expect(
      (
        await db.query<{ requests: number }>(
          "select requests from public.claim_rate_limits",
        )
      ).rows[0].requests,
    ).toBe(1);
  });
  it("prevents changing URLs already encoded in QR codes", async () => {
    await expect(
      db.exec("update public.events set slug='changed'"),
    ).rejects.toThrow(/cannot change/);
  });
});
