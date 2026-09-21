import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV === "development") return NextResponse.next();

  if (request.headers.get("x-birding-admin") !== "1") {
    return new NextResponse(null, { status: 403 });
  }

  if (request.headers.get("sec-fetch-site") !== "same-origin") {
    return new NextResponse(null, { status: 403 });
  }

  return NextResponse.next();
}

export const config = { matcher: "/api/admin/:path*" };
