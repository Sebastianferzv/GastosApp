import { NextResponse } from 'next/server';
import { verifyToken } from './lib/auth-edge';

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('gasto_token')?.value;

  const publicPaths = ['/login', '/register', '/api/auth/login', '/api/auth/register'];
  if (publicPaths.some(p => pathname.startsWith(p))) return NextResponse.next();

  if (!token) return NextResponse.redirect(new URL('/login', request.url));
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.redirect(new URL('/login', request.url));

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-192.png|icon-512.png).*)'],
};
