import { sendVerificationEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  TOKEN_TYPES,
  createVerificationToken,
  generateToken,
} from "@/server/repositories/verificationToken";

export async function issueEmailVerification(email: string, userId: string): Promise<void> {
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

  sendVerificationEmail(email, verifyUrl).catch((err: unknown) => {
    logger.error({ err, userId }, "verification email failed");
  });
}
