import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import sql from '@/lib/db';

export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { id } = await params;
  await sql`DELETE FROM friendships WHERE id=${id} AND (requester_id=${session.userId} OR addressee_id=${session.userId})`;
  return NextResponse.json({ success: true });
}
