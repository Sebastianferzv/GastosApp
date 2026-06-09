import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET(request, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const [member] = await sql`SELECT 1 FROM group_members WHERE group_id = ${id} AND user_id = ${session.userId}`;
  if (!member) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const messages = await sql`
    SELECT gm.id, gm.message, gm.created_at, gm.user_id,
           u.display_name, u.username, u.avatar_url
    FROM group_messages gm
    JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = ${id}
    ORDER BY gm.created_at ASC
    LIMIT 200
  `;

  return NextResponse.json(messages.map(m => ({
    id: m.id,
    message: m.message,
    createdAt: m.created_at,
    userId: m.user_id,
    displayName: m.display_name,
    username: m.username,
    avatarUrl: m.avatar_url,
  })));
}

export async function POST(request, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const [member] = await sql`SELECT 1 FROM group_members WHERE group_id = ${id} AND user_id = ${session.userId}`;
  if (!member) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { message } = await request.json();
  if (!message?.trim()) return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 });

  await sql`INSERT INTO group_messages (group_id, user_id, message) VALUES (${id}, ${session.userId}, ${message.trim()})`;
  return NextResponse.json({ success: true });
}
