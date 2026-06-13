import crypto from "crypto";

import { prisma } from "@/server/db";

export const TOKEN_TYPES = {
  MAGIC_LINK: "MAGIC_LINK",
  EMAIL_VERIFICATION: "EMAIL_VERIFICATION",
} as const;

export type TokenType = (typeof TOKEN_TYPES)[keyof typeof TOKEN_TYPES];

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export async function createVerificationToken(opts: {
  identifier: string;
  token: string;
  expiresAt: Date;
  type: TokenType;
}): Promise<void> {
  const tokenHash = hashToken(opts.token);
  await prisma.verificationToken.deleteMany({
    where: { identifier: opts.identifier, type: opts.type },
  });
  await prisma.verificationToken.create({
    data: {
      identifier: opts.identifier,
      token: tokenHash,
      expires: opts.expiresAt,
      type: opts.type,
    },
  });
}

export async function findAndConsumeVerificationToken(opts: {
  identifier: string;
  token: string;
  type: TokenType;
}): Promise<{ valid: boolean; expired: boolean }> {
  const tokenHash = hashToken(opts.token);

  const record = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier: opts.identifier, token: tokenHash } },
  });

  if (!record || record.type !== opts.type) {
    return { valid: false, expired: false };
  }

  // Single-use: delete regardless of expiry
  await prisma.verificationToken.delete({
    where: { identifier_token: { identifier: opts.identifier, token: tokenHash } },
  });

  if (record.expires < new Date()) {
    return { valid: false, expired: true };
  }

  return { valid: true, expired: false };
}

export async function lookupVerificationToken(opts: {
  identifier: string;
  token: string;
  type: TokenType;
}): Promise<{ exists: boolean; expired: boolean }> {
  const tokenHash = hashToken(opts.token);

  const record = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier: opts.identifier, token: tokenHash } },
    select: { expires: true, type: true },
  });

  if (!record || record.type !== opts.type) {
    return { exists: false, expired: false };
  }

  return { exists: true, expired: record.expires < new Date() };
}
