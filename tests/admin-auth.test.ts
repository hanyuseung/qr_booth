import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  invoke: vi.fn(),
}));
vi.mock("../src/lib/config", () => ({
  isDemo: false,
  defaultSlug: "fall-festival",
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (
    _url: string,
    _key: string,
    options: { auth: { storageKey: string } },
  ) => {
    if (options.auth.storageKey !== "moa-admin-auth") return {};
    return {
      auth: { signInWithPassword: mock.signIn, signOut: mock.signOut },
      functions: { invoke: mock.invoke },
    };
  },
}));
import { api } from "../src/lib/api";

beforeEach(() => {
  vi.clearAllMocks();
  mock.signIn.mockResolvedValue({ error: null });
  mock.signOut.mockResolvedValue({ error: null });
  mock.invoke.mockResolvedValue({
    data: { event: null, booths: [], qrCodes: [] },
    error: null,
  });
});
describe("administrator authentication", () => {
  it("forwards CAPTCHA proof to password authentication when enabled", async () => {
    await api.login("admin@example.com", "password", "captcha-proof");
    expect(mock.signIn).toHaveBeenCalledWith({
      email: "admin@example.com",
      password: "password",
      options: { captchaToken: "captcha-proof" },
    });
    expect(mock.invoke).toHaveBeenCalledWith("admin-action", {
      body: { action: "snapshot" },
    });
  });
  it("allows login without CAPTCHA when protection is disabled", async () => {
    await api.login("admin@example.com", "password");
    expect(mock.signIn.mock.calls[0][0].options.captchaToken).toBeUndefined();
  });
  it("does not check permissions when CAPTCHA verification fails", async () => {
    mock.signIn.mockResolvedValue({ error: { code: "captcha_failed" } });
    await expect(
      api.login("admin@example.com", "password", "expired-proof"),
    ).rejects.toThrow("다시 인증");
    expect(mock.invoke).not.toHaveBeenCalled();
  });
  it("clears the admin session when backend authorization fails", async () => {
    mock.invoke.mockResolvedValue({
      error: { context: Response.json({ code: "FORBIDDEN" }, { status: 403 }) },
    });
    await expect(api.login("visitor@example.com", "password")).rejects.toThrow(
      "운영자 권한",
    );
    expect(mock.signOut).toHaveBeenCalledOnce();
  });
});
