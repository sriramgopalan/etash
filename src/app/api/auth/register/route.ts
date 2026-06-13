import { hash } from "@node-rs/argon2";
import { NextResponse } from "next/server";
import { z } from "zod";

import { sendVerificationEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { createUser, getUserByEmail } from "@/server/repositories/user";
import {
  TOKEN_TYPES,
  createVerificationToken,
  generateToken,
} from "@/server/repositories/verificationToken";

const registerSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(12, "Password must be at least 12 characters"),
  })
  .strict();

function getIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "127.0.0.1"
  );
}

export async function POST(req: Request): Promise<NextResponse> {
  const ip = getIp(req);

  try {
    await rateLimit(`auth:ip:${ip}`, { max: 10, windowSeconds: 3600 });

    const body: unknown = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;

    const existing = await getUserByEmail(email);
    if (existing) {
      // M1: constant-time response — perform the same expensive hash so response
      // timing cannot distinguish "email exists" from "email does not exist".
      await hash(password);
      return NextResponse.json(
        { error: "CONFLICT", message: "An account with this email already exists." },
        { status: 409 },
      );
    }

    const passwordHash = await hash(password);
    const user = await createUser({ email, passwordHash });

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await createVerificationToken({
      identifier: email,
      token,
      expiresAt,
      type: TOKEN_TYPES.EMAIL_VERIFICATION,
    });

    const baseUrl = env.AUTH_URL ?? "http://localhost:3000";
    const verifyUrl = `${baseUrl}/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

    // L2: individual fire-and-forget per email type so each failure is identifiable.
    sendVerificationEmail(email, verifyUrl).catch((err: unknown) => {
      logger.error({ err, userId: user.id, emailType: "verification" }, "registration email failed");
    });

    logger.info({ ip, userId: user.id }, "user registered");
    return NextResponse.json({ userId: user.id }, { status: 201 });
  } catch (err) {
    if (err instanceof AppError && err.code === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "RATE_LIMITED", message: err.message },
        { status: 429 },
      );
    }
    logger.error({ err, ip }, "registration failed");
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
