import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const [user] = await sql`SELECT id, username, display_name FROM users WHERE id = ${session.userId}`;
  if (!user) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ id: user.id, username: user.username, displayName: user.display_name });
}
