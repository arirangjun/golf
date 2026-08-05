import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "golf_session";
const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-change-me"
);

export async function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  // 비로그인 → 관리자 로그인 화면 허용
  if (!token) {
    return NextResponse.next();
  }

  try {
    const { payload } = await jwtVerify(token, secret, {
      // 만료 없는 토큰도 허용
    });
    if (payload.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  } catch {
    // 잘못된 토큰이면 관리자 로그인 화면 표시
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/admin/:path*"],
};
