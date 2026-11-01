import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isPublicPath } from "@/lib/public-paths";

export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  if (isPublicPath(pathname)) {
    // Signed-in admin has no reason to see the login page.
    if (pathname === "/login" && req.auth) return NextResponse.redirect(new URL("/", req.nextUrl));
    return NextResponse.next();
  }
  if (req.auth) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const loginUrl = new URL("/login", req.nextUrl);
  if (pathname !== "/") loginUrl.searchParams.set("callbackUrl", pathname + search);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  // Run on everything except Next.js internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
