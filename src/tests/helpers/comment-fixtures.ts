export const BOARD_ID = "cboard1234567890";
export const POST_ID = "cpost12345678901";
export const USER_ID = "cuser12345678901";
export const COMMENT_ID = "ccomment12345678";

export const BASE_COMMENT = {
  id: COMMENT_ID,
  postId: POST_ID,
  authorId: USER_ID,
  guestName: null as string | null,
  body: "This is a test comment.",
  createdAt: new Date("2024-06-01T10:00:00.000Z"),
  updatedAt: new Date("2024-06-01T10:00:00.000Z"),
};

export function makeCommentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: COMMENT_ID,
    postId: POST_ID,
    guestName: null as string | null,
    body: "Test comment",
    createdAt: new Date("2024-06-01T10:00:00.000Z"),
    updatedAt: new Date("2024-06-01T10:00:00.000Z"),
    author: { id: USER_ID, name: "Alice" } as { id: string; name: string | null } | null,
    ...overrides,
  };
}
