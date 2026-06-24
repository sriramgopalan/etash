import { jwtVerify } from "jose";

const CLOCK_SKEW_SECONDS = 60;
const MAX_TOKEN_WINDOW_SECONDS = 300;

export interface WidgetClaims {
  sub: string;
  email: string;
  name: string | null;
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, "").trim().slice(0, 512);
}

export async function verifyWidgetToken(
  token: string,
  secret: string,
): Promise<WidgetClaims | null> {
  try {
    const key = Buffer.from(secret, "utf-8");
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      clockTolerance: CLOCK_SKEW_SECONDS,
    });

    if (
      typeof payload.exp !== "number" ||
      typeof payload.iat !== "number" ||
      payload.exp - payload.iat > MAX_TOKEN_WINDOW_SECONDS
    ) {
      return null;
    }

    const sub = payload.sub;
    const email = typeof payload["email"] === "string" ? payload["email"] : null;
    if (!sub || !email) return null;

    const name = typeof payload["name"] === "string" ? stripHtml(payload["name"]) : null;
    return { sub, email: stripHtml(email), name };
  } catch {
    return null;
  }
}
