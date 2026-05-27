import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import sql from '@/lib/db';

export async function PUT(request, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { id } = await params;
  const { action } = await request.json();

  const [f] = await sql`SELECT * FROM friendships WHERE id=${id} AND addressee_id=${session.userId}`;
  if (!f) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  if (action === 'accept') {
    await sql`UPDATE friendships SET status='accepted' WHERE id=${id}`;
  } else {
    await sql`DELETE FROM friendships WHERE id=${id}`;
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { id } = await params;
  await sql`DELETE FROM friendships WHERE id=${id} AND (requester_id=${session.userId} OR addressee_id=${session.userId})`;
  return NextResponse.json({ success: true });
}
