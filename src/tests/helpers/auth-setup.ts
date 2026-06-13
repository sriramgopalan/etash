import { vi } from "vitest";

export function makeRedisMock() {
  return {
    get: vi.fn<() => Promise<string | null>>(),
    set: vi.fn<() => Promise<string>>(),
    del: vi.fn<() => Promise<number>>(),
    sadd: vi.fn<() => Promise<number>>(),
    srem: vi.fn<() => Promise<number>>(),
    smembers: vi.fn<() => Promise<string[]>>(),
  };
}

export function makeFullRedisMock() {
  return {
    incr: vi.fn<() => Promise<number>>(),
    expire: vi.fn<() => Promise<number>>(),
    ...makeRedisMock(),
  };
}
