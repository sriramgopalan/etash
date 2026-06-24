// @vitest-environment node
import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import { verifyWidgetToken } from "@/lib/widget-auth";

const SECRET = "supersecret-widget-jwt-key-at-least-32-chars"; // gitleaks:allow
const KEY = Buffer.from(SECRET, "utf-8");
const SHORT_SECRET = "tooshort"; // gitleaks:allow

async function sign(
  payload: Record<string, unknown>,
  secret = SECRET,
  windowSecs = 300,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + windowSecs)
    .sign(Buffer.from(secret, "utf-8"));
}

describe("verifyWidgetToken", () => {
  it("returns claims for a valid token", async () => {
    const token = await sign({ sub: "user-1", email: "alice@example.com", name: "Alice" });
    const claims = await verifyWidgetToken(token, SECRET);
    expect(claims).toEqual({ sub: "user-1", email: "alice@example.com", name: "Alice" });
  });

  it("returns claims without name when name is absent", async () => {
    const token = await sign({ sub: "user-2", email: "bob@example.com" });
    const claims = await verifyWidgetToken(token, SECRET);
    expect(claims).toEqual({ sub: "user-2", email: "bob@example.com", name: null });
  });

  it("strips HTML from name", async () => {
    const token = await sign({ sub: "u1", email: "x@x.com", name: "<b>Evil</b>" });
    const claims = await verifyWidgetToken(token, SECRET);
    expect(claims?.name).toBe("Evil");
  });

  it("returns null when signature is wrong", async () => {
    const token = await sign({ sub: "u1", email: "a@b.com" }, "different-wrong-secret-32-chars-ok"); // gitleaks:allow
    const result = await verifyWidgetToken(token, SECRET);
    expect(result).toBeNull();
  });

  it("returns null when token is expired", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ sub: "u1", email: "a@b.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now - 400)
      .setExpirationTime(now - 100)
      .sign(KEY);
    const result = await verifyWidgetToken(token, SECRET);
    expect(result).toBeNull();
  });

  it("returns null when exp - iat > 300 (window too large)", async () => {
    const token = await sign({ sub: "u1", email: "a@b.com" }, SECRET, 600);
    const result = await verifyWidgetToken(token, SECRET);
    expect(result).toBeNull();
  });

  it("returns null when sub is missing", async () => {
    const token = await sign({ email: "a@b.com" });
    const result = await verifyWidgetToken(token, SECRET);
    expect(result).toBeNull();
  });

  it("returns null when email is missing", async () => {
    const token = await sign({ sub: "u1" });
    const result = await verifyWidgetToken(token, SECRET);
    expect(result).toBeNull();
  });

  it("returns null for malformed token string", async () => {
    const result = await verifyWidgetToken("not.a.jwt", SECRET);
    expect(result).toBeNull();
  });

  it("ignores short secret gracefully (jose rejects)", async () => {
    const result = await verifyWidgetToken("any.token.value", SHORT_SECRET);
    expect(result).toBeNull();
  });
});
