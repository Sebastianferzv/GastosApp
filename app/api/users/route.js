import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const users = await sql`
    SELECT u.id, u.username, u.display_name, u.avatar_url,
      f.status as friendship_status,
      CASE WHEN f.requester_id = ${session.userId} THEN 'sent' ELSE 'received' END as direction
    FROM users u
    LEFT JOIN friendships f ON (
      (f.requester_id = ${session.userId} AND f.addressee_id = u.id) OR
      (f.requester_id = u.id AND f.addressee_id = ${session.userId})
    )
    WHERE u.id != ${session.userId}
    ORDER BY u.display_name
  `;

  return NextResponse.json(users.map(u => ({
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    avatarUrl: u.avatar_url,
    friendshipStatus: u.friendship_status || null,
    direction: u.friendship_status ? u.direction : null,
  })));
}
