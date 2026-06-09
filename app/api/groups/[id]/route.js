import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET(request, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;

  const [member] = await sql`SELECT 1 FROM group_members WHERE group_id = ${id} AND user_id = ${session.userId}`;
  if (!member) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const [group] = await sql`SELECT id, name, created_by FROM groups WHERE id = ${id}`;
  if (!group) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const members = await sql`
    SELECT u.id, u.display_name, u.username, u.avatar_url, gm.joined_at
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = ${id}
    ORDER BY gm.joined_at ASC
  `;

  return NextResponse.json({
    id: group.id,
    name: group.name,
    createdBy: group.created_by,
    members: members.map(m => ({
      id: m.id,
      displayName: m.display_name,
      username: m.username,
      avatarUrl: m.avatar_url,
    })),
  });
}
