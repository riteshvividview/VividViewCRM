import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { REMEMBER_COOKIE, forSession } from "@/lib/supabase/remember";

// Pages anyone may open. There is no sign-up: the CEO adds people in User Management.
const PUBLIC_ROUTES = [
  "/auth/login",
  "/auth/forgot-password",
  "/auth/callback",
  "/auth/activate",
  "/auth/mfa",
];
// Public pages a signed-in person may still need (finishing a step, opening a setup link).
const STAY_WHEN_SIGNED_IN = ["/auth/mfa", "/auth/callback"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  // Inject current pathname so the server layout can read it for route protection
  supabaseResponse.headers.set("x-pathname", pathname);

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        supabaseResponse.headers.set("x-pathname", pathname);
        const keep = request.cookies.get(REMEMBER_COOKIE)?.value !== "0";
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, forSession(options, keep))
        );
      },
    },
  });

  const { data: { session } } = await supabase.auth.getSession();

  if (!session && !isPublicRoute) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session && (pathname === "/" || isPublicRoute) && !STAY_WHEN_SIGNED_IN.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
