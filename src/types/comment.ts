export interface PublicCommentView {
  id: string;
  postId: string;
  guestName: string | null;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; name: string | null } | null;
}

export interface AdminCommentView extends Omit<PublicCommentView, "author"> {
  authorId: string | null;
  author: { id: string; name: string | null; email: string } | null;
}

export interface CreatedComment {
  id: string;
  postId: string;
  authorId: string | null;
  guestName: string | null;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentListResult {
  items: PublicCommentView[];
  nextCursor: string | null;
}
