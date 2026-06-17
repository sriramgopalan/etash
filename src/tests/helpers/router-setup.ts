import { vi } from "vitest";

import { BOARD_ID } from "@/tests/helpers/post-fixtures";

export type RouterRedisMock = {
  mget: ReturnType<typeof vi.fn>;
  exists: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  pipeline: ReturnType<typeof vi.fn>;
};

export function makePipelineMock() {
  return {
    incr: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn<() => Promise<[Error | null, unknown][]>>(),
  };
}

export const ADMIN_ID = "cadmin1234567890";

export const DEFAULT_SETTINGS = {
  whoCanPost: "AUTHENTICATED" as "ANYONE" | "AUTHENTICATED" | "ADMINS_ONLY",
  guestVotingEnabled: false,
  postModerationEnabled: false,
};

export const BASE_BOARD = {
  id: BOARD_ID,
  slug: "test-board",
  name: "Test Board",
  description: null,
  isPublic: true,
  isListed: true,
  settingsJson: DEFAULT_SETTINGS,
  createdAt: new Date("2024-01-01"),
  ownerId: "owner-1",
  position: 0,
  updatedAt: new Date("2024-01-01"),
  _count: { posts: 0 },
};
