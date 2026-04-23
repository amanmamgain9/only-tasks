import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "only_tasks_session";
const protectedPaths = new Set(["/", "/all-tasks", "/today", "/tomorrow", "/this-week"]);

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!protectedPaths.has(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sessionCookie) {
    return NextResponse.next();
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/sign-in";
  redirectUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/", "/all-tasks", "/today", "/tomorrow", "/this-week"],
};
