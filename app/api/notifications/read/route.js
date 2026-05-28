import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import sql from '@/lib/db';

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { ids } = await request.json();

  if (ids && ids.length > 0) {
    await sql`UPDATE notifications SET read = TRUE WHERE id = ANY(${ids}) AND user_id = ${session.userId}`;
  } else {
    await sql`UPDATE notifications SET read = TRUE WHERE user_id = ${session.userId}`;
  }

  return NextResponse.json({ success: true });
}
