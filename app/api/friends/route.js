import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const friends = await sql`
    SELECT
      f.id as friendship_id, f.status,
      u.id, u.username, u.display_name, u.avatar_url,
      CASE WHEN f.requester_id = ${session.userId} THEN 'sent' ELSE 'received' END as direction
    FROM friendships f
    JOIN users u ON u.id = CASE WHEN f.requester_id = ${session.userId} THEN f.addressee_id ELSE f.requester_id END
    WHERE f.requester_id = ${session.userId} OR f.addressee_id = ${session.userId}
    ORDER BY u.display_name
  `;

  return NextResponse.json(friends.map(f => ({
    friendshipId: f.friendship_id, status: f.status, direction: f.direction,
    userId: f.id, username: f.username, displayName: f.display_name, avatarUrl: f.avatar_url,
  })));
}

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { username } = await request.json();

  const [target] = await sql`SELECT id, display_name FROM users WHERE username = ${username.toLowerCase()}`;
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  if (target.id === session.userId) return NextResponse.json({ error: 'No puedes agregarte a ti mismo' }, { status: 400 });

  const existing = await sql`
    SELECT id FROM friendships
    WHERE (requester_id=${session.userId} AND addressee_id=${target.id})
       OR (requester_id=${target.id} AND addressee_id=${session.userId})
  `;
  if (existing.length > 0) return NextResponse.json({ error: 'Ya existe una conexión o solicitud pendiente' }, { status: 400 });

  const [f] = await sql`
    INSERT INTO friendships (requester_id, addressee_id) VALUES (${session.userId}, ${target.id}) RETURNING id
  `;

  const [requester] = await sql`SELECT display_name FROM users WHERE id = ${session.userId}`;
  await sql`
    INSERT INTO notifications (user_id, type, message, from_user_id, reference_id)
    VALUES (${target.id}, 'friend_request', ${`${requester.display_name} te envió una solicitud de amistad`}, ${session.userId}, ${f.id})
  `;

  return NextResponse.json({ success: true, friendshipId: f.id, displayName: target.display_name });
}
