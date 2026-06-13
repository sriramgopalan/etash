
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createPrismaMock,
  mockReset,
  type DeepMockProxy,
  type PrismaClient,
} from "@/tests/helpers/repository-setup";

let prismaMock: DeepMockProxy<PrismaClient>;

vi.mock("@/server/db", async () => {
  prismaMock = await createPrismaMock();
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

type TokenType = (typeof TOKEN_TYPES)[keyof typeof TOKEN_TYPES];

function mockTokenRecord(opts: { expires: Date; type?: TokenType }) {
  prismaMock.verificationToken.findUnique.mockResolvedValue({
    identifier: "user@example.com",
    token: "tok",
    expires: opts.expires,
    type: opts.type ?? TOKEN_TYPES.MAGIC_LINK,
    createdAt: new Date(),
  } as never);
  prismaMock.verificationToken.delete.mockResolvedValue({} as never);
}

async function callFindAndConsume(token = "tok", type: TokenType = TOKEN_TYPES.MAGIC_LINK) {
  return findAndConsumeVerificationToken({ identifier: "user@example.com", token, type });
}

async function callLookup(token = "tok", type: TokenType = TOKEN_TYPES.MAGIC_LINK) {
  return lookupVerificationToken({ identifier: "user@example.com", token, type });
}

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
      expect(storedToken).toHaveLength(64);
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
      mockTokenRecord({ expires: FUTURE });
      const result = await callFindAndConsume();
      expect(result).toEqual({ valid: true, expired: false });
      expect(prismaMock.verificationToken.delete).toHaveBeenCalled();
    });

    it("returns expired=true and deletes expired token", async () => {
      mockTokenRecord({ expires: PAST });
      const result = await callFindAndConsume();
      expect(result).toEqual({ valid: false, expired: true });
      expect(prismaMock.verificationToken.delete).toHaveBeenCalled();
    });

    it("returns valid=false when not found", async () => {
      prismaMock.verificationToken.findUnique.mockResolvedValue(null);
      const result = await callFindAndConsume("bad");
      expect(result).toEqual({ valid: false, expired: false });
      expect(prismaMock.verificationToken.delete).not.toHaveBeenCalled();
    });

    it("returns valid=false when type mismatch", async () => {
      mockTokenRecord({ expires: FUTURE, type: TOKEN_TYPES.EMAIL_VERIFICATION });
      const result = await callFindAndConsume();
      expect(result).toEqual({ valid: false, expired: false });
    });
  });

  describe("lookupVerificationToken", () => {
    it("returns exists=true for valid token", async () => {
      prismaMock.verificationToken.findUnique.mockResolvedValue({
        expires: FUTURE,
        type: TOKEN_TYPES.MAGIC_LINK,
      } as never);
      const result = await callLookup();
      expect(result).toEqual({ exists: true, expired: false });
    });

    it("returns expired=true for past token", async () => {
      prismaMock.verificationToken.findUnique.mockResolvedValue({
        expires: PAST,
        type: TOKEN_TYPES.MAGIC_LINK,
      } as never);
      const result = await callLookup();
      expect(result).toEqual({ exists: true, expired: true });
    });

    it("returns exists=false when type mismatch", async () => {
      prismaMock.verificationToken.findUnique.mockResolvedValue({
        expires: FUTURE,
        type: TOKEN_TYPES.EMAIL_VERIFICATION,
      } as never);
      const result = await callLookup("tok", TOKEN_TYPES.MAGIC_LINK);
      expect(result).toEqual({ exists: false, expired: false });
    });
  });
});
