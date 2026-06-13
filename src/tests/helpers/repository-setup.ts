import type { PrismaClient } from "@prisma/client";
import type { DeepMockProxy } from "vitest-mock-extended";

export { mockReset } from "vitest-mock-extended";
export type { DeepMockProxy, PrismaClient };

export async function createPrismaMock(): Promise<DeepMockProxy<PrismaClient>> {
  const { mockDeep } = await import("vitest-mock-extended");
  return mockDeep<PrismaClient>();
}
