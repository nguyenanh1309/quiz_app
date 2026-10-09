import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (session?.role !== "admin") return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  if (pathname.startsWith("/student")) {
    if (session?.role !== "student") return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/student/:path*"],
};
