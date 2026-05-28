import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const notifications = await sql`
    SELECT n.id, n.type, n.message, n.read, n.reference_id, n.created_at,
           u.display_name as from_display_name, u.avatar_url as from_avatar_url
    FROM notifications n
    LEFT JOIN users u ON u.id = n.from_user_id
    WHERE n.user_id = ${session.userId}
    ORDER BY n.created_at DESC
    LIMIT 50
  `;

  return NextResponse.json(notifications.map(n => ({
    id: n.id,
    type: n.type,
    message: n.message,
    read: n.read,
    referenceId: n.reference_id,
    createdAt: n.created_at,
    fromDisplayName: n.from_display_name,
    fromAvatarUrl: n.from_avatar_url,
  })));
}
