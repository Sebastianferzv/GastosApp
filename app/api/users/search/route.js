import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  if (q.length < 2) return NextResponse.json([]);

  const users = await sql`
    SELECT id, username, display_name FROM users
    WHERE (username ILIKE ${'%' + q + '%'} OR display_name ILIKE ${'%' + q + '%'})
    AND id != ${session.userId}
    LIMIT 8
  `;
  return NextResponse.json(users.map(u => ({ id: u.id, username: u.username, displayName: u.display_name })));
}
