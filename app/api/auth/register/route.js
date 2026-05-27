import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import sql from '@/lib/db';
import { signToken } from '@/lib/auth';

export async function POST(request) {
  try {
    const { username, password, displayName } = await request.json();

    if (!username || !password || !displayName)
      return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
    if (username.length < 3)
      return NextResponse.json({ error: 'El usuario debe tener al menos 3 caracteres' }, { status: 400 });
    if (password.length < 6)
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });

    const existing = await sql`SELECT id FROM users WHERE username = ${username.toLowerCase()}`;
    if (existing.length > 0)
      return NextResponse.json({ error: 'Ese nombre de usuario ya existe' }, { status: 400 });

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await sql`
      INSERT INTO users (username, password_hash, display_name)
      VALUES (${username.toLowerCase()}, ${passwordHash}, ${displayName})
      RETURNING id, username, display_name
    `;

    const token = await signToken({ userId: user.id, username: user.username, displayName: user.display_name });
    const response = NextResponse.json({ success: true, user: { id: user.id, username: user.username, displayName: user.display_name } });
    response.cookies.set('gasto_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 604800, path: '/' });
    return response;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
