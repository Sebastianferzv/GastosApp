import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import sql from '@/lib/db';
import { signToken } from '@/lib/auth';

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    const [user] = await sql`SELECT * FROM users WHERE username = ${username.toLowerCase()}`;
    if (!user)
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });

    const token = await signToken({ userId: user.id, username: user.username, displayName: user.display_name });
    const response = NextResponse.json({ success: true, user: { id: user.id, username: user.username, displayName: user.display_name } });
    response.cookies.set('gasto_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 604800, path: '/' });
    return response;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
