import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/types'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Auth routes — redirect to dashboard if already logged in (respect ?redirect= param)
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/signup')
  if (isAuthRoute && user) {
    const redirectTo = request.nextUrl.searchParams.get('redirect') ?? '/'
    return NextResponse.redirect(new URL(redirectTo, request.url))
  }

  // Public routes that don't require a session
  const isPublicRoute =
    isAuthRoute ||
    pathname.startsWith('/landing') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/update-password') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/invite') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')

  // Protected routes — visiteur non connecté :
  //   - racine « / » → landing publique (vitrine commerciale, page d'accueil) ;
  //   - toute autre route protégée → login.
  // L'utilisateur connecté n'est jamais concerné (bloc gardé par !user) : « / »
  // continue de servir le Dashboard. Sûr, sans boucle : /landing est public.
  if (!isPublicRoute && !user) {
    const target = pathname === '/' ? '/landing' : '/login'
    return NextResponse.redirect(new URL(target, request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
