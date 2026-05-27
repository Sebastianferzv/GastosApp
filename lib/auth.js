import { cookies } from 'next/headers';
import { signToken, verifyToken } from './auth-edge';

export { signToken, verifyToken };

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('gasto_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function setTokenCookie(response, token) {
  response.cookies.set('gasto_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
}
