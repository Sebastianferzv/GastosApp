import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import sql from '@/lib/db';

export async function PUT(request, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { id } = await params;
  const { name, total, date, myShare, charges } = await request.json();

  const [exp] = await sql`SELECT id FROM expenses WHERE id = ${id} AND user_id = ${session.userId}`;
  if (!exp) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  await sql`UPDATE expenses SET name=${name}, total=${total}, date=${date}, my_share=${myShare} WHERE id=${id}`;
  await sql`DELETE FROM charges WHERE expense_id = ${id}`;

  for (const c of charges || []) {
    await sql`
      INSERT INTO charges (expense_id, person_name, person_user_id, amount, paid)
      VALUES (${id}, ${c.person}, ${c.personUserId || null}, ${c.amount}, ${c.paid || false})
    `;
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { id } = await params;

  const [exp] = await sql`SELECT id FROM expenses WHERE id = ${id} AND user_id = ${session.userId}`;
  if (!exp) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  await sql`DELETE FROM expenses WHERE id = ${id}`;
  return NextResponse.json({ success: true });
}
