import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/auth";

export default auth((req) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { nextUrl, auth: session } = req as any;
  const isLoggedIn = !!session;

  const { pathname } = nextUrl as URL;
  const isPublicPath =
    pathname === "/" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/boards") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/trpc") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml";

  if (!isPublicPath && !isLoggedIn) {
    const signInUrl = new URL("/auth/signin", nextUrl as URL);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
