import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const groups = await sql`
    SELECT g.id, g.name, g.created_by,
      (SELECT COUNT(*) FROM group_members gm2 WHERE gm2.group_id = g.id) as member_count,
      (SELECT m.message FROM group_messages m WHERE m.group_id = g.id ORDER BY m.created_at DESC LIMIT 1) as last_message
    FROM groups g
    JOIN group_members gm ON gm.group_id = g.id
    WHERE gm.user_id = ${session.userId}
    ORDER BY g.created_at DESC
  `;

  return NextResponse.json(groups.map(g => ({
    id: g.id,
    name: g.name,
    createdBy: g.created_by,
    memberCount: parseInt(g.member_count),
    lastMessage: g.last_message,
  })));
}

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });

  const [group] = await sql`
    INSERT INTO groups (name, created_by)
    VALUES (${name.trim()}, ${session.userId})
    RETURNING id
  `;

  await sql`INSERT INTO group_members (group_id, user_id) VALUES (${group.id}, ${session.userId})`;

  return NextResponse.json({ id: group.id });
}
