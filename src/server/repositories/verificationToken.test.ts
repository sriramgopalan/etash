
import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DeepMockProxy } from "vitest-mock-extended";
import { mockReset } from "vitest-mock-extended";

let prismaMock: DeepMockProxy<PrismaClient>;

vi.mock("@/server/db", async () => {
  const { mockDeep } = await import("vitest-mock-extended");
  prismaMock = mockDeep<PrismaClient>();
  return { prisma: prismaMock };
});

const {
  TOKEN_TYPES,
  generateToken,
  hashToken,
  createVerificationToken,
  findAndConsumeVerificationToken,
  lookupVerificationToken,
} = await import("@/server/repositories/verificationToken");

const FUTURE = new Date(Date.now() + 60_000);
const PAST = new Date(Date.now() - 60_000);

describe("verificationToken repository", () => {
  beforeEach(() => {
    mockReset(prismaMock);
  });

  describe("generateToken", () => {
    it("returns 64-character hex string", () => {
      const token = generateToken();
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]+$/);
    });

    it("generates unique tokens", () => {
      expect(generateToken()).not.toBe(generateToken());
    });
  });

  describe("createVerificationToken", () => {
    it("never stores the raw token — stores SHA-256 hash", async () => {
      prismaMock.verificationToken.deleteMany.mockResolvedValue({ count: 0 });
      prismaMock.verificationToken.create.mockResolvedValue({} as never);

      const rawToken = "super-secret-raw-token";
      await createVerificationToken({
        identifier: "user@example.com",
        token: rawToken,
        expiresAt: FUTURE,
        type: TOKEN_TYPES.EMAIL_VERIFICATION,
      });

      const createCall = prismaMock.verificationToken.create.mock.calls[0];
      const storedToken = createCall?.[0]?.data?.token as string;
      expect(storedToken).not.toBe(rawToken);
      expect(storedToken).toBe(hashToken(rawToken));
      expect(storedToken).toHaveLength(64); // SHA-256 hex
    });

    it("deletes old tokens of same type before creating", async () => {
      prismaMock.verificationToken.deleteMany.mockResolvedValue({ count: 1 });
      prismaMock.verificationToken.create.mockResolvedValue({} as never);

      await createVerificationToken({
        identifier: "user@example.com",
        token: "abc",
        expiresAt: FUTURE,
        type: TOKEN_TYPES.MAGIC_LINK,
      });

      expect(prismaMock.verificationToken.deleteMany).toHaveBeenCalledWith({
        where: { identifier: "user@example.com", type: TOKEN_TYPES.MAGIC_LINK },
      });
      expect(prismaMock.verificationToken.create).toHaveBeenCalledWith({
        data: {
          identifier: "user@example.com",
          token: hashToken("abc"),
          expires: FUTURE,
          type: TOKEN_TYPES.MAGIC_LINK,
        },
      });
    });
  });

  describe("findAndConsumeVerificationToken", () => {
    it("returns valid=true and deletes valid token", async () => {
      prismaMock.verificationToken.findUnique.mockResolvedValue({
        identifier: "user@example.com",
        token: "tok",
        expires: FUTURE,
        type: TOKEN_TYPES.MAGIC_LINK,
        createdAt: new Date(),
      } as never);
      prismaMock.verificationToken.delete.mockResolvedValue({} as never);

      const result = await findAndConsumeVerificationToken({
        identifier: "user@example.com",
        token: "tok",
        type: TOKEN_TYPES.MAGIC_LINK,
      });

      expect(result).toEqual({ valid: true, expired: false });
      expect(prismaMock.verificationToken.delete).toHaveBeenCalled();
    });

    it("returns expired=true and deletes expired token", async () => {
      prismaMock.verificationToken.findUnique.mockResolvedValue({
        identifier: "user@example.com",
        token: "tok",
        expires: PAST,
        type: TOKEN_TYPES.MAGIC_LINK,
        createdAt: new Date(),
      } as never);
      prismaMock.verificationToken.delete.mockResolvedValue({} as never);

      const result = await findAndConsumeVerificationToken({
        identifier: "user@example.com",
        token: "tok",
        type: TOKEN_TYPES.MAGIC_LINK,
      });

      expect(result).toEqual({ valid: false, expired: true });
      expect(prismaMock.verificationToken.delete).toHaveBeenCalled();
    });

    it("returns valid=false when not found", async () => {
      prismaMock.verificationToken.findUnique.mockResolvedValue(null);

      const result = await findAndConsumeVerificationToken({
        identifier: "user@example.com",
        token: "bad",
        type: TOKEN_TYPES.MAGIC_LINK,
      });

      expect(result).toEqual({ valid: false, expired: false });
      expect(prismaMock.verificationToken.delete).not.toHaveBeenCalled();
    });

    it("returns valid=false when type mismatch", async () => {
      prismaMock.verificationToken.findUnique.mockResolvedValue({
        identifier: "user@example.com",
        token: "tok",
        expires: FUTURE,
        type: TOKEN_TYPES.EMAIL_VERIFICATION,
        createdAt: new Date(),
      } as never);
      prismaMock.verificationToken.delete.mockResolvedValue({} as never);

      const result = await findAndConsumeVerificationToken({
        identifier: "user@example.com",
        token: "tok",
        type: TOKEN_TYPES.MAGIC_LINK,
      });

      expect(result).toEqual({ valid: false, expired: false });
    });
  });

  describe("lookupVerificationToken", () => {
    it("returns exists=true for valid token", async () => {
      prismaMock.verificationToken.findUnique.mockResolvedValue({
        expires: FUTURE,
        type: TOKEN_TYPES.MAGIC_LINK,
      } as never);

      const result = await lookupVerificationToken({
        identifier: "user@example.com",
        token: "tok",
        type: TOKEN_TYPES.MAGIC_LINK,
      });

      expect(result).toEqual({ exists: true, expired: false });
    });

    it("returns expired=true for past token", async () => {
      prismaMock.verificationToken.findUnique.mockResolvedValue({
        expires: PAST,
        type: TOKEN_TYPES.MAGIC_LINK,
      } as never);

      const result = await lookupVerificationToken({
        identifier: "user@example.com",
        token: "tok",
        type: TOKEN_TYPES.MAGIC_LINK,
      });

      expect(result).toEqual({ exists: true, expired: true });
    });
  });
});
