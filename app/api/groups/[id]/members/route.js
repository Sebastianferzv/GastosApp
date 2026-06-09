import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import sql from '@/lib/db';

export async function POST(request, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const [group] = await sql`SELECT created_by FROM groups WHERE id = ${id}`;
  if (!group || group.created_by !== session.userId)
    return NextResponse.json({ error: 'Solo el creador puede agregar miembros' }, { status: 403 });

  const { username } = await request.json();
  const [user] = await sql`SELECT id, display_name FROM users WHERE username = ${username.toLowerCase().trim()}`;
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  const [existing] = await sql`SELECT 1 FROM group_members WHERE group_id = ${id} AND user_id = ${user.id}`;
  if (existing) return NextResponse.json({ error: 'Ya es miembro del grupo' }, { status: 409 });

  await sql`INSERT INTO group_members (group_id, user_id) VALUES (${id}, ${user.id})`;
  return NextResponse.json({ success: true, displayName: user.display_name });
}

export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const [group] = await sql`SELECT created_by FROM groups WHERE id = ${id}`;
  if (!group || group.created_by !== session.userId)
    return NextResponse.json({ error: 'Solo el creador puede eliminar miembros' }, { status: 403 });

  const { userId } = await request.json();
  if (userId === session.userId) return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 400 });

  await sql`DELETE FROM group_members WHERE group_id = ${id} AND user_id = ${userId}`;
  return NextResponse.json({ success: true });
}
